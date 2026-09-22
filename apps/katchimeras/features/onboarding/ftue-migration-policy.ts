import type { FtueRunState } from './ftue-types';

/** Forward-only v43 projection. Never restart a player or discard their receipts. */
export function streamlinedFtueStep(run: Pick<FtueRunState, 'stepId' | 'status'>): string {
  if (run.status === 'complete') return 'complete';
  const replacement: Record<string, string> = {
    'merge.handoff.spawn': 'companion.meditating',
    'merge.handoff.merge': 'companion.meditating',
    'companion.day_one_action': 'world.garden_arrival',
    'companion.nickname': 'world.garden_arrival',
    'companion.bond_intro': 'world.garden_arrival',
    'companion.bond_spotlight': 'world.garden_arrival',
    'companion.order_preview': 'world.garden_arrival',
    'world.garden_handoff': 'world.first_seed_grew',
    // v53: the first session ends its planting at the bud; nothing stands between any more.
    'world.seed_planted': 'world.first_seed_grew',
    'world.first_bloom_offer': 'world.first_seed_grew',
    'world.first_bloom_restore': 'world.first_seed_grew',
    'companion.chapter_zero_return': 'companion.first_rest',
    // v54: no Heartwood modal before the planting and no chat after it; a run parked on either continues at the next real beat.
    'companion.garden_intro': 'world.garden_arrival',
    'companion.water_together': 'companion.first_rest',
    'companion.first_grow': 'companion.first_rest',
    'companion.first_notice': 'companion.first_rest',
    'companion.notice_bond_spotlight': 'companion.first_rest',
    'companion.water_response': 'companion.first_rest',
    'companion.first_insight': 'companion.first_rest',
    'egg.mind': 'egg.ready',
    'egg.nature_theme': 'egg.ready',
    'egg.companion_identity': 'egg.ready',
  };
  return replacement[run.stepId] ?? run.stepId;
}

const V28_REWRITTEN_EGG_QUESTION_STEPS = new Set([
  'egg.opening',
  'egg.context',
  'egg.mind',
  'egg.nature_theme',
  'egg.nature_detail.green',
  'egg.nature_detail.season',
  'egg.nature_detail.weather',
  'egg.companion_identity',
  'egg.ready',
]);

const V28_EGG_QUESTION_ACTION_IDS = [
  'egg.desired_feeling',
  'egg.main_difficulty',
  'egg.support_style',
  'egg.life_priority',
  'egg.companion_place',
] as const;

/** Only pre-v28 saves may restart onto the rewritten five-question opening. */
export function ftueNeedsV28QuestionnaireRestart(
  run: Pick<FtueRunState, 'scriptVersion' | 'status' | 'stepId'>,
): boolean {
  return run.status === 'active'
    && run.scriptVersion < 28
    && V28_REWRITTEN_EGG_QUESTION_STEPS.has(run.stepId);
}

/** Repairs saves that the former migration loop already pushed back to question one. */
export function ftueV28QuestionnaireLoopRecoveryStep(
  run: Pick<FtueRunState, 'scriptVersion' | 'status' | 'stepId'> & {
    answers: Readonly<Record<string, unknown>>;
  },
): 'egg.ready' | null {
  const hasEveryAnswer = V28_EGG_QUESTION_ACTION_IDS.every((actionId) => run.answers[actionId] != null);
  return run.status === 'active'
    && run.scriptVersion >= 28
    && run.stepId === 'egg.opening'
    && hasEveryAnswer
    ? 'egg.ready'
    : null;
}
