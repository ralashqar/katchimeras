import type {
  CandidateEvidence,
  ConfidenceLevel,
  NativeAreaCandidate,
  NativePlaceCandidate,
  PhotoPlaceInput,
  PlaceType,
  PreviousPlaceSelection,
  ScoredPlaceCandidate,
  UserPlaceCluster,
} from '@/types/photo-place';

const NON_PUBLIC_AREA_TYPES = new Set<PlaceType>([
  'home',
  'work',
  'residential',
  'office',
  'unknown',
]);

export const PLACE_SCORE_WEIGHTS = {
  proximity: 0.3,
  gpsAccuracy: 0.1,
  visualCategory: 0.2,
  ocrName: 0.2,
  personalHistory: 0.12,
  dwell: 0.05,
  apiRank: 0.03,
} as const;

export const VENUE_RADIUS_PRIORS: Partial<Record<PlaceType, number>> = {
  cafe: 12,
  restaurant: 15,
  bar: 15,
  bakery: 12,
  shop: 15,
  supermarket: 30,
  museum: 60,
  gallery: 30,
  park: 100,
  playground: 50,
  shopping_centre: 100,
  airport: 200,
  station: 80,
  hotel: 40,
  university: 100,
  hospital: 80,
};

const VISUAL_PLACE_ASSOCIATIONS: Record<string, Partial<Record<PlaceType, number>>> = {
  'coffee cup': { cafe: 1, restaurant: 0.4, home: 0.25 },
  coffee: { cafe: 0.9, restaurant: 0.35, home: 0.2 },
  espresso: { cafe: 1, restaurant: 0.3 },
  menu: { restaurant: 0.9, cafe: 0.8, bar: 0.5 },
  food: { restaurant: 0.75, cafe: 0.45, home: 0.3 },
  painting: { museum: 0.8, gallery: 1, home: 0.2 },
  sculpture: { museum: 0.85, gallery: 0.9, tourist_attraction: 0.4 },
  'gallery wall': { museum: 0.9, gallery: 1 },
  'gym equipment': { gym: 1, sports: 0.7 },
  bookshelf: { library: 0.8, bookstore: 0.8, home: 0.4 },
  books: { library: 0.75, bookstore: 0.75, home: 0.3 },
  bed: { home: 0.8, residential: 0.7, hotel: 0.8 },
  kitchen: { home: 0.8, residential: 0.6, restaurant: 0.35 },
  sofa: { home: 0.75, residential: 0.65, hotel: 0.25 },
  playground: { playground: 1, park: 0.8 },
  grass: { park: 0.7, nature: 0.65, sports: 0.25 },
  trees: { nature: 0.8, park: 0.65 },
  beach: { beach: 1, nature: 0.5 },
  sand: { beach: 0.85, playground: 0.2 },
  train: { station: 0.8, transport: 0.8 },
  airplane: { airport: 0.9, transport: 0.7 },
};

const DIRECT_PLACE_TYPES = new Set<PlaceType>([
  'home',
  'work',
  'residential',
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
  'shopping_centre',
  'hotel',
  'school',
  'university',
  'hospital',
  'pharmacy',
  'office',
  'transport',
  'airport',
  'station',
  'religious',
  'tourist_attraction',
  'unknown',
]);

// Only semantic differences between Apple's open raw-value namespace and the
// Katchimeras taxonomy belong here. Identically named categories (including
// future values such as "playground") pass through automatically.
const APPLE_CATEGORY_ALIASES: Record<string, PlaceType> = {
  movie_theater: 'cinema',
  theater: 'theatre',
  fitness_center: 'gym',
  food_market: 'supermarket',
  shopping_center: 'shopping_centre',
  public_transport: 'transport',
  airport_terminal: 'airport',
  national_park: 'park',
  amusement_park: 'park',
  rv_park: 'park',
  skate_park: 'sports',
  music_venue: 'theatre',
  nightlife: 'bar',
  brewery: 'bar',
  winery: 'bar',
  distillery: 'bar',
  store: 'shop',
  landmark: 'tourist_attraction',
  national_monument: 'tourist_attraction',
  castle: 'tourist_attraction',
  fortress: 'tourist_attraction',
  aquarium: 'tourist_attraction',
  zoo: 'tourist_attraction',
  campground: 'nature',
  hiking: 'nature',
  marina: 'nature',
  picnic_area: 'nature',
  scenic_view: 'nature',
  baseball: 'sports',
  basketball: 'sports',
  bowling: 'sports',
  fishing: 'sports',
  go_kart: 'sports',
  golf: 'sports',
  kayaking: 'sports',
  mini_golf: 'sports',
  rock_climbing: 'sports',
  skating: 'sports',
  skiing: 'sports',
  soccer: 'sports',
  stadium: 'sports',
  surfing: 'sports',
  swimming: 'sports',
  tennis: 'sports',
  volleyball: 'sports',
};

