/**
 * Natural language to SQL using a strict prompt.
 * Requires OPENAI_API_KEY. Falls back to a simple pattern-based handler if no key.
 */

const CLAIMS_SCHEMA = `
Table: claims
- id (uuid)
- member_id (text, nullable)
- claim_id (text, nullable)
- service_date (date, nullable)
- allowed_amt (numeric, nullable)
- paid_amt (numeric, nullable)
- member_resp_amt (numeric, nullable)
- claim_type (text, nullable: 'medical', 'pharmacy', etc.)
- raw (jsonb)
- created_at (timestamptz)

Rules:
- Only output a single SELECT. No INSERT/UPDATE/DELETE.
- Prefer aggregate results (counts, sums) unless the question clearly asks for member-level or claim-level detail.
- For "paid" use paid_amt; for "allowed" use allowed_amt; for "cost" or "spend" use allowed_amt unless context says "paid".
- Time windows: YTD = service_date >= date_trunc('year', current_date); prior YTD = same for current_date - interval '1 year'; last 12 months = service_date >= current_date - interval '12 months'; last year = extract(year from service_date) = extract(year from current_date) - 1.
- For "top N members" use ORDER BY sum(allowed_amt) DESC LIMIT N and group by member_id.
- For "members exceeded $20K" filter HAVING sum(allowed_amt) > 20000 (or paid_amt if question says "paid").
- Return only valid PostgreSQL for Supabase.
`;

export type NLQueryResult = {
  sql: string;
  explanation: string;
  intent: 'aggregate' | 'member_level' | 'claim_level';
};

export async function naturalLanguageToSql(
  question: string,
  opts: { allowMemberLevel?: boolean } = {}
): Promise<NLQueryResult> {
  const key = process.env.OPENAI_API_KEY;
  if (key) {
    return naturalLanguageToSqlOpenAI(question, key, opts);
  }
  return fallbackPatternSql(question, opts);
}

async function naturalLanguageToSqlOpenAI(
  question: string,
  apiKey: string,
  opts: { allowMemberLevel?: boolean }
): Promise<NLQueryResult> {
  const allowMemberLevel = opts.allowMemberLevel ?? false;
  const system = `${CLAIMS_SCHEMA}
${allowMemberLevel ? '' : "Default to aggregate results. If the user asks for member-level or claim-level detail, still return an aggregate query (e.g. counts by bucket) unless the question is explicitly 'list members' or 'show member ids'."}
Respond with exactly two lines:
1) SQL (one line, no markdown, no backticks)
2) EXPLANATION: short sentence of how the result was calculated.`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: question },
      ],
      temperature: 0.1,
      max_tokens: 500,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${err}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content?.trim() ?? '';
  const lines = content.split('\n').map((s) => s.trim()).filter(Boolean);
  let sql = '';
  let explanation = 'Query executed.';
  for (const line of lines) {
    if (line.toUpperCase().startsWith('SELECT ') && !line.includes('```')) {
      sql = line.replace(/^SQL:\s*/i, '').replace(/;$/, '');
      if (!sql.endsWith(';')) sql += ';';
      break;
    }
  }
  const explLine = lines.find((l) => l.toLowerCase().startsWith('explanation:'));
  if (explLine) explanation = explLine.replace(/^explanation:\s*/i, '').trim();
  if (!sql) {
    const firstSelect = content.match(/select\s+[\s\S]+?;/i);
    if (firstSelect) sql = firstSelect[0].trim();
  }
  if (!sql) throw new Error('Could not extract SQL from model response');
  const intent = /group\s+by\s+member_id|member_id\s+/.test(sql.toLowerCase()) ? 'member_level' : 'aggregate';
  return { sql, explanation, intent };
}

