create schema if not exists private;

create or replace function private.expire_shipping_quotes_after_method_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.shipping_quotes
  set
    expires_at = least(expires_at, statement_timestamp()),
    updated_at = statement_timestamp()
  where method_id = new.id
    and expires_at > statement_timestamp();

  return new;
end;
$$;

revoke all on function private.expire_shipping_quotes_after_method_change()
  from public, anon, authenticated;

drop trigger if exists expire_shipping_quotes_after_method_change
  on public.shipping_methods;

create trigger expire_shipping_quotes_after_method_change
after update of status, price, free_over_subtotal, min_delivery_days, max_delivery_days
on public.shipping_methods
for each row
when (
  old.status is distinct from new.status
  or old.price is distinct from new.price
  or old.free_over_subtotal is distinct from new.free_over_subtotal
  or old.min_delivery_days is distinct from new.min_delivery_days
  or old.max_delivery_days is distinct from new.max_delivery_days
)
execute function private.expire_shipping_quotes_after_method_change();

update public.shipping_methods
set
  free_over_subtotal = null,
  updated_at = statement_timestamp()
where store_id = '00000000-0000-0000-0000-000000000001'
  and kind = 'fixed'
  and service_code = 'fixed-standard'
  and free_over_subtotal is not null;

comment on function private.expire_shipping_quotes_after_method_change() is
  'Expires open quotes whenever a shipping method pricing or availability policy changes.';