export function calculateSearchRadius(horizontalAccuracyMeters?: number): number {
  const accuracy = horizontalAccuracyMeters ?? 30;
  return Math.min(200, Math.max(40, accuracy * 2));
}

export function calculateAccuracyScore(horizontalAccuracyMeters?: number): number {
  if (horizontalAccuracyMeters == null) return 0.4;
  if (horizontalAccuracyMeters <= 10) return 1;
  if (horizontalAccuracyMeters <= 25) return 0.8;
  if (horizontalAccuracyMeters <= 50) return 0.55;
  if (horizontalAccuracyMeters <= 100) return 0.3;
  return 0.1;
}

export function calculateProximityScore(params: {
  distanceMeters: number;
  horizontalAccuracyMeters?: number;
  placeType: PlaceType;
}): number {
  const accuracy = Math.max(params.horizontalAccuracyMeters ?? 30, 5);
  const venueRadius = VENUE_RADIUS_PRIORS[params.placeType] ?? 15;
  return Math.exp(-Math.max(0, params.distanceMeters) / (accuracy + venueRadius));
}

export function calculateCandidateScore(evidence: CandidateEvidence): number {
  return clamp(
    evidence.proximityScore * PLACE_SCORE_WEIGHTS.proximity +
      evidence.accuracyScore * PLACE_SCORE_WEIGHTS.gpsAccuracy +
      evidence.categoryVisualScore * PLACE_SCORE_WEIGHTS.visualCategory +
      evidence.ocrNameScore * PLACE_SCORE_WEIGHTS.ocrName +
      evidence.personalHistoryScore * PLACE_SCORE_WEIGHTS.personalHistory +
      evidence.dwellScore * PLACE_SCORE_WEIGHTS.dwell +
      evidence.apiRankScore * PLACE_SCORE_WEIGHTS.apiRank,
    0,
    1
  );
}

export function calculateAvailableEvidenceScore(
  evidence: CandidateEvidence,
  input: Pick<PhotoPlaceInput, 'ocrText' | 'visualTags'>,
  hasHistoryContext: boolean
): number {
  const hasVisualEvidence = (input.visualTags?.length ?? 0) > 0;
  const hasOcrEvidence = (input.ocrText?.some((line) => line.trim().length > 0) ?? false);
  const availableWeight =
    PLACE_SCORE_WEIGHTS.proximity +
    PLACE_SCORE_WEIGHTS.gpsAccuracy +
    PLACE_SCORE_WEIGHTS.apiRank +
    (hasVisualEvidence ? PLACE_SCORE_WEIGHTS.visualCategory : 0) +
    (hasOcrEvidence ? PLACE_SCORE_WEIGHTS.ocrName : 0) +
    (hasHistoryContext ? PLACE_SCORE_WEIGHTS.personalHistory : 0);
  const availableWeightedScore =
    evidence.proximityScore * PLACE_SCORE_WEIGHTS.proximity +
    evidence.accuracyScore * PLACE_SCORE_WEIGHTS.gpsAccuracy +
    evidence.apiRankScore * PLACE_SCORE_WEIGHTS.apiRank +
    (hasVisualEvidence
      ? evidence.categoryVisualScore * PLACE_SCORE_WEIGHTS.visualCategory
      : 0) +
    (hasOcrEvidence ? evidence.ocrNameScore * PLACE_SCORE_WEIGHTS.ocrName : 0) +
    (hasHistoryContext
      ? evidence.personalHistoryScore * PLACE_SCORE_WEIGHTS.personalHistory
      : 0);
  const fitGivenAvailableEvidence = availableWeightedScore / Math.max(availableWeight, 0.001);
  // More independent channels justify treating a strong fit as more reliable.
  // GPS-only evidence can rank and suggest a type, but cannot silently resolve
  // a named venue regardless of how close its POI centre is.
  const reliability = 0.62 + 0.38 * Math.sqrt(availableWeight);
  let score = fitGivenAvailableEvidence * reliability;
  if (!hasVisualEvidence && !hasOcrEvidence && !hasHistoryContext) {
    score = Math.min(score, 0.74);
  }
  return clamp(score, 0, 1);
}

