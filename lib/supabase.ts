import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    _supabase = createClient(url, key);
  }
  return _supabase;
}

export type ClaimRow = {
  id: string;
  member_id: string | null;
  claim_id: string | null;
  service_date: string | null;
  allowed_amt: number | null;
  paid_amt: number | null;
  member_resp_amt: number | null;
  claim_type: string | null;
  raw: Record<string, unknown>;
  created_at: string;
};
