-- Bling operational beta: order-send gate and webhook idempotency.

create unique index if not exists webhook_events_bling_event_id_uidx
  on public.webhook_events (store_id, provider, external_id)
  where provider = 'bling'
    and external_id is not null;

create unique index if not exists sync_jobs_bling_webhook_event_uidx
  on public.sync_jobs (store_id, provider, job_type, ((payload ->> 'eventId')))
  where provider = 'bling'
    and job_type = 'webhook_process'
    and payload ? 'eventId';

update public.integration_providers
set
  status = 'beta',
  description = 'ERP em beta para Brasil Drones: OAuth, catálogo, estoque, pedidos e webhook enfileirado.',
  updated_at = now()
where key = 'bling';

update public.store_integrations
set
  settings_json = jsonb_set(
    coalesce(settings_json, '{}'::jsonb),
    '{orderSend}',
    coalesce(settings_json -> 'orderSend', '{}'::jsonb)
      || jsonb_build_object('enabled', false),
    true
  ),
  updated_at = now()
where provider_key = 'bling'
  and not (coalesce(settings_json -> 'orderSend', '{}'::jsonb) ? 'enabled');
