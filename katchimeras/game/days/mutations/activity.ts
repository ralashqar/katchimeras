import type {
  ActivityPermissionState,
  HealthPermissionState,
  HomeLocationSource,
  HomeLocationType,
  LocationPermissionState,
  StoredHomeLocationPoint,
  StoredHomeState,
} from '@/types/home';
import { getDistanceMeters } from '../geo';

const MAX_STORED_DAY_LOCATIONS = 180;
const LOCATION_DEDUPE_WINDOW_MS = 4 * 60 * 1000;
const LOCATION_DEDUPE_DISTANCE_METERS = 65;

export type ForegroundLocationSample = {
  lat: number;
  lng: number;
  capturedAt: string;
  accuracyMeters?: number;
  type?: HomeLocationType;
  source?: HomeLocationSource;
};

export function withLocationPermission(
  state: StoredHomeState,
  permission: LocationPermissionState
): StoredHomeState {
  return {
    ...state,
    locationPermission: permission,
  };
}

export function withHealthPermission(state: StoredHomeState, permission: HealthPermissionState): StoredHomeState {
  return {
    ...state,
    healthPermission: permission,
  };
}

export function withActivityPermission(
  state: StoredHomeState,
  permission: ActivityPermissionState
): StoredHomeState {
  return {
    ...state,
    activityPermission: permission,
  };
}

export function withTodayStepCount(state: StoredHomeState, stepsCount: number): StoredHomeState {
  if (!Number.isFinite(stepsCount) || stepsCount < 0) {
    return state;
  }

  return {
    ...state,
    today: {
      ...state.today,
      stepsCount: Math.max(state.today.stepsCount, Math.round(stepsCount)),
    },
  };
}

export function withForegroundLocationSample(
  state: StoredHomeState,
  sample: ForegroundLocationSample
): StoredHomeState {
  const nextPoint = createForegroundLocationPoint(sample);

  if (shouldSkipLocationSample(state.today.locations, nextPoint)) {
    return state;
  }

  return {
    ...state,
    today: {
      ...state.today,
      locations: [...state.today.locations, nextPoint].slice(-MAX_STORED_DAY_LOCATIONS),
    },
  };
}

function createForegroundLocationPoint(sample: ForegroundLocationSample): StoredHomeLocationPoint {
  return {
    id: `loc-${new Date(sample.capturedAt).getTime().toString(36)}-${Math.abs(
      Math.round(sample.lat * 10000 + sample.lng * 10000)
    ).toString(36)}`,
    lat: Number(sample.lat.toFixed(6)),
    lng: Number(sample.lng.toFixed(6)),
    capturedAt: sample.capturedAt,
    type: sample.type ?? 'unknown',
    hasPhoto: false,
    source: sample.source ?? 'foreground',
    momentId: null,
    accuracyMeters: sample.accuracyMeters ? Number(sample.accuracyMeters.toFixed(1)) : undefined,
  };
}

function shouldSkipLocationSample(existingPoints: StoredHomeLocationPoint[], nextPoint: StoredHomeLocationPoint) {
  const latestPoint = existingPoints[existingPoints.length - 1];
  if (!latestPoint) {
    return false;
  }

  const timeDelta = new Date(nextPoint.capturedAt).getTime() - new Date(latestPoint.capturedAt).getTime();
  const distance = getDistanceMeters(nextPoint.lat, nextPoint.lng, latestPoint.lat, latestPoint.lng);
  return timeDelta >= 0 && timeDelta <= LOCATION_DEDUPE_WINDOW_MS && distance <= LOCATION_DEDUPE_DISTANCE_METERS;
}
