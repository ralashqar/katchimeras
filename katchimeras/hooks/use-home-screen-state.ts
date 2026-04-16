import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type {
  AddMomentInput,
  ActivityPermissionState,
  HealthPermissionState,
  LocationPermissionState,
  RecentPhotoAsset,
  StoredHomeState,
} from '@/types/home';
import {
  addMomentToDay,
  hydrateHomeState,
  importHealthRoutesForDay as applyHealthRoutesForDay,
  type ImportedHealthRoutesPayload,
  recordForegroundLocationSample,
  seedRecentPhotoLocationsForToday,
  triggerHatchForDay,
  updateActivityPermissionState,
  updateHealthPermissionState,
  updateLocationPermissionState,
  updateTodayStepCount,
} from '@/utils/home-engine';
import { getHealthRouteAvailability, importRoutesForDay, requestHealthRoutePermission } from '@/utils/health-route-import';
import { clearStoredHomeState, loadStoredHomeState, saveStoredHomeState } from '@/utils/home-storage';
import { loadOnboardingProfile } from '@/utils/onboarding-state';

export function useHomeScreenState() {
  const [storedState, setStoredState] = useState<StoredHomeState | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string>('today');
  const [importingHealthRouteDayId, setImportingHealthRouteDayId] = useState<string | null>(null);
  const storedStateRef = useRef<StoredHomeState | null>(storedState);

  useEffect(() => {
    storedStateRef.current = storedState;
  }, [storedState]);

  const syncState = useCallback(() => {
    const now = new Date();
    const profile = loadOnboardingProfile();
    const hydrated = hydrateHomeState(loadStoredHomeState() ?? storedStateRef.current, profile, now);
    const latestReadyArchived = [...hydrated.timelineDays]
      .reverse()
      .find((day) => day.kind === 'day' && !day.isToday && day.state === 'ready_to_hatch');

    setStoredState((current) => (areStoredStatesEqual(current, hydrated.state) ? current : hydrated.state));
    setSelectedDayId((current) => {
      if (latestReadyArchived) {
        return latestReadyArchived.id;
      }

      if (hydrated.timelineDays.some((day) => day.id === current)) {
        return current;
      }

      return hydrated.todayId;
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      syncState();
    }, [syncState])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        syncState();
      }
    });

    return () => subscription.remove();
  }, [syncState]);

  useEffect(() => {
    if (!storedState) {
      return;
    }

    saveStoredHomeState(storedState);
  }, [storedState]);

  const viewModel = useMemo(() => {
    const now = new Date();
    const profile = loadOnboardingProfile();
    const hydrated = hydrateHomeState(storedState, profile, now);
    return hydrated;
  }, [storedState]);

  const timelineDays = viewModel.timelineDays;
  const selectedDay =
    timelineDays.find((day) => day.id === selectedDayId) ??
    timelineDays.find((day) => day.kind === 'day' && day.isToday) ??
    timelineDays[0] ??
    null;

  const addMoment = useCallback((momentInput: AddMomentInput) => {
    const now = new Date();
    const profile = loadOnboardingProfile();

    setStoredState((currentState) => {
      const hydrated = hydrateHomeState(currentState, profile, now);
      return addMomentToDay(hydrated.state, profile, momentInput, now);
    });
  }, []);

  const setLocationPermission = useCallback((permission: LocationPermissionState) => {
    const now = new Date();
    const profile = loadOnboardingProfile();

    setStoredState((currentState) => {
      const hydrated = hydrateHomeState(currentState, profile, now);
      return updateLocationPermissionState(hydrated.state, permission, profile, now);
    });
  }, []);

  const setHealthPermission = useCallback((permission: HealthPermissionState) => {
    const now = new Date();
    const profile = loadOnboardingProfile();

    setStoredState((currentState) => {
      const hydrated = hydrateHomeState(currentState, profile, now);
      return updateHealthPermissionState(hydrated.state, permission, profile, now);
    });
  }, []);

  const setActivityPermission = useCallback((permission: ActivityPermissionState) => {
    const now = new Date();
    const profile = loadOnboardingProfile();

    setStoredState((currentState) => {
      const hydrated = hydrateHomeState(currentState, profile, now);
      return updateActivityPermissionState(hydrated.state, permission, profile, now);
    });
  }, []);

  const setTodayStepCount = useCallback((stepsCount: number) => {
    const now = new Date();
    const profile = loadOnboardingProfile();

    setStoredState((currentState) => {
      const hydrated = hydrateHomeState(currentState, profile, now);
      return updateTodayStepCount(hydrated.state, stepsCount, profile, now);
    });
  }, []);

  const addForegroundLocationSample = useCallback(
    (sample: {
      lat: number;
      lng: number;
      capturedAt: string;
      accuracyMeters?: number;
    }) => {
      const now = new Date();
      const profile = loadOnboardingProfile();

      setStoredState((currentState) => {
        const hydrated = hydrateHomeState(currentState, profile, now);
        return recordForegroundLocationSample(hydrated.state, sample, profile, now);
      });
    },
    []
  );

  const seedRecentPhotoLocations = useCallback((photos: RecentPhotoAsset[]) => {
    const now = new Date();
    const profile = loadOnboardingProfile();

    setStoredState((currentState) => {
      const hydrated = hydrateHomeState(currentState, profile, now);
      return seedRecentPhotoLocationsForToday(hydrated.state, photos, profile, now);
    });
  }, []);

  const selectTimelineDay = useCallback((dayId: string) => {
    setSelectedDayId(dayId);
  }, []);

  const selectPath = useCallback((pathId: string) => {
    const now = new Date();
    const profile = loadOnboardingProfile();

    setStoredState((currentState) => {
      const hydrated = hydrateHomeState(currentState, profile, now);
      return {
        ...hydrated.state,
        today: {
          ...hydrated.state.today,
          selectedPathId: hydrated.state.today.selectedPathId === pathId ? null : pathId,
        },
      };
    });
  }, []);

  const triggerHatchIfReady = useCallback(() => {
    if (!selectedDay || selectedDay.kind !== 'day') {
      return;
    }

    const now = new Date();
    const profile = loadOnboardingProfile();

    setStoredState((currentState) => {
      const hydrated = hydrateHomeState(currentState, profile, now);
      return triggerHatchForDay(hydrated.state, selectedDay.id, profile, now);
    });
  }, [selectedDay]);

  const refreshState = useCallback(() => {
    syncState();
  }, [syncState]);

  const resetHomeState = useCallback(() => {
    const now = new Date();
    const profile = loadOnboardingProfile();
    const hydrated = hydrateHomeState(null, profile, now);

    clearStoredHomeState();
    setStoredState(hydrated.state);
    setSelectedDayId(hydrated.todayId);
  }, []);

  const importHealthRoutesForDay = useCallback(async (dayId: string): Promise<ImportedHealthRoutesPayload> => {
    const profile = loadOnboardingProfile();
    const initialNow = new Date();
    const hydrated = hydrateHomeState(loadStoredHomeState() ?? storedStateRef.current, profile, initialNow);
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
  }, []);

  return {
    timelineDays,
    selectedDayId: selectedDay?.id ?? viewModel.todayId,
    selectedDay,
    locationPermission: viewModel.state.locationPermission,
    activityPermission: viewModel.state.activityPermission,
    healthPermission: viewModel.state.healthPermission,
    importingHealthRouteDayId,
    addMoment,
    addForegroundLocationSample,
    importHealthRoutesForDay,
    seedRecentPhotoLocations,
    setActivityPermission,
    setHealthPermission,
    setLocationPermission,
    setTodayStepCount,
    selectTimelineDay,
    selectPath,
    triggerHatchIfReady,
    refreshState,
    resetHomeState,
  };
}

function areStoredStatesEqual(left: StoredHomeState | null, right: StoredHomeState | null) {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return JSON.stringify(left) === JSON.stringify(right);
}
