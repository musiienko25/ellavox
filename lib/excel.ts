import * as XLSX from 'xlsx';

export type ColumnMapping = {
  member_id?: string;
  claim_id?: string;
  service_date?: string;
  allowed_amt?: string;
  paid_amt?: string;
  member_resp_amt?: string;
  claim_type?: string;
};

const COMMON_ALIASES: Record<string, string[]> = {
  member_id: ['member id', 'memberid', 'member', 'subscriber', 'patient', 'member_id'],
  claim_id: ['claim id', 'claimid', 'claim', 'claim_id', 'claim number'],
  service_date: ['service date', 'servicedate', 'date of service', 'dos', 'service_date', 'date'],
  allowed_amt: ['allowed', 'allowed amount', 'allowed_amt', 'allowed amt', 'billed'],
  paid_amt: ['paid', 'paid amount', 'paid_amt', 'paid amt', 'payment'],
  member_resp_amt: ['member responsibility', 'member resp', 'member_resp', 'copay', 'deductible', 'coinsurance', 'member_resp_amt'],
  claim_type: ['claim type', 'claimtype', 'type', 'medical/pharmacy', 'claim_type', 'pharmacy', 'medical'],
};

function normalizeHeader(h: string): string {
  return String(h ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function getHeadersFromBuffer(buffer: ArrayBuffer): string[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const name = wb.SheetNames[0];
  const ws = wb.Sheets[name];
  if (!ws) return [];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  return (data[0] as string[]) || [];
}

export function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const normalized = headers.map(normalizeHeader);
  for (const [canon, aliases] of Object.entries(COMMON_ALIASES)) {
    for (const alias of aliases) {
      const i = normalized.findIndex((h) => h === alias || h.includes(alias));
      if (i >= 0) {
        (mapping as Record<string, string>)[canon] = headers[i];
        break;
      }
    }
  }
  return mapping;
}

function parseNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  const n = Number(String(v).replace(/[,$]/g, ''));
  return Number.isNaN(n) ? null : n;
}

function parseDate(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function parseExcelBuffer(
  buffer: ArrayBuffer,
  mapping: ColumnMapping,
  sheetName?: string
): { rows: Record<string, unknown>[]; headers: string[] } {
  const wb = XLSX.read(buffer, { type: 'array' });
  const name = sheetName || wb.SheetNames[0];
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Sheet not found: ${name}`);
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
  const headers = data.length ? Object.keys(data[0]!) : [];
  const rev: Record<string, string> = {};
  Object.entries(mapping).forEach(([canon, excelCol]) => {
    if (excelCol) rev[excelCol] = canon;
  });
  const rows = data.map((rawRow) => {
    const row: Record<string, unknown> = {
      member_id: null,
      claim_id: null,
      service_date: null,
      allowed_amt: null,
      paid_amt: null,
      member_resp_amt: null,
      claim_type: null,
      raw: {},
    };
    for (const [excelCol, value] of Object.entries(rawRow)) {
      const canon = rev[excelCol];
      if (canon) {
        if (canon === 'service_date') row.service_date = parseDate(value);
        else if (canon === 'allowed_amt' || canon === 'paid_amt' || canon === 'member_resp_amt') row[canon] = parseNumber(value);
        else row[canon] = value != null ? String(value).trim() || null : null;
      }
      (row.raw as Record<string, unknown>)[excelCol] = value;
    }
    return row;
  });
  return { rows, headers };
}
