-- Catálogo de compatibilidade por linha/modelo DJI.
-- Esta estrutura é independente de product_categories: a categoria técnica do
-- produto continua sendo a sua classificação principal no Bling.

create table if not exists public.drone_model_lines (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  slug text not null,
  position integer not null default 0,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint drone_model_lines_store_slug_key unique (store_id, slug),
  constraint drone_model_lines_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.drone_models (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  line_id uuid not null references public.drone_model_lines(id) on delete cascade,
  name text not null,
  slug text not null,
  aliases text[] not null default '{}',
  position integer not null default 0,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint drone_models_store_slug_key unique (store_id, slug),
  constraint drone_models_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.product_drone_models (
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  drone_model_id uuid not null references public.drone_models(id) on delete cascade,
  source text not null default 'manual',
  confidence text not null default 'confirmed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, drone_model_id),
  constraint product_drone_models_source_check
    check (source in ('seed', 'detected', 'manual', 'import')),
  constraint product_drone_models_confidence_check
    check (confidence in ('confirmed', 'review'))
);

create index if not exists drone_model_lines_store_position_idx
  on public.drone_model_lines(store_id, position);

create index if not exists drone_models_store_line_position_idx
  on public.drone_models(store_id, line_id, position);

create index if not exists product_drone_models_store_model_idx
  on public.product_drone_models(store_id, drone_model_id, product_id);

create index if not exists product_drone_models_store_product_idx
  on public.product_drone_models(store_id, product_id, drone_model_id);

create or replace function public.set_drone_model_catalog_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.enforce_product_drone_model_store_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.products
    where products.id = new.product_id
      and products.store_id = new.store_id
  ) then
    raise exception 'product_drone_models.product_id must belong to store_id';
  end if;

  if not exists (
    select 1
    from public.drone_models
    where drone_models.id = new.drone_model_id
      and drone_models.store_id = new.store_id
  ) then
    raise exception 'product_drone_models.drone_model_id must belong to store_id';
  end if;

  return new;
end;
$$;

drop trigger if exists set_drone_model_lines_updated_at on public.drone_model_lines;
create trigger set_drone_model_lines_updated_at
  before update on public.drone_model_lines
  for each row
  execute function public.set_drone_model_catalog_updated_at();

drop trigger if exists set_drone_models_updated_at on public.drone_models;
create trigger set_drone_models_updated_at
  before update on public.drone_models
  for each row
  execute function public.set_drone_model_catalog_updated_at();

drop trigger if exists set_product_drone_models_updated_at on public.product_drone_models;
create trigger set_product_drone_models_updated_at
  before update on public.product_drone_models
  for each row
  execute function public.set_drone_model_catalog_updated_at();

drop trigger if exists enforce_product_drone_model_store_scope on public.product_drone_models;
create trigger enforce_product_drone_model_store_scope
  before insert or update on public.product_drone_models
  for each row
  execute function public.enforce_product_drone_model_store_scope();

alter table public.drone_model_lines enable row level security;
alter table public.drone_models enable row level security;
alter table public.product_drone_models enable row level security;

grant select on public.drone_model_lines, public.drone_models, public.product_drone_models to anon, authenticated;
grant insert, update, delete on public.drone_model_lines, public.drone_models, public.product_drone_models to authenticated;
grant select, insert, update, delete on public.drone_model_lines, public.drone_models, public.product_drone_models to service_role;

drop policy if exists "public_can_read_active_drone_model_lines" on public.drone_model_lines;
create policy "public_can_read_active_drone_model_lines" on public.drone_model_lines
  for select
  to anon, authenticated
  using (
    is_active = true
    and exists (
      select 1
      from public.stores
      where stores.id = drone_model_lines.store_id
        and stores.status = 'active'
    )
  );

drop policy if exists "store_members_can_read_drone_model_lines" on public.drone_model_lines;
create policy "store_members_can_read_drone_model_lines" on public.drone_model_lines
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
      where store_memberships.store_id = drone_model_lines.store_id
        and store_memberships.user_id = (select auth.uid())
    )
  );

