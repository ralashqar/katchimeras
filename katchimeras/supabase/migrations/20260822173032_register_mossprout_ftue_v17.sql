-- v17 keeps the three-step growing Egg opening while shortening the Merge
-- tutorial. Reuse the existing privacy-safe action catalog.
insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
select script_id, 17, step_id, action_id, surface
from public.ftue_action_catalog
where script_id = 'mossprout-first-session'
  and script_version = 16
on conflict (script_id, script_version, step_id, action_id) do nothing;
