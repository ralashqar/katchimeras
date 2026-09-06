-- v39 makes the first session relationship-first: one real-life Egg answer,
-- one growth-intent Bond choice, an optional Water Together check-in, and a
-- collectible first Seed. Existing v38 action ids remain allowlisted so
-- in-flight older runs can safely finish.
insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
select script_id, 39, step_id, action_id, surface
from public.ftue_action_catalog
where script_id = 'mossprout-first-session'
  and script_version = 38
on conflict (script_id, script_version, step_id, action_id) do nothing;

insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
values
  ('mossprout-first-session', 39, 'egg.opening', 'egg.day_texture', 'haven'),
  ('mossprout-first-session', 39, 'companion.first_insight', 'companion.keep_first_seed', 'companion')
on conflict (script_id, script_version, step_id, action_id) do nothing;
