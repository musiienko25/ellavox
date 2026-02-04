-- Claims Natural Language Query POC – initial schema
-- Run this in Supabase SQL Editor (local or hosted).

create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  member_id text,
  claim_id text,
  service_date date,
  allowed_amt numeric,
  paid_amt numeric,
  member_resp_amt numeric,
  claim_type text,
  raw jsonb default '{}',
  created_at timestamptz default now()
);

create index if not exists idx_claims_service_date on public.claims(service_date);
create index if not exists idx_claims_member_id on public.claims(member_id);
create index if not exists idx_claims_claim_type on public.claims(claim_type);

alter table public.claims enable row level security;

create policy "Allow all for service role"
  on public.claims for all
  using (true)
  with check (true);

comment on table public.claims is 'Ingested claims from Excel; used for NL query and reporting.';

-- Run arbitrary SELECT only (for NL-generated queries). POC / dev use.
create or replace function public.exec_sql(q text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  res jsonb;
begin
  if q !~* '^\s*select\s+' then
    raise exception 'Only SELECT statements allowed';
  end if;
  execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (%s) t', q) into res;
  return res;
end;
$$;
