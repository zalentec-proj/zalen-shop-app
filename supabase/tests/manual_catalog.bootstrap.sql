-- Extends the disposable platform bootstrap with the actual initial catalog.
alter table public.products add column external_provider text, add column external_id text,
  add column name text not null default 'Fixture', add column slug text not null default 'fixture',
  add column description text, add column brand text, add column requires_shipping boolean default true,
  add column free_shipping boolean not null default false,
  add column created_at timestamptz default now(), add column updated_at timestamptz default now(),
  add unique(store_id,slug);
create table public.memberships(id uuid primary key default gen_random_uuid(),user_id uuid,store_id uuid references public.stores(id),role text);
grant select on public.platform_users,public.store_memberships,public.memberships to service_role;
grant select on public.platform_users,public.store_memberships to authenticated;
alter table public.platform_users enable row level security;
alter table public.store_memberships enable row level security;
create policy own_role on public.platform_users for select to authenticated using(user_id=auth.uid());
create policy own_membership on public.store_memberships for select to authenticated using(user_id=auth.uid());
-- Same member read path already present in the cloud catalog.
create policy store_members_can_read_products on public.products for select to authenticated using (
  exists(select 1 from public.platform_users where user_id=auth.uid() and role in ('platform_owner','platform_admin'))
  or exists(select 1 from public.store_memberships where store_id=products.store_id and user_id=auth.uid())
);
