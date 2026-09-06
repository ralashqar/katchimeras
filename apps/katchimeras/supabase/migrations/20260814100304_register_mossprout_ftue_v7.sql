insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface) values
  ('mossprout-first-session', 7, 'egg.opening', 'egg.feeling', 'today'),
  ('mossprout-first-session', 7, 'egg.context', 'egg.context.activity', 'today'),
  ('mossprout-first-session', 7, 'egg.mind', 'egg.mind.focus', 'today'),
  ('mossprout-first-session', 7, 'egg.ready', 'egg.hatch', 'today'),
  ('mossprout-first-session', 7, 'companion.first_meeting', 'companion.complete_first_meeting', 'companion'),
  ('mossprout-first-session', 7, 'companion.order_preview', 'companion.open_garden', 'companion'),
  ('mossprout-first-session', 7, 'merge.seed_drag', 'merge.create_sprout', 'merge'),
  ('mossprout-first-session', 7, 'merge.serve_sprout', 'merge.serve_sprout', 'merge'),
  ('mossprout-first-session', 7, 'merge.plant.spawn', 'merge.spawn_plant_seeds', 'merge'),
  ('mossprout-first-session', 7, 'merge.plant.seed_pairs', 'merge.create_two_sprouts', 'merge'),
  ('mossprout-first-session', 7, 'merge.plant.sprout_pair', 'merge.create_home_plant', 'merge'),
  ('mossprout-first-session', 7, 'merge.serve_plant', 'merge.serve_home_plant', 'merge'),
  ('mossprout-first-session', 7, 'chapter.complete', 'chapter.finish', 'merge')
on conflict (script_id, script_version, action_id) do nothing;
