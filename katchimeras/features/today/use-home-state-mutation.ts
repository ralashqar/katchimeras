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
  storedStateRef?: MutableRefObject<StoredHomeState | null>,
  scheduledStateRef?: MutableRefObject<StoredHomeState | null>
) {
  return useCallback(
    (mutation: HomeStateMutation) => {
      const now = new Date();
      const profile = loadOnboardingProfile();
      const startedAt = performance.now();
      // More than one short-lived route can own this hook. Always rebase a
      // mutation on the repository's newest in-memory state so a late callback
      // from an unfocused/unmounting screen cannot replace Today's progress
      // with that screen's older snapshot.
      const current = homeRepository.load() ?? storedStateRef?.current ?? null;
      // The hook already owns a hydrated, current-day state. Rehydrating the
      // entire archive before every tap doubled normalization work. Only do it
      // when the state is absent or midnight rollover is actually required.
      const baseState = current?.today.isoDate === toLocalDateId(now)
        ? current
        : hydrateHomeState(current, profile, now).state;
      const hydratedAt = performance.now();
      const next = mutation(baseState, profile, now);
      const mutatedAt = performance.now();

      if (storedStateRef) storedStateRef.current = next;
      if (scheduledStateRef) scheduledStateRef.current = next;
      setStoredState(next);
      void homeRepository.saveDeferred(next, { notify: false, preserveArchive: true });
      const completedAt = performance.now();
      if (__DEV__ && completedAt - startedAt > 80) {
        console.warn(
          `[Today mutation] ${Math.round(completedAt - startedAt)}ms ` +
          `(hydrate ${Math.round(hydratedAt - startedAt)}ms, ` +
          `derive ${Math.round(mutatedAt - hydratedAt)}ms)`
        );
      }
    },
    [setStoredState, storedStateRef, scheduledStateRef]
  );
}
