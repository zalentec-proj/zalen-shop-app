-- Read policies for moving the app from pure mock data to Supabase-backed data.
-- Catalog is public for active storefront products.
-- Orders remain private to platform admins and store members.

grant select on stores to anon, authenticated;
grant select on products to anon, authenticated;
grant select on product_variants to anon, authenticated;
grant select on product_images to anon, authenticated;
grant select on categories to anon, authenticated;
grant select on product_categories to anon, authenticated;
grant select on orders to authenticated;
grant select on order_items to authenticated;

drop policy if exists "public_can_read_active_stores" on stores;
create policy "public_can_read_active_stores" on stores
  for select
  to anon, authenticated
  using (status = 'active');

drop policy if exists "public_can_read_active_products" on products;
create policy "public_can_read_active_products" on products
  for select
  to anon, authenticated
  using (status = 'active');

drop policy if exists "public_can_read_active_product_variants" on product_variants;
create policy "public_can_read_active_product_variants" on product_variants
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from products
      where products.id = product_variants.product_id
        and products.store_id = product_variants.store_id
        and products.status = 'active'
      )
  );

drop policy if exists "public_can_read_active_product_images" on product_images;
create policy "public_can_read_active_product_images" on product_images
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from products
      where products.id = product_images.product_id
        and products.store_id = product_images.store_id
        and products.status = 'active'
      )
  );

drop policy if exists "public_can_read_categories" on categories;
create policy "public_can_read_categories" on categories
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from stores
      where stores.id = categories.store_id
        and stores.status = 'active'
      )
  );

drop policy if exists "public_can_read_active_product_categories" on product_categories;
create policy "public_can_read_active_product_categories" on product_categories
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from products
      where products.id = product_categories.product_id
        and products.status = 'active'
      )
  );

drop policy if exists "store_members_can_read_orders" on orders;
create policy "store_members_can_read_orders" on orders
  for select
  to authenticated
  using (
    exists (
      select 1
      from platform_users
      where platform_users.user_id = auth.uid()
        and platform_users.role in ('platform_owner', 'platform_admin')
    )
    or exists (
      select 1
      from store_memberships
      where store_memberships.store_id = orders.store_id
        and store_memberships.user_id = auth.uid()
      )
  );

drop policy if exists "store_members_can_read_order_items" on order_items;
create policy "store_members_can_read_order_items" on order_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from platform_users
      where platform_users.user_id = auth.uid()
        and platform_users.role in ('platform_owner', 'platform_admin')
    )
    or exists (
      select 1
      from store_memberships
      where store_memberships.store_id = order_items.store_id
        and store_memberships.user_id = auth.uid()
    )
  );
