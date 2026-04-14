# Chitra's Job Portal

Personal job radar for **Chitra Bhanu Vurivi** — Risk & Controls / Fraud Investigation / Internal Audit, Hyderabad.

## What it does

- Scans Adzuna India + Greenhouse + Lever job boards **twice daily** (9 AM, 8 PM IST)
- Scores each posting against Chitra's profile (0–100)
- Stores new matches in Supabase, dedupes by source ID
- Emails a digest of strong matches (≥ 40) to chitravurivi14@gmail.com
- Dashboard at `/` to browse, apply, mark applied, or dismiss

## Stack

| Layer | Choice | Cost |
|---|---|---|
| Hosting | Vercel Hobby | $0 |
| Cron | cron-job.org (external) | $0 |
| DB | Supabase | $0 |
| Email | Resend | $0 |
| Data | Adzuna API + Greenhouse/Lever public boards | $0 |

Total: **$0/month** up to ~3k emails and 250 Adzuna calls/month.

## Setup

See [`SETUP.md`](./SETUP.md).

## Architecture

```
cron-job.org --GET /api/cron (Bearer CRON_SECRET)--> Vercel
                                                      |
                                                      v
                                      lib/sources.ts (Adzuna, GH, Lever)
                                                      |
                                          dedupe + score + upsert
                                                      |
                                              Supabase jobs table
                                                      |
                                    new & score≥40 --> Resend email
```

## Files that matter

- `app/api/cron/route.ts` — the scraper+emailer, runs on schedule
- `lib/sources.ts` — job board adapters; add/remove companies here
- `lib/matcher.ts` — keyword lists & scoring; tune for Chitra's next career shift
- `app/dashboard.tsx` — the portal UI

## Commit notes

Opinionated and minimal on purpose (DHH + Bellard):
- No Tailwind, no UI library — 80 lines of CSS in `globals.css`
- No auth library — one shared password + httpOnly cookie
- No ORM — Supabase client handles queries directly
- No Redis, queues, or background workers — cron endpoint is idempotent
