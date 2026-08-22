import { resetTodayInState } from '@/game/days/actions';
import { resetRelationshipProgressForDayForDebug } from '@/game/katchimeras/relationship-progression';
import { shiftLocalDate, toLocalDateId } from '@/game/days/date';
import { homeRepository } from '@/storage/repositories/home-repository';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import type { StoredHomeState } from '@/types/home';
import { resetStoredCompanionQuickGoalProgressForDay } from '@/utils/companion-quick-goal-storage';
import { resetKatchimeraContentForDayForDebug } from '@/utils/companion-content-storage';
import { resetMergeWorldActivityForDayForDebug } from '@/utils/merge-world/repository';
import { loadOnboardingProfile } from '@/utils/onboarding-state';
import { cancelTodayCareGameRound } from '@/utils/today-care-game-round';
import { clearTodayEnergyTraces } from '@/utils/today-energy-loop-performance';
import { clearTodayPatch } from '@/utils/today-patch-storage';
import { clearBaseCustomisation } from '@/utils/world-base-customisation';

import { clearTodayEnergyFeedback } from './today-energy-feedback';

/**
 * Resets every day-scoped source that can feed Growth Energy. External reward
 * receipts are invalidated before publishing the blank Home record so mounted
 * tabs cannot reconcile an old completion into the new egg.
 */
export async function resetTodayForDebug(now = new Date()): Promise<StoredHomeState | null> {
  const state = homeRepository.load();
  if (!state) return null;

  resetStoredCompanionQuickGoalProgressForDay(state.today.isoDate);
  resetKatchimeraContentForDayForDebug(state.today.isoDate);
  relationshipProgressionRepository.update((current) => (
    resetRelationshipProgressForDayForDebug(current, state.today.isoDate)
  ));
  cancelTodayCareGameRound();
  clearTodayEnergyFeedback();
  clearTodayEnergyTraces();
  clearTodayPatch();
  clearBaseCustomisation();

  // Clear Merge's deterministic daily receipts before publishing the blank
  // Today record, preventing mounted tabs from restoring the old daily cap.
  const stateToday = new Date(`${state.today.isoDate}T12:00:00`);
  const resetDay = Number.isNaN(stateToday.getTime()) ? now : stateToday;
  const yesterdayDayId = toLocalDateId(shiftLocalDate(resetDay, -1));
  await resetMergeWorldActivityForDayForDebug(state.today.isoDate, now.getTime(), yesterdayDayId);

  const next = resetTodayInState(state, loadOnboardingProfile(), now);
  homeRepository.save(next, { allowHatchDowngrade: true, allowTodayReset: true });
  return next;
}
