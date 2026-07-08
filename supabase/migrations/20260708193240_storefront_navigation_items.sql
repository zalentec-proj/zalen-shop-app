create table if not exists public.storefront_navigation_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  label text not null,
  type text not null default 'category',
  category_slug text,
  parent_id uuid references public.storefront_navigation_items(id) on delete cascade,
  position integer not null default 0,
  enabled boolean not null default true,
  show_in_navbar boolean not null default false,
  show_in_categories_dropdown boolean not null default false,
  opens_in_dropdown boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint storefront_navigation_items_type_check
    check (type in ('category', 'group', 'custom')),
  constraint storefront_navigation_items_category_slug_check
    check (type <> 'category' or category_slug is not null),
  constraint storefront_navigation_items_custom_link_check
    check (
      type <> 'custom'
      or category_slug is not null
      or opens_in_dropdown = true
      or parent_id is not null
    )
);

create unique index if not exists storefront_navigation_items_store_label_idx
  on public.storefront_navigation_items(store_id, lower(label));

create index if not exists storefront_navigation_items_store_position_idx
  on public.storefront_navigation_items(store_id, position);

create index if not exists storefront_navigation_items_store_parent_idx
  on public.storefront_navigation_items(store_id, parent_id);

create index if not exists storefront_navigation_items_public_idx
  on public.storefront_navigation_items(store_id, enabled, show_in_navbar, show_in_categories_dropdown);

create or replace function public.set_storefront_navigation_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_storefront_navigation_items_updated_at
  on public.storefront_navigation_items;

create trigger set_storefront_navigation_items_updated_at
  before update on public.storefront_navigation_items
  for each row
  execute function public.set_storefront_navigation_items_updated_at();

alter table public.storefront_navigation_items enable row level security;

grant select on public.storefront_navigation_items to anon, authenticated;
grant insert, update, delete on public.storefront_navigation_items to authenticated;
grant select, insert, update, delete on public.storefront_navigation_items to service_role;

drop policy if exists "public_can_read_enabled_storefront_navigation_items" on public.storefront_navigation_items;
create policy "public_can_read_enabled_storefront_navigation_items" on public.storefront_navigation_items
  for select
  to anon, authenticated
  using (
    enabled = true
    and (
      show_in_navbar = true
      or show_in_categories_dropdown = true
      or parent_id is not null
    )
    and exists (
      select 1
      from public.stores
      where stores.id = storefront_navigation_items.store_id
        and stores.status = 'active'
    )
  );

drop policy if exists "store_members_can_read_storefront_navigation_items" on public.storefront_navigation_items;
create policy "store_members_can_read_storefront_navigation_items" on public.storefront_navigation_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.platform_users
      where platform_users.user_id = (select auth.uid())
        and platform_users.role in ('platform_owner', 'platform_admin')
    )
    or exists (
      select 1
      from public.store_memberships
      where store_memberships.store_id = storefront_navigation_items.store_id
        and store_memberships.user_id = (select auth.uid())
    )
  );

drop policy if exists "store_operators_can_write_storefront_navigation_items" on public.storefront_navigation_items;
create policy "store_operators_can_write_storefront_navigation_items" on public.storefront_navigation_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.platform_users
      where platform_users.user_id = (select auth.uid())
        and platform_users.role in ('platform_owner', 'platform_admin')
    )
    or exists (
      select 1
      from public.store_memberships
      where store_memberships.store_id = storefront_navigation_items.store_id
        and store_memberships.user_id = (select auth.uid())
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  );

drop policy if exists "store_operators_can_update_storefront_navigation_items" on public.storefront_navigation_items;
create policy "store_operators_can_update_storefront_navigation_items" on public.storefront_navigation_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.platform_users
      where platform_users.user_id = (select auth.uid())
        and platform_users.role in ('platform_owner', 'platform_admin')
    )
    or exists (
      select 1
      from public.store_memberships
      where store_memberships.store_id = storefront_navigation_items.store_id
        and store_memberships.user_id = (select auth.uid())
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  )
  with check (
    exists (
      select 1
      from public.platform_users
      where platform_users.user_id = (select auth.uid())
        and platform_users.role in ('platform_owner', 'platform_admin')
    )
    or exists (
      select 1
      from public.store_memberships
      where store_memberships.store_id = storefront_navigation_items.store_id
        and store_memberships.user_id = (select auth.uid())
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  );

drop policy if exists "store_operators_can_delete_storefront_navigation_items" on public.storefront_navigation_items;
create policy "store_operators_can_delete_storefront_navigation_items" on public.storefront_navigation_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.platform_users
      where platform_users.user_id = (select auth.uid())
        and platform_users.role in ('platform_owner', 'platform_admin')
    )
    or exists (
      select 1
      from public.store_memberships
      where store_memberships.store_id = storefront_navigation_items.store_id
        and store_memberships.user_id = (select auth.uid())
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  );

