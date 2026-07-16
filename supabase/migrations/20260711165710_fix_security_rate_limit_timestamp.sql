create or replace function public.consume_security_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table(
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  request_timestamp timestamptz := clock_timestamp();
  current_window timestamptz;
  current_count integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid_rate_limit_configuration';
  end if;

  current_window := to_timestamp(
    floor(extract(epoch from request_timestamp) / p_window_seconds) * p_window_seconds
  );

  insert into public.security_rate_limit_buckets (
    scope,
    key_hash,
    window_started_at,
    request_count,
    updated_at
  ) values (
    p_scope,
    p_key_hash,
    current_window,
    1,
    request_timestamp
  )
  on conflict (scope, key_hash, window_started_at)
  do update set
    request_count = public.security_rate_limit_buckets.request_count + 1,
    updated_at = excluded.updated_at
  returning request_count into current_count;

  return query
  select
    current_count <= p_limit,
    greatest(p_limit - current_count, 0),
    case
      when current_count > p_limit then greatest(
        ceil(extract(epoch from current_window + make_interval(secs => p_window_seconds) - request_timestamp))::integer,
        1
      )
      else 0
    end;
end;
$$;
