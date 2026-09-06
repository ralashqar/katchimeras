-- v27 limits FTUE questions to four choices in a consistent 2x2 presentation.
insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
select script_id, 27, step_id, action_id, surface
from public.ftue_action_catalog
where script_id = 'mossprout-first-session'
  and script_version = 26
on conflict (script_id, script_version, step_id, action_id) do nothing;
