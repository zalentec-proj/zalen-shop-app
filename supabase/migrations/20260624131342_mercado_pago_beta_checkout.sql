-- Mercado Pago beta: Checkout Pro with env-backed credentials and per-store gate.

update public.integration_providers
set
  status = 'beta',
  description = 'Gateway de pagamento em beta: Checkout Pro, retorno, webhook assinado e conciliação inicial.',
  updated_at = now()
where key = 'mercado_pago';

insert into public.store_integrations (
  store_id,
  provider_key,
  environment,
  status,
  settings_json
)
values (
  '00000000-0000-0000-0000-000000000001',
  'mercado_pago',
  'test',
  'pending_credentials',
  jsonb_build_object(
    'beta', true,
    'credentialsSource', 'env',
    'checkoutPro', jsonb_build_object(
      'enabled', true,
      'mode', 'checkout_pro'
    )
  )
)
on conflict (store_id, provider_key, environment) do update
set
  settings_json = jsonb_set(
    jsonb_set(
      jsonb_set(
        coalesce(public.store_integrations.settings_json, '{}'::jsonb),
        '{beta}',
        'true'::jsonb,
        true
      ),
      '{credentialsSource}',
      '"env"'::jsonb,
      true
    ),
    '{checkoutPro}',
    coalesce(public.store_integrations.settings_json -> 'checkoutPro', '{}'::jsonb)
      || jsonb_build_object('enabled', true, 'mode', 'checkout_pro'),
    true
  ),
  updated_at = now();

create unique index if not exists webhook_events_mercado_pago_notification_uidx
  on public.webhook_events (store_id, provider, external_id)
  where provider = 'mercado_pago'
    and external_id is not null
    and (
      external_id like 'notification:%'
      or external_id like 'request:%'
      or external_id like 'payment:%'
    );
