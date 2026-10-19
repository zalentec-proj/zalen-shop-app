-- Cover the store foreign key used by the provisioning idempotency ledger.
create index platform_store_requests_store_idx
  on private.platform_store_requests (store_id);
