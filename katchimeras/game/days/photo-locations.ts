import type {
  PhotoVisionResult,
  RecentPhotoAsset,
  StoredHomeDayRecord,
  StoredHomeLocationPoint,
  StoredHomeState,
} from '@/types/home';
import { buildPhotoEvidence, upsertEvidence } from '@/utils/intelligence/evidence';
import { curatePhotos } from '@/utils/photo-curation';
import { aggregatePhotoVision } from '@/utils/vision-signals';

import { toLocalDateId } from './date';

const MAX_STORED_DAY_LOCATIONS = 180;

export function withSeededPhotoLocationsByDay(
  state: StoredHomeState,
  photos: RecentPhotoAsset[],
  options: { todayPhotoTarget?: StoredHomeDayRecord | null } = {}
): StoredHomeState {
  type NormalizedPhoto = Omit<RecentPhotoAsset, 'latitude' | 'longitude'> & {
    latitude: number;
    longitude: number;
  };

  const keepers = curatePhotos(photos).keepers;
  const geotaggedByDate = new Map<string, NormalizedPhoto[]>();
  keepers
    .map((photo) => ({
      ...photo,
      latitude: normalizeCoordinate(photo.latitude),
      longitude: normalizeCoordinate(photo.longitude),
    }))
    .filter((photo): photo is NormalizedPhoto => photo.latitude != null && photo.longitude != null)
    .forEach((photo) => {
      const dateId = toLocalDateId(new Date(photo.createdAt));
      const bucket = geotaggedByDate.get(dateId) ?? [];
      bucket.push(photo);
      geotaggedByDate.set(dateId, bucket);
    });

  if (geotaggedByDate.size === 0) {
    return state;
  }

  const applyToDay = (day: StoredHomeDayRecord, bucketOverride?: NormalizedPhoto[]): StoredHomeDayRecord => {
    if (day.creature) {
      return day;
    }
    const bucket = bucketOverride ?? geotaggedByDate.get(day.isoDate);
    if (!bucket || bucket.length === 0) {
      return day;
    }

    const nextLocations = [...(day.locations ?? [])];
    [...bucket]
      .sort((left, right) => left.createdAt - right.createdAt)
      .slice(-MAX_STORED_DAY_LOCATIONS)
      .forEach((photo) => {
        const seededPoint: StoredHomeLocationPoint = {
          id: `camera-roll-photo-${photo.id}`,
          lat: Number(photo.latitude.toFixed(6)),
          lng: Number(photo.longitude.toFixed(6)),
          capturedAt: new Date(photo.createdAt).toISOString(),
          type: 'unknown',
          hasPhoto: true,
          source: 'photo_attachment',
          momentId: null,
          thumbnailUri: photo.thumbnailUri || photo.uri,
          similarityHash: photo.similarityHash,
          meanLuminance: photo.meanLuminance,
          luminanceRange: photo.luminanceRange,
        };
        const existingIndex = nextLocations.findIndex((point) => point.id === seededPoint.id);

        if (existingIndex >= 0) {
          nextLocations[existingIndex] = {
            ...nextLocations[existingIndex],
            ...seededPoint,
            momentId: nextLocations[existingIndex]?.momentId ?? null,
          };
          return;
        }

        nextLocations.push(seededPoint);
      });

    const visionResults = bucket
      .map((photo) => photo.vision)
      .filter((result): result is PhotoVisionResult => result != null);
    const nextVision = visionResults.length > 0 ? aggregatePhotoVision(visionResults) : day.vision;
    const evidence = bucket
      .filter((photo) => photo.vision != null)
      .map((photo) =>
        buildPhotoEvidence({
          sourceId: photo.id,
          observedAt: new Date(photo.createdAt).toISOString(),
          thumbnailUri: photo.thumbnailUri || photo.uri,
          rawVision: photo.vision ?? null,
        })
      );

    return {
      ...day,
      locations: nextLocations.slice(-MAX_STORED_DAY_LOCATIONS),
      vision: nextVision,
      evidence: evidence.length > 0 ? upsertEvidence(day.evidence, evidence) : day.evidence,
    };
  };
  const todayPhotoTarget =
    options.todayPhotoTarget && options.todayPhotoTarget.id !== state.today.id ? options.todayPhotoTarget : null;
  const mergeBuckets = (...buckets: Array<NormalizedPhoto[] | undefined>): NormalizedPhoto[] =>
    buckets.flatMap((bucket) => bucket ?? []);
  const redirectedTodayBucket = todayPhotoTarget
    ? mergeBuckets(
        geotaggedByDate.get(state.today.isoDate),
        todayPhotoTarget.isoDate !== state.today.isoDate ? geotaggedByDate.get(todayPhotoTarget.isoDate) : undefined
      )
    : [];

  return {
    ...state,
    today: todayPhotoTarget ? state.today : applyToDay(state.today),
    tomorrow: todayPhotoTarget
      ? applyToDay(todayPhotoTarget, redirectedTodayBucket)
      : state.tomorrow
        ? applyToDay(state.tomorrow)
        : state.tomorrow,
    archivedDays: state.archivedDays.map((day) => applyToDay(day)),
  };
}

function normalizeCoordinate(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}
