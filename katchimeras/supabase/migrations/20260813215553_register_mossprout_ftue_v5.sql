insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface) values
  ('mossprout-first-session', 5, 'egg.opening', 'egg.feeling', 'today'),
  ('mossprout-first-session', 5, 'egg.context', 'egg.context.activity', 'today'),
  ('mossprout-first-session', 5, 'egg.mind', 'egg.mind.focus', 'today'),
  ('mossprout-first-session', 5, 'egg.ready', 'egg.hatch', 'today'),
  ('mossprout-first-session', 5, 'companion.first_meeting', 'companion.complete_first_meeting', 'companion'),
  ('mossprout-first-session', 5, 'merge.first', 'merge.serve_sprout', 'merge'),
  ('mossprout-first-session', 5, 'chapter.complete', 'chapter.finish', 'merge')
on conflict (script_id, script_version, action_id) do nothing;
