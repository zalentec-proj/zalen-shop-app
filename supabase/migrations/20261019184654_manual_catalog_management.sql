-- Manual catalog writes are atomic and available only through the authorized
-- server service. No new direct Auth/anon table grants or public-store access.
create table private.manual_product_creations (
  product_id uuid primary key references public.products(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  actor_id uuid not null,
  payload_hash text not null
);
create index manual_product_creations_store_id_idx on private.manual_product_creations(store_id);
alter table private.manual_product_creations enable row level security;
revoke all on private.manual_product_creations from public, anon, authenticated;

-- Members already read their product drafts; include category names as well.
-- The anonymous active-store policy is unchanged.
create policy store_members_can_read_categories on public.categories for select to authenticated using (
  exists(select 1 from public.platform_users where user_id=(select auth.uid()) and role in ('platform_owner','platform_admin'))
  or exists(select 1 from public.store_memberships where store_id=categories.store_id and user_id=(select auth.uid()))
);

create function private.save_manual_product(p_actor_id uuid, p_store_id uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := (p_payload->>'productId')::uuid;
  v_product public.products%rowtype;
  v_creation private.manual_product_creations%rowtype;
  v_variant uuid;
  v_category uuid;
  v_slug text;
  v_code text;
  v_physical boolean := p_payload->>'format' = 'physical';
  v_attributes jsonb := jsonb_build_object('format',p_payload->>'format','author',p_payload->>'author','isbn',p_payload->>'isbn');
begin
  if p_actor_id is null or not (
    exists(select 1 from public.platform_users where user_id=p_actor_id and role in ('platform_owner','platform_admin'))
    or exists(select 1 from public.store_memberships where store_id=p_store_id and user_id=p_actor_id and role in ('store_owner','store_admin','store_operator'))
    or exists(select 1 from public.memberships where store_id=p_store_id and user_id=p_actor_id and role in ('owner','admin','operator'))
  ) then return jsonb_build_object('ok',false,'code','forbidden'); end if;

  -- Serialize manual writes for duplicate SKUs/slugs and store status transitions.
  perform 1 from public.stores where id=p_store_id and status in ('active','planned') for update;
  if not found then return jsonb_build_object('ok',false,'code','unavailable'); end if;

  if v_id is null or jsonb_typeof(p_payload) is distinct from 'object'
    or (p_payload->>'mode') is null or (p_payload->>'mode') not in ('create','edit')
    or coalesce(length(p_payload->>'name'),0) not between 2 and 200
    or coalesce(length(p_payload->>'description'),10001)>10000
    or coalesce(length(p_payload->>'sku'),81)>80
    or coalesce(length(p_payload->>'author'),201)>200 or coalesce(length(p_payload->>'isbn'),41)>40
    or coalesce(length(p_payload->>'category'),81)>80
    or coalesce(p_payload->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or ((p_payload->>'category')<>'' and coalesce(p_payload->>'categorySlug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$')
    or coalesce(p_payload->>'status','') not in ('draft','active','inactive')
    or coalesce(p_payload->>'format','') not in ('physical','ebook')
    or coalesce(p_payload->>'price','') !~ '^\d+(\.\d{1,2})?$'
    or (p_payload->>'price')::numeric not between 0 and 9999999
    or coalesce(p_payload->>'stock','') !~ '^\d+$' or (p_payload->>'stock')::numeric not between 0 and 999999
    or coalesce(length(p_payload->>'imageUrl'),1025)>1024
    or ((p_payload->>'imageUrl')<>'' and (p_payload->>'imageUrl') !~* '^https://[^/@[:space:]]+(/[^[:space:]]*)?\.(png|jpe?g|webp|avif)(\?[^[:space:]]*)?$')
  then return jsonb_build_object('ok',false,'code','invalid_input'); end if;
  for v_code in select unnest(array['weight','width','height','depth']) loop
    if p_payload->>v_code is not null and ((p_payload->>v_code) !~ '^\d+(\.\d{1,3})?$' or (p_payload->>v_code)::numeric not between 0 and 9999) then
      return jsonb_build_object('ok',false,'code','invalid_input');
    end if;
  end loop;

  begin
    select * into v_product from public.products where id=v_id for update;
    if p_payload->>'mode'='create' then
      select * into v_creation from private.manual_product_creations where product_id=v_id;
      if found then
        if v_creation.store_id=p_store_id and v_creation.actor_id=p_actor_id and v_creation.payload_hash=md5(p_payload::text) then
          return jsonb_build_object('ok',true,'productId',v_id);
        end if;
        raise exception using message='conflict';
      end if;
      if v_product.id is not null then raise exception using message='conflict'; end if;
    elsif v_product.id is null or v_product.store_id<>p_store_id then
      raise exception using message='conflict';
    elsif coalesce(v_product.external_provider,'manual')<>'manual' then
      raise exception using message='external_product';
    end if;

    if (p_payload->>'sku')<>'' and exists(select 1 from public.product_variants where store_id=p_store_id and upper(sku)=upper(p_payload->>'sku') and product_id<>v_id) then
      raise exception using message='sku_taken';
    end if;
    if p_payload->>'mode'='create' then
      v_slug := p_payload->>'slug';
      if exists(select 1 from public.products where store_id=p_store_id and slug=v_slug) then v_slug := v_slug || '-' || v_id::text; end if;
      insert into public.products(id,store_id,external_provider,name,slug,description,status,requires_shipping)
        values(v_id,p_store_id,'manual',p_payload->>'name',v_slug,nullif(p_payload->>'description',''),p_payload->>'status',v_physical);
      insert into public.product_variants(store_id,product_id) values(p_store_id,v_id) returning id into v_variant;
      insert into private.manual_product_creations values(v_id,p_store_id,p_actor_id,md5(p_payload::text));
    else
      if (select count(*) from public.product_variants where store_id=p_store_id and product_id=v_id)<>1 then raise exception using message='external_product'; end if;
      select id into v_variant from public.product_variants where store_id=p_store_id and product_id=v_id;
      update public.products set name=p_payload->>'name',description=nullif(p_payload->>'description',''),status=p_payload->>'status',requires_shipping=v_physical,updated_at=now() where id=v_id and store_id=p_store_id;
    end if;

    update public.product_variants set sku=nullif(p_payload->>'sku',''),price=(p_payload->>'price')::numeric,stock=(p_payload->>'stock')::integer,
      weight=case when v_physical then (p_payload->>'weight')::numeric else null end,
      width=case when v_physical then (p_payload->>'width')::numeric else null end,
      height=case when v_physical then (p_payload->>'height')::numeric else null end,
      depth=case when v_physical then (p_payload->>'depth')::numeric else null end,
      attributes_json=coalesce(attributes_json,'{}'::jsonb)||v_attributes
      where id=v_variant and store_id=p_store_id and product_id=v_id;

    delete from public.product_images where store_id=p_store_id and product_id=v_id;
    if (p_payload->>'imageUrl')<>'' then
      insert into public.product_images(store_id,product_id,url,alt,position) values(p_store_id,v_id,p_payload->>'imageUrl',p_payload->>'name',0);
    end if;
    -- Both sides are scoped before modifying the category join table.
    delete from public.product_categories pc using public.categories c where pc.product_id=v_id and pc.category_id=c.id and c.store_id=p_store_id;
    if (p_payload->>'category')<>'' then
      insert into public.categories(store_id,name,slug) values(p_store_id,p_payload->>'category',p_payload->>'categorySlug') on conflict(store_id,slug) do nothing;
      select id into v_category from public.categories where store_id=p_store_id and slug=p_payload->>'categorySlug';
      insert into public.product_categories(product_id,category_id) values(v_id,v_category);
    end if;
    return jsonb_build_object('ok',true,'productId',v_id);
  exception when others then
    v_code := sqlerrm;
    if v_code not in ('conflict','sku_taken','external_product') then raise; end if;
    return jsonb_build_object('ok',false,'code',v_code);
  end;
end;
$$;
revoke all on function private.save_manual_product(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function private.save_manual_product(uuid,uuid,jsonb) to service_role;
create function public.save_manual_product(p_actor_id uuid,p_store_id uuid,p_payload jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select private.save_manual_product(p_actor_id,p_store_id,p_payload);
$$;
revoke all on function public.save_manual_product(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.save_manual_product(uuid,uuid,jsonb) to service_role;
