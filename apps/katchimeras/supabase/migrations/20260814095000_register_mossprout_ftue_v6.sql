insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface) values
  ('mossprout-first-session', 6, 'egg.opening', 'egg.feeling', 'today'),
  ('mossprout-first-session', 6, 'egg.context', 'egg.context.activity', 'today'),
  ('mossprout-first-session', 6, 'egg.mind', 'egg.mind.focus', 'today'),
  ('mossprout-first-session', 6, 'egg.ready', 'egg.hatch', 'today'),
  ('mossprout-first-session', 6, 'companion.first_meeting', 'companion.complete_first_meeting', 'companion'),
  ('mossprout-first-session', 6, 'merge.seed_drag', 'merge.create_sprout', 'merge'),
  ('mossprout-first-session', 6, 'merge.serve_sprout', 'merge.serve_sprout', 'merge'),
  ('mossprout-first-session', 6, 'chapter.complete', 'chapter.finish', 'merge')
on conflict (script_id, script_version, action_id) do nothing;
