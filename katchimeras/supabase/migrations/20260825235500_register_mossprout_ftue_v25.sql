-- v25 separates Mossprout's friendship, Garden introduction, and first order
-- into distinct dialogue beats. Copy v24, then register the new transition.
insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
select script_id, 25, step_id, action_id, surface
from public.ftue_action_catalog
where script_id = 'mossprout-first-session'
  and script_version = 24
on conflict (script_id, script_version, step_id, action_id) do nothing;

insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
values
  ('mossprout-first-session', 25, 'companion.garden_intro', 'companion.acknowledge_garden_intro', 'companion')
on conflict (script_id, script_version, step_id, action_id) do nothing;
