-- v22 binds the first resident parcel, sealed-card merge, requests, and reward
-- into one recoverable FTUE-owned chapter.
insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
select script_id, 22, step_id, action_id, surface
from public.ftue_action_catalog
where script_id = 'mossprout-first-session'
  and script_version = 21
on conflict (script_id, script_version, step_id, action_id) do nothing;