drop policy if exists "store_operators_can_write_drone_model_lines" on public.drone_model_lines;
create policy "store_operators_can_write_drone_model_lines" on public.drone_model_lines
  for all
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
      where store_memberships.store_id = drone_model_lines.store_id
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
      where store_memberships.store_id = drone_model_lines.store_id
        and store_memberships.user_id = (select auth.uid())
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  );

drop policy if exists "public_can_read_active_drone_models" on public.drone_models;
create policy "public_can_read_active_drone_models" on public.drone_models
  for select
  to anon, authenticated
  using (
    is_active = true
    and exists (
      select 1
      from public.drone_model_lines
      join public.stores on stores.id = drone_model_lines.store_id
      where drone_model_lines.id = drone_models.line_id
        and drone_model_lines.store_id = drone_models.store_id
        and drone_model_lines.is_active = true
        and stores.status = 'active'
    )
  );

drop policy if exists "store_members_can_read_drone_models" on public.drone_models;
create policy "store_members_can_read_drone_models" on public.drone_models
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
      where store_memberships.store_id = drone_models.store_id
        and store_memberships.user_id = (select auth.uid())
    )
  );

drop policy if exists "store_operators_can_write_drone_models" on public.drone_models;
create policy "store_operators_can_write_drone_models" on public.drone_models
  for all
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
      where store_memberships.store_id = drone_models.store_id
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
      where store_memberships.store_id = drone_models.store_id
        and store_memberships.user_id = (select auth.uid())
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  );

drop policy if exists "public_can_read_active_product_drone_models" on public.product_drone_models;
create policy "public_can_read_active_product_drone_models" on public.product_drone_models
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.products
      join public.drone_models on drone_models.id = product_drone_models.drone_model_id
      join public.drone_model_lines on drone_model_lines.id = drone_models.line_id
      join public.stores on stores.id = product_drone_models.store_id
      where products.id = product_drone_models.product_id
        and products.store_id = product_drone_models.store_id
        and products.status = 'active'
        and drone_models.store_id = product_drone_models.store_id
        and drone_models.is_active = true
        and drone_model_lines.store_id = product_drone_models.store_id
        and drone_model_lines.is_active = true
        and stores.status = 'active'
    )
  );

drop policy if exists "store_members_can_read_product_drone_models" on public.product_drone_models;
create policy "store_members_can_read_product_drone_models" on public.product_drone_models
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
      where store_memberships.store_id = product_drone_models.store_id
        and store_memberships.user_id = (select auth.uid())
    )
  );

drop policy if exists "store_operators_can_write_product_drone_models" on public.product_drone_models;
create policy "store_operators_can_write_product_drone_models" on public.product_drone_models
  for all
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
      where store_memberships.store_id = product_drone_models.store_id
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
      where store_memberships.store_id = product_drone_models.store_id
        and store_memberships.user_id = (select auth.uid())
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  );

-- Navegação interna por modelo. Apenas caminhos relativos são permitidos para
-- que o editor público não se torne um redirecionador externo.
alter table public.storefront_navigation_items
  add column if not exists href text;

alter table public.storefront_navigation_items
  drop constraint if exists storefront_navigation_items_custom_link_check;

alter table public.storefront_navigation_items
  add constraint storefront_navigation_items_custom_link_check
  check (
    type <> 'custom'
    or href is not null
    or category_slug is not null
    or opens_in_dropdown = true
    or parent_id is not null
  );

alter table public.storefront_navigation_items
  drop constraint if exists storefront_navigation_items_href_internal_check;

alter table public.storefront_navigation_items
  add constraint storefront_navigation_items_href_internal_check
  check (href is null or href ~ '^/[a-z0-9][a-z0-9/_-]*$');

