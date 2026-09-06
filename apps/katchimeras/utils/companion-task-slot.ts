import type { KatchimeraFamilyId } from '@/types/katchimera';
import { quickGoalsForDay, type CompanionQuickGoalState } from './companion-quick-goals';

/** Keep the current task stable; sample only when its slot needs a replacement. */
export function chooseCompanionTask(state: CompanionQuickGoalState, familyId: KatchimeraFamilyId, dayId: string, currentId?: string | null, random: () => number = Math.random) {
  const candidates = quickGoalsForDay(state, dayId, familyId).filter((item) => !item.completion).map((item) => item.goal);
  const current = candidates.find((goal) => goal.id === currentId);
  if (current) return current;
  if (!candidates.length) return null;
  return candidates[Math.min(candidates.length - 1, Math.max(0, Math.floor(random() * candidates.length)))];
}
