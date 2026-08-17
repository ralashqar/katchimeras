import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import {
  applyGeneratedReflection,
  hydrateHomeState,
  setDayWeatherForDay,
  setPlaceCategorySeedsForDay,
  triggerHatchForDay,
} from '@/game/days';
import type { HomeTimelineDay, StoredHomeDayRecord, StoredHomeState } from '@/types/home';
import { requestDayReflection } from '@/utils/day-reflection';
import { ensureDayWeather } from '@/utils/day-weather';
import {
  getHatchNotificationPermission,
  requestHatchNotificationPermission,
  syncHatchNotification,
} from '@/utils/hatch-notification';
import { loadOnboardingProfile } from '@/utils/onboarding-state';
import { ensureDayVision } from '@/utils/photo-vision';
import { resolvePlaceSeedsForDay } from '@/utils/place-categories';
import { syncWidgetState } from '@/utils/widget-state';
import { homeRepository } from '@/storage/repositories/home-repository';
import { markArrivalPending } from '@/utils/kingdom-arrival';

export type HatchCommitResult =
  | { status: 'hatched'; day: StoredHomeDayRecord }
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

  const enhanceDayReflection = useCallback(async (hatchedState: StoredHomeState, dayId: string) => {
    const profile = loadOnboardingProfile();
    const day =
      hatchedState.today.id === dayId
        ? hatchedState.today
        : hatchedState.archivedDays.find((candidate) => candidate.id === dayId) ?? null;

    if (!day?.creature || day.creature.reflectionSource === 'generated') {
      return;
    }

    const vision = await ensureDayVision(day);
    const dayForReflection = vision ? { ...day, vision } : day;
    const pastDays = hatchedState.archivedDays.filter((candidate) => candidate.id !== dayId);
    const generated = await requestDayReflection(dayForReflection, profile, pastDays);
    if (!generated) {
      return;
    }

    const now = new Date();
    setStoredState((currentState) => {
      const hydrated = hydrateHomeState(currentState, profile, now);
      return applyGeneratedReflection(hydrated.state, dayId, generated, profile, now);
    });
  }, [setStoredState]);

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
      if (!targetDay) return { status: 'not_ready' };

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
      if (!hatchedDay?.dailyHatch || hatchedDay.state !== 'hatched') {
        return { status: 'not_ready' };
      }

      // The hatch is durable before any presentation begins. A suspended app
      // can therefore reopen directly onto the resident without replaying or
      // losing the arrival.
      storedStateRef.current = hatchedState;
      homeRepository.save(hatchedState, { notify: false });
      setStoredState(hatchedState);
      // Standard daily hatches no longer create a Katchimera resident arrival.
      void (async () => {
        const permission = await getHatchNotificationPermission();
        if (permission === 'undetermined') {
          await requestHatchNotificationPermission();
        }
        await syncHatchNotification(hatchedState, profile);
      })();
      return { status: 'hatched', day: hatchedDay };
    } catch (error) {
      console.warn('Hatch finalization failed', error);
      return {
        status: 'failed',
        reason: error instanceof Error ? error.message : 'The hatch could not be completed.',
      };
    }
  }, [enhanceDayReflection, selectedDay, setStoredState, storedStateRef]);

  return { triggerHatchIfReady };
}

function findDay(state: StoredHomeState, dayId: string): StoredHomeDayRecord | null {
  return state.today.id === dayId
    ? state.today
    : state.archivedDays.find((day) => day.id === dayId) ?? null;
}
