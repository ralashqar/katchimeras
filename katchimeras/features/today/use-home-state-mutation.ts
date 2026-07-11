import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import { hydrateHomeState } from '@/game/days';
import { toLocalDateId } from '@/game/days/date';
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
      const startedAt = performance.now();
      const current = storedStateRef?.current;
      // The hook already owns a hydrated, current-day state. Rehydrating the
      // entire archive before every tap doubled normalization work. Only do it
      // when the state is absent or midnight rollover is actually required.
      const baseState = current?.today.isoDate === toLocalDateId(now)
        ? current
        : hydrateHomeState(current ?? homeRepository.load(), profile, now).state;
      const hydratedAt = performance.now();
      const next = mutation(baseState, profile, now);
      const mutatedAt = performance.now();

      homeRepository.save(next);
      const savedAt = performance.now();
      if (storedStateRef) storedStateRef.current = next;
      setStoredState(next);
      if (__DEV__ && savedAt - startedAt > 80) {
        console.warn(
          `[Today mutation] ${Math.round(savedAt - startedAt)}ms ` +
          `(hydrate ${Math.round(hydratedAt - startedAt)}ms, ` +
          `derive ${Math.round(mutatedAt - hydratedAt)}ms, save ${Math.round(savedAt - mutatedAt)}ms)`
        );
      }
    },
    [setStoredState, storedStateRef]
  );
}
