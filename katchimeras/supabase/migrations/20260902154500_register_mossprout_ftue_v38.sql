-- v38 restores the authored top-of-screen Egg introduction while keeping the
-- redundant inspect beat retired. The intro advances automatically into the
-- first question after its slow world-camera focus completes.
insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
select script_id, 38, step_id, action_id, surface
from public.ftue_action_catalog
where script_id = 'mossprout-first-session'
  and script_version = 37
on conflict (script_id, script_version, step_id, action_id) do nothing;

insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
values ('mossprout-first-session', 38, 'world.egg_intro', 'world.inspect_mossprout_egg', 'haven')
on conflict (script_id, script_version, step_id, action_id) do nothing;
