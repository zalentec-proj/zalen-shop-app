-- Keep the ERP model/line category as the primary classification while adding
-- the commercial Baterias -> Novo/Semi Novo taxonomy used by the storefront.
-- Names explicitly describing a drone sold without a battery are excluded.
with target_store as (
  select id
  from public.stores
  where slug = 'brasil-drones'
  limit 1
),
battery_products as (
  select products.id, lower(products.name) as normalized_name
  from public.products products
  join target_store on target_store.id = products.store_id
  where products.external_provider = 'bling'
    and lower(products.name) like '%bateria%'
    and lower(products.name) !~ 'sem.{0,30}bateria'
),
managed_categories as (
  select categories.id, categories.slug
  from public.categories categories
  join target_store on target_store.id = categories.store_id
  where categories.slug in ('baterias-e-tampas', 'novo', 'semi-novo')
)
delete from public.product_categories product_categories
using battery_products, managed_categories
where product_categories.product_id = battery_products.id
  and product_categories.category_id = managed_categories.id;

with target_store as (
  select id
  from public.stores
  where slug = 'brasil-drones'
  limit 1
),
battery_products as (
  select products.id, lower(products.name) as normalized_name
  from public.products products
  join target_store on target_store.id = products.store_id
  where products.external_provider = 'bling'
    and lower(products.name) like '%bateria%'
    and lower(products.name) !~ 'sem.{0,30}bateria'
),
managed_categories as (
  select categories.id, categories.slug
  from public.categories categories
  join target_store on target_store.id = categories.store_id
  where categories.slug in ('baterias-e-tampas', 'novo', 'semi-novo')
),
desired_links as (
  select battery_products.id as product_id, parent_category.id as category_id
  from battery_products
  join managed_categories parent_category
    on parent_category.slug = 'baterias-e-tampas'

  union all

  select battery_products.id as product_id, condition_category.id as category_id
  from battery_products
  join managed_categories condition_category
    on condition_category.slug = case
      when battery_products.normalized_name ~ 'semi[[:space:]]*nov[oa]s?'
        then 'semi-novo'
      else 'novo'
    end
)
insert into public.product_categories (product_id, category_id)
select desired_links.product_id, desired_links.category_id
from desired_links
on conflict (product_id, category_id) do nothing;
