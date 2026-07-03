insert into public.store_integrations (
  store_id,
  provider_key,
  environment,
  status,
  settings_json
)
select
  stores.id,
  'mercado_pago',
  'shared',
  'connected',
  jsonb_build_object(
    'activeEnvironment',
    'test',
    'activeEnvironmentUpdatedAt',
    now()
  )
from public.stores
where exists (
  select 1
  from public.store_integrations existing
  where existing.store_id = stores.id
    and existing.provider_key = 'mercado_pago'
)
on conflict (store_id, provider_key, environment)
do update set
  status = excluded.status,
  settings_json = coalesce(public.store_integrations.settings_json, '{}'::jsonb)
    || jsonb_build_object(
      'activeEnvironment',
      coalesce(
        public.store_integrations.settings_json ->> 'activeEnvironment',
        'test'
      ),
      'activeEnvironmentUpdatedAt',
      coalesce(
        public.store_integrations.settings_json ->> 'activeEnvironmentUpdatedAt',
        now()::text
      )
    ),
  updated_at = now();
