-- v28 replaces the opening Egg questionnaire with five direct, player-focused
-- questions and one non-branching companion-place match.
insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
select script_id, 28, step_id, action_id, surface
from public.ftue_action_catalog
where script_id = 'mossprout-first-session'
  and script_version = 27
on conflict (script_id, script_version, step_id, action_id) do nothing;

delete from public.ftue_action_catalog
where script_id = 'mossprout-first-session'
  and script_version = 28
  and step_id in (
    'egg.opening',
    'egg.context',
    'egg.mind',
    'egg.nature_theme',
    'egg.nature_detail.green',
    'egg.nature_detail.season',
    'egg.nature_detail.weather'
  );

insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
values
  ('mossprout-first-session', 28, 'egg.opening', 'egg.desired_feeling', 'today'),
  ('mossprout-first-session', 28, 'egg.context', 'egg.main_difficulty', 'today'),
  ('mossprout-first-session', 28, 'egg.mind', 'egg.support_style', 'today'),
  ('mossprout-first-session', 28, 'egg.nature_theme', 'egg.life_priority', 'today'),
  ('mossprout-first-session', 28, 'egg.companion_identity', 'egg.companion_place', 'today')
on conflict (script_id, script_version, step_id, action_id) do nothing;
