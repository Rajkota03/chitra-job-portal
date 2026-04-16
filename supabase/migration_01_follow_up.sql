-- Run once after the initial schema. Adds application tracking + follow-up reminders.

alter table jobs add column if not exists applied_at timestamptz;
alter table jobs add column if not exists followed_up_at timestamptz;

create index if not exists jobs_applied_idx on jobs (applied_at) where applied_at is not null;

-- Backfill: any job already marked applied gets applied_at = found_at
update jobs set applied_at = found_at where status = 'applied' and applied_at is null;
