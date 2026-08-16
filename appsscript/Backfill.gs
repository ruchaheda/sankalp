const BACKFILL_FIRST_DATA_ROW = 3;

/**
 * Returns rows that have a date in column A and an explicit FALSE checkbox in H.
 * This function is read-only and never submits the Form.
 */
function previewBackfill() {
  const context = getBackfillContext_();
  const sheet = context.sheet;
  const lastRow = findLastBackfillDataRow_(sheet);
  if (lastRow < BACKFILL_FIRST_DATA_ROW) {
    return { environment: context.environment, eligible: [], invalid: [] };
  }

  const rowCount = lastRow - BACKFILL_FIRST_DATA_ROW + 1;
  const values = sheet.getRange(BACKFILL_FIRST_DATA_ROW, 1, rowCount, 8).getValues();
  const eligible = [];
  const invalid = [];

  values.forEach(function (row, offset) {
    const rowNumber = BACKFILL_FIRST_DATA_ROW + offset;
    if (isBlankBackfillRow_(row)) return;
    if (row[7] !== false) return;

    try {
      const session = sessionFromBackfillRow_(row);
      validateSessionForBackfill_(session);
      eligible.push({
        rowNumber: rowNumber,
        date: session.date,
        minutes: session.minutes,
        whatPracticed: session.whatPracticed,
        sankalp: session.sankalp,
        raag: session.raag,
        omkarTime: session.omkarTime,
        alankarTime: session.alankarTime,
        fingerprint: createBackfillFingerprint_(rowNumber, session),
      });
    } catch (error) {
      invalid.push({
        rowNumber: rowNumber,
        error: String(error && error.message ? error.message : error),
      });
    }
  });

  return {
    environment: context.environment,
    eligible: eligible,
    invalid: invalid,
  };
}

/**
 * Submits exactly one previously previewed row and updates only its H checkbox.
 */
function submitBackfillRow(request) {
  if (!request || !Number.isInteger(Number(request.rowNumber))) {
    throw new Error('Missing backfill row number.');
  }
  const rowNumber = Number(request.rowNumber);
  if (rowNumber < BACKFILL_FIRST_DATA_ROW) throw new Error('Invalid backfill row number.');

  const context = getBackfillContext_();
  if (context.environment === PRODUCTION_ENVIRONMENT &&
      context.properties.getProperty('PRODUCTION_SUBMISSIONS_ENABLED') !== 'true') {
    throw new Error('Safety stop: production submissions are not enabled.');
  }
  const row = context.sheet.getRange(rowNumber, 1, 1, 8).getValues()[0];
  if (row[7] !== false) {
    return {
      rowNumber: rowNumber,
      status: 'skipped',
      message: 'Form Submitted? is no longer explicitly unchecked.',
    };
  }

  const session = sessionFromBackfillRow_(row);
  validateSessionForBackfill_(session);
  const currentFingerprint = createBackfillFingerprint_(rowNumber, session);
  if (currentFingerprint !== String(request.fingerprint || '')) {
    return {
      rowNumber: rowNumber,
      status: 'skipped',
      message: 'The spreadsheet row changed after preview. Preview again before submitting.',
    };
  }

  const formOutcome = submitBackfillForm_(context, session);
  let checkboxUpdated = false;
  try {
    const checkbox = context.sheet.getRange(rowNumber, 8);
    if (formOutcome.status === 'submitted') {
      checkbox.setValue(true);
    } else if (formOutcome.status === 'unknown') {
      checkbox.clearContent();
    }
    checkboxUpdated = true;
  } catch (sheetError) {
    if (context.environment === PRODUCTION_ENVIRONMENT) {
      sendSpreadsheetFailureEmail_(
        context.properties,
        context.profile,
        session,
        formOutcome,
        'Could not update Form Submitted? for spreadsheet row ' + rowNumber + ': ' + sheetError
      );
    }
    return {
      rowNumber: rowNumber,
      status: 'sheet_update_failed',
      formStatus: formOutcome.status,
      message: String(sheetError && sheetError.message ? sheetError.message : sheetError),
    };
  }

  return {
    rowNumber: rowNumber,
    status: formOutcome.status,
    formStatus: formOutcome.status,
    checkboxUpdated: checkboxUpdated,
    message: formOutcome.error || '',
  };
}

