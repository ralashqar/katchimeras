-- Two-wisp hatch: question/action IDs stay stable; new narrative beats are local.
-- Include the last registered catalog on fresh databases and any intermediate releases.
insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
select distinct script_id, 51, step_id, action_id, surface
from public.ftue_action_catalog
where script_id = 'mossprout-first-session' and script_version between 45 and 50
on conflict (script_id, script_version, step_id, action_id) do nothing;
