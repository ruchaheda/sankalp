import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  appendToGoogleSheetWithToken,
  buildGoogleFormPayload,
  submitGoogleForm,
  type GoogleConfig,
  type Session,
} from './googleSubmission';

const config: GoogleConfig = {
  clientId: 'client-id',
  spreadsheetId: 'spreadsheet-id',
  sheetRange: '2025-2026!A:G',
  formActionUrl: 'https://docs.google.com/forms/d/e/form-id/formResponse',
  formProfile: {
    mksmNumber: '90955',
    firstName: 'Rucha',
    lastName: 'Heda',
    email: 'raheda@gmail.com',
    batchName: 'Tol Bhairav',
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

const session: Session = {
  date: '2026-07-15',
  minutes: '45',
  whatPracticed: 'Yaman alankars',
  sankalp: 'steadiness',
  raag: 'Yaman',
  omkarTime: '10',
  alankarTime: '20',
  loggedAt: '2026-07-15T12:00:00.000Z',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Google submission helpers', () => {
  it('appends the expected row to Google Sheets without touching the live API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
    });
    vi.stubGlobal('fetch', fetchMock);

    await appendToGoogleSheetWithToken(config, session, 'fake-access-token');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://sheets.googleapis.com/v4/spreadsheets/spreadsheet-id/values/2025-2026!A%3AG:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS',
    );
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer fake-access-token',
        'Content-Type': 'application/json',
      },
    });
    expect(JSON.parse(init.body)).toEqual({
      values: [['2026-07-15', '45', 'Yaman alankars', 'steadiness', 'Yaman', '10', '20']],
    });
  });

  it('builds the expected Google Form entry payload', () => {
    const payload = buildGoogleFormPayload(config, session);

    expect(Object.fromEntries(payload.entries())).toEqual({
      'entry.1742760532': '90955',
      'entry.1992748701': 'Rucha',
      'entry.1182588695': 'Heda',
      'entry.1838437624': 'raheda@gmail.com',
      'entry.2040019182': 'Tol Bhairav',
      'entry.737772668_year': '2026',
      'entry.737772668_month': '07',
      'entry.737772668_day': '15',
      'entry.1586397793': '45',
      'entry.193868850': 'Yaman alankars',
      'entry.1865891008': 'steadiness',
    });
  });

  it('posts the Google Form payload with no-cors without touching the live form', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await submitGoogleForm(config, session);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(config.formActionUrl);
    expect(init.method).toBe('POST');
    expect(init.mode).toBe('no-cors');
    expect(Object.fromEntries(init.body.entries())).toMatchObject({
      'entry.1586397793': '45',
      'entry.193868850': 'Yaman alankars',
      'entry.1865891008': 'steadiness',
    });
  });
});
