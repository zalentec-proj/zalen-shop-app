-- Admin catalog policies for Cloud-first operation.
-- Public storefront policies still expose only active products.
-- Authenticated platform admins and store operators can manage their store catalog.

grant select on products to authenticated;
grant select on product_variants to authenticated;
grant select on product_images to authenticated;
grant select on categories to authenticated;
grant select on product_categories to authenticated;

grant update (status, updated_at) on products to authenticated;
grant update (stock) on product_variants to authenticated;

drop policy if exists "store_members_can_read_products" on products;
create policy "store_members_can_read_products" on products
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
      where store_memberships.store_id = products.store_id
        and store_memberships.user_id = auth.uid()
    )
  );

drop policy if exists "store_catalog_managers_can_update_products" on products;
create policy "store_catalog_managers_can_update_products" on products
  for update
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
      where store_memberships.store_id = products.store_id
        and store_memberships.user_id = auth.uid()
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  )
  with check (
    exists (
      select 1
      from platform_users
      where platform_users.user_id = auth.uid()
        and platform_users.role in ('platform_owner', 'platform_admin')
    )
    or exists (
      select 1
      from store_memberships
      where store_memberships.store_id = products.store_id
        and store_memberships.user_id = auth.uid()
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  );

drop policy if exists "store_members_can_read_product_variants" on product_variants;
create policy "store_members_can_read_product_variants" on product_variants
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
      where store_memberships.store_id = product_variants.store_id
        and store_memberships.user_id = auth.uid()
    )
  );

drop policy if exists "store_catalog_managers_can_update_product_variants" on product_variants;
create policy "store_catalog_managers_can_update_product_variants" on product_variants
  for update
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
      where store_memberships.store_id = product_variants.store_id
        and store_memberships.user_id = auth.uid()
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  )
  with check (
    exists (
      select 1
      from platform_users
      where platform_users.user_id = auth.uid()
        and platform_users.role in ('platform_owner', 'platform_admin')
    )
    or exists (
      select 1
      from store_memberships
      where store_memberships.store_id = product_variants.store_id
        and store_memberships.user_id = auth.uid()
        and store_memberships.role in ('store_owner', 'store_admin', 'store_operator')
    )
  );

drop policy if exists "store_members_can_read_product_images" on product_images;
create policy "store_members_can_read_product_images" on product_images
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
      where store_memberships.store_id = product_images.store_id
        and store_memberships.user_id = auth.uid()
    )
  );

drop policy if exists "store_members_can_read_product_categories" on product_categories;
create policy "store_members_can_read_product_categories" on product_categories
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
      from products
      join store_memberships
        on store_memberships.store_id = products.store_id
       and store_memberships.user_id = auth.uid()
      where products.id = product_categories.product_id
    )
  );
