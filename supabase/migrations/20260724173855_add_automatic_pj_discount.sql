-- Native per-store automatic discount for authenticated PJ customers.
-- Public/catalog prices remain unchanged; order items persist final charged prices.

alter table public.price_lists
  add column if not exists automatic_discount_enabled boolean not null default false,
  add column if not exists automatic_discount_percentage numeric(5,2) not null default 10,
  add column if not exists promotion_policy text not null default 'best_price';

alter table public.price_lists
  drop constraint if exists price_lists_automatic_discount_percentage_check,
  add constraint price_lists_automatic_discount_percentage_check
    check (
      automatic_discount_percentage >= 0
      and automatic_discount_percentage <= 100
    ),
  drop constraint if exists price_lists_automatic_discount_activation_check,
  add constraint price_lists_automatic_discount_activation_check
    check (
      not automatic_discount_enabled
      or automatic_discount_percentage > 0
    ),
  drop constraint if exists price_lists_promotion_policy_check,
  add constraint price_lists_promotion_policy_check
    check (promotion_policy in ('best_price', 'stack', 'promotion_only'));

alter table public.orders
  add column if not exists product_discount_total numeric(12,2) not null default 0;

alter table public.orders
  drop constraint if exists orders_product_discount_total_check,
  add constraint orders_product_discount_total_check
    check (product_discount_total >= 0);

alter table public.order_items
  add column if not exists base_unit_price numeric(12,2),
  add column if not exists discount_percentage numeric(5,2) not null default 0,
  add column if not exists product_discount_total numeric(12,2) not null default 0;

update public.order_items
set base_unit_price = unit_price
where base_unit_price is null;

alter table public.order_items
  alter column base_unit_price set not null,
  alter column base_unit_price set default 0,
  drop constraint if exists order_items_base_unit_price_check,
  add constraint order_items_base_unit_price_check
    check (base_unit_price >= 0),
  drop constraint if exists order_items_discount_percentage_check,
  add constraint order_items_discount_percentage_check
    check (discount_percentage >= 0 and discount_percentage <= 100),
  drop constraint if exists order_items_product_discount_total_check,
  add constraint order_items_product_discount_total_check
    check (product_discount_total >= 0);
