-- v33 connects the First Bloom to the existing resident-card lesson before
-- the final Haven reward. Existing action ids retain their established
-- surfaces; only the explicit First Bloom bridge is new.
insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
select script_id, 33, step_id, action_id, surface
from public.ftue_action_catalog
where script_id = 'mossprout-first-session'
  and script_version = 32
on conflict (script_id, script_version, step_id, action_id) do nothing;

insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface) values
  ('mossprout-first-session', 33, 'haven.first_bloom', 'haven.continue_to_resident', 'haven')
on conflict (script_id, script_version, step_id, action_id) do update
set surface = excluded.surface;