export function scoreNativeCandidate(
  input: PhotoPlaceInput,
  candidate: NativePlaceCandidate,
  history: PreviousPlaceSelection[] = []
): ScoredPlaceCandidate {
  const normalizedCategory = inferCandidatePlaceType(candidate);
  const evidence: CandidateEvidence = {
    proximityScore: calculateProximityScore({
      distanceMeters: candidate.distanceMeters,
      horizontalAccuracyMeters: input.horizontalAccuracyMeters,
      placeType: normalizedCategory,
    }),
    accuracyScore: calculateAccuracyScore(input.horizontalAccuracyMeters),
    categoryVisualScore: calculateVisualCategoryScore(input, normalizedCategory),
    ocrNameScore: calculateOcrNameScore(input.ocrText ?? [], candidate.name, candidate.address),
    personalHistoryScore: historyScore(candidate, history),
    dwellScore: 0,
    apiRankScore: 1 / Math.max(1, candidate.rank + 1),
  };
  let confidenceScore = calculateAvailableEvidenceScore(evidence, input, history.length > 0);
  const allowedDistance =
    (input.horizontalAccuracyMeters ?? 30) +
    (VENUE_RADIUS_PRIORS[normalizedCategory] ?? 15);
  if (
    candidate.distanceMeters > allowedDistance &&
    evidence.ocrNameScore < 0.75 &&
    evidence.categoryVisualScore < 0.75
  ) {
    confidenceScore = Math.min(confidenceScore, 0.74);
  }
  if ((input.horizontalAccuracyMeters ?? 30) > 100 && evidence.ocrNameScore < 0.85) {
    confidenceScore = Math.min(confidenceScore, 0.74);
  }
  return {
    ...candidate,
    normalizedCategory,
    confidenceScore: round3(confidenceScore),
    evidence,
    source: 'apple_maps_poi',
  };
}

export function scoreAreaCandidate(
  input: PhotoPlaceInput,
  candidate: NativeAreaCandidate,
  history: PreviousPlaceSelection[] = []
): ScoredPlaceCandidate | null {
  const normalizedCategory = inferCandidatePlaceType(candidate);
  if (NON_PUBLIC_AREA_TYPES.has(normalizedCategory)) return null;

  const categoryVisualScore = calculateVisualCategoryScore(input, normalizedCategory);
  const accuracyScore = calculateAccuracyScore(input.horizontalAccuracyMeters);
  const groundedAppleCategory =
    candidate.normalizedCategory !== 'unknown' ||
    placeTypeFromAppleRawCategory(candidate.rawCategory) !== 'unknown';
  const nameMatchScore = clamp(candidate.nameMatchScore, 0, 1);
  const exactGroundedArea = groundedAppleCategory && nameMatchScore >= 0.95;
  const areaContextScore = exactGroundedArea
    ? clamp(
        0.72 +
          nameMatchScore * 0.18 +
          accuracyScore * 0.05 +
          categoryVisualScore * 0.05,
        0,
        0.95
      )
    : clamp(
        0.52 +
          nameMatchScore * 0.12 +
          accuracyScore * 0.04 +
          categoryVisualScore * 0.06,
        0,
        0.74
      );
  const evidence: CandidateEvidence = {
    // The reverse geocoder associated the area with the original coordinate.
    // This is contextual association, so the area's label-pin distance must
    // not count against it as though it were a small venue.
    proximityScore: 1,
    accuracyScore,
    categoryVisualScore,
    ocrNameScore: calculateOcrNameScore(
      input.ocrText ?? [],
      candidate.name,
      candidate.address
    ),
    personalHistoryScore: historyScore(candidate, history),
    dwellScore: 0,
    apiRankScore: 1 / Math.max(1, candidate.rank + 1),
    areaContextScore: nameMatchScore,
  };
  return {
    ...candidate,
    normalizedCategory,
    confidenceScore: round3(areaContextScore),
    evidence,
    source: 'apple_area_of_interest',
    areaName: candidate.areaName,
  };
}

