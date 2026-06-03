-- Orders are private operational data.
-- Keep Data API access limited to authenticated users; RLS still filters by store.

revoke select on orders from anon;
revoke select on order_items from anon;
