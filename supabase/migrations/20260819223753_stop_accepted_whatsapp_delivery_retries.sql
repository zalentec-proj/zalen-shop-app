-- An accepted send has already reached Evolution. Only queued rows belong to
-- the retry worker; accepted rows await an optional delivery webhook.
drop index if exists public.whatsapp_message_deliveries_due_idx;

create index whatsapp_message_deliveries_due_idx
  on public.whatsapp_message_deliveries (status, next_attempt_at, created_at)
  where status = 'queued';
