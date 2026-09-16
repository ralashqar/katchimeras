-- This baseline is intentionally idempotent: the existing content-pack migration
-- was created with a later timestamp and has also been applied out of order.
create schema if not exists private;
create table if not exists public.content_packs (
  id text not null,
  version integer not null check (version > 0),
  content_schema_version integer not null check (content_schema_version > 0),
  manifest jsonb not null check (jsonb_typeof(manifest) = 'object'),
  enabled boolean not null default false,
  min_app_version text,
  starts_at timestamptz,
  ends_at timestamptz,
  published_at timestamptz not null default now(),
  primary key (id, version)
);
alter table public.content_packs enable row level security;

create or replace function private.get_content_release_v2(app_version text, schema_version integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if app_version !~ '^\d+\.\d+\.\d+$' or schema_version < 1 then
    raise exception 'Invalid client version';
  end if;
  select coalesce(jsonb_agg(pack.manifest order by pack.id), '[]'::jsonb) into result
  from (
    select distinct on (p.id) p.id, p.manifest
    from public.content_packs p
    where p.enabled and p.content_schema_version <= schema_version
      and (p.starts_at is null or p.starts_at <= now())
      and (p.ends_at is null or p.ends_at > now())
      and (p.min_app_version is null or
        case when p.min_app_version ~ '^\d+\.\d+\.\d+$'
          then string_to_array(p.min_app_version, '.')::integer[] <= string_to_array(app_version, '.')::integer[]
          else false end)
    order by p.id, p.version desc
  ) pack;
  return jsonb_build_object('packs', result, 'serverTime', now());
end;
$$;
create or replace function public.get_content_release_v2(app_version text, schema_version integer)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.get_content_release_v2(app_version, schema_version); $$;
revoke all on function private.get_content_release_v2(text, integer) from public;
revoke all on function public.get_content_release_v2(text, integer) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.get_content_release_v2(text, integer) to anon, authenticated;
grant execute on function public.get_content_release_v2(text, integer) to anon, authenticated;

-- Receipt and entitlement are committed together. A failed write rolls back the
-- receipt too, so the provider's retry can actually complete it.
create or replace function private.process_revenuecat_event_v2(payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  e jsonb := payload->'event';
  receipt public.revenuecat_webhook_events%rowtype;
  user_id_value uuid;
  event_at timestamptz;
  expires_at_value timestamptz;
  affects_plus boolean;
  active_value boolean;
begin
  if e->>'id' is null or e->>'type' is null or e->>'app_user_id' is null
    or jsonb_typeof(e->'event_timestamp_ms') <> 'number' then
    raise exception 'Invalid purchase event';
  end if;
  user_id_value := (e->>'app_user_id')::uuid;
  event_at := to_timestamp((e->>'event_timestamp_ms')::numeric / 1000);
  if e->>'expiration_at_ms' is not null then
    expires_at_value := to_timestamp((e->>'expiration_at_ms')::numeric / 1000);
  end if;
  insert into public.revenuecat_webhook_events
    (event_id, event_type, app_user_id, event_timestamp_ms, environment, payload)
  values (e->>'id', e->>'type', e->>'app_user_id', (e->>'event_timestamp_ms')::bigint, e->>'environment', payload)
  on conflict do nothing;
  select * into receipt from public.revenuecat_webhook_events where event_id = e->>'id' for update;
  if receipt.payload <> payload then raise exception 'Purchase event identity conflict'; end if;
  if receipt.processed_at is not null then return jsonb_build_object('ok', true, 'idempotent', true); end if;
  affects_plus := coalesce(e->'entitlement_ids', '[]'::jsonb) ? 'plus'
    or e->>'product_id' in ('katchimeras_plus_monthly', 'katchimeras_plus_annual');
  if affects_plus then
    active_value := e->>'type' not in ('EXPIRATION', 'REFUND', 'TRANSFER')
      and (expires_at_value is null or expires_at_value > now());
    insert into public.economy_subscriptions as existing
      (user_id, revenuecat_app_user_id, entitlement_id, product_id, active, environment,
       original_purchase_at, expires_at, last_event_at, updated_at)
    values (user_id_value, e->>'app_user_id', 'plus', e->>'product_id', active_value, e->>'environment',
      case when e->>'purchased_at_ms' is not null then to_timestamp((e->>'purchased_at_ms')::numeric / 1000) end,
      expires_at_value, event_at, now())
    on conflict (user_id) do update set
      product_id = excluded.product_id, active = excluded.active, environment = excluded.environment,
      original_purchase_at = coalesce(existing.original_purchase_at, excluded.original_purchase_at),
      expires_at = excluded.expires_at, last_event_at = excluded.last_event_at, updated_at = excluded.updated_at
    where existing.last_event_at is null or existing.last_event_at <= excluded.last_event_at;
  end if;
  update public.revenuecat_webhook_events set processed_at = now(), processing_error = null where event_id = e->>'id';
  return jsonb_build_object('ok', true, 'idempotent', false);
end;
$$;
create or replace function public.process_revenuecat_event_v2(payload jsonb)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.process_revenuecat_event_v2(payload); $$;
revoke all on function private.process_revenuecat_event_v2(jsonb) from public, anon, authenticated;
revoke all on function public.process_revenuecat_event_v2(jsonb) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.process_revenuecat_event_v2(jsonb) to service_role;
grant execute on function public.process_revenuecat_event_v2(jsonb) to service_role;
