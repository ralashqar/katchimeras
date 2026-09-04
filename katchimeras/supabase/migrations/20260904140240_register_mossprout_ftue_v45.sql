-- Register the life companion FTUE; action identities and rewards are unchanged.
-- Union prior catalogs also supports fresh databases with the earlier v43/v44 file order.
insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
select distinct script_id, 45, step_id, action_id, surface
from public.ftue_action_catalog
where script_id = 'mossprout-first-session' and script_version in (43, 44)
on conflict (script_id, script_version, step_id, action_id) do nothing;
