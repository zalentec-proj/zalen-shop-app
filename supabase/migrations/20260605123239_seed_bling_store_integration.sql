-- Seed the Brasil Drones Bling integration intention.
-- This stores no credentials. Real OAuth tokens must be encrypted later.

insert into store_integrations (
  store_id,
  provider_key,
  environment,
  status,
  credentials_encrypted,
  settings_json
)
select
  stores.id,
  'bling',
  'sandbox',
  'pending_credentials',
  null,
  jsonb_build_object(
    'primary',
    true,
    'label',
    'ERP principal da Brasil Drones',
    'nextStep',
    'Configurar OAuth Bling'
  )
from stores
where stores.slug = 'brasil-drones'
on conflict (store_id, provider_key, environment)
do update set
  status = case
    when store_integrations.credentials_encrypted is null
      then excluded.status
    else store_integrations.status
  end,
  settings_json = store_integrations.settings_json || excluded.settings_json,
  updated_at = now();
