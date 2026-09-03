-- Glow discovery starts as a separate local Content Flow after meditation.
-- Keep every historical action valid for delayed/offline receipt uploads.
insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
select script_id, 44, step_id, action_id, surface
from public.ftue_action_catalog
where script_id = 'mossprout-first-session' and script_version = 43
on conflict (script_id, script_version, step_id, action_id) do nothing;
