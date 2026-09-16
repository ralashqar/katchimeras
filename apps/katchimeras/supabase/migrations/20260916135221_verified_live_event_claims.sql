-- Trusted event scoring is separate from legacy client-reported season XP.
create table private.live_event_definitions (
  id text primary key,
  definition jsonb not null,
  enabled boolean not null default false,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  claim_ends_at timestamptz not null,
  check (starts_at < ends_at and ends_at <= claim_ends_at),
  check (definition->>'id' = id and jsonb_typeof(definition->'rules') = 'array'
    and jsonb_typeof(definition->'tiers') = 'array')
);
create table private.live_event_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  harmony bigint not null default 0 check (harmony >= 0)
);
create table private.live_event_milestones (
  user_id uuid not null references auth.users(id) on delete cascade,
  milestone_key text not null,
  primary key(user_id, milestone_key)
);
create table private.live_event_actions (
  user_id uuid not null references auth.users(id) on delete cascade,
  action_id text not null,
  action jsonb not null,
  received_at timestamptz not null default now(),
  primary key(user_id, action_id)
);
create table private.live_event_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null references private.live_event_definitions(id),
  enrolled_at timestamptz not null default now(),
  points bigint not null default 0 check (points >= 0),
  rule_counts jsonb not null default '{}'::jsonb,
  primary key(user_id, event_id)
);
create table private.live_event_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null references private.live_event_definitions(id),
  tier_id text not null,
  track text not null check (track in ('free', 'premium')),
  reward jsonb not null,
  claimed_at timestamptz not null default now(),
  primary key(user_id, event_id, tier_id, track)
);
alter table private.live_event_definitions enable row level security;
alter table private.live_event_accounts enable row level security;
alter table private.live_event_milestones enable row level security;
alter table private.live_event_actions enable row level security;
alter table private.live_event_progress enable row level security;
alter table private.live_event_claims enable row level security;
revoke all on private.live_event_definitions, private.live_event_accounts,
  private.live_event_milestones, private.live_event_actions, private.live_event_progress,
  private.live_event_claims from public, anon, authenticated;

-- Availability may change; a player's definition and reward contract may not.
create function private.guard_live_event_definition() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.definition is distinct from old.definition
    or new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at
    or new.claim_ends_at is distinct from old.claim_ends_at then
    raise exception 'Event definitions are immutable; publish a new event ID';
  end if;
  return new;
end; $$;
create trigger live_event_definition_immutable before update on private.live_event_definitions
for each row execute function private.guard_live_event_definition();

-- Validate even direct operator inserts, not just Studio submissions.
create function private.validate_live_event_definition() returns trigger
language plpgsql set search_path = '' as $$
declare d jsonb := new.definition; r jsonb; t jsonb; f jsonb; seen text[]; previous bigint := -1;
begin
  if coalesce(d->>'id','') <> new.id or length(new.id) not between 1 and 160
    or coalesce(d->>'version','') !~ '^[1-9][0-9]{0,8}$'
    or coalesce(d->>'minHarmony','') !~ '^[0-9]{1,9}$'
    or coalesce(jsonb_typeof(d->'rules'),'') <> 'array'
    or coalesce(jsonb_typeof(d->'tiers'),'') <> 'array'
    or coalesce(jsonb_typeof(d->'enabled'),'') <> 'boolean'
    or coalesce(length(d->>'title'),0) = 0 or coalesce(length(d->>'description'),0) = 0
    or (d->>'startsAt')::timestamptz is distinct from new.starts_at
    or (d->>'endsAt')::timestamptz is distinct from new.ends_at
    or (d->>'claimEndsAt')::timestamptz is distinct from new.claim_ends_at then
    raise exception 'Invalid event definition';
  end if;
  if jsonb_array_length(d->'rules') not between 1 and 32 or jsonb_array_length(d->'tiers') > 100 then
    raise exception 'Invalid event definition size';
  end if;
  seen := array[]::text[];
  for r in select value from jsonb_array_elements(d->'rules') loop
    if coalesce(length(r->>'id'),0) not between 1 and 160 or r->>'id' = any(seen)
      or coalesce(r->>'kind','') not in ('merge','order_completed','mist_cleared','hex_restored','structure_upgraded',
        'friend_rescued','bond_gained','wisp_discovered','journey_completed','expedition_completed')
      or coalesce(r->>'points','') !~ '^[1-9][0-9]{0,9}$'
      or coalesce(r->>'limit','') !~ '^[1-9][0-9]{0,9}$' then raise exception 'Invalid scoring rule'; end if;
    if (r->>'points')::numeric * (r->>'limit')::numeric > 1000000000 then raise exception 'Unbounded scoring rule'; end if;
    seen := array_append(seen,r->>'id');
    f := r->'filter';
    if f is not null then
      if jsonb_typeof(f) <> 'object' then raise exception 'Invalid scoring filter'; end if;
      if f ? 'minItemTier' and coalesce(f->>'minItemTier','') !~ '^[1-9][0-9]{0,5}$' then raise exception 'Invalid tier filter'; end if;
      if f ? 'tags' then
        if jsonb_typeof(f->'tags') <> 'array' then raise exception 'Invalid tag filter'; end if;
        if exists(select 1 from jsonb_array_elements(f->'tags') v where jsonb_typeof(v) <> 'string') then raise exception 'Invalid tag filter'; end if;
      end if;
    end if;
  end loop;
  seen := array[]::text[];
  for t in select value from jsonb_array_elements(d->'tiers') loop
    if coalesce(length(t->>'id'),0) not between 1 and 160 or t->>'id' = any(seen)
      or coalesce(t->>'points','') !~ '^[0-9]{1,12}$' then raise exception 'Invalid reward tier'; end if;
    if (t->>'points')::bigint <= previous then raise exception 'Tier thresholds must increase'; end if;
    previous := (t->>'points')::bigint;
    seen := array_append(seen,t->>'id');
    if coalesce(jsonb_typeof(t->'free'->'items'),'') <> 'array' then raise exception 'Invalid free reward bundle'; end if;
  end loop;
  return new;
