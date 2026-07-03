-- Growth tracking, paid traffic and advanced SEO foundation.
-- Marketing connectors remain global providers; store-specific public IDs,
-- credentials and switches live in store_integrations.

insert into public.integration_providers (key, name, category, status, description)
values
  (
    'google_tag_manager',
    'Google Tag Manager',
    'analytics',
    'beta',
    'Container por loja para tags e eventos de marketing no storefront.'
  ),
  (
    'ga4',
    'Google Analytics 4',
    'analytics',
    'beta',
    'Eventos ecommerce GA4 via data layer e compra confirmada server-side.'
  ),
  (
    'google_ads',
    'Google Ads',
    'analytics',
    'beta',
    'Conversao de compra, enhanced conversions e click IDs por loja.'
  ),
  (
    'google_merchant_center',
    'Google Merchant Center',
    'sales_channel',
    'beta',
    'Feed de produtos por loja para Shopping, free listings e Performance Max.'
  ),
  (
    'meta_pixel',
    'Meta Pixel',
    'analytics',
    'beta',
    'Eventos de navegador para Meta Ads com consentimento e deduplicacao.'
  ),
  (
    'meta_conversions_api',
    'Meta Conversions API',
    'analytics',
    'beta',
    'Eventos server-side Meta CAPI com token criptografado por loja.'
  )
on conflict (key) do update set
  name = excluded.name,
  category = excluded.category,
  status = excluded.status,
  description = excluded.description,
  updated_at = now();

alter table public.orders
  add column if not exists marketing_context_json jsonb not null default '{}'::jsonb;

create table if not exists public.marketing_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  provider_key text not null references public.integration_providers(key),
  event_name text not null,
  event_id text not null,
  source text not null check (source in ('browser', 'server', 'manual')),
  order_id uuid references public.orders(id) on delete set null,
  order_number text,
  status text not null default 'pending' check (
    status in ('pending', 'sent', 'skipped', 'error')
  ),
  occurred_at timestamptz not null default now(),
  processed_at timestamptz,
  value numeric(12,2),
  currency text,
  payload_json jsonb not null default '{}'::jsonb,
  response_json jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists marketing_events_store_provider_event_uidx
  on public.marketing_events (store_id, provider_key, event_name, event_id);

create index if not exists marketing_events_store_provider_status_idx
  on public.marketing_events (store_id, provider_key, status, occurred_at desc);

create index if not exists marketing_events_store_order_idx
  on public.marketing_events (store_id, order_id);

create or replace function public.set_marketing_events_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_marketing_events_updated_at
  before update on public.marketing_events
  for each row
  execute function public.set_marketing_events_updated_at();

alter table public.marketing_events enable row level security;

revoke all on public.marketing_events from anon;
revoke all on public.marketing_events from authenticated;
grant select, insert, update, delete on public.marketing_events to service_role;

drop policy if exists "service_role_only" on public.marketing_events;
create policy "service_role_only" on public.marketing_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
