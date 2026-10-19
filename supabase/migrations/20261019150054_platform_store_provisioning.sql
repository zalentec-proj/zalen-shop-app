-- Additive platform management. No connector, catalog or commercial data is copied.
create schema if not exists private;
grant usage on schema private to service_role;

-- Public records disappear with the store, including direct Data API reads.
alter policy public_can_read_active_products on public.products using (
  status = 'active' and exists(select 1 from public.stores s where s.id = store_id and s.status = 'active')
);
alter policy public_can_read_published_store_legal_documents on public.store_legal_documents using (
  status = 'published' and exists(select 1 from public.stores s where s.id = store_id and s.status = 'active')
);

create table public.storefront_drafts (
  store_id uuid primary key references public.stores(id) on delete cascade,
  config jsonb not null check (jsonb_typeof(config) = 'object'),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
create table public.storefront_presentations (
  store_id uuid primary key references public.stores(id) on delete cascade,
  config jsonb not null check (jsonb_typeof(config) = 'object'),
  published_revision integer not null,
  published_at timestamptz not null default now()
);
create table public.platform_store_profiles (
  store_id uuid primary key references public.stores(id) on delete cascade,
  responsible_user_id uuid not null references auth.users(id),
  created_by uuid not null references auth.users(id)
);
create index platform_store_profiles_responsible_idx on public.platform_store_profiles(responsible_user_id);
create index platform_store_profiles_creator_idx on public.platform_store_profiles(created_by);
create table private.platform_store_requests (
  actor_id uuid not null,
  request_id uuid not null,
  fingerprint text not null,
  store_id uuid not null references public.stores(id),
  primary key (actor_id, request_id)
);
create table public.platform_store_events (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  store_id uuid,
  action text not null,
  outcome text not null,
  created_at timestamptz not null default now()
);
create index platform_store_events_store_time_idx on public.platform_store_events(store_id, created_at desc);
alter table public.storefront_drafts enable row level security;
alter table public.storefront_presentations enable row level security;
alter table public.platform_store_profiles enable row level security;
alter table public.platform_store_events enable row level security;
alter table private.platform_store_requests enable row level security;

revoke all on public.storefront_drafts, public.storefront_presentations, public.platform_store_profiles, public.platform_store_events from public, anon, authenticated;
revoke all on private.platform_store_requests from public, anon, authenticated;
grant all on public.storefront_drafts, public.storefront_presentations, public.platform_store_profiles, public.platform_store_events, private.platform_store_requests to service_role;
revoke all on sequence public.platform_store_events_id_seq from public, anon, authenticated;
grant usage, select on sequence public.platform_store_events_id_seq to service_role;
grant select on public.storefront_presentations to anon, authenticated;
create policy published_active_storefront on public.storefront_presentations
  for select to anon, authenticated using (
    exists (select 1 from public.stores s where s.id = store_id and s.status = 'active')
  );

-- This private definer is unreachable through the Data API. The public invoker
-- wrapper below is executable only by the server's service_role, never a JWT user.
-- actor_id is derived from a freshly authenticated session by the application;
-- the role is independently rechecked here inside the transaction.
create function private.platform_store_command(
  p_actor_id uuid, p_action text, p_store_id uuid, p_request_id uuid, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  v_store public.stores%rowtype;
  v_draft public.storefront_drafts%rowtype;
  v_owner uuid;
  v_count integer;
  v_previous private.platform_store_requests%rowtype;
  v_result jsonb;
  v_code text;
begin
  select role into v_role from public.platform_users where user_id = p_actor_id;
  if v_role is null or (p_action in ('create', 'publish', 'deactivate') and v_role <> 'platform_owner') then
    v_result := jsonb_build_object('ok', false, 'code', 'forbidden');
  else
    begin
      if p_action = 'create' then
        if p_request_id is null or p_payload->>'name' is null or p_payload->>'slug' is null or p_payload->>'ownerEmail' is null
          or length(p_payload->>'name') not between 2 and 100
          or length(p_payload->>'slug') not between 3 and 50
          or (p_payload->>'slug') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
          or (p_payload->>'slug') in ('app','www','api','admin','assets','static','support')
          or jsonb_typeof(p_payload->'config') is distinct from 'object'
          or (p_payload->'config'->>'renderer') is distinct from 'neutral'
        then raise exception using message = 'invalid_input'; end if;
        perform pg_advisory_xact_lock(hashtextextended(p_actor_id::text || p_request_id::text, 0));
        select * into v_previous from private.platform_store_requests where actor_id = p_actor_id and request_id = p_request_id;
        if found then
          if v_previous.fingerprint <> md5(p_payload::text) then raise exception using message = 'idempotency_conflict'; end if;
          v_result := jsonb_build_object('ok', true, 'storeId', v_previous.store_id, 'revision', 1);
        else
          select count(*), min(id::text)::uuid into v_count, v_owner from auth.users where lower(email) = lower(p_payload->>'ownerEmail') and deleted_at is null;
          if v_count <> 1 then raise exception using message = 'owner_not_found'; end if;
          insert into public.stores (name, slug, status) values (p_payload->>'name', p_payload->>'slug', 'planned') returning * into v_store;
          insert into public.store_memberships(store_id, user_id, role) values (v_store.id, v_owner, 'store_owner');
          insert into public.platform_store_profiles(store_id, responsible_user_id, created_by) values (v_store.id, v_owner, p_actor_id);
          insert into public.storefront_drafts(store_id, config) values (v_store.id, p_payload->'config');
          -- Native empty price lists, never inherited commercial prices/policies.
          -- Initialize here so the first public page does not provision settings.
          insert into public.price_lists(store_id, name, code, customer_type, is_default, priority, automatic_discount_enabled)
            values (v_store.id, 'PF padrão', 'pf_default', 'pf', true, 10, false),
                   (v_store.id, 'PJ empresa', 'pj_business', 'pj', true, 20, false);
          insert into private.platform_store_requests values (p_actor_id, p_request_id, md5(p_payload::text), v_store.id);
          v_result := jsonb_build_object('ok', true, 'storeId', v_store.id, 'revision', 1);
        end if;
      elsif p_action in ('save', 'publish', 'deactivate') then
        select * into v_store from public.stores where id = p_store_id for update;
        if not found then raise exception using message = 'not_found'; end if;
        select * into v_draft from public.storefront_drafts where store_id = p_store_id for update;
        -- Existing stores are lazily initialized on their first save.
        if p_payload->>'revision' is null or coalesce(v_draft.revision, 0) <> (p_payload->>'revision')::integer then raise exception using message = 'conflict'; end if;
        if p_action = 'save' then
          if p_payload->>'name' is null or p_payload->'config'->>'renderer' is null
            or length(p_payload->>'name') not between 2 and 100 or jsonb_typeof(p_payload->'config') is distinct from 'object'
            or (p_payload->'config'->>'renderer') not in ('neutral', 'brasil-drones')
            or ((p_payload->'config'->>'renderer') = 'brasil-drones' and v_store.slug <> 'brasil-drones')
          then raise exception using message = 'invalid_input'; end if;
          update public.stores set name = p_payload->>'name' where id = p_store_id;
          insert into public.storefront_drafts(store_id, config, revision) values (p_store_id, p_payload->'config', 1)
            on conflict(store_id) do update set config = excluded.config, revision = storefront_drafts.revision + 1, updated_at = now()
            returning * into v_draft;
        elsif p_action = 'publish' then
          if v_draft.store_id is null then raise exception using message = 'missing_presentation'; end if;
          insert into public.storefront_presentations(store_id, config, published_revision) values(p_store_id, v_draft.config, v_draft.revision)
            on conflict(store_id) do update set config = excluded.config, published_revision = excluded.published_revision, published_at = now();
          update public.stores set status = 'active' where id = p_store_id;
        else
          update public.stores set status = 'inactive' where id = p_store_id;
        end if;
        v_result := jsonb_build_object('ok', true, 'storeId', p_store_id, 'revision', coalesce(v_draft.revision, 0));
      else raise exception using message = 'invalid_input';
      end if;
    exception
      when unique_violation then v_result := jsonb_build_object('ok', false, 'code', 'slug_taken');
      when others then
        v_code := sqlerrm;
        if v_code not in ('invalid_input','idempotency_conflict','owner_not_found','conflict','not_found','missing_presentation') then
          raise;
        end if;
        v_result := jsonb_build_object('ok', false, 'code', v_code);
    end;
  end if;
  insert into public.platform_store_events(actor_id, store_id, action, outcome)
    values (p_actor_id, coalesce((v_result->>'storeId')::uuid, p_store_id), left(p_action, 30), case when (v_result->>'ok')::boolean then 'success' else v_result->>'code' end);
  return v_result;
end;
$$;
revoke all on function private.platform_store_command(uuid,text,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function private.platform_store_command(uuid,text,uuid,uuid,jsonb) to service_role;
create function public.platform_store_command(p_actor_id uuid, p_action text, p_store_id uuid, p_request_id uuid, p_payload jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.platform_store_command(p_actor_id, p_action, p_store_id, p_request_id, p_payload);
$$;
revoke all on function public.platform_store_command(uuid,text,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.platform_store_command(uuid,text,uuid,uuid,jsonb) to service_role;
