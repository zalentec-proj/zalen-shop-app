-- Keep trigger functions independent from the caller's search_path.
-- These functions do not need relation lookup, so an empty path is safest.
create or replace function public.set_marketing_events_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_storefront_navigation_items_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- An order must not enter fulfillment before its payment is confirmed.
-- NOT VALID preserves the historical exception for manual resolution while
-- enforcing the rule for every new or updated record from this point onward.
alter table public.orders
  drop constraint if exists orders_fulfillment_requires_payment;

alter table public.orders
  add constraint orders_fulfillment_requires_payment
  check (
    coalesce(payment_status, 'pending') = 'paid'
    or coalesce(status, 'pending') not in ('processing', 'shipped', 'delivered')
  ) not valid;

-- Model routes remain unpublished until the storefront deployment is released.
-- This is intentionally idempotent because an operator may have re-enabled them.
update public.storefront_navigation_items
set enabled = false,
    updated_at = now()
where store_id = (
  select id
  from public.stores
  where slug = 'brasil-drones'
  limit 1
)
  and href like '/modelos/%';
