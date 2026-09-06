-- v34 starts inside Mossprout's focused world, introduces a world-map Garden
-- handoff, and completes on that same map without a cosmetic or Haven upgrade.
insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
select script_id, 34, step_id, action_id, surface
from public.ftue_action_catalog
where script_id = 'mossprout-first-session'
  and script_version = 33
on conflict (script_id, script_version, step_id, action_id) do nothing;

insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface) values
  ('mossprout-first-session', 34, 'world.garden_handoff', 'world.open_garden', 'haven'),
  ('mossprout-first-session', 34, 'world.complete', 'world.finish', 'haven')
on conflict (script_id, script_version, step_id, action_id) do update
set surface = excluded.surface;
