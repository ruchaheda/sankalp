import { useState } from 'react';
import { AlertCircle, CheckCircle, Loader, RefreshCw } from 'lucide-react';
import {
  previewBackfill,
  submitBackfillRow,
  type BackfillPreview,
  type BackfillRow,
  type BackfillRowResult,
} from './appsScriptClient';

export default function BackfillView() {
  const [preview, setPreview] = useState<BackfillPreview | null>(null);
  const [results, setResults] = useState<Record<number, BackfillRowResult>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const rowsToSubmit = (preview?.eligible || []).filter(row => !results[row.rowNumber]);

  const loadPreview = async () => {
    setLoading(true);
    setError('');
    setResults({});
    try {
      const nextPreview = await previewBackfill();
      setPreview(nextPreview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load backfill rows.');
    } finally {
      setLoading(false);
    }
  };

  const submitAll = async () => {
    if (!rowsToSubmit.length || !preview) return;
    const environmentLabel = preview.environment === 'production' ? 'production' : 'test';
    const confirmed = window.confirm(
      `Submit all ${rowsToSubmit.length} unsubmitted ${environmentLabel} Form ` +
      `response${rowsToSubmit.length === 1 ? '' : 's'}? This cannot be automatically undone.`,
    );
    if (!confirmed) return;

    setSubmitting(true);
    setError('');
    const nextResults: Record<number, BackfillRowResult> = {};
    for (const row of rowsToSubmit) {
      try {
        nextResults[row.rowNumber] = await submitBackfillRow(row);
      } catch (err) {
        nextResults[row.rowNumber] = {
          rowNumber: row.rowNumber,
          status: 'unknown',
          message: err instanceof Error ? err.message : 'Unexpected submission error.',
        };
        setResults({ ...nextResults });
        break;
      }
      setResults({ ...nextResults });
      if (nextResults[row.rowNumber].status === 'unknown' ||
          nextResults[row.rowNumber].status === 'sheet_update_failed') {
        break;
      }
    }
    setSubmitting(false);
  };

  const statusLabel = (result?: BackfillRowResult) => {
    if (!result) return '';
    if (result.status === 'submitted') return 'Submitted';
    if (result.status === 'failed') return 'Failed — remains unchecked';
    if (result.status === 'unknown') return 'Unknown — checkbox cleared';
    if (result.status === 'skipped') return 'Skipped';
    return 'Form submitted, but checkbox update failed';
  };

  const completedResults = Object.values(results);
  const submittedCount = completedResults.filter(result => result.status === 'submitted').length;
  const failedCount = completedResults.filter(result => result.status === 'failed').length;
  const reviewCount = completedResults.filter(result =>
    result.status === 'unknown' || result.status === 'sheet_update_failed',
  ).length;

  return (
    <div className="backdrop-blur-sm rounded-2xl p-6 shadow-lg" style={{ background: 'rgba(255,255,255,.65)' }}>
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-[#5A4A6B]">Backfill Missing Form Entries</h2>
          <p className="text-sm text-[#5A4A6B] opacity-75 mt-1">
            Scans the spreadsheet for every dated row whose Form Submitted? value is explicitly unchecked.
          </p>
        </div>
        {preview && (
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            preview.environment === 'production' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {preview.environment.toUpperCase()}
          </span>
        )}
      </div>

      <div className="flex justify-end mb-5">
        <button onClick={loadPreview} disabled={loading || submitting}
          className="px-4 py-2 rounded-lg text-white font-bold bg-[#9D6FD9] disabled:opacity-50">
          {loading ? <span className="flex justify-center gap-2"><Loader className="w-4 h-4 animate-spin" /> Loading</span>
            : <span className="flex justify-center gap-2"><RefreshCw className="w-4 h-4" /> Find unsubmitted rows</span>}
        </button>
      </div>

      {error && <div className="p-3 mb-4 rounded-lg bg-red-100 text-red-700">{error}</div>}

      {preview && (
        <>
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap text-sm text-[#5A4A6B]">
            <span>{preview.eligible.length} eligible · {preview.invalid.length} invalid</span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-purple-100">
            <table className="w-full text-sm bg-white">
              <thead className="bg-purple-50 text-[#5A4A6B]">
                <tr>
                  <th className="p-3 text-left">Row</th>
                  <th className="p-3 text-left">Date</th><th className="p-3 text-left">Minutes</th>
                  <th className="p-3 text-left">Practice</th><th className="p-3 text-left">Result</th>
                </tr>
              </thead>
              <tbody>
                {preview.eligible.map((row: BackfillRow) => {
                  const result = results[row.rowNumber];
                  return (
                    <tr key={row.rowNumber} className="border-t border-purple-50">
                      <td className="p-3">{row.rowNumber}</td><td className="p-3 whitespace-nowrap">{row.date}</td>
                      <td className="p-3">{row.minutes}</td>
                      <td className="p-3 min-w-48">{row.whatPracticed || row.raag || '—'}</td>
                      <td className="p-3 min-w-52">
                        {result && <span className={result.status === 'submitted' ? 'text-green-700' : 'text-red-700'}>
                          {result.status === 'submitted'
                            ? <CheckCircle className="w-4 h-4 inline mr-1" />
                            : <AlertCircle className="w-4 h-4 inline mr-1" />}
                          {statusLabel(result)}{result.message ? ` — ${result.message}` : ''}
                        </span>}
                      </td>
                    </tr>
                  );
                })}
                {!preview.eligible.length && (
                  <tr><td colSpan={5} className="p-8 text-center text-[#5A4A6B] opacity-70">
                    No explicitly unchecked rows found.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {preview.invalid.length > 0 && (
            <details className="mt-4 text-sm text-red-700">
              <summary className="cursor-pointer font-semibold">Show invalid rows</summary>
              <ul className="mt-2 space-y-1">
                {preview.invalid.map(item => <li key={item.rowNumber}>Row {item.rowNumber}: {item.error}</li>)}
              </ul>
            </details>
          )}

          <div className="mt-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="text-sm text-[#5A4A6B]">
              {completedResults.length > 0 && `${submittedCount} submitted · ${failedCount} failed · ${reviewCount} need review`}
            </div>
            <button onClick={submitAll} disabled={!rowsToSubmit.length || submitting}
              className="px-5 py-2 rounded-lg text-white font-bold bg-[#FF69B4] disabled:opacity-50">
              {submitting ? <span className="flex gap-2"><Loader className="w-4 h-4 animate-spin" /> Processing</span>
                : `Submit all ${rowsToSubmit.length} unsubmitted`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
