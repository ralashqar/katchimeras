-- v37 begins directly with the first Egg question. The passive world notice
-- and inspect gates are retired so opening copy and choices share one top-led
-- action-card composition.
insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
select script_id, 37, step_id, action_id, surface
from public.ftue_action_catalog
where script_id = 'mossprout-first-session'
  and script_version = 36
  and step_id not in ('world.egg_intro', 'grove.egg_inspect')
on conflict (script_id, script_version, step_id, action_id) do nothing;
