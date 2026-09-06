-- Streamlined first session. Retain old allowlist entries for offline receipts.
insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
select script_id, 43, step_id, action_id, surface
from public.ftue_action_catalog
where script_id = 'mossprout-first-session'
  and script_version = 42
on conflict (script_id, script_version, step_id, action_id) do nothing;

insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
values
  ('mossprout-first-session', 43, 'companion.garden_intro', 'companion.continue_to_planting', 'companion'),
  ('mossprout-first-session', 43, 'merge.handoff.spawn', 'merge.handoff.spawn', 'merge'),
  ('mossprout-first-session', 43, 'merge.handoff.merge', 'merge.handoff.merge', 'merge')
on conflict (script_id, script_version, step_id, action_id) do nothing;
