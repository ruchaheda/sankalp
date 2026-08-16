import type { Session } from './googleSubmission';

export interface AppsScriptSession extends Session {
  submissionId: string;
}

export interface SubmissionResult {
  ok: boolean;
  duplicate: boolean;
  environment?: 'test' | 'production';
  submissionId: string;
  formSubmitted: boolean;
  formStatus?: 'submitted' | 'failed' | 'unknown';
  sheetSubmitted: boolean;
  alertEmailSent?: boolean;
  status?: string;
  formResponseId?: string;
  error?: string;
}

export interface BackfillRow {
  rowNumber: number;
  date: string;
  minutes: string;
  whatPracticed: string;
  sankalp: string;
  raag: string;
  omkarTime: string;
  alankarTime: string;
  fingerprint: string;
}

export interface BackfillPreview {
  environment: 'test' | 'production';
  eligible: BackfillRow[];
  invalid: Array<{ rowNumber: number; error: string }>;
  truncated?: boolean;
}

export interface BackfillRowResult {
  rowNumber: number;
  status: 'submitted' | 'failed' | 'unknown' | 'skipped' | 'sheet_update_failed';
  formStatus?: 'submitted' | 'failed' | 'unknown';
  message?: string;
}

interface GoogleScriptRunner {
  withSuccessHandler: (handler: (result: any) => void) => GoogleScriptRunner;
  withFailureHandler: (handler: (error: { message?: string } | string) => void) => GoogleScriptRunner;
  submitPractice: (session: AppsScriptSession) => void;
  previewBackfill: () => void;
  submitBackfillRow: (request: { rowNumber: number; fingerprint: string }) => void;
}

type AppsScriptWindow = Window & {
  google?: {
    script?: {
      run: GoogleScriptRunner;
    };
  };
};

const getRunner = () => (window as AppsScriptWindow).google?.script?.run;

export const isAppsScriptHosted = () => Boolean(getRunner());

export const submitPractice = (session: AppsScriptSession) =>
  new Promise<SubmissionResult>((resolve, reject) => {
    const runner = getRunner();
    if (!runner) {
      reject(new Error('This build must be opened from its Apps Script web app URL.'));
      return;
    }

    runner
      .withSuccessHandler(resolve)
      .withFailureHandler((error) => {
        const message = typeof error === 'string' ? error : error?.message;
        reject(new Error(message || 'Apps Script submission failed.'));
      })
      .submitPractice(session);
  });

export const previewBackfill = () =>
  new Promise<BackfillPreview>((resolve, reject) => {
    const runner = getRunner();
    if (!runner) {
      reject(new Error('This build must be opened from its Apps Script web app URL.'));
      return;
    }
    runner
      .withSuccessHandler(resolve)
      .withFailureHandler((error) => {
        const message = typeof error === 'string' ? error : error?.message;
        reject(new Error(message || 'Could not preview backfill rows.'));
      })
      .previewBackfill();
  });

export const submitBackfillRow = (row: BackfillRow) =>
  new Promise<BackfillRowResult>((resolve, reject) => {
    const runner = getRunner();
    if (!runner) {
      reject(new Error('This build must be opened from its Apps Script web app URL.'));
      return;
    }
    runner
      .withSuccessHandler(resolve)
      .withFailureHandler((error) => {
        const message = typeof error === 'string' ? error : error?.message;
        reject(new Error(message || `Could not submit spreadsheet row ${row.rowNumber}.`));
      })
      .submitBackfillRow({ rowNumber: row.rowNumber, fingerprint: row.fingerprint });
  });
