-- Separate opt-in verified pilot. Never overwrite/import the existing local world.
create table private.verified_merge_checkpoints (
  user_id uuid primary key references auth.users(id) on delete cascade,
  device_id uuid not null,
  epoch bigint not null default 1 check (epoch > 0),
  sequence bigint not null default 0 check (sequence between 0 and 9007199254740991),
  ruleset_id text not null,
  seed text not null,
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  expires_at timestamptz not null default now() + interval '24 hours',
  updated_at timestamptz not null default now()
);
create table private.verified_merge_batches (
  user_id uuid not null references private.verified_merge_checkpoints(user_id) on delete cascade,
  epoch bigint not null,
  from_sequence bigint not null,
  through_sequence bigint not null,
  batch jsonb not null,
  accepted_at timestamptz not null default now(),
  primary key(user_id,epoch,from_sequence)
);
alter table private.verified_merge_checkpoints enable row level security;
alter table private.verified_merge_batches enable row level security;
revoke all on private.verified_merge_checkpoints,private.verified_merge_batches from public,anon,authenticated;

create function private.verified_merge_checkpoint_json(c private.verified_merge_checkpoints) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('deviceId',c.device_id,'epoch',c.epoch,'sequence',c.sequence,
    'rulesetId',c.ruleset_id,'seed',c.seed,'state',c.state,'expiresAt',c.expires_at);
$$;

