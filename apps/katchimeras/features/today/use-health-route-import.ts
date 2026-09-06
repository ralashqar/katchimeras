import { useCallback, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import {
  hydrateHomeState,
  importHealthRoutesForDay as applyHealthRoutesForDay,
  type ImportedHealthRoutesPayload,
  updateHealthPermissionState,
} from '@/game/days';
import type { StoredHomeState } from '@/types/home';
import { getHealthRouteAvailability, importRoutesForDay, requestHealthRoutePermission } from '@/utils/health-route-import';
import { loadOnboardingProfile } from '@/utils/onboarding-state';
import { homeRepository } from '@/storage/repositories/home-repository';

type HealthRouteImportParams = {
  storedStateRef: MutableRefObject<StoredHomeState | null>;
  setStoredState: Dispatch<SetStateAction<StoredHomeState | null>>;
};

export function useHealthRouteImport({ storedStateRef, setStoredState }: HealthRouteImportParams) {
  const [importingHealthRouteDayId, setImportingHealthRouteDayId] = useState<string | null>(null);

  const importHealthRoutesForDay = useCallback(async (dayId: string): Promise<ImportedHealthRoutesPayload> => {
    const profile = loadOnboardingProfile();
    const initialNow = new Date();
    const hydrated = hydrateHomeState(homeRepository.load() ?? storedStateRef.current, profile, initialNow);
    const targetDay =
      hydrated.state.today.id === dayId
        ? hydrated.state.today
        : hydrated.state.archivedDays.find((day) => day.id === dayId) ?? null;

    if (!targetDay) {
      return {
        status: 'error',
        importedWorkoutCount: 0,
        sampledPointCount: 0,
        segmentCount: 0,
        workoutIds: [],
        message: 'That day could not be resolved from local state.',
      };
    }

    setImportingHealthRouteDayId(dayId);

    try {
      const availability = await getHealthRouteAvailability();
      let permissionState = availability.permissionState;

      if (permissionState === 'unknown') {
        permissionState = await requestHealthRoutePermission();
      }

      const permissionNow = new Date();
      setStoredState((currentState) => {
        const currentHydrated = hydrateHomeState(currentState, profile, permissionNow);
        return updateHealthPermissionState(currentHydrated.state, permissionState, profile, permissionNow);
      });

      if (permissionState !== 'granted') {
        return {
          status: permissionState === 'unavailable' ? 'unavailable' : 'denied',
          importedWorkoutCount: 0,
          sampledPointCount: 0,
          segmentCount: 0,
          workoutIds: [],
          message:
            permissionState === 'unavailable'
              ? 'Health route import is only available on iPhone builds with HealthKit enabled.'
              : 'Apple Health route access was not granted.',
        };
      }

      const result = await importRoutesForDay({ isoDate: targetDay.isoDate });
      const resultNow = new Date();

      setStoredState((currentState) => {
        const currentHydrated = hydrateHomeState(currentState, profile, resultNow);
        const withHealthPermission = updateHealthPermissionState(
          currentHydrated.state,
          'granted',
          profile,
          resultNow
        );
        return applyHealthRoutesForDay(withHealthPermission, dayId, result, profile, resultNow);
      });

      return result;
    } finally {
      setImportingHealthRouteDayId((current) => (current === dayId ? null : current));
    }
  }, [setStoredState, storedStateRef]);

  return {
    importingHealthRouteDayId,
    importHealthRoutesForDay,
  };
}
