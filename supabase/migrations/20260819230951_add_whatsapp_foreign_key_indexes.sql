-- Cover the foreign-key columns used by cleanup, audit and customer-history
-- queries as the per-store WhatsApp history grows.

create index if not exists customer_contact_preferences_customer_id_idx
  on public.customer_contact_preferences (customer_id);

create index if not exists customer_contact_verifications_customer_id_idx
  on public.customer_contact_verifications (customer_id);

create index if not exists whatsapp_message_deliveries_customer_id_idx
  on public.whatsapp_message_deliveries (customer_id)
  where customer_id is not null;

create index if not exists whatsapp_message_deliveries_integration_id_idx
  on public.whatsapp_message_deliveries (integration_id)
  where integration_id is not null;

create index if not exists whatsapp_webhook_events_integration_id_idx
  on public.whatsapp_webhook_events (integration_id)
  where integration_id is not null;
