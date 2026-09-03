-- v40 makes the First Bloom restore an explicit, free Garden upgrade and
-- closes the first session inside Mossprout's durable meditation state.
-- Copying v39 preserves every existing allowlisted action for in-flight runs.
insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
select script_id, 40, step_id, action_id, surface
from public.ftue_action_catalog
where script_id = 'mossprout-first-session'
  and script_version = 39
on conflict (script_id, script_version, step_id, action_id) do nothing;

insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
values
  ('mossprout-first-session', 40, 'world.first_bloom_restore', 'world.restore_with_first_bloom', 'haven'),
  ('mossprout-first-session', 40, 'world.first_bloom_restore', 'world.complete_first_bloom_restore', 'haven'),
  ('mossprout-first-session', 40, 'companion.water_response', 'companion.ack_water_response', 'companion'),
  ('mossprout-first-session', 40, 'companion.first_rest', 'companion.begin_rest', 'companion'),
  ('mossprout-first-session', 40, 'companion.meditating', 'companion.tend_garden', 'companion')
on conflict (script_id, script_version, step_id, action_id) do nothing;