insert into public.storefront_navigation_items (
  id,
  store_id,
  label,
  type,
  category_slug,
  parent_id,
  position,
  enabled,
  show_in_navbar,
  show_in_categories_dropdown,
  opens_in_dropdown
)
values
  ('71000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000001', 'Categorias', 'group', null, null, 0, true, true, true, true),
  ('71000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000001', 'Drones', 'category', 'drones', null, 10, true, true, true, false),
  ('71000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000001', 'Baterias', 'category', 'baterias', null, 20, true, true, true, false),
  ('71000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000001', 'Master Airscrew', 'category', 'master-airscrew', null, 30, true, true, true, false),
  ('71000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000001', 'Mini 3', 'category', 'mini-3', null, 40, true, true, true, false),
  ('71000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000001', 'Flip', 'category', 'flip', null, 50, true, true, true, false),
  ('71000000-0000-4000-8000-000000000007', '00000000-0000-0000-0000-000000000001', 'Linha Air', 'category', 'linha-air', null, 60, true, true, true, true),
  ('71000000-0000-4000-8000-000000000008', '00000000-0000-0000-0000-000000000001', 'Linha Mavic', 'category', 'linha-mavic', null, 70, true, true, true, true),
  ('71000000-0000-4000-8000-000000000009', '00000000-0000-0000-0000-000000000001', 'Linha Avata', 'category', 'linha-avata', null, 80, true, true, true, true),
  ('71000000-0000-4000-8000-000000000010', '00000000-0000-0000-0000-000000000001', 'Peças', 'category', 'pecas', '71000000-0000-4000-8000-000000000001', 10, true, false, true, false),
  ('71000000-0000-4000-8000-000000000011', '00000000-0000-0000-0000-000000000001', 'Acessórios', 'category', 'acessorios', '71000000-0000-4000-8000-000000000001', 20, true, false, true, false),
  ('71000000-0000-4000-8000-000000000012', '00000000-0000-0000-0000-000000000001', 'Hélices e Rotores', 'category', 'helices-e-rotores', '71000000-0000-4000-8000-000000000001', 30, true, false, true, false),
  ('71000000-0000-4000-8000-000000000013', '00000000-0000-0000-0000-000000000001', 'Sensores, IMU e GPS', 'category', 'sensores-imu-e-gps', '71000000-0000-4000-8000-000000000001', 40, true, false, true, false),
  ('71000000-0000-4000-8000-000000000014', '00000000-0000-0000-0000-000000000001', 'Câmeras e CMOS', 'category', 'cameras-e-cmos', '71000000-0000-4000-8000-000000000001', 50, true, false, true, false),
  ('71000000-0000-4000-8000-000000000015', '00000000-0000-0000-0000-000000000001', 'Carregadores e Hubs', 'category', 'carregadores-e-hubs', '71000000-0000-4000-8000-000000000001', 60, true, false, true, false),
  ('71000000-0000-4000-8000-000000000016', '00000000-0000-0000-0000-000000000001', 'Air 2', 'category', 'air-2', '71000000-0000-4000-8000-000000000007', 10, true, false, true, false),
  ('71000000-0000-4000-8000-000000000017', '00000000-0000-0000-0000-000000000001', 'Air 3', 'category', 'air-3', '71000000-0000-4000-8000-000000000007', 20, true, false, true, false),
  ('71000000-0000-4000-8000-000000000018', '00000000-0000-0000-0000-000000000001', 'Mavic 2', 'category', 'mavic-2', '71000000-0000-4000-8000-000000000008', 10, true, false, true, false),
  ('71000000-0000-4000-8000-000000000019', '00000000-0000-0000-0000-000000000001', 'Mavic 3', 'category', 'mavic-3', '71000000-0000-4000-8000-000000000008', 20, true, false, true, false),
  ('71000000-0000-4000-8000-000000000020', '00000000-0000-0000-0000-000000000001', 'Avata 2', 'category', 'avata-2', '71000000-0000-4000-8000-000000000009', 10, true, false, true, false)
on conflict (store_id, lower(label)) do update
set
  type = excluded.type,
  category_slug = excluded.category_slug,
  parent_id = excluded.parent_id,
  position = excluded.position,
  enabled = excluded.enabled,
  show_in_navbar = excluded.show_in_navbar,
  show_in_categories_dropdown = excluded.show_in_categories_dropdown,
  opens_in_dropdown = excluded.opens_in_dropdown,
  updated_at = now();
