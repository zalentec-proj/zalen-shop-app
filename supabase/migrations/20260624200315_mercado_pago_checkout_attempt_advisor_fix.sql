create index if not exists checkout_attempts_order_id_idx
  on public.checkout_attempts (order_id)
  where order_id is not null;

drop policy if exists "service_role_only" on public.checkout_attempts;
create policy "service_role_only" on public.checkout_attempts
  for all
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');
