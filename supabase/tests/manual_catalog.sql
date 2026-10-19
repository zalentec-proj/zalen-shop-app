begin;
insert into auth.users(id,email) values
('10000000-0000-4000-8000-000000000001','owner@catalog.invalid'),
('10000000-0000-4000-8000-000000000002','merchant@catalog.invalid'),
('10000000-0000-4000-8000-000000000003','viewer@catalog.invalid');
insert into public.platform_users values('10000000-0000-4000-8000-000000000001','platform_owner');
insert into public.stores(id,name,slug,status) values
('20000000-0000-4000-8000-000000000001','Publisher','publisher','planned'),
('20000000-0000-4000-8000-000000000002','Other','other','active');
insert into public.store_memberships(store_id,user_id,role) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','store_owner'),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','store_viewer');
set local role service_role;
do $$
declare
  owner_id uuid := '10000000-0000-4000-8000-000000000001';
  merchant_id uuid := '10000000-0000-4000-8000-000000000002';
  store_id uuid := '20000000-0000-4000-8000-000000000001';
  payload jsonb := '{"productId":"30000000-0000-4000-8000-000000000001","mode":"create","name":"Livro fixture","slug":"livro-fixture","description":"Descrição","sku":"BOOK-1","author":"Autora","isbn":"9780000000000","format":"physical","price":39.9,"stock":7,"status":"draft","category":"Fé","categorySlug":"fe","imageUrl":"https://example.com/cover.webp","weight":0.3,"width":14,"height":2,"depth":21}';
  result jsonb;
begin
  result := public.save_manual_product('10000000-0000-4000-8000-000000000003',store_id,payload);
  assert result->>'code'='forbidden', 'viewer wrote catalog';
  result := public.save_manual_product(merchant_id,'20000000-0000-4000-8000-000000000002',payload);
  assert result->>'code'='forbidden', 'cross-store membership accepted';
  result := public.save_manual_product(merchant_id,store_id,payload);
  assert result->>'ok'='true', result::text;
  result := public.save_manual_product(merchant_id,store_id,payload);
  assert result->>'ok'='true', 'retry failed';
  assert (select count(*)=1 from public.products), 'duplicate creation';
  assert (select count(*)=1 from public.product_variants), 'duplicate variant';
  assert (select count(*)=1 from public.product_images), 'missing cover';
  assert (select count(*)=1 from public.product_categories), 'missing category';
  assert (select status='planned' from public.stores where id=store_id), 'store published implicitly';
  result := public.save_manual_product(merchant_id,store_id,payload||'{"productId":"30000000-0000-4000-8000-000000000002"}');
  assert result->>'code'='sku_taken', result::text;
  assert (select count(*)=1 from public.products), 'partial duplicate SKU product';
  result := public.save_manual_product(owner_id,'20000000-0000-4000-8000-000000000002',payload||'{"mode":"edit"}');
  assert result->>'code'='conflict', 'cross-store product overwritten';
  result := public.save_manual_product(merchant_id,store_id,payload||'{"mode":"edit","price":45.5,"stock":8,"format":"ebook","category":"Estudos","categorySlug":"estudos"}');
  assert result->>'ok'='true', result::text;
  assert (select price=45.5 and stock=8 and weight is null from public.product_variants), 'price or format not updated';
  assert (select not requires_shipping from public.products), 'digital shipping remained enabled';
  assert (select count(*)=1 from public.product_categories), 'stale category linkage';
end $$;
reset role;
-- A forced child-row failure must roll back the product and category as well.
alter table public.product_images add constraint fixture_reject_image check(url not like '%reject%');
do $$ begin
  begin
    perform public.save_manual_product('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
    '{"productId":"30000000-0000-4000-8000-000000000003","mode":"create","name":"Rollback","slug":"rollback","description":"","sku":"ROLLBACK","author":"","isbn":"","format":"physical","price":10,"stock":1,"status":"draft","category":"","categorySlug":"","imageUrl":"https://example.com/reject.png"}');
    raise exception 'expected fixture failure';
  exception when check_violation then null; end;
  assert (select count(*)=1 from public.products), 'orphan product after child failure';
  assert (select count(*)=1 from private.manual_product_creations), 'orphan idempotency entry';
end $$;
update public.products set external_provider='bling';
do $$ declare result jsonb; begin
  result := public.save_manual_product('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
  '{"productId":"30000000-0000-4000-8000-000000000001","mode":"edit","name":"Forbidden edit","slug":"forbidden-edit","description":"","sku":"ERP","author":"","isbn":"","format":"physical","price":1,"stock":1,"status":"draft","category":"","categorySlug":"","imageUrl":""}');
  assert result->>'code'='external_product', 'ERP overwritten';
  assert (select name='Livro fixture' from public.products), 'partial ERP mutation';
end $$;
update public.products set status='active';
set local role anon;
do $$ begin
  assert (select count(*)=0 from public.products), 'draft leaked';
  assert (select count(*)=0 from public.categories), 'planned categories leaked';
  assert not has_function_privilege(current_user,'public.save_manual_product(uuid,uuid,jsonb)','execute'), 'RPC exposed to anon';
end $$;
reset role;
set local role authenticated;
set local request.jwt.claims='{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
do $$ begin
  assert (select count(*)=2 from public.categories), 'member missing preparation categories';
  assert (select count(*)=1 from public.products), 'member missing preparation products';
  assert not has_function_privilege(current_user,'public.save_manual_product(uuid,uuid,jsonb)','execute'), 'RPC exposed to user';
end $$;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000099';
do $$ begin assert (select count(*)=0 from public.categories), 'categories leaked to unrelated account'; end $$;
reset role;
rollback;
