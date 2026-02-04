import * as XLSX from 'xlsx';

export type ExportContext = {
  question: string;
  explanation: string;
  timeWindow?: string;
  filters?: string;
  exportedAt: string;
};

export function buildWorkbook(
  results: { sheetName: string; columns: string[]; rows: (string | number | null)[][] }[],
  context: ExportContext
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const contextSheet = XLSX.utils.aoa_to_sheet([
    ['Question', context.question],
    ['Explanation', context.explanation],
    ['Time window / filters', context.timeWindow || context.filters || '—'],
    ['Exported at', context.exportedAt],
  ]);
  XLSX.utils.book_append_sheet(wb, contextSheet, 'Context');
  for (const { sheetName, columns, rows } of results) {
    const data = [columns, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  }
  return wb;
}

export function downloadWorkbook(wb: XLSX.WorkBook, filename: string): void {
  XLSX.writeFile(wb, filename);
}