export function inferCandidatePlaceType(
  candidate: Pick<NativePlaceCandidate, 'name' | 'rawCategory' | 'normalizedCategory'>
): PlaceType {
  if (candidate.normalizedCategory !== 'unknown') return candidate.normalizedCategory;
  const rawType = placeTypeFromAppleRawCategory(candidate.rawCategory);
  if (rawType !== 'unknown') return rawType;

  const name = normalizeText(candidate.name);
  const has = (value: string) => new RegExp(`(^|\\s)${value}(\\s|$)`).test(name);
  if (has('playground') || has('play area')) return 'playground';
  if (has('cafe') || has('coffee') || has('coffeehouse')) return 'cafe';
  if (has('restaurant') || has('kitchen') || has('diner')) return 'restaurant';
  if (has('hotel') || has('inn') || has('hostel')) return 'hotel';
  if (has('bakery') || has('bakehouse')) return 'bakery';
  if (has('museum')) return 'museum';
  if (has('gallery')) return 'gallery';
  if (has('library')) return 'library';
  if (has('bookstore') || has('bookshop')) return 'bookstore';
  if (has('cinema') || has('movie theater')) return 'cinema';
  if (has('theatre') || has('theater')) return 'theatre';
  if (has('gym') || has('fitness centre') || has('fitness center')) return 'gym';
  if (has('beach')) return 'beach';
  if (has('park') || has('gardens') || has('garden')) return 'park';
  return 'unknown';
}

export function placeTypeFromAppleRawCategory(rawCategory?: string): PlaceType {
  if (!rawCategory) return 'unknown';
  const withoutPrefix = rawCategory.replace(
    /^(MKPointOfInterestCategory|MKPOICategory)/i,
    ''
  );
  const token = withoutPrefix
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  if (!token) return 'unknown';
  const alias = APPLE_CATEGORY_ALIASES[token];
  if (alias) return alias;
  return DIRECT_PLACE_TYPES.has(token as PlaceType) ? token as PlaceType : 'unknown';
}

export function scorePersonalCluster(
  input: PhotoPlaceInput,
  cluster: UserPlaceCluster,
  distanceMeters: number
): ScoredPlaceCandidate {
  const visual = calculateVisualCategoryScore(input, cluster.placeType);
  const evidence: CandidateEvidence = {
    proximityScore: calculateProximityScore({
      distanceMeters,
      horizontalAccuracyMeters: input.horizontalAccuracyMeters,
      placeType: cluster.placeType,
    }),
    accuracyScore: calculateAccuracyScore(input.horizontalAccuracyMeters),
    categoryVisualScore: visual,
    ocrNameScore: 0,
    personalHistoryScore: calculateHistoryScore({
      visitCount: cluster.visitCount,
      userConfirmed: cluster.userConfirmed,
    }),
    dwellScore: 0,
    apiRankScore: 0,
  };
  const inside = distanceMeters <= cluster.radiusMeters + (input.horizontalAccuracyMeters ?? 30);
  let confidenceScore = calculateCandidateScore(evidence);
  if (cluster.userConfirmed && inside) {
    confidenceScore = Math.max(confidenceScore, 0.75 + Math.min(0.15, evidence.proximityScore * 0.15));
  }
  if (visual > 0 && visual < 0.25) confidenceScore = Math.min(confidenceScore, 0.74);
  return {
    id: `personal:${cluster.id}`,
    name: cluster.label,
    latitude: cluster.center.latitude,
    longitude: cluster.center.longitude,
    distanceMeters,
    normalizedCategory: cluster.placeType,
    rank: 0,
    confidenceScore: round3(confidenceScore),
    evidence,
    source: 'personal_cluster',
    userConfirmed: cluster.userConfirmed,
  };
}

