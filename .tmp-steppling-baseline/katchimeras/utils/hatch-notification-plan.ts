import type { StoredHomeState } from '@/types/home';
import type { OnboardingProfile } from '@/utils/onboarding-state';

export type HatchNotificationPlan = {
  dayId: string;
  targetAt: Date;
  isReady: boolean;
};

export function resolveHatchNotificationPlan(
  _state: StoredHomeState,
  _profile: OnboardingProfile,
  _now = new Date(),
): HatchNotificationPlan | null {
  // The Wisp is finalized at rollover and revealed on the player's next visit.
  // There is no clock-time hatch to schedule.
  return null;
}
