import KatchimeraMapSearch from '@/modules/katchimera-map-search';
import { photoPlaceRepository } from '@/storage/repositories/photo-place-repository';
import type {
  CandidateEvidence,
  NativeAreaCandidate,
  NativePlaceCandidate,
  NativePlaceLookupResult,
  PhotoPlaceInput,
  PhotoPlaceResolution,
  PlaceType,
  ScoredPlaceCandidate,
  UserPlaceCluster,
} from '@/types/photo-place';
import {
  buildPlaceCacheKey,
} from '@/storage/repositories/photo-place-repository';
import {
  calculateSearchRadius,
  calculateVisualCategoryScore,
  distanceMeters,
  scoreAreaCandidate,
  scoreNativeCandidate,
  scorePersonalCluster,
} from '@/utils/photo-place-scoring';
import { buildPhotoPlaceResolutionDecision } from '@/utils/photo-place-decision';

const INFERRED_TYPES: PlaceType[] = [
  'cafe',
  'restaurant',
  'bar',
  'bakery',
  'museum',
  'gallery',
  'library',
  'bookstore',
  'cinema',
  'theatre',
  'park',
  'playground',
  'beach',
  'nature',
  'gym',
  'sports',
  'shop',
  'supermarket',
  'hotel',
  'station',
  'airport',
  'residential',
];

export type PhotoPlaceResolveOptions = {
  force?: boolean;
  signal?: AbortSignal;
  nativeLookup?: (
    latitude: number,
    longitude: number,
    radiusMeters: number
  ) => Promise<NativePlaceLookupResult>;
};

export async function resolvePhotoPlace(
  input: PhotoPlaceInput,
  options: PhotoPlaceResolveOptions = {}
): Promise<PhotoPlaceResolution> {
  const settings = await photoPlaceRepository.settings();
  if (!settings.enabled) return noLocationResult(input, 'unresolved');
  if (!input.coordinate) return noLocationResult(input, 'no_location');
  if (options.signal?.aborted) return noLocationResult(input, 'unresolved');

  if (!options.force) {
    const stored = await photoPlaceRepository.resolution(input.photoId);
    if (stored) return stored;
  }

  const searchRadiusMeters = calculateSearchRadius(input.horizontalAccuracyMeters);
  const cacheKey = buildPlaceCacheKey(
    input.coordinate.latitude,
    input.coordinate.longitude,
    searchRadiusMeters
  );
  const [clusters, history, cached] = await Promise.all([
    photoPlaceRepository.clusters(),
    photoPlaceRepository.history(),
    photoPlaceRepository.cachedLookup(cacheKey),
  ]);
  if (options.signal?.aborted) return noLocationResult(input, 'unresolved');

  let nativeResult = cached;
  if (!nativeResult) {
    const lookup =
      options.nativeLookup ??
      (KatchimeraMapSearch?.resolveNearbyPlacesAsync
        ? KatchimeraMapSearch.resolveNearbyPlacesAsync.bind(KatchimeraMapSearch)
        : null);
    if (lookup) {
      try {
        nativeResult = await lookup(
          input.coordinate.latitude,
          input.coordinate.longitude,
          searchRadiusMeters
        );
        if (!options.signal?.aborted) {
          const ttl =
            nativeResult.candidates.length > 0 ||
            (nativeResult.areaCandidates?.length ?? 0) > 0
              ? 7 * 24 * 60 * 60 * 1000
              : 3 * 60 * 1000;
          await photoPlaceRepository.cacheLookup(cacheKey, nativeResult, ttl);
        }
      } catch {
        nativeResult = null;
      }
    }
  }

  const areaCandidates = sanitizeAreaCandidates(nativeResult?.areaCandidates ?? []);
  const areaIdentities = new Set(areaCandidates.map(candidateIdentity));
  const nativeCandidates = sanitizeNativeCandidates(nativeResult?.candidates ?? []).filter(
    (candidate) => !areaIdentities.has(candidateIdentity(candidate))
  );
  const scored = [
    ...clusters.map((cluster) =>
      scorePersonalCluster(
        input,
        cluster,
        distanceMeters(input.coordinate!, cluster.center)
      )
    ),
    ...areaCandidates.flatMap((candidate) => {
      const scoredArea = scoreAreaCandidate(input, candidate, history);
      return scoredArea ? [scoredArea] : [];
    }),
    ...nativeCandidates.map((candidate) => scoreNativeCandidate(input, candidate, history)),
  ].sort(compareCandidates);

  if (scored.length === 0) {
    const inferred = buildInferredCategoryCandidate(input);
    if (inferred) scored.push(inferred);
  }

  const result = buildPhotoPlaceResolutionDecision({
    input,
    scored,
    nativeResult,
    searchRadiusMeters,
    usedPersonalHistory: history.length > 0 || clusters.length > 0,
  });
  if (!options.signal?.aborted) await photoPlaceRepository.saveResolution(result);
  return result;
}

