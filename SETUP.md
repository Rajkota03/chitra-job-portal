# Setup — Chitra's Job Portal

Total time: ~20 minutes. Cost: **₹0/month**.

---

## 1. Supabase (DB) — 2 min

You already have a project: `https://gzqgrwqqvlloypwpfflf.supabase.co`

1. Go to **SQL Editor** → paste the contents of `supabase/schema.sql` → Run.
2. Go to **Project Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret)

---

## 2. Adzuna (job data) — 3 min

1. Sign up at https://developer.adzuna.com → free tier, 250 calls/month.
2. Copy **App ID** → `ADZUNA_APP_ID`
3. Copy **App Key** → `ADZUNA_APP_KEY`

> 9 queries × 2 runs/day × 30 days = 540 calls/month. Adzuna caps at 250/mo on free. Solutions:
> - Run the cron **once per day** instead of twice (cuts to 270 — still over, so also...)
> - Reduce `SEARCH_QUERIES` in `lib/matcher.ts` to 4 highest-priority terms → 4 × 2 × 30 = 240 ✅
> - Or just accept it: after the 250th call, Adzuna returns empty and we still scrape Greenhouse/Lever for free.

---

## 3. Resend (email) — 3 min

1. Sign up at https://resend.com → free tier, 3,000 emails/month (plenty).
2. **Easiest path** (no domain setup): use `onboarding@resend.dev` as the sender in testing.
   - `EMAIL_FROM="Chitra Jobs <onboarding@resend.dev>"`
3. **Cleaner path**: verify a domain you own (resend.com → Domains → Add). Then:
   - `EMAIL_FROM="Chitra Jobs <jobs@yourdomain.com>"`
4. Copy API key → `RESEND_API_KEY`
5. `EMAIL_TO=chitravurivi14@gmail.com`

---

## 4. Deploy to Vercel — 3 min

```bash
cd /Users/rajnikanthkota/CHITRA
npm install
git init && git add -A && git commit -m "initial"
# create a new GitHub repo, push, then:
# go to vercel.com/new → import the repo → deploy
```

When importing:
- Paste every variable from `.env.example` into **Environment Variables**.
- Generate `CRON_SECRET`: `openssl rand -hex 32` → paste.
- Pick any `DASHBOARD_PASSWORD` (she'll enter this once to unlock the portal).
- After deploy, add one more env var: `NEXT_PUBLIC_PORTAL_URL` = your vercel URL.

---

## 5. External cron (2× daily) — 5 min

Vercel Hobby only allows 1 cron/day. We bypass this with a free external pinger.

1. Sign up at https://cron-job.org (free, unlimited).
2. Click **Create cronjob**:
   - **URL**: `https://your-portal.vercel.app/api/cron`
   - **Schedule**: `0 9,20 * * *` (9 AM and 8 PM IST daily)
   - **Advanced → Request method**: GET
   - **Advanced → Request headers**:
     - Header name: `Authorization`
     - Header value: `Bearer <paste your CRON_SECRET>`
   - Save.
3. Click **Execute now** once to verify it runs. Check the Supabase `cron_runs` table — you should see a row with `sources_hit`, `jobs_found`, `new_jobs`.

---

## 6. First run

Send Chitra the portal URL + password. First digest email arrives at 9 AM IST tomorrow.

---

## Tuning (optional)

- **Add companies**: edit `GREENHOUSE_BOARDS` and `LEVER_COMPANIES` in `lib/sources.ts`.
- **Change search terms**: edit `SEARCH_QUERIES` in `lib/matcher.ts`.
- **Adjust match threshold**: in `app/api/cron/route.ts` — the `>= 25` filter (DB insert) and `>= 40` filter (email).
- **See every scan**: query `select * from cron_runs order by ran_at desc` in Supabase.
