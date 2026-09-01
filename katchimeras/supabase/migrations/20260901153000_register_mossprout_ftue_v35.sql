-- v35 keeps Egg feeding, hatching, Bond teaching, and Mossprout dialogue on
-- the focused world map, then adds a narrated Garden camera arrival before
-- the existing spotlighted Garden handoff.
insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
select script_id, 35, step_id, action_id, surface
from public.ftue_action_catalog
where script_id = 'mossprout-first-session'
  and script_version = 34
on conflict (script_id, script_version, step_id, action_id) do nothing;
