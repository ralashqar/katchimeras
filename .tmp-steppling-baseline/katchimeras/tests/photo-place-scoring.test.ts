import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  NativeAreaCandidate,
  NativePlaceCandidate,
  PhotoPlaceInput,
  UserPlaceCluster,
} from '../types/photo-place';
import { buildPhotoPlaceResolutionDecision } from '../utils/photo-place-decision';
import {
  calculateAccuracyScore,
  calculateOcrNameScore,
  calculateSearchRadius,
  inferCandidatePlaceType,
  placeTypeFromAppleRawCategory,
  scoreAreaCandidate,
  scoreNativeCandidate,
  scorePersonalCluster,
} from '../utils/photo-place-scoring';

const input = (patch: Partial<PhotoPlaceInput> = {}): PhotoPlaceInput => ({
  photoId: 'photo-1',
  coordinate: { latitude: 51.5046, longitude: -0.0194 },
  horizontalAccuracyMeters: 8,
  imageSource: 'photo_library',
  ...patch,
});

const candidate = (patch: Partial<NativePlaceCandidate> = {}): NativePlaceCandidate => ({
  id: 'watchhouse',
  name: 'WatchHouse Canary Wharf',
  latitude: 51.50462,
  longitude: -0.01939,
  distanceMeters: 6,
  normalizedCategory: 'cafe',
  rank: 0,
  ...patch,
});

test('search radius follows the 40 to 200 metre policy', () => {
  assert.equal(calculateSearchRadius(undefined), 60);
  assert.equal(calculateSearchRadius(5), 40);
  assert.equal(calculateSearchRadius(20), 40);
  assert.equal(calculateSearchRadius(40), 80);
  assert.equal(calculateSearchRadius(100), 200);
});

test('accuracy scoring preserves uncertainty for imported photos', () => {
  assert.equal(calculateAccuracyScore(undefined), 0.4);
  assert.equal(calculateAccuracyScore(8), 1);
  assert.equal(calculateAccuracyScore(180), 0.1);
});

test('unmapped Apple playground categories are recovered before scoring', () => {
  const scored = scoreNativeCandidate(
    input(),
    candidate({
      name: 'Greenwich Park Playground',
      rawCategory: 'MKPOICategoryPlayground',
      normalizedCategory: 'unknown',
      distanceMeters: 10,
    })
  );
  assert.equal(scored.normalizedCategory, 'playground');
});

test('Apple raw category names decode generically before semantic aliases are applied', () => {
  assert.equal(placeTypeFromAppleRawCategory('MKPOICategoryPlayground'), 'playground');
  assert.equal(placeTypeFromAppleRawCategory('MKPointOfInterestCategoryMuseum'), 'museum');
  assert.equal(placeTypeFromAppleRawCategory('MKPOICategoryMovieTheater'), 'cinema');
  assert.equal(placeTypeFromAppleRawCategory('MKPOICategoryPicnicArea'), 'nature');
  assert.equal(placeTypeFromAppleRawCategory('MKPOICategoryParking'), 'unknown');
});

test('conservative place-name fallback promotes useful types without confusing hotel names', () => {
  assert.equal(
    inferCandidatePlaceType({
      name: 'Greenwich Park Playground',
      normalizedCategory: 'unknown',
    }),
    'playground'
  );
  assert.equal(
    inferCandidatePlaceType({
      name: 'Park Plaza Hotel',
      normalizedCategory: 'unknown',
    }),
    'hotel'
  );
  assert.equal(
    inferCandidatePlaceType({
      name: 'Parking Garage',
      normalizedCategory: 'unknown',
    }),
    'unknown'
  );
});

test('clear cafe signage and visual evidence strongly resolve a nearby cafe', () => {
  const scored = scoreNativeCandidate(
    input({
      ocrText: ['WATCH HOUSE'],
      visualTags: [
        { label: 'coffee cup', confidence: 0.91 },
        { label: 'menu', confidence: 0.73 },
      ],
    }),
    candidate()
  );
  assert.ok(scored.confidenceScore >= 0.8);
  assert.ok(scored.evidence.ocrNameScore >= 0.9);
});

