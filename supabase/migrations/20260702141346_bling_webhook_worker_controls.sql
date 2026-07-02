-- Bling webhook worker controls.
-- Existing sync_jobs already has attempts; these fields allow safe worker locks
-- and delayed retry without processing a webhook event inline.

alter table public.sync_jobs
  add column if not exists locked_at timestamptz,
  add column if not exists next_attempt_at timestamptz;

create index if not exists sync_jobs_bling_webhook_retry_idx
  on public.sync_jobs (store_id, status, next_attempt_at, created_at)
  where provider = 'bling'
    and job_type = 'webhook_process'
    and processed_at is null;

create index if not exists sync_jobs_bling_webhook_lock_idx
  on public.sync_jobs (locked_at)
  where provider = 'bling'
    and job_type = 'webhook_process'
    and status = 'running'
    and processed_at is null;
