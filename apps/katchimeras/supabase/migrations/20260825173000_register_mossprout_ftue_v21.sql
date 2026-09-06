-- v21 adds an explicit, durable parcel-ready confirmation before Merge.
insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
select script_id, 21, step_id, action_id, surface
from public.ftue_action_catalog
where script_id = 'mossprout-first-session'
  and script_version = 20
on conflict (script_id, script_version, step_id, action_id) do nothing;

insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
values ('mossprout-first-session', 21, 'companion.resident_parcel_ready', 'companion.open_resident_parcel', 'companion')
on conflict (script_id, script_version, step_id, action_id) do nothing;