function getBackfillContext_() {
  const properties = PropertiesService.getScriptProperties();
  const environment = properties.getProperty('ENVIRONMENT');
  const profile = profileFromProperties_(properties);

  if (environment === PRODUCTION_ENVIRONMENT) {
    const spreadsheet = SpreadsheetApp.openById(
      requiredProperty_(properties, 'PRODUCTION_SPREADSHEET_ID')
    );
    const sheetName = requiredProperty_(properties, 'PRODUCTION_SHEET_NAME');
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) throw new Error('Production spreadsheet is missing the sheet "' + sheetName + '".');
    return {
      environment: environment,
      properties: properties,
      profile: profile,
      sheet: sheet,
      formActionUrl: requiredProperty_(properties, 'PRODUCTION_FORM_ACTION_URL'),
    };
  }

  assertTestEnvironment_();
  return {
    environment: TEST_ENVIRONMENT,
    properties: properties,
    profile: profile,
    sheet: getSessionsSheet_(requiredProperty_(properties, 'TEST_SPREADSHEET_ID')),
    formId: requiredProperty_(properties, 'TEST_FORM_ID'),
  };
}

function submitBackfillForm_(context, session) {
  if (context.environment === PRODUCTION_ENVIRONMENT) {
    return submitPublicProductionForm_(context.formActionUrl, session, context.profile);
  }

  try {
    const response = submitTestForm_(context.formId, session, context.profile);
    return { status: 'submitted', httpStatus: 200, error: '', responseId: response.getId() };
  } catch (error) {
    return {
      status: 'unknown',
      httpStatus: '',
      error: String(error && error.message ? error.message : error),
    };
  }
}

function sessionFromBackfillRow_(row) {
  return {
    date: normalizeBackfillDate_(row[0]),
    minutes: row[1] === '' || row[1] === null ? '' : String(row[1]),
    whatPracticed: String(row[2] || ''),
    sankalp: String(row[3] || ''),
    raag: String(row[4] || ''),
    omkarTime: row[5] === '' || row[5] === null ? '' : String(row[5]),
    alankarTime: row[6] === '' || row[6] === null ? '' : String(row[6]),
  };
}

function normalizeBackfillDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );
  }
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  throw new Error('Date must be a valid date or use YYYY-MM-DD.');
}

function validateSessionForBackfill_(session) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(session.date)) throw new Error('Invalid date.');
  const minutes = Number(session.minutes);
  if (!Number.isFinite(minutes) || minutes < 0) {
    throw new Error('Minutes must be a non-negative number.');
  }
  numericOrBlank_(session.omkarTime);
  numericOrBlank_(session.alankarTime);
}

function createBackfillFingerprint_(rowNumber, session) {
  const source = [
    rowNumber,
    session.date,
    session.minutes,
    session.whatPracticed,
    session.sankalp,
    session.raag,
    session.omkarTime,
    session.alankarTime,
  ].join('\u001f');
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, source)
    .map(function (byte) {
      const value = byte < 0 ? byte + 256 : byte;
      return ('0' + value.toString(16)).slice(-2);
    })
    .join('');
}

function findLastBackfillDataRow_(sheet) {
  return sheet
    .getRange(sheet.getMaxRows(), 1)
    .getNextDataCell(SpreadsheetApp.Direction.UP)
    .getRow();
}

function isBlankBackfillRow_(row) {
  return row.slice(0, 7).every(function (value) {
    return value === '' || value === null;
  });
}
