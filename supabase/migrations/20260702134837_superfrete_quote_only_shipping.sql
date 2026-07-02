insert into public.integration_providers (key, name, category, status, description)
values (
  'superfrete',
  'SuperFrete',
  'shipping',
  'beta',
  'Cotacao de frete quote-only para checkout. Etiqueta, pagamento, impressao, rastreio e webhook ficam fora da V1.'
)
on conflict (key) do update set
  name = excluded.name,
  category = excluded.category,
  status = excluded.status,
  description = excluded.description,
  updated_at = now();

insert into public.shipping_methods (
  store_id,
  kind,
  provider_key,
  service_code,
  name,
  description,
  status,
  sort_order,
  price,
  free_over_subtotal,
  min_delivery_days,
  max_delivery_days,
  settings_json
)
values (
  '00000000-0000-0000-0000-000000000001',
  'external',
  'superfrete',
  'superfrete-quote',
  'SuperFrete quote-only',
  'Cotacao real por CEP, peso e dimensoes. A etiqueta continua operacional no Bling.',
  'active',
  5,
  0,
  null,
  null,
  null,
  '{"mode":"quote_only","services":"1,2,3,17"}'::jsonb
)
on conflict (store_id, kind, coalesce(provider_key, ''), service_code) do update set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  sort_order = excluded.sort_order,
  settings_json = excluded.settings_json,
  updated_at = now();
