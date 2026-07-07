import { useCallback, type Dispatch, type SetStateAction } from 'react';

import { hydrateHomeState } from '@/game/days';
import type { StoredHomeState } from '@/types/home';
import { loadOnboardingProfile, type OnboardingProfile } from '@/utils/onboarding-state';

type HomeStateMutation = (
  state: StoredHomeState,
  profile: OnboardingProfile,
  now: Date
) => StoredHomeState;

export function useHomeStateMutation(
  setStoredState: Dispatch<SetStateAction<StoredHomeState | null>>
) {
  return useCallback(
    (mutation: HomeStateMutation) => {
      const now = new Date();
      const profile = loadOnboardingProfile();

      setStoredState((currentState) => {
        const hydrated = hydrateHomeState(currentState, profile, now);
        return mutation(hydrated.state, profile, now);
      });
    },
    [setStoredState]
  );
}
