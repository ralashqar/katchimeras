-- v26 teaches the action-card loop with a first "Introduce yourself" action.
insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
select script_id, 26, step_id, action_id, surface
from public.ftue_action_catalog
where script_id = 'mossprout-first-session'
  and script_version = 25
on conflict (script_id, script_version, step_id, action_id) do nothing;

insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
values
  ('mossprout-first-session', 26, 'companion.intro_action', 'companion.start_introduction', 'companion')
on conflict (script_id, script_version, step_id, action_id) do nothing;
