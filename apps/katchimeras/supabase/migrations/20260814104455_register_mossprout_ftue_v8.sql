insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface) values
  ('mossprout-first-session', 8, 'egg.opening', 'egg.feeling', 'today'),
  ('mossprout-first-session', 8, 'egg.context', 'egg.context.activity', 'today'),
  ('mossprout-first-session', 8, 'egg.mind', 'egg.mind.focus', 'today'),
  ('mossprout-first-session', 8, 'egg.ready', 'egg.hatch', 'today'),
  ('mossprout-first-session', 8, 'companion.first_meeting', 'companion.complete_first_meeting', 'companion'),
  ('mossprout-first-session', 8, 'companion.order_preview', 'companion.open_garden', 'companion'),
  ('mossprout-first-session', 8, 'merge.seed_drag', 'merge.create_sprout', 'merge'),
  ('mossprout-first-session', 8, 'merge.serve_sprout', 'merge.serve_sprout', 'merge'),
  ('mossprout-first-session', 8, 'merge.plant.spawn', 'merge.spawn_plant_seeds', 'merge'),
  ('mossprout-first-session', 8, 'merge.plant.seed_pairs', 'merge.create_two_sprouts', 'merge'),
  ('mossprout-first-session', 8, 'merge.plant.sprout_pair', 'merge.create_home_plant', 'merge'),
  ('mossprout-first-session', 8, 'merge.serve_plant', 'merge.serve_home_plant', 'merge'),
  ('mossprout-first-session', 8, 'merge.return_note', 'merge.open_mossprout_note', 'merge'),
  ('mossprout-first-session', 8, 'companion.chapter_zero_return', 'companion.complete_chapter_zero_return', 'companion')
on conflict (script_id, script_version, action_id) do nothing;
