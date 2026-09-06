import type {
  HomeLocationType,
  StoredExactRouteSegment,
  StoredHealthRouteImportMeta,
  StoredHomeDayRecord,
  StoredHomeLocationPoint,
} from '@/types/home';

import { getDistanceMeters } from './geo';

const MAX_STORED_DAY_LOCATIONS = 180;
const MAX_HEALTH_ROUTE_SAMPLE_POINTS = 120;
const LOCATION_LINK_WINDOW_MS = 20 * 60 * 1000;

export type ImportedHealthRoutePoint = {
  latitude: number;
  longitude: number;
  capturedAt: string;
};

export type ImportedHealthRouteSegment = {
  id: string;
  workoutId: string;
  activityType: string;
  startedAt: string;
  endedAt: string;
  coordinates: ImportedHealthRoutePoint[];
};

export type ImportedHealthRoutesPayload = {
  status: 'success' | 'no_data' | 'denied' | 'unavailable' | 'error';
  importedWorkoutCount: number;
  sampledPointCount: number;
  segmentCount: number;
  workoutIds: string[];
  segments?: ImportedHealthRouteSegment[];
  message?: string | null;
};

export function applyHealthRoutesToDayRecord(
  day: StoredHomeDayRecord,
  payload: ImportedHealthRoutesPayload,
  now: Date
): StoredHomeDayRecord {
  const nextImportMeta = buildHealthRouteImportMeta(payload, now);

  if (payload.status !== 'success' || !payload.segments || payload.segments.length === 0) {
    return {
      ...day,
      healthRouteImport: nextImportMeta,
    };
  }

  const normalizedSegments = payload.segments
    .map(normalizeImportedHealthRouteSegment)
    .filter((segment) => segment.coordinates.length > 0);

  const baseLocations = day.locations.filter((point) => point.source !== 'health_workout_route');
  const sampledRouteLocations = buildSampledHealthRouteLocations(normalizedSegments, baseLocations);

  return {
    ...day,
    locations: [...baseLocations, ...sampledRouteLocations].slice(-MAX_STORED_DAY_LOCATIONS),
    healthRouteImport: {
      ...nextImportMeta,
      sampledPointCount: sampledRouteLocations.length,
      segmentCount: normalizedSegments.length,
    },
    exactRouteSegments: normalizedSegments,
  };
}

function buildHealthRouteImportMeta(
  payload: ImportedHealthRoutesPayload,
  now: Date
): StoredHealthRouteImportMeta {
  return {
    status: payload.status,
    importedAt: payload.status === 'success' ? now.toISOString() : null,
    workoutIds: payload.workoutIds,
    importedWorkoutCount: payload.importedWorkoutCount,
    sampledPointCount: payload.sampledPointCount,
    segmentCount: payload.segmentCount,
    message: payload.message ?? null,
  };
}

function normalizeImportedHealthRouteSegment(segment: ImportedHealthRouteSegment): StoredExactRouteSegment {
  return {
    ...segment,
    coordinates: segment.coordinates
      .map((coordinate) => ({
        latitude: Number(coordinate.latitude.toFixed(6)),
        longitude: Number(coordinate.longitude.toFixed(6)),
        capturedAt: coordinate.capturedAt,
      }))
      .filter(
        (coordinate) =>
          Number.isFinite(coordinate.latitude) &&
          Number.isFinite(coordinate.longitude) &&
          Boolean(coordinate.capturedAt)
      ),
  };
}

function buildSampledHealthRouteLocations(
  segments: StoredExactRouteSegment[],
  baseLocations: StoredHomeLocationPoint[]
): StoredHomeLocationPoint[] {
  const collectedPoints: StoredHomeLocationPoint[] = [];
  const existingPoints = [...baseLocations];

  for (const segment of segments) {
    const downsampled = downsampleRouteCoordinates(segment.coordinates);
    for (const coordinate of downsampled) {
      if (collectedPoints.length >= MAX_HEALTH_ROUTE_SAMPLE_POINTS) {
        return collectedPoints;
      }

      const nextPoint: StoredHomeLocationPoint = {
        id: `health-route-${segment.workoutId}-${new Date(coordinate.capturedAt).getTime().toString(36)}-${collectedPoints.length.toString(36)}`,
        lat: coordinate.latitude,
        lng: coordinate.longitude,
        capturedAt: coordinate.capturedAt,
        type: classifyHealthRouteLocationType(segment.activityType),
        hasPhoto: false,
        source: 'health_workout_route',
        momentId: null,
      };

      if (isDuplicateImportedHealthRoutePoint([...existingPoints, ...collectedPoints], nextPoint)) {
        continue;
      }

      collectedPoints.push(nextPoint);
    }
  }

  return collectedPoints;
}

function downsampleRouteCoordinates(
  coordinates: StoredExactRouteSegment['coordinates']
): StoredExactRouteSegment['coordinates'] {
  if (coordinates.length <= 2) {
    return coordinates;
  }

  const kept: StoredExactRouteSegment['coordinates'] = [coordinates[0]];
  let lastKept = coordinates[0];

  for (let index = 1; index < coordinates.length - 1; index += 1) {
    const candidate = coordinates[index];
    const distance = getDistanceMeters(
      lastKept.latitude,
      lastKept.longitude,
      candidate.latitude,
      candidate.longitude
    );
    const elapsedMs = Math.abs(new Date(candidate.capturedAt).getTime() - new Date(lastKept.capturedAt).getTime());

    if (distance >= 100 || elapsedMs >= 120_000) {
      kept.push(candidate);
      lastKept = candidate;
    }
  }

  const lastCoordinate = coordinates[coordinates.length - 1];
  if (kept[kept.length - 1]?.capturedAt !== lastCoordinate.capturedAt) {
    kept.push(lastCoordinate);
  }

  return kept;
}

function isDuplicateImportedHealthRoutePoint(
  existingPoints: StoredHomeLocationPoint[],
  nextPoint: StoredHomeLocationPoint
) {
  return existingPoints.some((point) => {
    const timeDelta = Math.abs(new Date(point.capturedAt).getTime() - new Date(nextPoint.capturedAt).getTime());
    const distance = getDistanceMeters(point.lat, point.lng, nextPoint.lat, nextPoint.lng);
    return timeDelta <= LOCATION_LINK_WINDOW_MS && distance <= 100;
  });
}

function classifyHealthRouteLocationType(activityType: string): HomeLocationType {
  const normalized = activityType.toLowerCase();
  if (normalized.includes('walk') || normalized.includes('run') || normalized.includes('hike')) {
    return 'park';
  }
  return 'unknown';
}
