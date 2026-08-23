-- v19 teaches Bond before the first optional action and gives that teaching
-- moment its own durable FTUE receipt.
insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
select script_id, 19, step_id, action_id, surface
from public.ftue_action_catalog
where script_id = 'mossprout-first-session'
  and script_version = 18
on conflict (script_id, script_version, step_id, action_id) do nothing;

insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
values ('mossprout-first-session', 19, 'companion.bond_spotlight', 'companion.acknowledge_bond', 'companion')
on conflict (script_id, script_version, step_id, action_id) do nothing;
