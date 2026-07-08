import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import { hydrateHomeState } from '@/game/days';
import type { StoredHomeState } from '@/types/home';
import { loadOnboardingProfile, type OnboardingProfile } from '@/utils/onboarding-state';
import { homeRepository } from '@/storage/repositories/home-repository';

type HomeStateMutation = (
  state: StoredHomeState,
  profile: OnboardingProfile,
  now: Date
) => StoredHomeState;

export function useHomeStateMutation(
  setStoredState: Dispatch<SetStateAction<StoredHomeState | null>>,
  storedStateRef?: MutableRefObject<StoredHomeState | null>
) {
  return useCallback(
    (mutation: HomeStateMutation) => {
      const now = new Date();
      const profile = loadOnboardingProfile();
      const hydrated = hydrateHomeState(storedStateRef?.current ?? homeRepository.load(), profile, now);
      const next = mutation(hydrated.state, profile, now);

      homeRepository.save(next);
      if (storedStateRef) storedStateRef.current = next;
      setStoredState(next);
    },
    [setStoredState, storedStateRef]
  );
}
