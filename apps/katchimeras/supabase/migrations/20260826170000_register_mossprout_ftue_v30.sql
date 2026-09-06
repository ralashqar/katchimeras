-- v30 makes the first resident lesson deterministic: Petalimp, one nearby
-- mystery card, one forced Seed, two locked Echo merges, and one Plant order.
insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
select script_id, 30, step_id, action_id, surface
from public.ftue_action_catalog
where script_id = 'mossprout-first-session'
  and script_version = 29
on conflict (script_id, script_version, step_id, action_id) do nothing;

insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface) values
  ('mossprout-first-session', 30, 'merge.resident_seed_spawn', 'merge.spawn_resident_seed', 'merge'),
  ('mossprout-first-session', 30, 'merge.resident_seed_echo', 'merge.clear_resident_seed_echo', 'merge'),
  ('mossprout-first-session', 30, 'merge.resident_sprout_echo', 'merge.clear_resident_sprout_echo', 'merge')
on conflict (script_id, script_version, step_id, action_id) do nothing;
