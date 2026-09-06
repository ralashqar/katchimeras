-- v42 makes the first personalized Seed an explicit world-space planting
-- action and holds on its first growth before returning to Mossprout.
insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
select script_id, 42, step_id, action_id, surface
from public.ftue_action_catalog
where script_id = 'mossprout-first-session'
  and script_version = 41
on conflict (script_id, script_version, step_id, action_id) do nothing;

insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
values
  ('mossprout-first-session', 42, 'world.garden_arrival', 'world.plant_first_seed', 'haven'),
  ('mossprout-first-session', 42, 'world.seed_planted', 'world.acknowledge_seed_dormant', 'haven'),
  ('mossprout-first-session', 42, 'world.first_seed_grew', 'world.acknowledge_first_seed_growth', 'haven')
on conflict (script_id, script_version, step_id, action_id) do nothing;
