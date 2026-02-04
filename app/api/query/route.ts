import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { naturalLanguageToSql } from '@/lib/nl-query';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question, allowMemberLevel } = body as { question?: string; allowMemberLevel?: boolean };
    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'question (string) required' }, { status: 400 });
    }
    const { sql, explanation, intent } = await naturalLanguageToSql(question, {
      allowMemberLevel: !!allowMemberLevel,
    });
    const cleanSql = sql.replace(/;$/, '').trim();
    const { data, error } = await getSupabase().rpc('exec_sql', { q: cleanSql });
    if (error) throw error;
    const rows: Record<string, unknown>[] = Array.isArray(data) ? data : (data ? [data] : []);
    const columns = rows.length && typeof rows[0] === 'object' && rows[0] !== null
      ? Object.keys(rows[0] as object)
      : [];
    return NextResponse.json({
      sql: cleanSql,
      explanation,
      intent,
      columns,
      rows,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Query failed' },
      { status: 500 }
    );
  }
}

