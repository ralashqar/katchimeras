import type { CompanionJourneyState } from '@/utils/companion-journey';
import type { CompanionQuickGoalState } from '@/utils/companion-quick-goals';

/**
 * Turns Mossprout's player-facing nature direction into board progression.
 * Quick activities only count when they were completed after that direction
 * was chosen, so old Today history cannot unlock a newly selected path.
 */
export function mossproutFocusStage(
  journey: CompanionJourneyState,
  quickGoals: CompanionQuickGoalState,
): number {
  const goal = [...journey.goals].reverse().find((candidate) => candidate.familyId === 'mossprout');
  if (!goal) return 0;
  if (goal.status === 'completed' || goal.status === 'abandoned') return 4;

  const reflectionCount = journey.reflectionEvents.filter((event) => event.goalId === goal.id).length;
  if (reflectionCount > 0) return 3;

  const questCount = journey.questEvents.filter((event) => event.goalId === goal.id).length;
  const quickGoalCount = quickGoals.completions.filter((completion) => (
    completion.familyId === 'mossprout' && completion.completedAt >= goal.createdAt
  )).length;
  return questCount + quickGoalCount >= 3 ? 2 : 1;
}
