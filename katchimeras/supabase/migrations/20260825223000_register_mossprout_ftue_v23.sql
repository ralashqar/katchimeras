-- v23 makes the post-card closest-match acknowledgement an authored FTUE
-- node so its Continue action durably releases navigation and normal content.
insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
select script_id, 23, step_id, action_id, surface
from public.ftue_action_catalog
where script_id = 'mossprout-first-session'
  and script_version = 22
on conflict (script_id, script_version, step_id, action_id) do nothing;

insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
values ('mossprout-first-session', 23, 'companion.resident_match_result', 'companion.ack_resident_match_result', 'companion')
on conflict (script_id, script_version, step_id, action_id) do nothing;