create function private.begin_verified_merge_v1(target_user uuid,device_id uuid,ruleset_id text,initial_state jsonb,random_seed text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c private.verified_merge_checkpoints%rowtype;
begin
  if device_id is null or coalesce(length(ruleset_id),0) not between 1 and 160
    or coalesce(length(random_seed),0) not between 16 and 160 or coalesce(jsonb_typeof(initial_state),'') <> 'object'
    or octet_length(initial_state::text) > 2000000 then raise exception 'Invalid initial checkpoint'; end if;
  insert into private.live_event_accounts(user_id) values(target_user) on conflict do nothing;
  perform 1 from private.live_event_accounts where user_id=target_user for update;
  insert into private.verified_merge_checkpoints(user_id,device_id,ruleset_id,seed,state)
    values(target_user,device_id,ruleset_id,random_seed,initial_state) on conflict do nothing;
  select * into c from private.verified_merge_checkpoints where user_id=target_user for update;
  if c.device_id <> device_id then return jsonb_build_object('ok',false,'reason','device_conflict','epoch',c.epoch); end if;
  if c.ruleset_id <> ruleset_id then return jsonb_build_object('ok',false,'reason','ruleset_unavailable'); end if;
  update private.verified_merge_checkpoints set expires_at=now()+interval '24 hours' where user_id=target_user returning * into c;
  return jsonb_build_object('ok',true,'checkpoint',private.verified_merge_checkpoint_json(c));
end; $$;

create function private.load_verified_merge_v1(target_user uuid,device_id uuid,requested_batch jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c private.verified_merge_checkpoints%rowtype; receipt private.verified_merge_batches%rowtype;
begin
  select * into c from private.verified_merge_checkpoints where user_id=target_user;
  if not found then return jsonb_build_object('ok',false,'reason','checkpoint_required'); end if;
  if c.device_id <> device_id or device_id is null then return jsonb_build_object('ok',false,'reason','device_conflict','epoch',c.epoch); end if;
  if c.expires_at <= now() then return jsonb_build_object('ok',false,'reason','lease_expired'); end if;
  if requested_batch is not null then
    if (requested_batch->>'epoch')::bigint is distinct from c.epoch then return jsonb_build_object('ok',false,'reason','device_conflict'); end if;
    select * into receipt from private.verified_merge_batches where user_id=target_user
      and epoch=c.epoch and from_sequence=(requested_batch->>'fromSequence')::bigint;
    if found then
      if receipt.batch <> requested_batch then raise exception 'Batch identity conflict'; end if;
      return jsonb_build_object('ok',true,'duplicate',true,'acceptedThrough',receipt.through_sequence,'checkpoint',private.verified_merge_checkpoint_json(c));
    end if;
  end if;
  return jsonb_build_object('ok',true,'duplicate',false,'checkpoint',private.verified_merge_checkpoint_json(c),
    'serverNow',floor(extract(epoch from clock_timestamp())*1000)::bigint);
end; $$;

create function private.commit_verified_merge_v1(target_user uuid,batch jsonb,next_state jsonb,verified_events jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c private.verified_merge_checkpoints%rowtype; receipt private.verified_merge_batches%rowtype; event jsonb; count integer;
begin
  -- Match the scoring lock order to avoid account/checkpoint inversion.
  perform 1 from private.live_event_accounts where user_id=target_user for update;
  select * into c from private.verified_merge_checkpoints where user_id=target_user for update;
  if not found then raise exception 'Checkpoint required'; end if;
  if c.device_id::text is distinct from (batch->>'deviceId') or c.epoch is distinct from (batch->>'epoch')::bigint then raise exception 'Device ownership changed'; end if;
  if c.expires_at <= now() then raise exception 'Checkpoint lease expired'; end if;
  if c.ruleset_id is distinct from (batch->>'rulesetId') then raise exception 'Ruleset mismatch'; end if;
  select * into receipt from private.verified_merge_batches where user_id=target_user and epoch=c.epoch and from_sequence=(commit_verified_merge_v1.batch->>'fromSequence')::bigint;
  if found then
    if receipt.batch <> batch then raise exception 'Batch identity conflict'; end if;
    return jsonb_build_object('ok',true,'duplicate',true,'acceptedThrough',receipt.through_sequence,'checkpoint',private.verified_merge_checkpoint_json(c));
  end if;
  if c.sequence is distinct from (batch->>'fromSequence')::bigint then raise exception 'Sequence conflict'; end if;
  count := jsonb_array_length(batch->'actions');
  if count is null or count not between 1 and 100 or coalesce(jsonb_typeof(next_state),'') <> 'object'
    or octet_length(next_state::text)>2000000 or coalesce(jsonb_typeof(verified_events),'') <> 'array'
    or jsonb_array_length(verified_events)>100 then raise exception 'Invalid replay result'; end if;
  for event in select value from jsonb_array_elements(verified_events) loop
    perform private.record_verified_live_action_v1(target_user,event);
  end loop;
  update private.verified_merge_checkpoints set sequence=c.sequence+count,state=next_state,updated_at=now()
    where user_id=target_user returning * into c;
  insert into private.verified_merge_batches(user_id,epoch,from_sequence,through_sequence,batch)
    values(target_user,c.epoch,(batch->>'fromSequence')::bigint,c.sequence,batch);
  return jsonb_build_object('ok',true,'duplicate',false,'acceptedThrough',c.sequence,'checkpoint',private.verified_merge_checkpoint_json(c));
end; $$;

-- Explicit account recovery fences old devices; it preserves the trusted world.
create function private.transfer_verified_merge_v1(new_device_id uuid,expected_epoch bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid:=auth.uid(); c private.verified_merge_checkpoints%rowtype;
begin
  if u is null or new_device_id is null then raise exception 'Authentication and device required'; end if;
  perform 1 from private.live_event_accounts where user_id=u for update;
  select * into c from private.verified_merge_checkpoints where user_id=u for update;
  if not found then return jsonb_build_object('ok',false,'reason','checkpoint_required'); end if;
  if c.epoch is distinct from expected_epoch then return jsonb_build_object('ok',false,'reason','epoch_conflict'); end if;
  if c.device_id <> new_device_id then
    update private.verified_merge_checkpoints set device_id=new_device_id,epoch=epoch+1,expires_at=now()+interval '24 hours',updated_at=now()
      where user_id=u returning * into c;
  end if;
  return jsonb_build_object('ok',true,'checkpoint',private.verified_merge_checkpoint_json(c));
end; $$;

create function public.begin_verified_merge_v1(target_user uuid,device_id uuid,ruleset_id text,initial_state jsonb,random_seed text)
returns jsonb language sql security invoker set search_path = '' as $$ select private.begin_verified_merge_v1(target_user,device_id,ruleset_id,initial_state,random_seed); $$;
create function public.load_verified_merge_v1(target_user uuid,device_id uuid,requested_batch jsonb default null)
returns jsonb language sql security invoker set search_path = '' as $$ select private.load_verified_merge_v1(target_user,device_id,requested_batch); $$;
create function public.commit_verified_merge_v1(target_user uuid,batch jsonb,next_state jsonb,verified_events jsonb)
returns jsonb language sql security invoker set search_path = '' as $$ select private.commit_verified_merge_v1(target_user,batch,next_state,verified_events); $$;
create function public.transfer_verified_merge_v1(new_device_id uuid,expected_epoch bigint)
returns jsonb language sql security invoker set search_path = '' as $$ select private.transfer_verified_merge_v1(new_device_id,expected_epoch); $$;

revoke all on function private.verified_merge_checkpoint_json(private.verified_merge_checkpoints) from public,anon,authenticated;
revoke all on function private.begin_verified_merge_v1(uuid,uuid,text,jsonb,text),public.begin_verified_merge_v1(uuid,uuid,text,jsonb,text),
  private.load_verified_merge_v1(uuid,uuid,jsonb),public.load_verified_merge_v1(uuid,uuid,jsonb),
  private.commit_verified_merge_v1(uuid,jsonb,jsonb,jsonb),public.commit_verified_merge_v1(uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function private.begin_verified_merge_v1(uuid,uuid,text,jsonb,text),public.begin_verified_merge_v1(uuid,uuid,text,jsonb,text),
  private.load_verified_merge_v1(uuid,uuid,jsonb),public.load_verified_merge_v1(uuid,uuid,jsonb),
  private.commit_verified_merge_v1(uuid,jsonb,jsonb,jsonb),public.commit_verified_merge_v1(uuid,jsonb,jsonb,jsonb) to service_role;
revoke all on function private.transfer_verified_merge_v1(uuid,bigint),public.transfer_verified_merge_v1(uuid,bigint) from public,anon;
grant execute on function private.transfer_verified_merge_v1(uuid,bigint),public.transfer_verified_merge_v1(uuid,bigint) to authenticated;
