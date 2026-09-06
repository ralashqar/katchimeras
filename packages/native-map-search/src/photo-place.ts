export type PlaceType =
  | 'home'
  | 'work'
  | 'residential'
  | 'cafe'
  | 'restaurant'
  | 'bar'
  | 'bakery'
  | 'museum'
  | 'gallery'
  | 'library'
  | 'bookstore'
  | 'cinema'
  | 'theatre'
  | 'park'
  | 'playground'
  | 'beach'
  | 'nature'
  | 'gym'
  | 'sports'
  | 'shop'
  | 'supermarket'
  | 'shopping_centre'
  | 'hotel'
  | 'school'
  | 'university'
  | 'hospital'
  | 'pharmacy'
  | 'office'
  | 'transport'
  | 'airport'
  | 'station'
  | 'religious'
  | 'tourist_attraction'
  | 'unknown';

export type PhotoPlaceCoordinate = {
  latitude: number;
  longitude: number;
};

export type PhotoPlaceVisualTag = {
  label: string;
  confidence: number;
};

export type PhotoPlaceInput = {
  photoId: string;
  coordinate?: PhotoPlaceCoordinate;
  horizontalAccuracyMeters?: number;
  capturedAt?: string;
  ocrText?: string[];
  visualTags?: PhotoPlaceVisualTag[];
  imageSource: 'camera' | 'photo_library';
};

export type UserPlaceCluster = {
  id: string;
  label: string;
  placeType: PlaceType;
  center: PhotoPlaceCoordinate;
  radiusMeters: number;
  userConfirmed: boolean;
  visitCount: number;
  createdAt: string;
  updatedAt: string;
};

export type NativePlaceAddress = {
  formattedAddress?: string;
  street?: string;
  city?: string;
  administrativeArea?: string;
  postalCode?: string;
  countryCode?: string;
  areasOfInterest?: string[];
};

export type NativePlaceCandidate = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  rawCategory?: string;
  normalizedCategory: PlaceType;
  applePlaceId?: string;
  alternateApplePlaceIds?: string[];
  address?: string;
  phoneNumber?: string;
  websiteUrl?: string;
  rank: number;
};

export type NativeAreaCandidate = NativePlaceCandidate & {
  areaName: string;
  nameMatchScore: number;
  associatedWithCoordinate: true;
};

export type NativePlaceLookupResult = {
  candidates: NativePlaceCandidate[];
  areaCandidates?: NativeAreaCandidate[];
  address?: NativePlaceAddress;
  lookupMetadata: {
    searchRadiusMeters: number;
    candidateCount: number;
    areaOfInterestCount?: number;
    areaCandidateCount?: number;
  };
  errors?: PlaceResolverErrorCode[];
};

export type CandidateEvidence = {
  proximityScore: number;
  accuracyScore: number;
  categoryVisualScore: number;
  ocrNameScore: number;
  personalHistoryScore: number;
  dwellScore: number;
  apiRankScore: number;
  areaContextScore?: number;
};

export type ScoredPlaceCandidate = NativePlaceCandidate & {
  confidenceScore: number;
  evidence: CandidateEvidence;
  source:
    | 'apple_maps_poi'
    | 'apple_area_of_interest'
    | 'personal_cluster'
    | 'inferred_category';
  areaName?: string;
  userConfirmed?: boolean;
};

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type PhotoPlaceResolution = {
  photoId: string;
  // Local-only input coordinate, retained so a user can confirm Home/Work.
  // It must never be included in analytics or share payloads.
  coordinate?: PhotoPlaceCoordinate;
  status: 'resolved' | 'category_only' | 'needs_confirmation' | 'unresolved' | 'no_location';
  selectedCandidate?: ScoredPlaceCandidate;
  alternatives: ScoredPlaceCandidate[];
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  scoreModel: 'heuristic_v1';
  address?: Pick<NativePlaceAddress, 'formattedAddress' | 'city' | 'countryCode'>;
  resolutionMetadata: {
    nearbyCandidateCount: number;
    usedOcr: boolean;
    usedVisualTags: boolean;
    usedPersonalHistory: boolean;
    searchRadiusMeters: number;
    resolvedAt: string;
  };
};

export type PlaceResolverErrorCode =
  | 'PERMISSION_DENIED'
  | 'INVALID_COORDINATE'
  | 'MAP_LOOKUP_FAILED'
  | 'GEOCODING_FAILED'
  | 'NETWORK_UNAVAILABLE'
  | 'CANCELLED'
  | 'UNKNOWN';

export type PreviousPlaceSelection = {
  applePlaceId?: string;
  fallbackKey?: string;
  placeType: PlaceType;
  selectionCount: number;
  lastSelectedAt: string;
};
