drop index if exists public.store_domains_redirect_to_domain_id_idx;
create index store_domains_redirect_to_domain_id_idx
  on public.store_domains(redirect_to_domain_id, store_id)
  where redirect_to_domain_id is not null;

drop index if exists public.store_domain_events_domain_created_at_idx;
create index store_domain_events_domain_created_at_idx
  on public.store_domain_events(store_domain_id, store_id, created_at desc);
