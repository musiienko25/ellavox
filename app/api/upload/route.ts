import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { parseExcelBuffer, detectColumnMapping, getHeadersFromBuffer } from '@/lib/excel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ROWS = 100_000;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    const buffer = await file.arrayBuffer();
    const headers = getHeadersFromBuffer(buffer);
    const mapping = detectColumnMapping(headers);
    const { rows } = parseExcelBuffer(buffer, mapping);

    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `Too many rows (max ${MAX_ROWS}). Use a smaller file or sample.` },
        { status: 400 }
      );
    }

    const toInsert = rows.map((r) => ({
      member_id: r.member_id ?? null,
      claim_id: r.claim_id ?? null,
      service_date: r.service_date ?? null,
      allowed_amt: r.allowed_amt ?? null,
      paid_amt: r.paid_amt ?? null,
      member_resp_amt: r.member_resp_amt ?? null,
      claim_type: r.claim_type ?? null,
      raw: r.raw ?? {},
    }));

    const { error } = await getSupabase().from('claims').insert(toInsert);
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      rowsLoaded: toInsert.length,
      mapping: Object.keys(mapping).length ? mapping : undefined,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
