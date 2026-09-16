import { recordCompanionBondEvent, type CompanionBondState } from './companion-bond';
import { companionIdForFamily } from '../constants/katchimera-skins';
import type { KatchimeraFamilyId } from '../types/katchimera';

/**
 * A friend's daily step ladder: each milestone of the day pays its Bond
 * once, in order, and the ladder starts again tomorrow. The ids are the
 * ones Steppling's saves already carry (`steppling:steps:<day>:<steps>`).
 */
export type CompanionStepMilestone = { steps: number; bond: number };

export function stepMilestoneId(companion: string, dayId: string, steps: number) { return `${companion}:steps:${dayId}:${steps}`; }

export function nextStepMilestone(companion: string, milestones: readonly CompanionStepMilestone[], state: CompanionBondState, dayId: string) {
  return milestones.find((goal) => !state.events.some((event) => event.id === stepMilestoneId(companion, dayId, goal.steps))) ?? null;
}

export function claimStepMilestone(companion: string, milestones: readonly CompanionStepMilestone[], state: CompanionBondState, dayId: string, target: number, recordedSteps: number, now = Date.now()) {
  const goal = nextStepMilestone(companion, milestones, state, dayId);
  if (!goal || goal.steps !== target || !Number.isFinite(recordedSteps) || recordedSteps < target) return null;
  return recordCompanionBondEvent(state, {
    id: stepMilestoneId(companion, dayId, goal.steps), creatureId: companionIdForFamily(companion as KatchimeraFamilyId),
    kind: 'quick_goal_completed', points: goal.bond, dayId, occurredAt: now,
  }, { queueCelebration: true });
}
