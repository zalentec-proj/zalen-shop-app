-- Allow authenticated users to read only their own access rows.
-- Writes remain service-role/dashboard only.

create policy "authenticated_can_read_own_platform_user" on platform_users
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "authenticated_can_read_own_store_memberships" on store_memberships
  for select
  to authenticated
  using (user_id = auth.uid());
