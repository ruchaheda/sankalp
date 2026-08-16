const TEST_ENVIRONMENT = 'test';
const PRODUCTION_ENVIRONMENT = 'production';
const SESSIONS_SHEET_NAME = 'Sessions';

/**
 * Serves the bundled React application.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Sankalp — Practice Tracker')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Creates isolated test resources. Run this once from the Apps Script editor.
 * It deliberately refuses to run unless ENVIRONMENT is exactly "test".
 */
function setupTestResources() {
  assertTestEnvironment_();

  const properties = PropertiesService.getScriptProperties();
  const existingFormId = properties.getProperty('TEST_FORM_ID');
  const existingSpreadsheetId = properties.getProperty('TEST_SPREADSHEET_ID');
  if (existingFormId || existingSpreadsheetId) {
    throw new Error(
      'Test resources are already configured. Clear TEST_FORM_ID and ' +
      'TEST_SPREADSHEET_ID before intentionally creating another pair.'
    );
  }

  const form = FormApp.create('[TEST] Sankalp Practice Log');
  form.setDescription('Disposable test form created by the Sankalp Apps Script proof of concept.');
  form.addTextItem().setTitle('MKSM Number').setRequired(true);
  form.addTextItem().setTitle('Your First Name').setRequired(true);
  form.addTextItem().setTitle('Your Last Name').setRequired(true);
  form
    .addTextItem()
    .setTitle('Your Email')
    .setValidation(FormApp.createTextValidation().requireTextIsEmail().build())
    .setRequired(true);
  form.addTextItem().setTitle('Your Batch Name').setRequired(true);
  form.addDateItem().setTitle('Date of Practice').setRequired(true);
  form
    .addTextItem()
    .setTitle('Number of Minutes Practiced')
    .setValidation(FormApp.createTextValidation().requireNumberGreaterThanOrEqualTo(0).build())
    .setRequired(true);
  form.addTextItem().setTitle('What did you practice today? (Optional)');
  form
    .addTextItem()
    .setTitle(
      'Sankalp Word - a word that comes to your mind for this practice session. ' +
      'Optional, but highly encouraged :)'
    );

  const spreadsheet = SpreadsheetApp.create('[TEST] Sankalp Practice Sessions');
  const sheet = spreadsheet.getSheets()[0];
  sheet.setName(SESSIONS_SHEET_NAME);
  sheet.getRange('H1').setValue(form.getPublishedUrl());
  sheet.getRange(2, 1, 1, 8).setValues([[
    'Date',
    'Minutes',
    'What Practiced',
    'Sankalp',
    'Raag',
    'Omkar Time',
    'Alankar Time',
    'Form Submitted?',
  ]]);
  sheet.getRange('H3:H').insertCheckboxes();
  sheet.setFrozenRows(2);

  properties.setProperties({
    ENVIRONMENT: TEST_ENVIRONMENT,
    TEST_FORM_ID: form.getId(),
    TEST_SPREADSHEET_ID: spreadsheet.getId(),
  });

  const resources = {
    formEditUrl: form.getEditUrl(),
    formPublishedUrl: form.getPublishedUrl(),
    spreadsheetUrl: spreadsheet.getUrl(),
  };
  console.log(JSON.stringify(resources, null, 2));
  return resources;
}

/**
 * The single server entry point called by the React application.
 */
