import { STEPPLING_STEP_MILESTONES } from '../constants/steppling-activities';
import { recordCompanionBondEvent, type CompanionBondState } from './companion-bond';
import { companionIdForFamily } from '../constants/katchimera-skins';

export function stepplingMilestoneId(dayId: string, steps: number) { return `steppling:steps:${dayId}:${steps}`; }
export function nextStepplingMilestone(state: CompanionBondState, dayId: string) {
  return STEPPLING_STEP_MILESTONES.find((goal) => !state.events.some((event) => event.id === stepplingMilestoneId(dayId, goal.steps))) ?? null;
}
export function claimStepplingMilestone(state: CompanionBondState, dayId: string, target: number, recordedSteps: number, now = Date.now()) {
  const goal = nextStepplingMilestone(state, dayId);
  if (!goal || goal.steps !== target || !Number.isFinite(recordedSteps) || recordedSteps < target) return null;
  return recordCompanionBondEvent(state, {
    id: stepplingMilestoneId(dayId, goal.steps), creatureId: companionIdForFamily('steppling'),
    kind: 'quick_goal_completed', points: goal.bond, dayId, occurredAt: now,
  }, { queueCelebration: true });
}