function fallbackPatternSql(
  question: string,
  _opts: { allowMemberLevel?: boolean }
): NLQueryResult {
  const q = question.toLowerCase();
  let sql: string;
  let explanation: string;
  if (q.includes('how many members') && (q.includes('20') || q.includes('20k') || q.includes('20000'))) {
    sql = `select count(*) as member_count from (select member_id from claims where service_date >= current_date - interval '12 months' group by member_id having sum(allowed_amt) > 20000) t`;
    explanation = 'Count of distinct members with total allowed amount over $20,000 in the last 12 months.';
  } else if (q.includes('top 20') && (q.includes('member') || q.includes('allowed'))) {
    sql = `select member_id, count(*) as claim_count, sum(allowed_amt) as total_allowed from claims where service_date >= date_trunc('year', current_date) group by member_id order by total_allowed desc limit 20`;
    explanation = 'Top 20 members by total allowed amount year-to-date.';
  } else if (q.includes('monthly') && (q.includes('allowed') || q.includes('paid'))) {
    sql = `select date_trunc('month', service_date)::date as month, sum(allowed_amt) as allowed, sum(paid_amt) as paid from claims where extract(year from service_date) = extract(year from current_date) - 1 group by 1 order by 1`;
    explanation = 'Monthly summary of allowed and paid amounts for last calendar year.';
  } else if (q.includes('ytd') || q.includes('year to date')) {
    sql = `select sum(allowed_amt) as total_allowed, sum(paid_amt) as total_paid, count(*) as claim_count, count(distinct member_id) as member_count from claims where service_date >= date_trunc('year', current_date)`;
    explanation = 'Year-to-date totals: allowed, paid, claim count, and member count.';
  } else if (q.includes('prior year') || q.includes('last year')) {
    sql = `select sum(allowed_amt) as total_allowed, sum(paid_amt) as total_paid, count(*) as claim_count from claims where extract(year from service_date) = extract(year from current_date) - 1`;
    explanation = 'Prior year totals: allowed, paid, and claim count.';
  } else if (q.includes('rolling 12') || q.includes('last 12 months')) {
    sql = `select sum(allowed_amt) as total_allowed, sum(paid_amt) as total_paid, count(*) as claim_count, count(distinct member_id) as member_count from claims where service_date >= current_date - interval '12 months'`;
    explanation = 'Rolling 12 months: total allowed, paid, claim count, and member count.';
  } else if (q.includes('claim type') || q.includes('medical') || q.includes('pharmacy')) {
    sql = `select claim_type, count(*) as claim_count, sum(allowed_amt) as allowed, sum(paid_amt) as paid from claims group by claim_type order by allowed desc`;
    explanation = 'Breakdown by claim type: claim count, allowed, and paid.';
  } else if (q.includes('overview') || q.includes('summary') || q.includes('data overview')) {
    sql = `select count(*) as row_count, min(service_date) as min_date, max(service_date) as max_date, count(distinct member_id) as distinct_members, count(distinct claim_id) as distinct_claims from claims`;
    explanation = 'Data overview: row count, date range, distinct members and claims.';
  } else if (q.includes('high-cost') || q.includes('high cost') || q.includes('top 10')) {
    sql = `select member_id, count(*) as claim_count, sum(allowed_amt) as total_allowed from claims where service_date >= current_date - interval '12 months' group by member_id order by total_allowed desc limit 10`;
    explanation = 'Top 10 high-cost members by allowed amount in the last 12 months.';
  } else if (q.includes('distinct members') || q.includes('unique members')) {
    sql = `select count(distinct member_id) as member_count from claims`;
    explanation = 'Count of distinct members in the claims data.';
  } else if (q.includes('total claims')) {
    sql = `select count(*) as claim_count from claims`;
    explanation = 'Total number of claims.';
  } else if (q.includes('allowed') && q.includes('paid') && !q.includes('month')) {
    sql = `select sum(allowed_amt) as total_allowed, sum(paid_amt) as total_paid from claims`;
    explanation = 'Total allowed and total paid across all claims.';
  } else {
    sql = `select count(*) as claim_count, sum(allowed_amt) as total_allowed, sum(paid_amt) as total_paid from claims`;
    explanation = 'Overall claim count and totals (allowed and paid).';
  }
  return { sql: sql.replace(/;$/, '') + ';', explanation, intent: 'aggregate' };
}
