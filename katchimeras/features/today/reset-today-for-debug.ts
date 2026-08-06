import { resetTodayInState } from '@/game/days/actions';
import { homeRepository } from '@/storage/repositories/home-repository';
import type { StoredHomeState } from '@/types/home';
import { resetStoredCompanionQuickGoalProgressForDay } from '@/utils/companion-quick-goal-storage';
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
export function resetTodayForDebug(now = new Date()): StoredHomeState | null {
  const state = homeRepository.load();
  if (!state) return null;

  resetStoredCompanionQuickGoalProgressForDay(state.today.isoDate);
  cancelTodayCareGameRound();
  clearTodayEnergyFeedback();
  clearTodayEnergyTraces();
  clearTodayPatch();
  clearBaseCustomisation();

  const next = resetTodayInState(state, loadOnboardingProfile(), now);
  homeRepository.save(next, { allowHatchDowngrade: true });
  return next;
}
