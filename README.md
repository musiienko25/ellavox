# Claims Natural Language Query POC

A localhost prototype to load a claims Excel file, ask natural-language questions, and export structured results to Excel.

## Stack

- **Next.js** (App Router, React 18)
- **Supabase** (Postgres + JS client)
- **xlsx** (SheetJS) for Excel read/write
- Optional: **OpenAI** for richer NL → SQL (falls back to built-in patterns if no key)

## Setup

1. **Clone and install**

   ```bash
   cd Ellavox
   npm install
   ```

2. **Supabase**

   - Create a project at [supabase.com](https://supabase.com) (or run Supabase locally with Docker).
   - In the SQL Editor, run the migration:

     ```bash
     # Copy contents of supabase/migrations/001_claims.sql and run in Supabase SQL Editor
     ```

   - Create a `.env.local` with:

     ```
     NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
     ```

   - Optional: set `OPENAI_API_KEY` for better natural-language understanding.

3. **Run locally**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## How to load the data

1. On the app home page, use **“1. Load data”**.
2. Choose the supplied claims Excel file (e.g. `Data_For_AI.xlsx`).
3. Click **“Upload & ingest”**. Rows are parsed and inserted into the `claims` table.
4. Click **“Refresh overview”** to see row count, date range, distinct members, and any data quality notes.

Column mapping is inferred from common headers (e.g. “member id”, “service date”, “allowed amount”, “paid amount”, “claim type”). Unmapped columns are stored in `raw` JSON.

## Example questions to try

- How many members exceeded $20K in the last 12 months?
- Who are the top 20 members by allowed amount YTD?
- Show a monthly summary of allowed vs paid for last year
- Year-to-date total allowed and paid
- Prior year totals
- Rolling 12 months claim count and member count
- Breakdown by claim type (medical vs pharmacy)
- Data overview / summary
- Top 10 high-cost members
- Monthly allowed and paid by month
- Count of distinct members
- Total claims
- Total allowed and paid

With `OPENAI_API_KEY` set, more phrasings and follow-ups are supported.

## Export

- After running a question, click **“Export to Excel”**.
- The downloaded `.xlsx` has:
  - A **Context** sheet: question, explanation, time window/filters, export timestamp.
  - A **Result** sheet: the result table (one query = one result sheet).

## Assumptions and tradeoffs

- **Schema:** One `claims` table with canonical columns (`member_id`, `claim_id`, `service_date`, `allowed_amt`, `paid_amt`, `member_resp_amt`, `claim_type`) plus `raw` JSON for extra Excel columns. Column names are auto-mapped from common aliases.
- **“Paid” vs “allowed”:** Default is to use `allowed_amt` for “cost”/“spend”; “paid” is mapped to `paid_amt`. Documented in the NL prompt.
- **Time windows:** YTD, prior YTD, rolling 12 months, and “last year” are implemented in both OpenAI and fallback logic.
- **Guardrails:** Results default to **aggregate** (counts, sums). Member-level detail (e.g. listing member IDs) requires the explicit **“Allow member-level detail”** checkbox. Raw identifiers are not hidden in export when that option is used (POC scope).
- **Security:** `exec_sql` in the migration is SELECT-only (regex guard). Suitable for local/dev; production would need stricter controls and possibly no dynamic SQL.
- **Scale:** Upload is capped at 100k rows per file to avoid timeouts; batching or chunked upload could be added later.

## Intentionally not built (timebox)

- Charts/visualizations (tables only).
- Multi-sheet Excel input (only first sheet is ingested).
- Saved queries or history.
- User auth / per-user data.
- Full actuarial validation or complex business rules.
- Automated data quality rules beyond null checks and overview stats.

## License

ISC.
