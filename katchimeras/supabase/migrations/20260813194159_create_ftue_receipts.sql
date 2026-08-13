create table public.ftue_action_catalog (
  script_id text not null,
  script_version integer not null,
  step_id text not null,
  action_id text not null,
  surface text not null check (surface in ('today', 'hatch', 'companion', 'merge')),
  primary key (script_id, script_version, action_id)
);

insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface) values
  ('mossprout-first-session', 4, 'egg.opening', 'egg.feeling', 'today'),
  ('mossprout-first-session', 4, 'egg.opening', 'egg.where', 'today'),
  ('mossprout-first-session', 4, 'egg.opening', 'egg.mind', 'today'),
  ('mossprout-first-session', 4, 'egg.context', 'egg.context.activity', 'today'),
  ('mossprout-first-session', 4, 'egg.ready', 'egg.hatch', 'today'),
  ('mossprout-first-session', 4, 'companion.first_meeting', 'companion.complete_first_meeting', 'companion'),
  ('mossprout-first-session', 4, 'merge.first', 'merge.serve_sprout', 'merge'),
  ('mossprout-first-session', 4, 'energy.capture', 'energy.photo', 'today'),
  ('mossprout-first-session', 4, 'energy.capture', 'energy.write', 'today'),
  ('mossprout-first-session', 4, 'energy.capture', 'energy.people', 'today'),
  ('mossprout-first-session', 4, 'energy.capture', 'energy.place', 'today'),
  ('mossprout-first-session', 4, 'merge.flower_return', 'merge.serve_flower', 'merge'),
  ('mossprout-first-session', 4, 'merge.final', 'merge.serve_plant', 'merge'),
  ('mossprout-first-session', 4, 'chapter.complete', 'chapter.finish', 'merge');

create table public.ftue_action_receipts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_event_id text not null,
  run_id text not null,
  script_id text not null,
  script_version integer not null,
  step_id text not null,
  action_id text not null,
  surface text not null,
  committed_at timestamptz,
  received_at timestamptz not null default now(),
  unique (user_id, client_event_id),
  foreign key (script_id, script_version, action_id)
    references public.ftue_action_catalog (script_id, script_version, action_id)
);

alter table public.ftue_action_catalog enable row level security;
alter table public.ftue_action_receipts enable row level security;

create policy "authenticated can read ftue catalog"
on public.ftue_action_catalog for select to authenticated using (true);

create policy "players can read own ftue receipts"
on public.ftue_action_receipts for select to authenticated using ((select auth.uid()) = user_id);

create schema if not exists private;

create or replace function private.register_ftue_action_v1_inner(event_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  inserted_id bigint;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(event_payload) <> 'object' then raise exception 'Invalid payload'; end if;
  if not exists (
    select 1 from public.ftue_action_catalog c
    where c.script_id = event_payload->>'script_id'
      and c.script_version = (event_payload->>'script_version')::integer
      and c.step_id = event_payload->>'step_id'
      and c.action_id = event_payload->>'action_id'
      and c.surface = event_payload->>'surface'
  ) then raise exception 'Unknown FTUE action'; end if;

  insert into public.ftue_action_receipts (
    user_id, client_event_id, run_id, script_id, script_version, step_id, action_id, surface, committed_at
  ) values (
    actor,
    event_payload->>'client_event_id',
    event_payload->>'run_id',
    event_payload->>'script_id',
    (event_payload->>'script_version')::integer,
    event_payload->>'step_id',
    event_payload->>'action_id',
    event_payload->>'surface',
    nullif(event_payload->>'committed_at', '')::timestamptz
  ) on conflict (user_id, client_event_id) do nothing
  returning id into inserted_id;

  if inserted_id is null then
    select id into inserted_id from public.ftue_action_receipts
    where user_id = actor and client_event_id = event_payload->>'client_event_id';
  end if;
  return jsonb_build_object('receipt_id', inserted_id, 'accepted', true);
end;
$$;

revoke all on function private.register_ftue_action_v1_inner(jsonb) from public;
grant execute on function private.register_ftue_action_v1_inner(jsonb) to authenticated;

create or replace function public.register_ftue_action_v1(event_payload jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.register_ftue_action_v1_inner(event_payload); $$;

revoke all on function public.register_ftue_action_v1(jsonb) from public;
grant execute on function public.register_ftue_action_v1(jsonb) to authenticated;
grant usage on schema private to authenticated;
