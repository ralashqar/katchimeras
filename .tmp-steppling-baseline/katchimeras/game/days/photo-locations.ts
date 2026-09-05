import type {
  PhotoVisionResult,
  RecentPhotoAsset,
  StoredHomeDayRecord,
  StoredHomeLocationPoint,
  StoredHomeState,
} from '@/types/home';
import type { PhotoPlaceResolution } from '@/types/photo-place';
import { upsertEvidence } from '@/utils/intelligence/evidence';
import { upsertClassifiedMemory } from '@/utils/intelligence/classification';
import { buildPhotoIntelligence } from '@/utils/intelligence/photo-intelligence';
import { curatePhotos } from '@/utils/photo-curation';
import { aggregatePhotoVision } from '@/utils/vision-signals';
import { isPlausibleGeographicCoordinate } from '@/utils/photo-location';

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
    .filter((photo): photo is NormalizedPhoto => isPlausibleGeographicCoordinate(photo.latitude, photo.longitude))
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
    const intelligence = bucket
      .filter((photo) => photo.vision != null)
      .map((photo) =>
        buildPhotoIntelligence({
          sourceId: photo.id,
          observedAt: new Date(photo.createdAt).toISOString(),
          thumbnailUri: photo.thumbnailUri || photo.uri,
          rawVision: photo.vision ?? null,
          vision: photo.visionSummary ?? aggregatePhotoVision([photo.vision!]),
          scene: photo.sceneRead ?? null,
        })
      );
    const evidence = intelligence.map((item) => item.evidence);
    const classifiedMemories = intelligence.map((item) => item.memory);

    return {
      ...day,
      locations: nextLocations.slice(-MAX_STORED_DAY_LOCATIONS),
      vision: nextVision,
      evidence: evidence.length > 0 ? upsertEvidence(day.evidence, evidence) : day.evidence,
      classifiedMemories:
        classifiedMemories.length > 0
          ? upsertClassifiedMemory(day.classifiedMemories, classifiedMemories)
          : day.classifiedMemories,
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

// Map-only refresh for one concrete day. Unlike the live Today seeder, this is
// allowed to enrich an already-hatched archive day, but it only merges located
// photo points: it never changes vision, evidence, scores, or narrative data.
export function withRefreshedPhotoLocationsForDay(
  state: StoredHomeState,
  dayId: string,
  photos: RecentPhotoAsset[]
): StoredHomeState {
  const target = [state.today, state.tomorrow, ...state.archivedDays].find((day) => day?.id === dayId) ?? null;
  if (!target) return state;
  const keepers = curatePhotos(photos).keepers
    .filter((photo) => toLocalDateId(new Date(photo.createdAt)) === target.isoDate)
    .map((photo) => ({
      photo,
      latitude: normalizeCoordinate(photo.latitude),
      longitude: normalizeCoordinate(photo.longitude),
    }))
    .filter((item): item is typeof item & { latitude: number; longitude: number } =>
      isPlausibleGeographicCoordinate(item.latitude, item.longitude)
    );

  // Replace only passive camera-roll imports. Manual pins, journal locations,
  // route samples and moment-linked photo points are never touched.
  const locations = (target.locations ?? []).filter((point) => !isPassiveCameraRollPoint(point));
  for (const { photo, latitude, longitude } of keepers) {
    const id = `camera-roll-photo-${photo.id}`;
    const previous = locations.find((point) => point.id === id);
    const point: StoredHomeLocationPoint = {
      ...previous,
      id,
      lat: Number(latitude.toFixed(6)),
      lng: Number(longitude.toFixed(6)),
      capturedAt: new Date(photo.createdAt).toISOString(),
      type: previous?.type ?? 'unknown',
      hasPhoto: true,
      source: 'photo_attachment',
      momentId: previous?.momentId ?? null,
      thumbnailUri: photo.thumbnailUri || photo.uri,
      similarityHash: photo.similarityHash ?? previous?.similarityHash,
      meanLuminance: photo.meanLuminance ?? previous?.meanLuminance,
      luminanceRange: photo.luminanceRange ?? previous?.luminanceRange,
    };
    const index = locations.findIndex((candidate) => candidate.id === id);
    if (index >= 0) locations[index] = point;
    else locations.push(point);
  }
  const resolutions = keepers
    .map(({ photo }) => photo.placeResolution)
    .filter((resolution): resolution is PhotoPlaceResolution => resolution != null);
  const photoPlaceResolutions = resolutions.reduce<PhotoPlaceResolution[]>((rows, resolution) => {
    const index = rows.findIndex((item) => item.photoId === resolution.photoId);
    if (index >= 0) rows[index] = resolution;
    else rows.push(resolution);
    return rows;
  }, [...(target.photoPlaceResolutions ?? [])]);
  const nextDay = {
    ...target,
    locations: locations.slice(-MAX_STORED_DAY_LOCATIONS),
    photoPlaceResolutions,
  };
  if (state.today.id === dayId) return { ...state, today: nextDay };
  if (state.tomorrow?.id === dayId) return { ...state, tomorrow: nextDay };
  return { ...state, archivedDays: state.archivedDays.map((day) => day.id === dayId ? nextDay : day) };
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

function isPassiveCameraRollPoint(point: StoredHomeLocationPoint): boolean {
  return (
    point.source === 'photo_attachment' &&
    point.id.startsWith('camera-roll-photo-') &&
    point.momentId == null &&
    point.journalRecordId == null
  );
}