test('poor GPS prevents automatic venue resolution without strong corroboration', () => {
  const scored = scoreNativeCandidate(
    input({ horizontalAccuracyMeters: 180, ocrText: [], visualTags: [] }),
    candidate({ distanceMeters: 70 })
  );
  assert.ok(scored.confidenceScore < 0.8);
});

test('a resolved Apple area uses association rather than distance to its label pin', () => {
  const area: NativeAreaCandidate = {
    id: 'greenwich-park',
    areaName: 'Greenwich Park',
    name: 'Greenwich Park',
    latitude: 51.4769,
    longitude: 0.0005,
    distanceMeters: 780,
    rawCategory: 'MKPOICategoryPark',
    normalizedCategory: 'park',
    applePlaceId: 'apple-greenwich-park',
    rank: 0,
    nameMatchScore: 1,
    associatedWithCoordinate: true,
  };
  const scored = scoreAreaCandidate(input({ visualTags: [] }), area);
  assert.ok(scored);
  assert.equal(scored.source, 'apple_area_of_interest');
  assert.equal(scored.normalizedCategory, 'park');
  assert.equal(scored.evidence.proximityScore, 1);
  assert.ok(scored.confidenceScore >= 0.9);

  const decision = buildPhotoPlaceResolutionDecision({
    input: input({ visualTags: [] }),
    scored: [scored],
    nativeResult: {
      candidates: [],
      areaCandidates: [area],
      address: { areasOfInterest: ['Greenwich Park'] },
      lookupMetadata: {
        candidateCount: 0,
        areaOfInterestCount: 1,
        areaCandidateCount: 1,
        searchRadiusMeters: 40,
      },
    },
    searchRadiusMeters: 40,
    usedPersonalHistory: false,
  });
  assert.equal(decision.status, 'category_only');
  assert.equal(decision.selectedCandidate?.normalizedCategory, 'park');
});

test('an area resolved only by its name remains below the automatic assignment gate', () => {
  const area: NativeAreaCandidate = {
    id: 'name-only-park',
    areaName: 'Example Park',
    name: 'Example Park',
    latitude: 51.51,
    longitude: -0.1,
    distanceMeters: 600,
    normalizedCategory: 'unknown',
    rank: 0,
    nameMatchScore: 1,
    associatedWithCoordinate: true,
  };
  const scored = scoreAreaCandidate(input({ visualTags: [] }), area);
  assert.ok(scored);
  assert.equal(scored.normalizedCategory, 'park');
  assert.ok(scored.confidenceScore < 0.8);
});

test('a partial area-name match cannot auto-assign the wrong categorized map item', () => {
  const area: NativeAreaCandidate = {
    id: 'victoria-park-hotel',
    areaName: 'Victoria Park',
    name: 'Victoria Park Hotel',
    latitude: 51.51,
    longitude: -0.1,
    distanceMeters: 300,
    rawCategory: 'MKPOICategoryHotel',
    normalizedCategory: 'hotel',
    rank: 0,
    nameMatchScore: 0.9,
    associatedWithCoordinate: true,
  };
  const scored = scoreAreaCandidate(input({ visualTags: [] }), area);
  assert.ok(scored);
  assert.equal(scored.normalizedCategory, 'hotel');
  assert.ok(scored.confidenceScore < 0.8);
});

test('GPS-only scoring is normalized but cannot silently resolve a named venue', () => {
  const museum = scoreNativeCandidate(
    input({ ocrText: [], visualTags: [] }),
    candidate({
      id: 'museum',
      name: 'Museum of London Docklands',
      normalizedCategory: 'museum',
      distanceMeters: 0,
    })
  );
  assert.equal(museum.confidenceScore, 0.74);
  const decision = buildPhotoPlaceResolutionDecision({
    input: input({ ocrText: [], visualTags: [] }),
    scored: [museum],
    nativeResult: {
      candidates: [museum],
      lookupMetadata: { candidateCount: 1, searchRadiusMeters: 40 },
    },
    searchRadiusMeters: 40,
    usedPersonalHistory: false,
  });
  assert.equal(decision.status, 'category_only');
  assert.equal(decision.selectedCandidate?.normalizedCategory, 'museum');
  assert.ok(decision.confidenceScore < 0.8);
});

