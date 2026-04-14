-- Run this once in Supabase SQL editor

create table if not exists jobs (
  id text primary key,                    -- sha1(source + source_id)
  source text not null,                   -- adzuna | greenhouse | lever
  source_id text not null,
  title text not null,
  company text not null,
  location text,
  work_mode text,                         -- remote | hybrid | onsite | unknown
  salary text,
  description text,
  apply_url text not null,
  posted_at timestamptz,
  found_at timestamptz default now(),
  relevance_score int default 0,
  status text default 'new',              -- new | seen | applied | dismissed
  notified boolean default false
);

create index if not exists jobs_score_idx on jobs (relevance_score desc, found_at desc);
create index if not exists jobs_status_idx on jobs (status);
create index if not exists jobs_notified_idx on jobs (notified) where notified = false;

-- Cron run log (so you can see what happened on the dashboard)
create table if not exists cron_runs (
  id bigserial primary key,
  ran_at timestamptz default now(),
  sources_hit int,
  jobs_found int,
  new_jobs int,
  notified int,
  error text
);
