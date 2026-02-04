import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getSupabase();
    const { count: rowCount } = await supabase
      .from('claims')
      .select('*', { count: 'exact', head: true });
    const { data: range } = await supabase
      .from('claims')
      .select('service_date')
      .not('service_date', 'is', null)
      .order('service_date', { ascending: true })
      .limit(1);
    const { data: rangeEnd } = await supabase
      .from('claims')
      .select('service_date')
      .not('service_date', 'is', null)
      .order('service_date', { ascending: false })
      .limit(1);
    const { data: members } = await supabase
      .from('claims')
      .select('member_id')
      .not('member_id', 'is', null);
    const distinctMembers = new Set((members ?? []).map((r) => r.member_id)).size;
    const minDate = range?.[0]?.service_date ?? null;
    const maxDate = rangeEnd?.[0]?.service_date ?? null;

    const { count: nullAllowedCount } = await supabase
      .from('claims')
      .select('*', { count: 'exact', head: true })
      .is('allowed_amt', null);

    return NextResponse.json({
      rowCount: rowCount ?? 0,
      minDate,
      maxDate,
      distinctMembers,
      issues: [
        nullAllowedCount && nullAllowedCount > 0
          ? `${nullAllowedCount} rows with null allowed_amt`
          : null,
      ].filter(Boolean),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Overview failed' },
      { status: 500 }
    );
  }
}
