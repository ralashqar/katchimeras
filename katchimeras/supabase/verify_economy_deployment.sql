select jsonb_build_object(
  'config', (
    select jsonb_build_object(
      'id', id,
      'version', version,
      'enabled', enabled,
      'flags', payload->'flags'
    )
    from public.economy_live_config
    where id = 'default'
  ),
  'tables', (
    select count(*)
    from pg_tables
    where schemaname = 'public' and tablename like 'economy_%'
  ),
  'rls_missing', (
    select coalesce(jsonb_agg(tablename), '[]'::jsonb)
    from pg_tables
    where schemaname = 'public' and tablename like 'economy_%' and not rowsecurity
  ),
  'disabled_offers', (
    select count(*) from public.economy_offers where not enabled
  ),
  'enabled_offers', (
    select count(*) from public.economy_offers where enabled
  ),
  'enabled_reward_rules', (
    select count(*) from public.economy_reward_rules where enabled
  ),
  'public_security_definers', (
    select coalesce(jsonb_agg(proname), '[]'::jsonb)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and proname like '%economy%' and prosecdef
  ),
  'private_security_definers', (
    select coalesce(jsonb_agg(proname), '[]'::jsonb)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and (proname like '%economy%' or proname like '%visitor%' or proname like '%avatar%')
      and prosecdef
  )
) as economy_deployment;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select jsonb_build_object(
  'config_is_disabled', public.get_economy_snapshot_v1()->'config' = 'null'::jsonb,
  'balance', public.get_economy_snapshot_v1()->'snapshot'->'essenceBalance',
  'inventory', public.get_economy_snapshot_v1()->'snapshot'->'inventory',
  'synced', public.get_economy_snapshot_v1()->'snapshot'->'synced'
) as authenticated_rpc_check;
rollback;