-- Taxonomia ativa para Brasil Drones. Os nomes são os rótulos comerciais
-- solicitados; não presumem compatibilidade de peças até revisão no admin.
with target_store as (
  select id from public.stores where slug = 'brasil-drones' limit 1
), line_data (name, slug, position) as (
  values
    ('Linha Lito', 'lito', 10),
    ('Flip', 'flip', 20),
    ('Linha Neo', 'neo', 30),
    ('Linha Mini', 'mini', 40),
    ('Linha Air', 'air', 50),
    ('Linha Avata', 'avata', 60),
    ('Linha Mavic', 'mavic', 70),
    ('Linha Phantom', 'phantom', 80)
)
insert into public.drone_model_lines (store_id, name, slug, position)
select target_store.id, line_data.name, line_data.slug, line_data.position
from target_store
cross join line_data
on conflict (store_id, slug) do update
set name = excluded.name,
    position = excluded.position,
    is_active = true,
    updated_at = now();

with target_store as (
  select id from public.stores where slug = 'brasil-drones' limit 1
), model_data (line_slug, name, slug, aliases, position) as (
  values
    ('lito', 'Lito', 'lito', array['dji lito'], 10),
    ('lito', 'Lito X1', 'lito-x1', array['dji lito x1'], 20),
    ('flip', 'Flip', 'flip', array['dji flip'], 10),
    ('neo', 'Neo', 'neo', array['dji neo'], 10),
    ('neo', 'Neo 2', 'neo-2', array['dji neo 2'], 20),
    ('mini', 'Mini', 'mini', array['dji mini'], 10),
    ('mini', 'Mini 2', 'mini-2', array['dji mini 2'], 20),
    ('mini', 'Mini 2 SE', 'mini-2-se', array['dji mini 2 se', 'mini 2se'], 30),
    ('mini', 'Mini 4K', 'mini-4k', array['dji mini 4k'], 40),
    ('mini', 'Mini 3', 'mini-3', array['dji mini 3'], 50),
    ('mini', 'Mini 3 Pro', 'mini-3-pro', array['dji mini 3 pro'], 60),
    ('mini', 'Mini 4 Pro', 'mini-4-pro', array['dji mini 4 pro'], 70),
    ('mini', 'Mini 5 Pro', 'mini-5-pro', array['dji mini 5 pro'], 80),
    ('air', 'Air', 'air', array['dji air'], 10),
    ('air', 'Air 2S', 'air-2s', array['dji air 2s'], 20),
    ('air', 'Air 2', 'air-2', array['dji air 2'], 30),
    ('air', 'Air 3', 'air-3', array['dji air 3'], 40),
    ('air', 'Air 3S', 'air-3s', array['dji air 3s'], 50),
    ('avata', 'Avata', 'avata', array['dji avata'], 10),
    ('avata', 'Avata 2', 'avata-2', array['dji avata 2', 'dji avata 02'], 20),
    ('avata', 'Avata 360', 'avata-360', array['dji avata 360'], 30),
    ('mavic', 'Mavic Pro', 'mavic-pro', array['dji mavic pro'], 10),
    ('mavic', 'Mavic 2 Pro', 'mavic-2-pro', array['dji mavic 2 pro'], 20),
    ('mavic', 'Mavic 2 Zoom', 'mavic-2-zoom', array['dji mavic 2 zoom'], 30),
    ('mavic', 'Mavic 3', 'mavic-3', array['dji mavic 3'], 40),
    ('mavic', 'Mavic 3 Classic', 'mavic-3-classic', array['dji mavic 3 classic'], 50),
    ('mavic', 'Mavic 3 Pro', 'mavic-3-pro', array['dji mavic 3 pro'], 60),
    ('mavic', 'Mavic 3 Cine', 'mavic-3-cine', array['dji mavic 3 cine'], 70),
    ('mavic', 'Mavic 4 Pro', 'mavic-4-pro', array['dji mavic 4 pro'], 80),
    ('phantom', 'Phantom 4 Pro', 'phantom-4-pro', array['dji phantom 4 pro'], 10),
    ('phantom', 'Phantom 4', 'phantom-4', array['dji phantom 4'], 20)
)
insert into public.drone_models (store_id, line_id, name, slug, aliases, position)
select target_store.id, lines.id, model_data.name, model_data.slug, model_data.aliases, model_data.position
from target_store
join public.drone_model_lines lines on lines.store_id = target_store.id
join model_data on model_data.line_slug = lines.slug
on conflict (store_id, slug) do update
set line_id = excluded.line_id,
    name = excluded.name,
    aliases = excluded.aliases,
    position = excluded.position,
    is_active = true,
    updated_at = now();