export async function confirmPhotoPlaceCandidate(
  resolution: PhotoPlaceResolution,
  candidate: ScoredPlaceCandidate
): Promise<PhotoPlaceResolution> {
  const confirmedCandidate: ScoredPlaceCandidate = {
    ...candidate,
    confidenceScore: Math.max(0.9, candidate.confidenceScore),
    userConfirmed: true,
  };
  const confirmed: PhotoPlaceResolution = {
    ...resolution,
    status: 'resolved',
    selectedCandidate: confirmedCandidate,
    alternatives: resolution.alternatives.filter((item) => item.id !== candidate.id).slice(0, 3),
    confidenceScore: confirmedCandidate.confidenceScore,
    confidenceLevel: 'high',
    resolutionMetadata: {
      ...resolution.resolutionMetadata,
      resolvedAt: new Date().toISOString(),
    },
  };
  await photoPlaceRepository.saveResolution(confirmed);
  await photoPlaceRepository.recordSelection(confirmed);
  return confirmed;
}

export async function rememberPersonalPlaceForPhoto(
  resolution: PhotoPlaceResolution,
  placeType: 'home' | 'work',
  label: string = placeType === 'home' ? 'Home' : 'Work'
): Promise<PhotoPlaceResolution> {
  const coordinate = resolution.coordinate;
  if (!coordinate) return resolution;
  const now = new Date().toISOString();
  const cluster: UserPlaceCluster = {
    id: `personal-${placeType}-${Date.now().toString(36)}`,
    label,
    placeType,
    center: coordinate,
    radiusMeters: placeType === 'home' ? 35 : 50,
    userConfirmed: true,
    visitCount: 1,
    createdAt: now,
    updatedAt: now,
  };
  await photoPlaceRepository.saveCluster(cluster);
  const evidence: CandidateEvidence = {
    proximityScore: 1,
    accuracyScore: 1,
    categoryVisualScore: 0,
    ocrNameScore: 0,
    personalHistoryScore: 1,
    dwellScore: 0,
    apiRankScore: 0,
  };
  return confirmPhotoPlaceCandidate(resolution, {
    id: `personal:${cluster.id}`,
    name: label,
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    distanceMeters: 0,
    normalizedCategory: placeType,
    rank: 0,
    confidenceScore: 0.95,
    evidence,
    source: 'personal_cluster',
    userConfirmed: true,
  });
}

export async function dismissPhotoPlaceResolution(
  resolution: PhotoPlaceResolution
): Promise<PhotoPlaceResolution> {
  const dismissed: PhotoPlaceResolution = {
    ...resolution,
    status: 'unresolved',
    selectedCandidate: undefined,
    alternatives: [],
    confidenceScore: 0,
    confidenceLevel: 'low',
    resolutionMetadata: {
      ...resolution.resolutionMetadata,
      resolvedAt: new Date().toISOString(),
    },
  };
  await photoPlaceRepository.saveResolution(dismissed);
  return dismissed;
}