test('an unknown Apple category cannot hide a nearly tied known broad type', () => {
  const museum = scoreNativeCandidate(
    input({ ocrText: [], visualTags: [] }),
    candidate({
      id: 'museum',
      name: 'Museum of London Docklands',
      normalizedCategory: 'museum',
      distanceMeters: 5,
      rank: 1,
    })
  );
  const unknown = scoreNativeCandidate(
    input({ ocrText: [], visualTags: [] }),
    candidate({
      id: 'unknown-poi',
      name: 'West India Quay',
      normalizedCategory: 'unknown',
      distanceMeters: 0,
      rank: 0,
    })
  );
  const decision = buildPhotoPlaceResolutionDecision({
    input: input({ ocrText: [], visualTags: [] }),
    scored: [unknown, museum],
    nativeResult: {
      candidates: [unknown, museum],
      lookupMetadata: { candidateCount: 2, searchRadiusMeters: 40 },
    },
    searchRadiusMeters: 40,
    usedPersonalHistory: false,
  });
  assert.equal(decision.status, 'category_only');
  assert.equal(decision.selectedCandidate?.normalizedCategory, 'museum');
  assert.equal(decision.alternatives[0]?.normalizedCategory, 'unknown');
});

test('matching visual evidence can promote an exact museum from broad type to resolved venue', () => {
  const museumInput = input({
    visualTags: [
      { label: 'painting', confidence: 0.92 },
      { label: 'gallery wall', confidence: 0.85 },
    ],
  });
  const museum = scoreNativeCandidate(
    museumInput,
    candidate({
      id: 'museum',
      name: 'Museum of London Docklands',
      normalizedCategory: 'museum',
      distanceMeters: 0,
    })
  );
  const hotel = scoreNativeCandidate(
    museumInput,
    candidate({
      id: 'hotel',
      name: 'Nearby Hotel',
      normalizedCategory: 'hotel',
      distanceMeters: 15,
      rank: 1,
    })
  );
  const decision = buildPhotoPlaceResolutionDecision({
    input: museumInput,
    scored: [museum, hotel].sort((left, right) => right.confidenceScore - left.confidenceScore),
    nativeResult: {
      candidates: [museum, hotel],
      lookupMetadata: { candidateCount: 2, searchRadiusMeters: 40 },
    },
    searchRadiusMeters: 40,
    usedPersonalHistory: false,
  });
  assert.ok(museum.confidenceScore >= 0.8);
  assert.equal(decision.status, 'resolved');
  assert.equal(decision.selectedCandidate?.normalizedCategory, 'museum');
});

test('OCR token matching tolerates brand spacing and branch suffixes', () => {
  assert.ok(calculateOcrNameScore(['WATCH HOUSE'], 'WatchHouse Canary Wharf') >= 0.9);
  assert.ok(calculateOcrNameScore(['WATCHHOUSE'], 'WatchHouse Canary Wharf') >= 0.9);
});

test('a confirmed home cluster inside its radius reaches the personal threshold', () => {
  const cluster: UserPlaceCluster = {
    id: 'home',
    label: 'Home',
    placeType: 'home',
    center: { latitude: 51.5046, longitude: -0.0194 },
    radiusMeters: 35,
    userConfirmed: true,
    visitCount: 8,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
  const scored = scorePersonalCluster(
    input({ visualTags: [{ label: 'kitchen', confidence: 0.9 }] }),
    cluster,
    8
  );
  assert.ok(scored.confidenceScore >= 0.75);
  assert.equal(scored.source, 'personal_cluster');
});
