import { Platform } from 'react-native';

import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { recordForegroundLocationSample, hydrateHomeState } from '@/game/days';
import { homeRepository } from '@/storage/repositories/home-repository';
import { loadOnboardingProfile } from '@/utils/onboarding-state';

export const TRAVEL_MEMORY_LOCATION_TASK = 'katchimera-travel-memory-location-v1';

export type TravelMemoryModeStatus = 'off' | 'enabled' | 'paused_today' | 'denied' | 'unavailable';

export type TravelMemoryModeState = {
  status: TravelMemoryModeStatus;
  enabledAt: string | null;
  pausedIsoDate: string | null;
  lastPermissionCheckAt: string | null;
  lastBackgroundSampleAt: string | null;
  lastError: string | null;
};

type LocationObjectLike = {
  timestamp?: number;
  coords?: {
    latitude?: number;
    longitude?: number;
    accuracy?: number | null;
  };
};

const TRAVEL_MEMORY_KEY = 'katchadeck.travel-memory-mode-v1';
const BACKGROUND_DISTANCE_INTERVAL_METERS = 300;
const BACKGROUND_TIME_INTERVAL_MS = 10 * 60 * 1000;
const MAX_BACKGROUND_ACCURACY_METERS = 300;

const DEFAULT_STATE: TravelMemoryModeState = {
  status: 'off',
  enabledAt: null,
  pausedIsoDate: null,
  lastPermissionCheckAt: null,
  lastBackgroundSampleAt: null,
  lastError: null,
};

const listeners = new Set<() => void>();

