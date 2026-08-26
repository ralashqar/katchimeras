-- v24 adds the five-question Egg profile and the local nickname/friendship
-- acknowledgement. Copy v23 so upgraded and fresh databases share one catalog.
insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
select script_id, 24, step_id, action_id, surface
from public.ftue_action_catalog
where script_id = 'mossprout-first-session'
  and script_version = 23
on conflict (script_id, script_version, step_id, action_id) do nothing;

insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
values
  ('mossprout-first-session', 24, 'egg.opening', 'egg.companion_goal', 'today'),
  ('mossprout-first-session', 24, 'egg.context', 'egg.support_need', 'today'),
  ('mossprout-first-session', 24, 'egg.mind', 'egg.notice_focus', 'today'),
  ('mossprout-first-session', 24, 'egg.nature_theme', 'egg.nature_theme', 'today'),
  ('mossprout-first-session', 24, 'egg.nature_detail.green', 'egg.nature_detail.green', 'today'),
  ('mossprout-first-session', 24, 'egg.nature_detail.season', 'egg.nature_detail.season', 'today'),
  ('mossprout-first-session', 24, 'egg.nature_detail.weather', 'egg.nature_detail.weather', 'today'),
  ('mossprout-first-session', 24, 'companion.nickname', 'companion.save_nickname', 'companion'),
  ('mossprout-first-session', 24, 'companion.bond_intro', 'companion.acknowledge_friendship', 'companion')
on conflict (script_id, script_version, step_id, action_id) do nothing;
