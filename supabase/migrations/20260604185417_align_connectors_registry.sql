-- Align connector registry with the Zalen Shop platform model.
-- Providers are global. Store integrations are per-store connector configs.

create table if not exists integration_providers (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  category text not null check (
    category in ('erp', 'payment', 'shipping', 'sales_channel', 'ai', 'analytics')
  ),
  status text not null check (
    status in ('planned', 'beta', 'available', 'deprecated')
  ),
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into integration_providers (key, name, category, status, description)
values
  ('bling', 'Bling', 'erp', 'planned', 'ERP planejado para a Brasil Drones.'),
  ('mercos', 'Mercos', 'erp', 'planned', 'ERP planejado para a futura loja LB London.'),
  ('mercado_pago', 'Mercado Pago', 'payment', 'planned', 'Gateway de pagamento planejado.'),
  ('melhor_envio', 'Melhor Envio', 'shipping', 'planned', 'Operador logístico planejado.')
on conflict (key) do update set
  name = excluded.name,
  category = excluded.category,
  status = excluded.status,
  description = excluded.description,
  updated_at = now();

-- Preserve any provider values that may already exist before adding the FK.
insert into integration_providers (key, name, category, status, description)
select distinct
  provider,
  initcap(replace(provider, '_', ' ')),
  'erp',
  'planned',
  'Provider migrado de store_integrations.provider.'
from store_integrations
where provider is not null
on conflict (key) do nothing;

alter table store_integrations
  add column if not exists provider_key text;

update store_integrations
set provider_key = provider
where provider_key is null
  and provider is not null;

alter table store_integrations
  alter column provider_key set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'store_integrations_provider_key_fkey'
  ) then
    alter table store_integrations
      add constraint store_integrations_provider_key_fkey
      foreign key (provider_key)
      references integration_providers(key);
  end if;
end $$;

alter table store_integrations
  drop constraint if exists store_integrations_store_id_provider_environment_key;

alter table store_integrations
  drop constraint if exists store_integrations_store_id_provider_key_environment_key;

alter table store_integrations
  add constraint store_integrations_store_id_provider_key_environment_key
  unique (store_id, provider_key, environment);

drop index if exists store_integrations_store_id_provider_idx;

create index if not exists store_integrations_store_id_provider_key_idx
  on store_integrations(store_id, provider_key);

alter table store_integrations
  drop column if exists provider;

alter table integration_providers enable row level security;

drop policy if exists "service_role_only" on integration_providers;

create policy "service_role_only" on integration_providers
  using (auth.role() = 'service_role');

do $$
declare
  has_legacy_rows boolean;
begin
  if to_regclass('public.integration_tokens') is not null then
    execute 'select exists (select 1 from public.integration_tokens limit 1)'
      into has_legacy_rows;

    if has_legacy_rows then
      raise exception 'integration_tokens is not empty; review legacy integration data before dropping it';
    end if;
  end if;

  if to_regclass('public.integration_connections') is not null then
    execute 'select exists (select 1 from public.integration_connections limit 1)'
      into has_legacy_rows;

    if has_legacy_rows then
      raise exception 'integration_connections is not empty; review legacy integration data before dropping it';
    end if;
  end if;
end $$;

drop table if exists integration_tokens;
drop table if exists integration_connections;
