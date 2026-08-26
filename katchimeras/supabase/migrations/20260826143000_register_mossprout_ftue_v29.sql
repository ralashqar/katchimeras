-- v29 moves the Bond lesson before the Garden and adds one local-only
-- get-to-know-you choice. Only backend-visible actions need catalog entries.
insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
select script_id, 29, step_id, action_id, surface
from public.ftue_action_catalog
where script_id = 'mossprout-first-session'
  and script_version = 28
on conflict (script_id, script_version, step_id, action_id) do nothing;
