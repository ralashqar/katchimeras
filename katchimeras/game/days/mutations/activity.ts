import type {
  ActivityPermissionState,
  HealthPermissionState,
  HomeLocationSource,
  HomeLocationType,
  LocationPermissionState,
  StoredHomeDayRecord,
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

export type StepCountReading = {
  stepsCount: number;
  dayId: string;
  observedAt?: string;
};

export function withTodayStepCount(state: StoredHomeState, reading: number | StepCountReading): StoredHomeState {
  const nextToday = withDayStepCount(state.today, reading);
  if (nextToday === state.today) {
    return state;
  }

  return {
    ...state,
    today: nextToday,
  };
}

export function withDayStepCount(day: StoredHomeDayRecord, reading: number | StepCountReading): StoredHomeDayRecord {
  const stepsCount = typeof reading === 'number' ? reading : reading.stepsCount;
  const readingDayId = typeof reading === 'number' ? day.isoDate : reading.dayId;
  if (!Number.isFinite(stepsCount) || stepsCount < 0) {
    return day;
  }
  if (readingDayId !== day.isoDate) {
    return day;
  }

  const storedDayId = day.stepsCountDayId ?? null;
  const existingSteps = storedDayId === day.isoDate ? day.stepsCount : 0;
  const nextSteps = Math.max(existingSteps, Math.round(stepsCount));
  const nextUpdatedAt = typeof reading === 'number' ? day.stepsUpdatedAt : (reading.observedAt ?? day.stepsUpdatedAt ?? null);
  if (nextSteps === day.stepsCount && day.stepsCountDayId === day.isoDate && nextUpdatedAt === day.stepsUpdatedAt) {
    return day;
  }

  return {
    ...day,
    stepsCount: nextSteps,
    stepsCountDayId: day.isoDate,
    stepsUpdatedAt: nextUpdatedAt,
  };
}

export function withForegroundLocationSample(
  state: StoredHomeState,
  sample: ForegroundLocationSample
): StoredHomeState {
  const nextToday = withDayForegroundLocationSample(state.today, sample);
  if (nextToday === state.today) {
    return state;
  }

  return {
    ...state,
    today: nextToday,
  };
}

export function withDayForegroundLocationSample(
  day: StoredHomeDayRecord,
  sample: ForegroundLocationSample
): StoredHomeDayRecord {
  const nextPoint = createForegroundLocationPoint(sample);
  const locations = day.locations ?? [];

  if (shouldSkipLocationSample(locations, nextPoint)) {
    return day;
  }

  return {
    ...day,
    locations: [...locations, nextPoint].slice(-MAX_STORED_DAY_LOCATIONS),
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

function shouldSkipLocationSample(existingPoints: StoredHomeLocationPoint[] | undefined, nextPoint: StoredHomeLocationPoint) {
  const points = existingPoints ?? [];
  const latestPoint = points[points.length - 1];
  if (!latestPoint) {
    return false;
  }

  const timeDelta = new Date(nextPoint.capturedAt).getTime() - new Date(latestPoint.capturedAt).getTime();
  const distance = getDistanceMeters(nextPoint.lat, nextPoint.lng, latestPoint.lat, latestPoint.lng);
  return timeDelta >= 0 && timeDelta <= LOCATION_DEDUPE_WINDOW_MS && distance <= LOCATION_DEDUPE_DISTANCE_METERS;
}
