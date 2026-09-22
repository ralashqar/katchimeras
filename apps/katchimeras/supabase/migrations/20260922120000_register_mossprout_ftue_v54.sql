-- The first session is the merges, the Egg, one meeting, the planting and the rest: no sheet before the planting,
-- no chat after it. Step and action IDs that remain are unchanged; retired steps stay in the catalog for old receipts.
-- Versions 52 and 53 shipped without a registration of their own, so all three are carried from the last registered
-- catalog here (fresh databases included).
insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
select distinct script_id, versions.script_version, step_id, action_id, surface
from public.ftue_action_catalog
cross join (values (52), (53), (54)) as versions(script_version)
where script_id = 'mossprout-first-session' and public.ftue_action_catalog.script_version between 45 and 51
on conflict (script_id, script_version, step_id, action_id) do nothing;
