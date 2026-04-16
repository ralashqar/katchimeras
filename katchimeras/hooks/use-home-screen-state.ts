import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { AddMomentInput, LocationPermissionState, RecentPhotoAsset, StoredHomeState } from '@/types/home';
import {
  addMomentToDay,
  hydrateHomeState,
  recordForegroundLocationSample,
  seedRecentPhotoLocationsForToday,
  triggerHatchForDay,
  updateLocationPermissionState,
} from '@/utils/home-engine';
import { clearStoredHomeState, loadStoredHomeState, saveStoredHomeState } from '@/utils/home-storage';
import { loadOnboardingProfile } from '@/utils/onboarding-state';

export function useHomeScreenState() {
  const [storedState, setStoredState] = useState<StoredHomeState | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string>('today');
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

  return {
    timelineDays,
    selectedDayId: selectedDay?.id ?? viewModel.todayId,
    selectedDay,
    locationPermission: viewModel.state.locationPermission,
    addMoment,
    addForegroundLocationSample,
    seedRecentPhotoLocations,
    setLocationPermission,
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
