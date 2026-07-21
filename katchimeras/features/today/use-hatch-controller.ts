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

  const triggerHatchIfReady = useCallback(async () => {
    if (!selectedDay || selectedDay.kind !== 'day') {
      return;
    }

    const profile = loadOnboardingProfile();
    let now = new Date();
    // Foreground mutations update the ref synchronously while repository writes
    // are deferred. Prefer the ref so the final check-in tap always reaches the
    // hatch even when disk persistence is still catching up.
    const hydrated = hydrateHomeState(storedStateRef.current ?? homeRepository.load(), profile, now);
    let baseState = hydrated.state;

    const targetDay = findDay(baseState, selectedDay.id);

    if (targetDay && targetDay.placeCategorySeeds === undefined && targetDay.locations.length > 0) {
      try {
        const seeds = await Promise.race([
          resolvePlaceSeedsForDay(
            targetDay,
            baseState.archivedDays.filter((day) => day.id !== targetDay.id)
          ),
          new Promise<string[]>((resolve) => {
            setTimeout(() => resolve([]), 2500);
          }),
        ]);
        now = new Date();
        baseState = setPlaceCategorySeedsForDay(baseState, selectedDay.id, seeds, profile, now);
      } catch {
        // Hatch proceeds without resolved place seeds.
      }
    }

    const weatherTarget = findDay(baseState, selectedDay.id);
    if (weatherTarget && weatherTarget.weather === undefined && weatherTarget.locations.length > 0) {
      try {
        const weather = await ensureDayWeather(weatherTarget);
        if (weather) {
          now = new Date();
          baseState = setDayWeatherForDay(baseState, selectedDay.id, weather, profile, now);
        }
      } catch {
        // Hatch proceeds without resolved weather.
      }
    }

    const hatchedState = triggerHatchForDay(baseState, selectedDay.id, profile, now);
    // Hatch completion is a rare terminal mutation, so persist it synchronously
    // before the reveal can navigate away. Map/photo refreshes may save their
    // own update as soon as the map opens; a deferred hatch write leaves a
    // window where those readers can observe and re-save the pre-hatch egg.
    storedStateRef.current = hatchedState;
    homeRepository.save(hatchedState, { notify: false });
    setStoredState(hatchedState);
    void enhanceDayReflection(hatchedState, selectedDay.id);
    void (async () => {
      const permission = await getHatchNotificationPermission();
      if (permission === 'undetermined') {
        await requestHatchNotificationPermission();
      }
      await syncHatchNotification(hatchedState, profile);
    })();
  }, [enhanceDayReflection, selectedDay, setStoredState, storedStateRef]);

  return { triggerHatchIfReady };
}

function findDay(state: StoredHomeState, dayId: string): StoredHomeDayRecord | null {
  return state.today.id === dayId
    ? state.today
    : state.archivedDays.find((day) => day.id === dayId) ?? null;
}