export function buildInferredCategoryCandidate(input: PhotoPlaceInput): ScoredPlaceCandidate | null {
  const ranked = INFERRED_TYPES.map((placeType) => ({
    placeType,
    score: calculateVisualCategoryScore(input, placeType),
  })).sort((left, right) => right.score - left.score);
  const best = ranked[0];
  if (!best || best.score < 0.65 || !input.coordinate) return null;
  return {
    id: `inferred:${best.placeType}`,
    name: broadPlaceLabel(best.placeType),
    latitude: input.coordinate.latitude,
    longitude: input.coordinate.longitude,
    distanceMeters: 0,
    normalizedCategory: best.placeType,
    rank: 0,
    confidenceScore: Math.min(0.75, Number((0.52 + best.score * 0.25).toFixed(3))),
    source: 'inferred_category',
    evidence: {
      proximityScore: 0,
      accuracyScore: 0,
      categoryVisualScore: best.score,
      ocrNameScore: 0,
      personalHistoryScore: 0,
      dwellScore: 0,
      apiRankScore: 0,
    },
  };
}

function sanitizeNativeCandidates(candidates: NativePlaceCandidate[]): NativePlaceCandidate[] {
  const seen = new Set<string>();
  return candidates.flatMap((candidate) => {
    if (
      !candidate.name?.trim() ||
      !Number.isFinite(candidate.latitude) ||
      !Number.isFinite(candidate.longitude) ||
      !Number.isFinite(candidate.distanceMeters)
    ) {
      return [];
    }
    const key =
      candidate.applePlaceId ??
      `${candidate.name.toLocaleLowerCase()}|${candidate.latitude.toFixed(4)}|${candidate.longitude.toFixed(4)}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ ...candidate, normalizedCategory: candidate.normalizedCategory ?? 'unknown' }];
  }).slice(0, 25);
}

function sanitizeAreaCandidates(candidates: NativeAreaCandidate[]): NativeAreaCandidate[] {
  return sanitizeNativeCandidates(candidates).flatMap((candidate) => {
    const area = candidate as NativeAreaCandidate;
    if (
      !area.areaName?.trim() ||
      !Number.isFinite(area.nameMatchScore) ||
      area.associatedWithCoordinate !== true
    ) {
      return [];
    }
    return [area];
  }).slice(0, 3);
}

function candidateIdentity(candidate: NativePlaceCandidate): string {
  return candidate.applePlaceId ??
    `${candidate.name.toLocaleLowerCase()}|${candidate.latitude.toFixed(4)}|${candidate.longitude.toFixed(4)}`;
}

function compareCandidates(left: ScoredPlaceCandidate, right: ScoredPlaceCandidate): number {
  if (left.source === 'personal_cluster' && left.userConfirmed && right.source !== 'personal_cluster') return -1;
  if (right.source === 'personal_cluster' && right.userConfirmed && left.source !== 'personal_cluster') return 1;
  return right.confidenceScore - left.confidenceScore || left.distanceMeters - right.distanceMeters;
}

function noLocationResult(
  input: PhotoPlaceInput,
  status: 'unresolved' | 'no_location'
): PhotoPlaceResolution {
  return {
    photoId: input.photoId,
    coordinate: input.coordinate,
    status,
    alternatives: [],
    confidenceScore: 0,
    confidenceLevel: 'low',
    scoreModel: 'heuristic_v1',
    resolutionMetadata: {
      nearbyCandidateCount: 0,
      usedOcr: (input.ocrText?.length ?? 0) > 0,
      usedVisualTags: (input.visualTags?.length ?? 0) > 0,
      usedPersonalHistory: false,
      searchRadiusMeters: 0,
      resolvedAt: new Date().toISOString(),
    },
  };
}

function broadPlaceLabel(placeType: PlaceType): string {
  return placeType.replaceAll('_', ' ').replace(/^\w/, (letter) => letter.toUpperCase());
}