function todayIso(now = new Date()) {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeTravelMemoryState(input: Partial<TravelMemoryModeState> | null | undefined): TravelMemoryModeState {
  if (!input || typeof input !== 'object') return DEFAULT_STATE;
  const status: TravelMemoryModeStatus =
    input.status === 'enabled' ||
    input.status === 'paused_today' ||
    input.status === 'denied' ||
    input.status === 'unavailable' ||
    input.status === 'off'
      ? input.status
      : 'off';
  return {
    status,
    enabledAt: input.enabledAt ?? null,
    pausedIsoDate: input.pausedIsoDate ?? null,
    lastPermissionCheckAt: input.lastPermissionCheckAt ?? null,
    lastBackgroundSampleAt: input.lastBackgroundSampleAt ?? null,
    lastError: input.lastError ?? null,
  };
}

function notifyTravelMemoryListeners() {
  listeners.forEach((listener) => listener());
}

export function loadTravelMemoryModeState(): TravelMemoryModeState {
  const state = normalizeTravelMemoryState(getStoredJson<Partial<TravelMemoryModeState> | null>(TRAVEL_MEMORY_KEY, null));
  if (state.status === 'paused_today' && state.pausedIsoDate !== todayIso()) {
    return { ...state, status: 'enabled', pausedIsoDate: null };
  }
  return state;
}

export function saveTravelMemoryModeState(state: TravelMemoryModeState) {
  setStoredJson(TRAVEL_MEMORY_KEY, normalizeTravelMemoryState(state));
  notifyTravelMemoryListeners();
}

export function subscribeTravelMemoryModeChanges(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isTravelMemoryModeActive(state = loadTravelMemoryModeState(), now = new Date()) {
  return state.status === 'enabled' || (state.status === 'paused_today' && state.pausedIsoDate !== todayIso(now));
}

export async function enableTravelMemoryMode(): Promise<TravelMemoryModeState> {
  if (Platform.OS === 'web') {
    const unavailable = { ...loadTravelMemoryModeState(), status: 'unavailable' as const, lastError: 'Background location is not available on web.' };
    saveTravelMemoryModeState(unavailable);
    return unavailable;
  }

  try {
    const Location = await import('expo-location');
    const checkedAt = new Date().toISOString();
    const foreground = await Location.getForegroundPermissionsAsync();
    const foregroundPermission = foreground.granted ? foreground : await Location.requestForegroundPermissionsAsync();
    if (!foregroundPermission.granted) {
      const denied = { ...loadTravelMemoryModeState(), status: 'denied' as const, lastPermissionCheckAt: checkedAt, lastError: null };
      saveTravelMemoryModeState(denied);
      await syncTravelMemoryLocationTask(denied);
      return denied;
    }

    const background = await Location.requestBackgroundPermissionsAsync();
    if (!background.granted) {
      const denied = { ...loadTravelMemoryModeState(), status: 'denied' as const, lastPermissionCheckAt: checkedAt, lastError: null };
      saveTravelMemoryModeState(denied);
      await syncTravelMemoryLocationTask(denied);
      return denied;
    }

    const enabled: TravelMemoryModeState = {
      ...loadTravelMemoryModeState(),
      status: 'enabled',
      enabledAt: loadTravelMemoryModeState().enabledAt ?? checkedAt,
      pausedIsoDate: null,
      lastPermissionCheckAt: checkedAt,
      lastError: null,
    };
    saveTravelMemoryModeState(enabled);
    await syncTravelMemoryLocationTask(enabled);
    return enabled;
  } catch (error) {
    const unavailable = {
      ...loadTravelMemoryModeState(),
      status: 'unavailable' as const,
      lastError: error instanceof Error ? error.message : 'Background location could not start.',
    };
    saveTravelMemoryModeState(unavailable);
    return unavailable;
  }
}

export async function pauseTravelMemoryModeForToday(): Promise<TravelMemoryModeState> {
  const paused = {
    ...loadTravelMemoryModeState(),
    status: 'paused_today' as const,
    pausedIsoDate: todayIso(),
    lastError: null,
  };
  saveTravelMemoryModeState(paused);
  await syncTravelMemoryLocationTask(paused);
  return paused;
}

export async function disableTravelMemoryMode(): Promise<TravelMemoryModeState> {
  const off = {
    ...loadTravelMemoryModeState(),
    status: 'off' as const,
    pausedIsoDate: null,
    lastError: null,
  };
  saveTravelMemoryModeState(off);
  await syncTravelMemoryLocationTask(off);
  return off;
}

export async function syncTravelMemoryLocationTask(state = loadTravelMemoryModeState()) {
  if (Platform.OS === 'web') return;
  try {
    const Location = await import('expo-location');
    const started = await Location.hasStartedLocationUpdatesAsync(TRAVEL_MEMORY_LOCATION_TASK).catch(() => false);
    const active = isTravelMemoryModeActive(state);
    if (!active) {
      if (started) await Location.stopLocationUpdatesAsync(TRAVEL_MEMORY_LOCATION_TASK);
      return;
    }

    const backgroundPermission = await Location.getBackgroundPermissionsAsync();
    if (!backgroundPermission.granted) {
      const denied = {
        ...state,
        status: 'denied' as const,
        lastPermissionCheckAt: new Date().toISOString(),
        lastError: null,
      };
      saveTravelMemoryModeState(denied);
      if (started) await Location.stopLocationUpdatesAsync(TRAVEL_MEMORY_LOCATION_TASK);
      return;
    }

    if (!started) {
      await Location.startLocationUpdatesAsync(TRAVEL_MEMORY_LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        activityType: Location.ActivityType.Other,
        distanceInterval: BACKGROUND_DISTANCE_INTERVAL_METERS,
        timeInterval: BACKGROUND_TIME_INTERVAL_MS,
        deferredUpdatesDistance: BACKGROUND_DISTANCE_INTERVAL_METERS * 2,
        deferredUpdatesInterval: BACKGROUND_TIME_INTERVAL_MS,
        pausesUpdatesAutomatically: true,
        showsBackgroundLocationIndicator: false,
        foregroundService: {
          notificationTitle: 'Katchimera is remembering places',
          notificationBody: 'Travel Memory Mode is building today from meaningful stops.',
          notificationColor: '#FFC36B',
          killServiceOnDestroy: false,
        },
      });
    }
  } catch (error) {
    saveTravelMemoryModeState({
      ...state,
      status: state.status === 'enabled' ? 'unavailable' : state.status,
      lastError: error instanceof Error ? error.message : 'Background location could not sync.',
    });
  }
}

export function recordTravelMemoryLocationObject(location: LocationObjectLike) {
  if (!isTravelMemoryModeActive()) return;
  const latitude = location.coords?.latitude;
  const longitude = location.coords?.longitude;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return;

  const accuracy = location.coords?.accuracy ?? undefined;
  if (typeof accuracy === 'number' && accuracy > MAX_BACKGROUND_ACCURACY_METERS) return;

  const now = new Date();
  const profile = loadOnboardingProfile();
  const hydrated = hydrateHomeState(homeRepository.load(), profile, now);
  const capturedAt = new Date(typeof location.timestamp === 'number' ? location.timestamp : now.getTime()).toISOString();
  const next = recordForegroundLocationSample(
    hydrated.state,
    {
      lat: latitude,
      lng: longitude,
      capturedAt,
      accuracyMeters: typeof accuracy === 'number' ? accuracy : undefined,
      source: 'background',
    },
    profile,
    now
  );
  homeRepository.save(next);
  saveTravelMemoryModeState({
    ...loadTravelMemoryModeState(),
    lastBackgroundSampleAt: capturedAt,
    lastError: null,
  });
}

export function deleteTodayTravelMemoryPlaces() {
  const now = new Date();
  const profile = loadOnboardingProfile();
  const hydrated = hydrateHomeState(homeRepository.load(), profile, now);
  const nextToday = {
    ...hydrated.state.today,
    locations: hydrated.state.today.locations.filter((point) => point.source !== 'background'),
  };
  const normalized = hydrateHomeState({ ...hydrated.state, today: nextToday }, profile, now).state;
  homeRepository.save(normalized);
}

// --- UI copy for the Travel Memory controls (Observatory reader) ---

export function travelMemoryStatusLabel(state: TravelMemoryModeState): string {
  if (state.status === 'enabled') return 'Remembering meaningful stops';
  if (state.status === 'paused_today') return 'Paused for today';
  if (state.status === 'denied') return 'Permission needed';
  if (state.status === 'unavailable') return 'Not available on this device';
  return 'Off by default';
}

export function travelMemoryBody(state: TravelMemoryModeState): string {
  if (state.status === 'enabled') {
    return 'When you travel, Katchimera can add coarse background stops to today so the patch does not depend on photos or opening the app.';
  }
  if (state.status === 'paused_today') return 'Background place capture is paused until tomorrow. You can resume it any time.';
  if (state.status === 'denied') return 'Allow background location if you want travel days to become places even when the app was not open.';
  if (state.status === 'unavailable') return 'This build or platform cannot run background place capture yet.';
  return 'Optional. Turn it on after you trust the app, especially for days when you move between places.';
}

export function travelMemoryEnableLabel(state: TravelMemoryModeState): string {
  if (state.status === 'paused_today') return 'Resume Travel Memory';
  if (state.status === 'denied') return 'Try Travel Memory';
  return 'Travel Memory';
}
