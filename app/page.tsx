'use client';

import { useState, useCallback } from 'react';
import { buildWorkbook, downloadWorkbook, type ExportContext } from '@/lib/export-excel';

type Overview = {
  rowCount: number;
  minDate: string | null;
  maxDate: string | null;
  distinctMembers: number;
  issues: string[];
};

type QueryResult = {
  sql: string;
  explanation: string;
  intent: string;
  columns: string[];
  rows: Record<string, unknown>[];
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{ ok?: boolean; rowsLoaded?: number; error?: string } | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [question, setQuestion] = useState('');
  const [allowMemberLevel, setAllowMemberLevel] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);

  const loadOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/overview');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load overview');
      setOverview(data);
    } catch (e) {
      setOverview(null);
    }
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploadStatus(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setUploadStatus({ ok: true, rowsLoaded: data.rowsLoaded });
      loadOverview();
    } catch (e) {
      setUploadStatus({ error: e instanceof Error ? e.message : 'Upload failed' });
    }
  };

  const handleAsk = async () => {
    if (!question.trim()) return;
    setQueryLoading(true);
    setQueryResult(null);
    setQueryError(null);
    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim(), allowMemberLevel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Query failed');
      setQueryResult(data);
    } catch (e) {
      setQueryError(e instanceof Error ? e.message : 'Query failed');
    } finally {
      setQueryLoading(false);
    }
  };

  const handleExport = () => {
    if (!queryResult?.columns?.length) return;
    const rows: (string | number | null)[][] = queryResult.rows.map((r) =>
      queryResult.columns.map((c) => {
        const v = r[c];
        if (v == null) return null;
        if (typeof v === 'object') return JSON.stringify(v);
        return v as string | number;
      })
    );
    const results = [{ sheetName: 'Result', columns: queryResult.columns, rows }];
    const context: ExportContext = {
      question,
      explanation: queryResult.explanation,
      timeWindow: undefined,
      exportedAt: new Date().toISOString(),
    };
    const wb = buildWorkbook(results, context);
    downloadWorkbook(wb, `claims-query-${Date.now()}.xlsx`);
  };

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">Claims Natural Language Query POC</h1>
        <p className="text-slate-400 mt-1">Load Excel claims data, ask questions in plain English, export results.</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-slate-200">1. Load data</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-400">Excel file</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="block text-sm text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:bg-slate-700 file:text-slate-100"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setUploadStatus(null);
              }}
            />
          </label>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!file}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-500"
          >
            Upload & ingest
          </button>
          <button
            type="button"
            onClick={loadOverview}
            className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            Refresh overview
          </button>
        </div>
        {uploadStatus?.ok && (
          <p className="text-sm text-emerald-400">Loaded {uploadStatus.rowsLoaded} rows.</p>
        )}
        {uploadStatus?.error && (
          <p className="text-sm text-red-400">{uploadStatus.error}</p>
        )}
      </section>

      {overview && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium text-slate-200">Data overview</h2>
          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Rows</span>
              <div className="font-mono text-slate-200">{overview.rowCount.toLocaleString()}</div>
            </div>
            <div>
              <span className="text-slate-500">Date range</span>
              <div className="font-mono text-slate-200">
                {overview.minDate ?? '—'} to {overview.maxDate ?? '—'}
              </div>
            </div>
            <div>
              <span className="text-slate-500">Distinct members</span>
              <div className="font-mono text-slate-200">{overview.distinctMembers.toLocaleString()}</div>
            </div>
            <div>
              <span className="text-slate-500">Data quality</span>
              <div className="text-slate-300">
                {overview.issues.length ? overview.issues.join('; ') : 'No obvious issues'}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-slate-200">2. Ask a question</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="e.g. How many members exceeded $20K in the last 12 months?"
            className="flex-1 rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
          />
          <button
            type="button"
            onClick={handleAsk}
            disabled={queryLoading}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-50"
          >
            {queryLoading ? 'Running…' : 'Ask'}
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-400">
          <input
            type="checkbox"
            checked={allowMemberLevel}
            onChange={(e) => setAllowMemberLevel(e.target.checked)}
          />
          Allow member-level detail (e.g. list member IDs) — use only when needed
        </label>
      </section>

      {queryError && (
        <section>
          <p className="text-sm text-red-400">{queryError}</p>
        </section>
      )}
      {queryResult && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium text-slate-200">Result</h2>
          <p className="text-sm text-slate-400">{queryResult.explanation}</p>
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/80">
                  {queryResult.columns.map((col) => (
                    <th key={col} className="text-left py-2 px-3 font-medium text-slate-300">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queryResult.rows.map((row, i) => (
                  <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/50">
                    {queryResult.columns.map((col) => (
                      <td key={col} className="py-2 px-3 text-slate-200 font-mono">
                        {row[col] != null ? String(row[col]) : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleExport}
              className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              Export to Excel
            </button>
          </div>
        </section>
      )}

      <footer className="text-sm text-slate-500 pt-4 border-t border-slate-800">
        Default outputs are aggregate-level. Enable “Allow member-level detail” only when you need identifiers.
      </footer>
    </main>
  );
}
