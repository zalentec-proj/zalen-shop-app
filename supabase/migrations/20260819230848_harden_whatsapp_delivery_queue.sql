-- Harden the WhatsApp delivery queue against concurrent workers and avoid
-- retaining authentication codes after a delivery reaches a terminal state.

alter table public.whatsapp_message_deliveries
  add column if not exists locked_at timestamptz,
  add column if not exists expires_at timestamptz;

alter table public.whatsapp_message_deliveries
  drop constraint if exists whatsapp_message_deliveries_status_check;

alter table public.whatsapp_message_deliveries
  add constraint whatsapp_message_deliveries_status_check
  check (status in ('queued', 'processing', 'accepted', 'delivered', 'failed', 'skipped'));

-- These rows no longer need their message body. This also removes the OTP that
-- was retained by the first production verification delivery.
update public.whatsapp_message_deliveries
set
  message_text = '[redacted]',
  next_attempt_at = null,
  locked_at = null,
  updated_at = now()
where status in ('accepted', 'delivered', 'failed', 'skipped')
  and message_text <> '[redacted]';

drop index if exists public.whatsapp_message_deliveries_due_idx;

create index whatsapp_message_deliveries_due_idx
  on public.whatsapp_message_deliveries (status, next_attempt_at, created_at)
  where status = 'queued';

create index if not exists whatsapp_message_deliveries_processing_idx
  on public.whatsapp_message_deliveries (locked_at)
  where status = 'processing';

-- The tables are server-only. Naming the role explicitly avoids evaluating a
-- catch-all policy for browser roles, in addition to the existing grants.
drop policy if exists "service_role_only" on public.customer_contact_preferences;
create policy "service_role_only" on public.customer_contact_preferences
  for all to service_role using (true) with check (true);

drop policy if exists "service_role_only" on public.customer_contact_verifications;
create policy "service_role_only" on public.customer_contact_verifications
  for all to service_role using (true) with check (true);

drop policy if exists "service_role_only" on public.whatsapp_message_deliveries;
create policy "service_role_only" on public.whatsapp_message_deliveries
  for all to service_role using (true) with check (true);

drop policy if exists "service_role_only" on public.whatsapp_webhook_events;
create policy "service_role_only" on public.whatsapp_webhook_events
  for all to service_role using (true) with check (true);
