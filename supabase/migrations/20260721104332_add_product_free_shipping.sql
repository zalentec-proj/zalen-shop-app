alter table public.products
  add column if not exists free_shipping boolean not null default false;

comment on column public.products.free_shipping is
  'When true, the storefront keeps carrier options and delivery estimates but charges zero shipping when every cart item is eligible.';