function submitPractice(session) {
  validateSession_(session);

  const environment = PropertiesService.getScriptProperties().getProperty('ENVIRONMENT');
  if (environment === PRODUCTION_ENVIRONMENT) {
    return submitProductionPractice_(session);
  }

  assertTestEnvironment_();

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  let sheet;
  let formSubmitted = false;
  let sheetSubmitted = false;
  let formStatus = 'unknown';
  try {
    const properties = PropertiesService.getScriptProperties();
    const formId = requiredProperty_(properties, 'TEST_FORM_ID');
    const spreadsheetId = requiredProperty_(properties, 'TEST_SPREADSHEET_ID');

    const response = submitTestForm_(formId, session, profileFromProperties_(properties));
    formSubmitted = true;
    formStatus = 'submitted';

    sheet = getSessionsSheet_(spreadsheetId);
    appendSessionRow_(sheet, session, true);
    sheetSubmitted = true;

    return {
      ok: true,
      duplicate: false,
      environment: TEST_ENVIRONMENT,
      submissionId: session.submissionId,
      formSubmitted: true,
      formStatus: formStatus,
      sheetSubmitted: true,
      formResponseId: response.getId(),
    };
  } catch (error) {
    if (!sheet) {
      try {
        const properties = PropertiesService.getScriptProperties();
        sheet = getSessionsSheet_(requiredProperty_(properties, 'TEST_SPREADSHEET_ID'));
        appendSessionRow_(sheet, session, '');
        sheetSubmitted = true;
      } catch (sheetError) {
        console.error(sheetError);
      }
    }
    return {
      ok: false,
      duplicate: false,
      environment: TEST_ENVIRONMENT,
      submissionId: session.submissionId,
      formSubmitted: formSubmitted,
      formStatus: formStatus,
      sheetSubmitted: sheetSubmitted,
      error: String(error && error.message ? error.message : error),
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Read-only production configuration check. This never submits the Form and
 * never writes to the spreadsheet.
 */
function checkProductionConfiguration() {
  const properties = PropertiesService.getScriptProperties();
  const formActionUrl = requiredProperty_(properties, 'PRODUCTION_FORM_ACTION_URL');
  const spreadsheetId = requiredProperty_(properties, 'PRODUCTION_SPREADSHEET_ID');
  const sheetName = requiredProperty_(properties, 'PRODUCTION_SHEET_NAME');
  profileFromProperties_(properties);

  if (!/^https:\/\/docs\.google\.com\/forms\/d\/e\/[^/]+\/formResponse$/.test(formActionUrl)) {
    throw new Error('PRODUCTION_FORM_ACTION_URL must end in /formResponse.');
  }

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error('Production spreadsheet is missing the sheet "' + sheetName + '".');
  if (sheet.getRange('H2').getDisplayValue() !== 'Form Submitted?') {
    throw new Error('Cell H2 must contain the header "Form Submitted?".');
  }
  const checkboxRule = sheet.getRange('H3').getDataValidation();
  if (!checkboxRule || checkboxRule.getCriteriaType() !== SpreadsheetApp.DataValidationCriteria.CHECKBOX) {
    throw new Error('Column H must have checkbox validation starting at H3.');
  }

  const result = {
    ok: true,
    formHost: 'docs.google.com',
    spreadsheetName: spreadsheet.getName(),
    sheetName: sheet.getName(),
    productionEnabled: properties.getProperty('PRODUCTION_SUBMISSIONS_ENABLED') === 'true',
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

/** Sends one harmless test email without touching either production resource. */
function sendTestAlertEmail() {
  const properties = PropertiesService.getScriptProperties();
  const profile = profileFromProperties_(properties);
  const recipient = properties.getProperty('ALERT_EMAIL') || profile.email;
  MailApp.sendEmail({
    to: recipient,
    subject: '[TEST] Sankalp spreadsheet failure alert',
    body: 'This is a test of the Sankalp spreadsheet-failure email. No Form response or spreadsheet row was created.',
  });
  console.log('Test alert sent to ' + recipient);
  return { ok: true, recipient: recipient };
}

function submitProductionPractice_(session) {
  const properties = PropertiesService.getScriptProperties();
  if (properties.getProperty('PRODUCTION_SUBMISSIONS_ENABLED') !== 'true') {
    throw new Error('Safety stop: production submissions are not enabled.');
  }

  const formActionUrl = requiredProperty_(properties, 'PRODUCTION_FORM_ACTION_URL');
  const spreadsheetId = requiredProperty_(properties, 'PRODUCTION_SPREADSHEET_ID');
  const sheetName = requiredProperty_(properties, 'PRODUCTION_SHEET_NAME');
  const profile = profileFromProperties_(properties);
  const formOutcome = submitPublicProductionForm_(formActionUrl, session, profile);
  const formSubmitted = formOutcome.status === 'submitted';
  const checkboxValue = formSubmitted ? true : formOutcome.status === 'failed' ? false : '';
  let sheetSubmitted = false;

  try {
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sessionsSheet = spreadsheet.getSheetByName(sheetName);
    if (!sessionsSheet) throw new Error('Production spreadsheet is missing the sheet "' + sheetName + '".');

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      appendSessionRow_(sessionsSheet, session, checkboxValue);
    } finally {
      lock.releaseLock();
    }
    sheetSubmitted = true;

    return {
      ok: formSubmitted,
      duplicate: false,
      environment: PRODUCTION_ENVIRONMENT,
      submissionId: session.submissionId,
      formSubmitted: formSubmitted,
      formStatus: formOutcome.status,
      sheetSubmitted: true,
      error: formOutcome.error || '',
    };
  } catch (error) {
    const sheetError = String(error && error.message ? error.message : error);
    const alertEmailSent = sendSpreadsheetFailureEmail_(properties, profile, session, formOutcome, sheetError);
    return {
      ok: false,
      duplicate: false,
      environment: PRODUCTION_ENVIRONMENT,
      submissionId: session.submissionId,
      formSubmitted: formSubmitted,
      formStatus: formOutcome.status,
      sheetSubmitted: sheetSubmitted,
      alertEmailSent: alertEmailSent,
      error: sheetError,
    };
  }
}

function submitPublicProductionForm_(formActionUrl, session, profile) {
  const dateParts = session.date.split('-');
  const payload = {
    'entry.1742760532': profile.mksmNumber,
    'entry.1992748701': profile.firstName,
    'entry.1182588695': profile.lastName,
    'entry.1838437624': profile.email,
    'entry.2040019182': profile.batchName,
    'entry.737772668_year': dateParts[0],
    'entry.737772668_month': dateParts[1],
    'entry.737772668_day': dateParts[2],
    'entry.1586397793': String(session.minutes),
    'entry.193868850': session.whatPracticed || '',
    'entry.1865891008': session.sankalp || '',
  };

  try {
    const response = UrlFetchApp.fetch(formActionUrl, {
      method: 'post',
      payload: payload,
      followRedirects: false,
      muteHttpExceptions: true,
    });
    const statusCode = response.getResponseCode();
    if (statusCode >= 200 && statusCode < 400) {
      return { status: 'submitted', httpStatus: statusCode, error: '' };
    }
    return {
      status: 'failed',
      httpStatus: statusCode,
      error: 'Production Form rejected the submission with HTTP ' + statusCode + '.',
    };
  } catch (error) {
    return {
      status: 'unknown',
      httpStatus: '',
      error: String(error && error.message ? error.message : error),
    };
  }
}

function appendSessionRow_(sheet, session, formSubmittedValue) {
  const firstDataRow = 3;
  const availableRows = Math.max(sheet.getMaxRows() - firstDataRow + 1, 0);
  let targetRow = firstDataRow;

  if (availableRows > 0) {
    const dateValues = sheet.getRange(firstDataRow, 1, availableRows, 1).getValues();
    const firstEmptyOffset = dateValues.findIndex(function (row) {
      return row[0] === '' || row[0] === null;
    });
    targetRow = firstEmptyOffset === -1
      ? sheet.getMaxRows() + 1
      : firstDataRow + firstEmptyOffset;
  }

  if (targetRow > sheet.getMaxRows()) {
    sheet.insertRowAfter(sheet.getMaxRows());
  }
  sheet.getRange(targetRow, 1, 1, 8).setValues([[
    session.date,
    Number(session.minutes),
    session.whatPracticed || '',
    session.sankalp || '',
    session.raag || '',
    numericOrBlank_(session.omkarTime),
    numericOrBlank_(session.alankarTime),
    formSubmittedValue,
  ]]);
}

function sendSpreadsheetFailureEmail_(properties, profile, session, formOutcome, sheetError) {
  const recipient = properties.getProperty('ALERT_EMAIL') || profile.email;
  const checkboxInstruction = formOutcome.status === 'submitted'
    ? 'checked (the Form submission succeeded)'
    : formOutcome.status === 'failed'
      ? 'unchecked (the Form submission failed)'
      : 'blank (the Form outcome is unknown)';
  const body = [
    'The Sankalp spreadsheet was not updated.',
    '',
    'Form status: ' + formOutcome.status,
    'Form HTTP status: ' + (formOutcome.httpStatus || 'unknown'),
    'Spreadsheet error: ' + sheetError,
    '',
    'Date: ' + session.date,
    'Minutes: ' + session.minutes,
    'What practiced: ' + (session.whatPracticed || ''),
    'Sankalp: ' + (session.sankalp || ''),
    'Raag: ' + (session.raag || ''),
    'Omkar time: ' + (session.omkarTime || ''),
    'Alankar time: ' + (session.alankarTime || ''),
    'Attempted at: ' + new Date().toISOString(),
    '',
    'Action required:',
    'Add this row to the spreadsheet manually and set Form Submitted? to ' + checkboxInstruction + '.',
  ].join('\n');

  try {
    MailApp.sendEmail({
      to: recipient,
      subject: 'Sankalp alert: spreadsheet was not updated',
      body: body,
    });
    return true;
  } catch (emailError) {
    console.error('Spreadsheet failure email could not be sent: ' + emailError);
    return false;
  }
}

function submitTestForm_(formId, session, profile) {
  const form = FormApp.openById(formId);
  const itemsByTitle = {};
  form.getItems().forEach(function (item) {
    itemsByTitle[item.getTitle()] = item;
  });

  const response = form.createResponse();
  addTextResponse_(response, itemsByTitle, 'MKSM Number', profile.mksmNumber);
  addTextResponse_(response, itemsByTitle, 'Your First Name', profile.firstName);
  addTextResponse_(response, itemsByTitle, 'Your Last Name', profile.lastName);
  addTextResponse_(response, itemsByTitle, 'Your Email', profile.email);
  addTextResponse_(response, itemsByTitle, 'Your Batch Name', profile.batchName);

  const dateItem = requiredItem_(itemsByTitle, 'Date of Practice').asDateItem();
  response.withItemResponse(dateItem.createResponse(dateFromIso_(session.date)));

  addTextResponse_(response, itemsByTitle, 'Number of Minutes Practiced', session.minutes);
  addTextResponse_(
    response,
    itemsByTitle,
    'What did you practice today? (Optional)',
    session.whatPracticed || ''
  );
  addTextResponse_(
    response,
    itemsByTitle,
    'Sankalp Word - a word that comes to your mind for this practice session. ' +
      'Optional, but highly encouraged :)',
    session.sankalp || ''
  );

  return response.submit();
}

function addTextResponse_(response, itemsByTitle, title, value) {
  const item = requiredItem_(itemsByTitle, title).asTextItem();
  response.withItemResponse(item.createResponse(String(value || '')));
}

function requiredItem_(itemsByTitle, title) {
  const item = itemsByTitle[title];
  if (!item) {
    throw new Error('Test Form is missing the item "' + title + '".');
  }
  return item;
}

function getSessionsSheet_(spreadsheetId) {
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(SESSIONS_SHEET_NAME);
  if (!sheet) {
    throw new Error('Test spreadsheet is missing the "' + SESSIONS_SHEET_NAME + '" sheet.');
  }
  return sheet;
}

function profileFromProperties_(properties) {
  return {
    mksmNumber: requiredProperty_(properties, 'PROFILE_MKSM_NUMBER'),
    firstName: requiredProperty_(properties, 'PROFILE_FIRST_NAME'),
    lastName: requiredProperty_(properties, 'PROFILE_LAST_NAME'),
    email: requiredProperty_(properties, 'PROFILE_EMAIL'),
    batchName: requiredProperty_(properties, 'PROFILE_BATCH_NAME'),
  };
}

function requiredProperty_(properties, name) {
  const value = properties.getProperty(name);
  if (!value) throw new Error('Missing Apps Script property: ' + name);
  return value;
}

function validateSession_(session) {
  if (!session || typeof session !== 'object') throw new Error('Missing practice session.');
  if (!/^[0-9a-f-]{36}$/i.test(String(session.submissionId || ''))) {
    throw new Error('Invalid submission ID.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(session.date || ''))) {
    throw new Error('Date must use YYYY-MM-DD.');
  }
  const minutes = Number(session.minutes);
  if (!Number.isFinite(minutes) || minutes < 0) {
    throw new Error('Minutes must be a non-negative number.');
  }
}

function dateFromIso_(value) {
  const parts = value.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function numericOrBlank_(value) {
  if (value === '' || value === null || value === undefined) return '';
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error('Optional times must be non-negative numbers.');
  return number;
}

function assertTestEnvironment_() {
  const environment = PropertiesService.getScriptProperties().getProperty('ENVIRONMENT');
  if (environment !== TEST_ENVIRONMENT) {
    throw new Error('Safety stop: ENVIRONMENT must be exactly "test".');
  }
}
