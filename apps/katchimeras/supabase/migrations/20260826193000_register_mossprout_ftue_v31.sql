-- v31 pivots the first session to Haven-first discovery, three attunement
-- answers, and a four-Seed First Bloom while retaining the existing runtime.
insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
select script_id, 31, step_id, action_id, surface
from public.ftue_action_catalog
where script_id = 'mossprout-first-session'
  and script_version = 30
on conflict (script_id, script_version, step_id, action_id) do nothing;

insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface) values
  ('mossprout-first-session', 31, 'merge.second_seed_drag', 'merge.create_second_sprout', 'merge'),
  ('mossprout-first-session', 31, 'merge.first_bloom', 'merge.create_first_bloom', 'merge')
on conflict (script_id, script_version, step_id, action_id) do nothing;
