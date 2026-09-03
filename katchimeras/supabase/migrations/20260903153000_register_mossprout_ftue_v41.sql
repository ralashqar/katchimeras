-- v41 adds the second egg input and stores support style separately from the
-- player's desired outcome. Copying v40 preserves retired-node recovery.
insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
select script_id, 41, step_id, action_id, surface
from public.ftue_action_catalog
where script_id = 'mossprout-first-session'
  and script_version = 40
on conflict (script_id, script_version, step_id, action_id) do nothing;

insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
values
  ('mossprout-first-session', 41, 'egg.context', 'egg.desired_help', 'haven'),
  ('mossprout-first-session', 41, 'companion.day_one_action', 'companion.choose_support_style', 'companion'),
  ('mossprout-first-session', 41, 'companion.first_insight', 'companion.confirm_first_reflection', 'companion')
on conflict (script_id, script_version, step_id, action_id) do nothing;
