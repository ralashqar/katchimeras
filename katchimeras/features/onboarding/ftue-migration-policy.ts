import type { FtueRunState } from './ftue-types';

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
