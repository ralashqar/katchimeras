import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import {
  claimDailyHatchForDay,
  hydrateHomeState,
  setDayWeatherForDay,
  setPlaceCategorySeedsForDay,
  triggerHatchForDay,
} from '@/game/days';
import type { HomeTimelineDay, StoredHomeDayRecord, StoredHomeState } from '@/types/home';
import { ensureDayWeather } from '@/utils/day-weather';
import { syncHatchNotification } from '@/utils/hatch-notification';
import { loadOnboardingProfile } from '@/utils/onboarding-state';
import { resolvePlaceSeedsForDay } from '@/utils/place-categories';
import { syncWidgetState } from '@/utils/widget-state';
import { homeRepository } from '@/storage/repositories/home-repository';

export type HatchCommitResult =
  | { status: 'hatched'; day: StoredHomeDayRecord }
  | { status: 'not_ready' }
  | { status: 'failed'; reason: string };

export type HatchClaimResult =
  | { status: 'claimed'; day: StoredHomeDayRecord }
  | { status: 'not_ready' }
  | { status: 'failed'; reason: string };

type HatchControllerParams = {
  selectedDay: HomeTimelineDay | null;
  state: StoredHomeState;
  storedStateRef: MutableRefObject<StoredHomeState | null>;
  setStoredState: Dispatch<SetStateAction<StoredHomeState | null>>;
};

export function useHatchController({
  selectedDay,
  state,
  storedStateRef,
  setStoredState,
}: HatchControllerParams) {
  const placeResolutionInFlight = useRef<string | null>(null);
  const todayId = state.today.id;
  const todayState = state.today.state;

  useEffect(() => {
    const currentState = storedStateRef.current;
    if (!currentState) {
      return;
    }

    const profile = loadOnboardingProfile();
    void syncHatchNotification(currentState, profile);
    void syncWidgetState(currentState, profile);
  }, [storedStateRef, todayId, todayState]);

  useEffect(() => {
    const today = state.today;
    if (
      today.state !== 'ready_to_hatch' ||
      today.placeCategorySeeds !== undefined ||
      today.locations.length === 0 ||
      placeResolutionInFlight.current === today.id
    ) {
      return;
    }

    placeResolutionInFlight.current = today.id;
    void (async () => {
      const seeds = await resolvePlaceSeedsForDay(today, state.archivedDays);
      const profile = loadOnboardingProfile();
      const now = new Date();
      setStoredState((currentState) => {
        const hydrated = hydrateHomeState(currentState, profile, now);
        return setPlaceCategorySeedsForDay(hydrated.state, today.id, seeds, profile, now);
      });
    })();
  }, [setStoredState, state]);

  const triggerHatchIfReady = useCallback(async (): Promise<HatchCommitResult> => {
    if (!selectedDay || selectedDay.kind !== 'day') {
      return { status: 'not_ready' };
    }

    try {
      const profile = loadOnboardingProfile();
      let now = new Date();
      // Foreground mutations update the ref synchronously while repository writes
      // are deferred. Prefer the ref so the final check-in tap always reaches the
      // hatch even when disk persistence is still catching up.
      const hydrated = hydrateHomeState(storedStateRef.current ?? homeRepository.load(), profile, now);
      let baseState = hydrated.state;

      const targetDay = findDay(baseState, selectedDay.id);
      if (!targetDay?.dailyHatch || targetDay.state !== 'sealed') return { status: 'not_ready' };

      // Both enrichments read the same immutable day snapshot. Resolve them in
      // parallel so the anticipation phase is bounded by one timeout rather
      // than two sequential network/classification waits.
      const shouldResolvePlaces = targetDay.placeCategorySeeds === undefined
        && targetDay.locations.length > 0;
      const shouldResolveWeather = targetDay.weather === undefined
        && targetDay.locations.length > 0;
      const [resolvedSeeds, resolvedWeather] = await Promise.all([
        shouldResolvePlaces
          ? Promise.race([
              resolvePlaceSeedsForDay(
                targetDay,
                baseState.archivedDays.filter((day) => day.id !== targetDay.id),
              ).catch(() => []),
              new Promise<string[]>((resolve) => setTimeout(() => resolve([]), 2500)),
            ])
          : Promise.resolve<string[] | undefined>(undefined),
        shouldResolveWeather
          ? Promise.race([
              ensureDayWeather(targetDay).catch(() => null),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
            ])
          : Promise.resolve(undefined),
      ]);
      now = new Date();
      if (resolvedSeeds !== undefined) {
        baseState = setPlaceCategorySeedsForDay(baseState, selectedDay.id, resolvedSeeds, profile, now);
      }
      if (resolvedWeather) {
        baseState = setDayWeatherForDay(baseState, selectedDay.id, resolvedWeather, profile, now);
      }

      const hatchedState = triggerHatchForDay(baseState, selectedDay.id, profile, now);
      const hatchedDay = findDay(hatchedState, selectedDay.id);
      if (!hatchedDay?.dailyHatch?.revealedAt) {
        return { status: 'not_ready' };
      }

      // The hatch is durable before any presentation begins. A suspended app
      // can therefore reopen directly onto the resident without replaying or
      // losing the arrival.
      storedStateRef.current = hatchedState;
      homeRepository.save(hatchedState, { notify: false });
      setStoredState(hatchedState);
      // Standard daily hatches no longer create a Katchimera resident arrival.
      void syncHatchNotification(hatchedState, profile);
      return { status: 'hatched', day: hatchedDay };
    } catch (error) {
      console.warn('Hatch finalization failed', error);
      return {
        status: 'failed',
        reason: error instanceof Error ? error.message : 'The hatch could not be completed.',
      };
    }
  }, [selectedDay, setStoredState, storedStateRef]);

  const claimHatch = useCallback(async (): Promise<HatchClaimResult> => {
    if (!selectedDay || selectedDay.kind !== 'day') return { status: 'not_ready' };
    try {
      const now = new Date();
      const profile = loadOnboardingProfile();
      const hydrated = hydrateHomeState(storedStateRef.current ?? homeRepository.load(), profile, now);
      const claimedState = claimDailyHatchForDay(hydrated.state, selectedDay.id, now);
      const claimedDay = findDay(claimedState, selectedDay.id);
      if (!claimedDay?.dailyHatch?.claimedAt) return { status: 'not_ready' };
      storedStateRef.current = claimedState;
      homeRepository.save(claimedState, { notify: false });
      setStoredState(claimedState);
      void syncWidgetState(claimedState, profile).catch((error) => {
        console.warn('Claimed hatch widget sync failed', error);
      });
      return { status: 'claimed', day: claimedDay };
    } catch (error) {
      console.warn('Hatch claim failed', error);
      return { status: 'failed', reason: error instanceof Error ? error.message : 'The card could not be claimed.' };
    }
  }, [selectedDay, setStoredState, storedStateRef]);

  return { claimHatch, triggerHatchIfReady };
}

function findDay(state: StoredHomeState, dayId: string): StoredHomeDayRecord | null {
  return state.today.id === dayId
    ? state.today
    : state.archivedDays.find((day) => day.id === dayId) ?? null;
}
