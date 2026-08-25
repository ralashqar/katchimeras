-- v20 extends the first Mossprout day through resident affinity, parcel reveal,
-- two resident requests, and the earned-card reveal. Existing completed runs
-- remain complete; active runs migrate through normal FTUE reconciliation.
insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface)
select script_id, 20, step_id, action_id, surface
from public.ftue_action_catalog
where script_id = 'mossprout-first-session'
  and script_version = 19
on conflict (script_id, script_version, step_id, action_id) do nothing;

insert into public.ftue_action_catalog (script_id, script_version, step_id, action_id, surface) values
  ('mossprout-first-session', 20, 'companion.resident_affinity', 'companion.complete_resident_affinity', 'companion'),
  ('mossprout-first-session', 20, 'merge.resident_parcel', 'merge.claim_resident_parcel', 'merge'),
  ('mossprout-first-session', 20, 'merge.resident_card', 'merge.reveal_resident', 'merge'),
  ('mossprout-first-session', 20, 'merge.resident_dialogue', 'merge.meet_resident', 'merge'),
  ('mossprout-first-session', 20, 'merge.resident_orders', 'merge.serve_resident_orders', 'merge'),
  ('mossprout-first-session', 20, 'merge.resident_card_reward', 'merge.ack_resident_card', 'merge')
on conflict (script_id, script_version, step_id, action_id) do nothing;
