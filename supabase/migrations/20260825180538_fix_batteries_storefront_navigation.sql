-- The complete Categories popover is editorially separate from the compact
-- top navbar. Keep Baterias in that popover and source its descendants from
-- the hierarchy mirrored from Bling.
with target as (
  select
    stores.id as store_id,
    categories.slug as category_slug
  from public.stores stores
  join public.categories categories
    on categories.store_id = stores.id
   and categories.external_id like 'bling:%'
   and lower(categories.name) = 'baterias'
  where stores.slug = 'brasil-drones'
  order by categories.id
  limit 1
)
insert into public.storefront_navigation_items (
  store_id,
  label,
  type,
  category_slug,
  href,
  parent_id,
  position,
  enabled,
  show_in_navbar,
  show_in_categories_dropdown,
  opens_in_dropdown
)
select
  target.store_id,
  'Baterias',
  'category',
  target.category_slug,
  null,
  null,
  20,
  true,
  false,
  true,
  true
from target
on conflict (store_id, lower(label)) do update
set
  type = excluded.type,
  category_slug = excluded.category_slug,
  href = null,
  parent_id = null,
  position = excluded.position,
  enabled = true,
  show_in_navbar = false,
  show_in_categories_dropdown = true,
  opens_in_dropdown = true,
  updated_at = now();
