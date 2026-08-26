-- v32 makes the opening a continuous Haven-owned sequence: Home notice,
-- Mossprout tile reveal, Grove attunement, hatch, and first meeting.
insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
select script_id, 32, step_id, action_id, surface
from public.ftue_action_catalog
where script_id = 'mossprout-first-session'
  and script_version = 31
on conflict (script_id, script_version, step_id, action_id) do nothing;

delete from public.ftue_action_catalog
where script_id = 'mossprout-first-session'
  and script_version = 32
  and step_id in ('haven.discovery', 'hatch.reveal', 'companion.intro_action');

insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface) values
  ('mossprout-first-session', 32, 'haven.home_notice', 'haven.notice_glow', 'haven'),
  ('mossprout-first-session', 32, 'haven.mossprout_focus', 'haven.reveal_mossprout_grove', 'haven'),
  ('mossprout-first-session', 32, 'haven.mossprout_reveal', 'haven.inspect_mossprout_egg', 'haven'),
  ('mossprout-first-session', 32, 'grove.egg_inspect', 'grove.begin_attunement', 'haven')
on conflict (script_id, script_version, step_id, action_id) do update
set surface = excluded.surface;

update public.ftue_action_catalog
set surface = 'haven'
where script_id = 'mossprout-first-session'
  and script_version = 32
  and step_id in ('egg.opening', 'egg.context', 'egg.mind', 'egg.ready', 'companion.first_meeting');
