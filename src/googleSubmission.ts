export const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
export const GOOGLE_IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client';

export interface FormData {
  date: string;
  minutes: string;
  whatPracticed: string;
  sankalp: string;
  raag: string;
  omkarTime: string;
  alankarTime: string;
}

export interface Session extends FormData {
  loggedAt?: string;
}

export interface GoogleConfig {
  clientId: string;
  spreadsheetId: string;
  sheetRange: string;
  formActionUrl: string;
  formProfile: {
    mksmNumber: string;
    firstName: string;
    lastName: string;
    email: string;
    batchName: string;
  };
  formFields: {
    mksmNumber: string;
    firstName: string;
    lastName: string;
    email: string;
    batchName: string;
    dateYear: string;
    dateMonth: string;
    dateDay: string;
    minutes: string;
    whatPracticed: string;
    sankalp: string;
  };
}

export interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GoogleTokenResponse) => void;
          }) => GoogleTokenClient;
        };
      };
    };
  }
}

export const googleConfig: GoogleConfig = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  spreadsheetId: import.meta.env.VITE_GOOGLE_SPREADSHEET_ID || '',
  sheetRange: import.meta.env.VITE_GOOGLE_SHEET_RANGE || 'Sessions!A:G',
  formActionUrl: import.meta.env.VITE_GOOGLE_FORM_ACTION_URL || '',
  formProfile: {
    mksmNumber: import.meta.env.VITE_GOOGLE_FORM_MKSM_NUMBER || '',
    firstName: import.meta.env.VITE_GOOGLE_FORM_FIRST_NAME || '',
    lastName: import.meta.env.VITE_GOOGLE_FORM_LAST_NAME || '',
    email: import.meta.env.VITE_GOOGLE_FORM_EMAIL || '',
    batchName: import.meta.env.VITE_GOOGLE_FORM_BATCH_NAME || '',
  },
  formFields: {
    mksmNumber: 'entry.1742760532',
    firstName: 'entry.1992748701',
    lastName: 'entry.1182588695',
    email: 'entry.1838437624',
    batchName: 'entry.2040019182',
    dateYear: 'entry.737772668_year',
    dateMonth: 'entry.737772668_month',
    dateDay: 'entry.737772668_day',
    minutes: 'entry.1586397793',
    whatPracticed: 'entry.193868850',
    sankalp: 'entry.1865891008',
  },
};

export const toSheetRow = (session: Session) => [
  session.date,
  session.minutes,
  session.whatPracticed,
  session.sankalp,
  session.raag,
  session.omkarTime,
  session.alankarTime,
];

export const buildSheetsAppendRequest = (config: GoogleConfig, session: Session, accessToken: string) => {
  const encodedRange = encodeURIComponent(config.sheetRange);
  return {
    url: `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${encodedRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    init: {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [toSheetRow(session)] }),
    },
  };
};

export const buildGoogleFormPayload = (config: GoogleConfig, session: Session) => {
  const [dateYear = '', dateMonth = '', dateDay = ''] = session.date.split('-');
  const valuesByKey: Record<keyof GoogleConfig['formFields'], string> = {
    mksmNumber: config.formProfile.mksmNumber,
    firstName: config.formProfile.firstName,
    lastName: config.formProfile.lastName,
    email: config.formProfile.email,
    batchName: config.formProfile.batchName,
    dateYear,
    dateMonth,
    dateDay,
    minutes: session.minutes,
    whatPracticed: session.whatPracticed,
    sankalp: session.sankalp,
  };

  const payload = new FormData();
  Object.entries(config.formFields).forEach(([key, entryId]) => {
    if (entryId) payload.append(entryId, valuesByKey[key as keyof GoogleConfig['formFields']] || '');
  });
  return payload;
};

export const loadGoogleIdentity = () =>
  new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_IDENTITY_SCRIPT}"]`);
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = GOOGLE_IDENTITY_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });

export const getSheetsAccessToken = async (config: GoogleConfig) => {
  if (!config.clientId) {
    throw new Error('Missing VITE_GOOGLE_CLIENT_ID');
  }

  await loadGoogleIdentity();

  return new Promise<string>((resolve, reject) => {
    const client = window.google?.accounts.oauth2.initTokenClient({
      client_id: config.clientId,
      scope: SHEETS_SCOPE,
      callback: (response) => {
        if (response.access_token) {
          resolve(response.access_token);
          return;
        }
        reject(new Error(response.error_description || response.error || 'Google authorization failed'));
      },
    });

    if (!client) {
      reject(new Error('Google Identity Services is unavailable'));
      return;
    }

    client.requestAccessToken({ prompt: '' });
  });
};

export const appendToGoogleSheet = async (config: GoogleConfig, session: Session) => {
  if (!config.spreadsheetId) {
    throw new Error('Missing VITE_GOOGLE_SPREADSHEET_ID');
  }

  const accessToken = await getSheetsAccessToken(config);
  await appendToGoogleSheetWithToken(config, session, accessToken);
};

export const appendToGoogleSheetWithToken = async (config: GoogleConfig, session: Session, accessToken: string) => {
  if (!config.spreadsheetId) {
    throw new Error('Missing VITE_GOOGLE_SPREADSHEET_ID');
  }

  const request = buildSheetsAppendRequest(config, session, accessToken);
  const response = await fetch(request.url, request.init);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Google Sheets append failed');
  }
};

export const submitGoogleForm = async (config: GoogleConfig, session: Session) => {
  if (!config.formActionUrl) {
    throw new Error('Missing VITE_GOOGLE_FORM_ACTION_URL');
  }

  const payload = buildGoogleFormPayload(config, session);
  if (Array.from(payload.keys()).length === 0) {
    throw new Error('Missing Google Form field ids');
  }

  await fetch(config.formActionUrl, {
    method: 'POST',
    mode: 'no-cors',
    body: payload,
  });
};
