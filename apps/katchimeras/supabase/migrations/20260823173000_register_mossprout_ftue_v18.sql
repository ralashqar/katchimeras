-- v18 extends the first day with one player-chosen Bond action after the
-- chapter return. Existing completed runs remain complete; active runs migrate
-- through the normal script-version reconciliation.
insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
select script_id, 18, step_id, action_id, surface
from public.ftue_action_catalog
where script_id = 'mossprout-first-session'
  and script_version = 17
on conflict (script_id, script_version, step_id, action_id) do nothing;

insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
values ('mossprout-first-session', 18, 'companion.day_one_action', 'companion.complete_day_one_action', 'companion')
on conflict (script_id, script_version, step_id, action_id) do nothing;