end; $$;
create trigger live_event_definition_valid before insert on private.live_event_definitions
for each row execute function private.validate_live_event_definition();

create function private.stage_live_event_definition_v1(event_definition jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare existing jsonb;
begin
  insert into private.live_event_definitions(id,definition,starts_at,ends_at,claim_ends_at)
    values(event_definition->>'id',event_definition,(event_definition->>'startsAt')::timestamptz,
      (event_definition->>'endsAt')::timestamptz,(event_definition->>'claimEndsAt')::timestamptz)
    on conflict do nothing;
  select definition into existing from private.live_event_definitions where id=event_definition->>'id';
  if existing <> event_definition then raise exception 'Event identity conflict'; end if;
  return jsonb_build_object('ok',true,'eventId',event_definition->>'id');
end; $$;

create function private.enroll_live_event_v1(target_event_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); d private.live_event_definitions%rowtype; h bigint;
begin
  if u is null then raise exception 'Authentication required'; end if;
  select * into d from private.live_event_definitions where id = target_event_id for share;
  if not found or not d.enabled or now() < d.starts_at or now() >= d.ends_at then
    return jsonb_build_object('ok', false, 'reason', 'event_unavailable');
  end if;
  select harmony into h from private.live_event_accounts where user_id = u;
  if coalesce(h, 0) < (d.definition->>'minHarmony')::bigint then
    return jsonb_build_object('ok', false, 'reason', 'harmony_required');
  end if;
  insert into private.live_event_progress(user_id, event_id) values(u, d.id) on conflict do nothing;
  return jsonb_build_object('ok', true, 'eventId', d.id);
end; $$;

-- This is a verifier sink, NOT a client upload endpoint. A future command-replay
-- worker must derive these facts itself, never forward the client's event journal.
create function private.record_verified_live_action_v1(target_user uuid, action jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  existing jsonb; stamp timestamptz; quantity bigint; context jsonb; kind text;
  award integer; inserted integer; p record; rule jsonb; filter jsonb;
  counts jsonb; score bigint; count_before bigint; amount bigint;
begin
  kind := action->>'kind'; context := action->'context';
  if target_user is null or coalesce(action->>'version', '') <> '1'
    or coalesce(length(action->>'id'), 0) not between 1 and 240
    or octet_length(action::text) > 16384
    or coalesce(jsonb_typeof(context), '') <> 'object'
    or coalesce(action->>'quantity', '') !~ '^[1-9][0-9]{0,5}$'
    or coalesce(action->>'occurredAt', '') !~ '^[0-9]{1,16}$'
    or coalesce(kind, '') not in ('merge','order_completed','mist_cleared','hex_restored',
      'structure_upgraded','friend_rescued','bond_gained','wisp_discovered','journey_completed','expedition_completed') then
    raise exception 'Invalid verified action';
  end if;
  stamp := to_timestamp((action->>'occurredAt')::numeric / 1000);
  quantity := (action->>'quantity')::bigint;
  if stamp > clock_timestamp() then raise exception 'Verified action is in the future'; end if;
  -- Serialize all scoring/eligibility changes per account, including duplicate delivery.
  insert into private.live_event_accounts(user_id) values(target_user) on conflict do nothing;
  perform 1 from private.live_event_accounts where user_id = target_user for update;
  select a.action into existing from private.live_event_actions a where user_id = target_user and action_id = record_verified_live_action_v1.action->>'id';
  if found then
    if existing <> action then raise exception 'Action identity conflict'; end if;
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;
  insert into private.live_event_actions(user_id, action_id, action) values(target_user, action->>'id', action);
  award := case kind when 'friend_rescued' then 100 when 'hex_restored' then 25
    when 'structure_upgraded' then 25 when 'mist_cleared' then 10
    when 'journey_completed' then 50 when 'wisp_discovered' then 10 else 0 end;
  if award > 0 and coalesce(length(context->>'targetId'), 0) > 0 then
    insert into private.live_event_milestones(user_id, milestone_key)
      values(target_user, jsonb_build_array(kind, context->>'targetId', coalesce(context->'level', '0'::jsonb))::text)
      on conflict do nothing;
    get diagnostics inserted = row_count;
    if inserted = 1 then update private.live_event_accounts set harmony = harmony + award where user_id = target_user; end if;
  end if;
  if coalesce((action->>'historical')::boolean, false) then return jsonb_build_object('ok', true, 'duplicate', false); end if;
  for p in select progress.*, d.definition from private.live_event_progress progress
    join private.live_event_definitions d on d.id = progress.event_id
    where progress.user_id = target_user and d.enabled and stamp >= d.starts_at
      and stamp < d.ends_at and stamp >= progress.enrolled_at and now() < d.claim_ends_at
    order by progress.event_id for update of progress
  loop
    counts := p.rule_counts; score := p.points;
    for rule in select value from jsonb_array_elements(p.definition->'rules') loop
      if rule->>'kind' <> kind then continue; end if;
      filter := coalesce(rule->'filter', '{}'::jsonb);
      if (filter ? 'companionId' and (filter->>'companionId') is distinct from (context->>'companionId'))
        or (filter ? 'regionId' and (filter->>'regionId') is distinct from (context->>'regionId'))
        or (filter ? 'targetId' and (filter->>'targetId') is distinct from (context->>'targetId'))
        or (filter ? 'minItemTier' and coalesce((context->>'itemTier')::integer, 0) < (filter->>'minItemTier')::integer)
        or (filter ? 'tags' and not coalesce(context->'tags', '[]'::jsonb) @> (filter->'tags')) then continue; end if;
      count_before := coalesce((counts->>(rule->>'id'))::bigint, 0);
      amount := least(quantity, greatest(0, (rule->>'limit')::bigint - count_before));
      counts := jsonb_set(counts, array[rule->>'id'], to_jsonb(count_before + amount), true);
      score := score + amount * (rule->>'points')::bigint;
    end loop;
    update private.live_event_progress set points = score, rule_counts = counts
      where user_id = target_user and event_id = p.event_id;
  end loop;
  return jsonb_build_object('ok', true, 'duplicate', false);
end; $$;

create function private.claim_live_event_reward_v1(target_event_id text, target_tier_id text, target_track text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid(); d private.live_event_definitions%rowtype; progress private.live_event_progress%rowtype;
  tier jsonb; reward jsonb; item jsonb; receipt jsonb; item_index integer := 0; source_key text;
begin
  if u is null then raise exception 'Authentication required'; end if;
  if target_track is null or target_track not in ('free','premium') then raise exception 'Invalid track'; end if;
  select * into d from private.live_event_definitions where id = target_event_id for share;
  if not found then return jsonb_build_object('ok', false, 'reason', 'event_unavailable'); end if;
  select * into progress from private.live_event_progress where user_id = u and event_id = d.id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_enrolled'); end if;
  select c.reward into receipt from private.live_event_claims c
    where user_id = u and event_id = d.id and tier_id = target_tier_id and track = target_track;
  if found then return jsonb_build_object('ok', true, 'duplicate', true, 'reward', receipt); end if;
  if not d.enabled or now() < d.starts_at or now() >= d.claim_ends_at then
    return jsonb_build_object('ok', false, 'reason', 'claims_closed');
  end if;
  -- Plus is not a seasonal pass entitlement. Keep paid claims off until store acceptance.
  if target_track = 'premium' then return jsonb_build_object('ok', false, 'reason', 'premium_disabled'); end if;
  select value into tier from jsonb_array_elements(d.definition->'tiers') where value->>'id' = target_tier_id;
  if tier is null then return jsonb_build_object('ok', false, 'reason', 'invalid_tier'); end if;
  if progress.points < (tier->>'points')::bigint then return jsonb_build_object('ok', false, 'reason', 'not_eligible'); end if;
  reward := tier->target_track;
  if coalesce(jsonb_typeof(reward->'items'), '') <> 'array' then raise exception 'Invalid reward bundle'; end if;
  if jsonb_array_length(reward->'items') not between 1 and 20 then raise exception 'Invalid reward bundle size'; end if;
  -- Preflight the entire bundle. Never acknowledge an unimplemented reward kind.
  for item in select value from jsonb_array_elements(reward->'items') loop
    if item->>'kind' = 'gems' then
      if coalesce(item->>'amount', '') !~ '^[1-9][0-9]{0,5}$' then raise exception 'Invalid Gem reward'; end if;
    elsif item->>'kind' = 'wisp' then
      if coalesce(length(item->>'id'), 0) not between 1 and 120 then raise exception 'Invalid Wisp reward'; end if;
    else return jsonb_build_object('ok', false, 'reason', 'unsupported_reward');
    end if;
  end loop;
  insert into private.live_event_claims(user_id,event_id,tier_id,track,reward)
    values(u,d.id,target_tier_id,target_track,reward);
  for item in select value from jsonb_array_elements(reward->'items') loop
    source_key := 'live-event:' || jsonb_build_array(d.id,target_tier_id,target_track,item_index)::text;
    if item->>'kind' = 'gems' then
      insert into public.economy_gem_ledger(user_id,delta,reason,source_type,idempotency_key)
        values(u,(item->>'amount')::integer,'live_event_reward','live_event',source_key);
    else
      insert into public.economy_collectible_grants(user_id,collectible_type,collectible_id,quantity,source,source_key)
        values(u,'wisp',item->>'id',1,'season',source_key);
    end if;
    item_index := item_index + 1;
  end loop;
  return jsonb_build_object('ok', true, 'duplicate', false, 'reward', reward);
end; $$;

create function private.get_live_event_state_v1() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := auth.uid(); result jsonb;
begin
  if u is null then raise exception 'Authentication required'; end if;
  select jsonb_build_object('serverTime', now(), 'harmony', coalesce((select harmony from private.live_event_accounts where user_id = u),0),
    'events', coalesce((select jsonb_agg(jsonb_build_object('definition',d.definition,'enabled',d.enabled,
      'enrolledAt',p.enrolled_at,'points',coalesce(p.points,0),'ruleCounts',coalesce(p.rule_counts,'{}'::jsonb),
      'claims',coalesce((select jsonb_agg(jsonb_build_object('tierId',c.tier_id,'track',c.track,'reward',c.reward))
        from private.live_event_claims c where c.user_id = u and c.event_id = d.id),'[]'::jsonb)) order by d.id)
      from private.live_event_definitions d left join private.live_event_progress p on p.event_id = d.id and p.user_id = u
      where (d.enabled and now() >= d.starts_at and now() < d.claim_ends_at) or p.user_id is not null),'[]'::jsonb)) into result;
  return result;
end; $$;

create function public.enroll_live_event_v1(event_id text) returns jsonb language sql security invoker set search_path = ''
as $$ select private.enroll_live_event_v1(event_id); $$;
create function public.claim_live_event_reward_v1(event_id text,tier_id text,track text) returns jsonb language sql security invoker set search_path = ''
as $$ select private.claim_live_event_reward_v1(event_id,tier_id,track); $$;
create function public.get_live_event_state_v1() returns jsonb language sql security invoker set search_path = ''
as $$ select private.get_live_event_state_v1(); $$;
create function public.record_verified_live_action_v1(target_user uuid,action jsonb) returns jsonb language sql security invoker set search_path = ''
as $$ select private.record_verified_live_action_v1(target_user,action); $$;
create function public.stage_live_event_definition_v1(event_definition jsonb) returns jsonb language sql security invoker set search_path = ''
as $$ select private.stage_live_event_definition_v1(event_definition); $$;

revoke all on function private.guard_live_event_definition() from public,anon,authenticated;
revoke all on function private.validate_live_event_definition() from public,anon,authenticated;
revoke all on function private.enroll_live_event_v1(text),public.enroll_live_event_v1(text),
  private.claim_live_event_reward_v1(text,text,text),public.claim_live_event_reward_v1(text,text,text),
  private.get_live_event_state_v1(),public.get_live_event_state_v1() from public,anon;
grant execute on function private.enroll_live_event_v1(text),public.enroll_live_event_v1(text),
  private.claim_live_event_reward_v1(text,text,text),public.claim_live_event_reward_v1(text,text,text),
  private.get_live_event_state_v1(),public.get_live_event_state_v1() to authenticated;
revoke all on function private.record_verified_live_action_v1(uuid,jsonb),public.record_verified_live_action_v1(uuid,jsonb) from public,anon,authenticated;
grant execute on function private.record_verified_live_action_v1(uuid,jsonb),public.record_verified_live_action_v1(uuid,jsonb) to service_role;
revoke all on function private.stage_live_event_definition_v1(jsonb),public.stage_live_event_definition_v1(jsonb) from public,anon,authenticated;
grant execute on function private.stage_live_event_definition_v1(jsonb),public.stage_live_event_definition_v1(jsonb) to service_role;
