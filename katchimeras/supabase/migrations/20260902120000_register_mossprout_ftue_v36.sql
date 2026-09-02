-- v36 removes the redundant Haven CTA between Mossprout's chapter-zero
-- return dialogue and the resident-parcel interaction. The existing
-- conversation receipt now advances directly to the next companion step.
insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
select script_id, 36, step_id, action_id, surface
from public.ftue_action_catalog
where script_id = 'mossprout-first-session'
  and script_version = 35
  and not (step_id = 'haven.first_bloom' and action_id = 'haven.continue_to_resident')
on conflict (script_id, script_version, step_id, action_id) do nothing;
