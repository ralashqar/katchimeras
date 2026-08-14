import type { FtueRunState } from './ftue-types';

const PRE_MOSSPROUT_CONVERSATION_STEPS = new Set([
  'egg.opening',
  'egg.context',
  'egg.mind',
  'egg.ready',
  'hatch.reveal',
]);

/** Keep the opening authored adventure focused until the player talks to Mossprout. */
export function ftueOwnsOpeningHome(run: Pick<FtueRunState, 'status' | 'stepId'> | null): boolean {
  return run?.status === 'active' && PRE_MOSSPROUT_CONVERSATION_STEPS.has(run.stepId);
}

export function ftueHidesBottomBar(run: Pick<FtueRunState, 'status' | 'stepId'> | null): boolean {
  return ftueOwnsOpeningHome(run);
}
