import { STEPPLING_STEP_MILESTONES } from '../constants/steppling-activities';
import type { CompanionBondState } from './companion-bond';
import { claimStepMilestone, nextStepMilestone, stepMilestoneId } from './companion-step-milestones';

/** Steppling's step ladder by its old names; the ladder itself is shared tech (`companion-step-milestones.ts`). */
export function stepplingMilestoneId(dayId: string, steps: number) { return stepMilestoneId('steppling', dayId, steps); }
export function nextStepplingMilestone(state: CompanionBondState, dayId: string) {
  return nextStepMilestone('steppling', STEPPLING_STEP_MILESTONES, state, dayId);
}
export function claimStepplingMilestone(state: CompanionBondState, dayId: string, target: number, recordedSteps: number, now = Date.now()) {
  return claimStepMilestone('steppling', STEPPLING_STEP_MILESTONES, state, dayId, target, recordedSteps, now);
}
