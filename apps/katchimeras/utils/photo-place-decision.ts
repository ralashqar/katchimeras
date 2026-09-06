import type {
  NativePlaceLookupResult,
  PhotoPlaceInput,
  PhotoPlaceResolution,
  ScoredPlaceCandidate,
} from '@/types/photo-place';
import { confidenceLevel } from '@/utils/photo-place-scoring';

export function buildPhotoPlaceResolutionDecision(params: {
  input: PhotoPlaceInput;
  scored: ScoredPlaceCandidate[];
  nativeResult: NativePlaceLookupResult | null;
  searchRadiusMeters: number;
  usedPersonalHistory: boolean;
}): PhotoPlaceResolution {
  const topCandidate = params.scored[0];
  const bestKnownType = params.scored.find(
    (candidate) => candidate.normalizedCategory !== 'unknown'
  );
  // An unmapped Apple category can be the closest POI, but it contains no
  // usable broad-type information. Let a nearly tied known category drive the
  // type decision while retaining the unknown POI as an alternative.
  const best =
    topCandidate?.normalizedCategory === 'unknown' &&
    bestKnownType &&
    topCandidate.confidenceScore - bestKnownType.confidenceScore <= 0.08
      ? bestKnownType
      : topCandidate;
  const second = params.scored.find((candidate) => candidate.id !== best?.id);
  const score = best?.confidenceScore ?? 0;
  const margin = score - (second?.confidenceScore ?? 0);
  const personalAuto =
    best?.source === 'personal_cluster' &&
    best.userConfirmed === true &&
    score >= 0.75;
  const auto = score >= 0.8 && margin >= 0.12;
  const nextDifferentType = params.scored.find(
    (candidate) =>
      candidate.normalizedCategory !== 'unknown' &&
      candidate.normalizedCategory !== best?.normalizedCategory
  );
  const typeMargin = score - (nextDifferentType?.confidenceScore ?? 0);
  const geographicCategoryOnly =
    best?.source === 'apple_maps_poi' &&
    best.normalizedCategory !== 'unknown' &&
    score >= 0.68 &&
    typeMargin >= 0.04 &&
    best.evidence.proximityScore >= 0.75 &&
    best.evidence.accuracyScore >= 0.8;
  const appleAreaCategoryOnly =
    best?.source === 'apple_area_of_interest' &&
    best.normalizedCategory !== 'unknown' &&
    score >= 0.8 &&
    typeMargin >= 0.04 &&
    (best.evidence.areaContextScore ?? 0) >= 0.8;
  const status = personalAuto || auto
    ? best.source === 'inferred_category' || best.source === 'apple_area_of_interest'
      ? 'category_only'
      : 'resolved'
    : geographicCategoryOnly || appleAreaCategoryOnly
      ? 'category_only'
      : score >= 0.52
        ? best?.source === 'inferred_category'
          ? 'category_only'
          : 'needs_confirmation'
        : 'unresolved';
  const alternatives = params.scored
    .filter((candidate) => candidate.id !== best?.id)
    .slice(0, 3);
  return {
    photoId: params.input.photoId,
    coordinate: params.input.coordinate,
    status,
    selectedCandidate:
      status === 'resolved' || status === 'category_only' ? best : undefined,
    alternatives:
      status === 'resolved' || status === 'category_only'
        ? alternatives
        : params.scored.slice(0, 3),
    confidenceScore: score,
    confidenceLevel: confidenceLevel(score),
    scoreModel: 'heuristic_v1',
    address: params.nativeResult?.address,
    resolutionMetadata: {
      nearbyCandidateCount: params.nativeResult?.lookupMetadata.candidateCount ?? 0,
      usedOcr: (params.input.ocrText?.length ?? 0) > 0,
      usedVisualTags: (params.input.visualTags?.length ?? 0) > 0,
      usedPersonalHistory: params.usedPersonalHistory,
      searchRadiusMeters: params.searchRadiusMeters,
      resolvedAt: new Date().toISOString(),
    },
  };
}