-- Mantém Drones como acesso técnico e substitui apenas os atalhos de modelo
-- redundantes. Baterias e Master Airscrew continuam no menu Categorias.
update public.storefront_navigation_items
set show_in_navbar = false,
    show_in_categories_dropdown = true,
    updated_at = now()
where store_id = (select id from public.stores where slug = 'brasil-drones' limit 1)
  and lower(label) in ('baterias', 'master airscrew');

with target_store as (
  select id from public.stores where slug = 'brasil-drones' limit 1
), navigation_lines (label, line_slug, position) as (
  values
    ('Linha Lito', 'lito', 20),
    ('Linha Neo', 'neo', 40),
    ('Linha Mini', 'mini', 50),
    ('Linha Air', 'air', 60),
    ('Linha Avata', 'avata', 70),
    ('Linha Mavic', 'mavic', 80),
    ('Linha Phantom', 'phantom', 90)
)
insert into public.storefront_navigation_items (
  store_id, label, type, category_slug, href, parent_id, position,
  enabled, show_in_navbar, show_in_categories_dropdown, opens_in_dropdown
)
select
  target_store.id,
  navigation_lines.label,
  'custom',
  null,
  '/modelos/linha/' || navigation_lines.line_slug,
  null,
  navigation_lines.position,
  true,
  true,
  false,
  true
from target_store
cross join navigation_lines
on conflict (store_id, lower(label)) do update
set type = excluded.type,
    category_slug = null,
    href = excluded.href,
    parent_id = null,
    position = excluded.position,
    enabled = true,
    show_in_navbar = true,
    show_in_categories_dropdown = false,
    opens_in_dropdown = true,
    updated_at = now();

with target_store as (
  select id from public.stores where slug = 'brasil-drones' limit 1
)
insert into public.storefront_navigation_items (
  store_id, label, type, category_slug, href, parent_id, position,
  enabled, show_in_navbar, show_in_categories_dropdown, opens_in_dropdown
)
select
  target_store.id,
  'Flip',
  'custom',
  null,
  '/modelos/flip',
  null,
  30,
  true,
  true,
  false,
  false
from target_store
on conflict (store_id, lower(label)) do update
set type = excluded.type,
    category_slug = null,
    href = excluded.href,
    parent_id = null,
    position = excluded.position,
    enabled = true,
    show_in_navbar = true,
    show_in_categories_dropdown = false,
    opens_in_dropdown = false,
    updated_at = now();

with target_store as (
  select id from public.stores where slug = 'brasil-drones' limit 1
)
insert into public.storefront_navigation_items (
  store_id, label, type, category_slug, href, parent_id, position,
  enabled, show_in_navbar, show_in_categories_dropdown, opens_in_dropdown
)
select
  target_store.id,
  models.name,
  'custom',
  null,
  '/modelos/' || models.slug,
  parent_navigation.id,
  models.position,
  true,
  false,
  false,
  false
from target_store
join public.drone_models models on models.store_id = target_store.id
join public.drone_model_lines lines on lines.id = models.line_id
join public.storefront_navigation_items parent_navigation
  on parent_navigation.store_id = target_store.id
  and parent_navigation.label = lines.name
where models.is_active = true
  and lines.slug <> 'flip'
on conflict (store_id, lower(label)) do update
set type = excluded.type,
    category_slug = null,
    href = excluded.href,
    parent_id = excluded.parent_id,
    position = excluded.position,
    enabled = true,
    show_in_navbar = false,
    show_in_categories_dropdown = false,
    opens_in_dropdown = false,
    updated_at = now();
