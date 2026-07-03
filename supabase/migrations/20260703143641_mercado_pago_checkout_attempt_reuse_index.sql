create index if not exists checkout_attempts_store_fingerprint_status_idx
  on public.checkout_attempts (store_id, cart_hash, customer_hash, status, created_at desc);
