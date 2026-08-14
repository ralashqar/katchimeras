import type { FtueRunState } from './ftue-types';
import { mossproutFtueStep } from './mossprout-ftue-script';

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

export function ftueHidesBottomBar(
  run: Pick<FtueRunState, 'status' | 'stepId'> | null,
  activeTabRoute: string,
): boolean {
  if (run?.status !== 'active') return false;
  const surface = mossproutFtueStep(run.stepId)?.surface;
  // A persisted graph may point at Merge while the app cold-opens on Today.
  // Hide navigation only on the tab currently presenting that graph surface,
  // otherwise the player must retain a route to Dev reset and recovery.
  if (activeTabRoute === 'today') return surface === 'today' || surface === 'hatch';
  if (activeTabRoute === 'games') return surface === 'merge';
  return false;
}
