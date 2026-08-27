-- Keep the commercial category families complete in the Categories popover and
-- expose Baterias in the compact navbar for the Brasil Drones storefront.
update public.storefront_navigation_items navigation
set
  show_in_navbar = true,
  show_in_categories_dropdown = true,
  enabled = true,
  updated_at = now()
from public.stores stores
where stores.id = navigation.store_id
  and stores.slug = 'brasil-drones'
  and lower(navigation.label) = 'baterias';

-- These three products are compatible with both Air 2 and Air 2S. Their Air 2
-- links already exist and are deliberately preserved; this only complements
-- the compatibility catalog with the confirmed Air 2S relation.
with target_products (external_id, sku) as (
  values
    ('16690729176', '79'),
    ('16690729373', '809'),
    ('16690729192', '259')
),
resolved as (
  select distinct
    products.store_id,
    products.id as product_id,
    models.id as drone_model_id
  from target_products
  join public.stores stores
    on stores.slug = 'brasil-drones'
  join public.products products
    on products.store_id = stores.id
   and products.external_provider = 'bling'
   and products.external_id = target_products.external_id
  join public.product_variants variants
    on variants.store_id = products.store_id
   and variants.product_id = products.id
   and variants.sku = target_products.sku
  join public.drone_models models
    on models.store_id = products.store_id
   and models.slug = 'air-2s'
)
insert into public.product_drone_models (
  store_id,
  product_id,
  drone_model_id,
  source,
  confidence
)
select
  resolved.store_id,
  resolved.product_id,
  resolved.drone_model_id,
  'manual',
  'confirmed'
from resolved
on conflict (product_id, drone_model_id) do update
set
  source = 'manual',
  confidence = 'confirmed',
  updated_at = now();