export function calculateHistoryScore(params: {
  visitCount: number;
  userConfirmed: boolean;
  lastSelectedDaysAgo?: number;
}): number {
  const confirmationBoost = params.userConfirmed ? 0.5 : 0;
  const visitBoost = Math.min(0.4, Math.log10(params.visitCount + 1) / 3);
  const recencyBoost =
    params.lastSelectedDaysAgo != null && params.lastSelectedDaysAgo <= 30 ? 0.1 : 0;
  return clamp(confirmationBoost + visitBoost + recencyBoost, 0, 1);
}

export function confidenceLevel(score: number): ConfidenceLevel {
  return score >= 0.8 ? 'high' : score >= 0.52 ? 'medium' : 'low';
}

export function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function calculateOcrNameScore(lines: string[], name: string, address?: string): number {
  const ocr = normalizeText(lines.join(' '));
  if (!ocr) return 0;
  const candidates = [name, address ?? ''].map(normalizeText).filter(Boolean);
  return candidates.reduce((best, candidate) => Math.max(best, tokenDiceSimilarity(ocr, candidate)), 0);
}

export function calculateVisualCategoryScore(input: PhotoPlaceInput, placeType: PlaceType): number {
  return (input.visualTags ?? []).reduce((best, tag) => {
    const normalized = normalizeText(tag.label);
    let association = VISUAL_PLACE_ASSOCIATIONS[normalized]?.[placeType] ?? 0;
    if (association === 0) {
      for (const [key, values] of Object.entries(VISUAL_PLACE_ASSOCIATIONS)) {
        if (normalized.includes(key) || key.includes(normalized)) {
          association = Math.max(association, values[placeType] ?? 0);
        }
      }
    }
    return Math.max(best, clamp(tag.confidence, 0, 1) * association);
  }, 0);
}

function tokenDiceSimilarity(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left.includes(right) || right.includes(left)) return 1;
  const compactLeft = left.replaceAll(' ', '');
  const compactRight = right.replaceAll(' ', '');
  const rightTokensRaw = right.split(' ').filter((token) => token.length > 1);
  const leftTokensRaw = left.split(' ').filter((token) => token.length > 1);
  if (
    compactLeft.includes(compactRight) ||
    compactRight.includes(compactLeft) ||
    rightTokensRaw.some((token) => token === compactLeft) ||
    leftTokensRaw.some((token) => token === compactRight)
  ) {
    return 0.95;
  }
  const leftTokens = new Set(leftTokensRaw);
  const rightTokens = new Set(rightTokensRaw);
  let overlap = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) overlap += 1;
  });
  return clamp((2 * overlap) / Math.max(1, leftTokens.size + rightTokens.size), 0, 1);
}

function historyScore(candidate: NativePlaceCandidate, history: PreviousPlaceSelection[]): number {
  const fallback = fallbackPlaceKey(candidate.name, candidate.latitude, candidate.longitude);
  const match = history.find(
    (item) =>
      (candidate.applePlaceId && item.applePlaceId === candidate.applePlaceId) ||
      item.fallbackKey === fallback
  );
  if (!match) return 0;
  const daysAgo = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(match.lastSelectedAt)) / 86_400_000)
  );
  return calculateHistoryScore({
    visitCount: match.selectionCount,
    userConfirmed: true,
    lastSelectedDaysAgo: Number.isFinite(daysAgo) ? daysAgo : undefined,
  });
}

export function fallbackPlaceKey(name: string, latitude: number, longitude: number): string {
  return `${normalizeText(name)}|${latitude.toFixed(4)}|${longitude.toFixed(4)}`;
}

export function distanceMeters(
  left: { latitude: number; longitude: number },
  right: { latitude: number; longitude: number }
): number {
  const earthRadius = 6_371_000;
  const dLat = ((right.latitude - left.latitude) * Math.PI) / 180;
  const dLng = ((right.longitude - left.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((left.latitude * Math.PI) / 180) *
      Math.cos((right.latitude * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round3(value: number): number {
  return Number(value.toFixed(3));
}
