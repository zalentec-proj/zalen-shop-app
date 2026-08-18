-- Bling is the source of truth for catalog category descendants. Navigation
-- keeps only editorial roots (visibility, order and compatibility routes).
update public.storefront_navigation_items navigation
set category_slug = categories.slug,
    updated_at = now()
from public.categories categories
where navigation.store_id = categories.store_id
  and categories.external_id like 'bling:%'
  and lower(categories.name) = lower(navigation.label)
  and (
    navigation.href like '/modelos/linha/%'
    or navigation.href = '/modelos/flip'
  );

delete from public.storefront_navigation_items navigation
where navigation.parent_id is not null
  and navigation.href like '/modelos/%'
  and navigation.href not like '/modelos/linha/%'
  and exists (
    select 1
    from public.storefront_navigation_items parent_navigation
    join public.categories parent_category
      on parent_category.store_id = parent_navigation.store_id
      and parent_category.external_id like 'bling:%'
      and lower(parent_category.name) = lower(parent_navigation.label)
    where parent_navigation.id = navigation.parent_id
      and parent_navigation.store_id = navigation.store_id
  );

-- The August catalog introduced three model sheets that were not present in
-- the first compatibility seed. Resolve line IDs by store/slug so the migration
-- remains portable and does not depend on generated UUIDs.
insert into public.drone_models (
  store_id,
  line_id,
  name,
  slug,
  aliases,
  position,
  is_active
)
select
  lines.store_id,
  lines.id,
  models.name,
  models.slug,
  models.aliases,
  models.position,
  true
from public.drone_model_lines lines
join (
  values
    ('mini', 'Mini SE', 'mini-se', array['mini se', 'dji mini se']::text[], 40),
    ('mavic', 'Mavic Platinum', 'mavic-platinum', array['mavic platinum', 'dji mavic platinum']::text[], 20),
    ('mavic', 'Mavic 2', 'mavic-2', array['mavic 2', 'dji mavic 2']::text[], 30)
) as models(line_slug, name, slug, aliases, position)
  on models.line_slug = lines.slug
join public.stores stores
  on stores.id = lines.store_id
  and stores.slug = 'brasil-drones'
on conflict (store_id, slug) do update
set
  line_id = excluded.line_id,
  name = excluded.name,
  aliases = excluded.aliases,
  position = excluded.position,
  is_active = true,
  updated_at = now();
