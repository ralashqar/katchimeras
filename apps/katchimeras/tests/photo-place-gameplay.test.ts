import assert from 'node:assert/strict';
import test from 'node:test';

import type { ClassifiedMemory, StoredHomeDayRecord } from '../types/home';
import type { PhotoPlaceResolution, ScoredPlaceCandidate } from '../types/photo-place';
import { photoPlaceEncounterSignals } from '../utils/photo-place-gameplay';
import { evaluatePhotoForQuest } from '../utils/quests/photo-evaluation';
import { resolveFactsForDay } from '../utils/signals/resolve';

const memory = {
  sourceId: 'photo-park',
  sourceType: 'photo',
  createdAt: '2026-07-24T12:00:00.000Z',
  qualities: [],
} as unknown as ClassifiedMemory;

function candidate(
  placeType: ScoredPlaceCandidate['normalizedCategory'],
  patch: Partial<ScoredPlaceCandidate> = {}
): ScoredPlaceCandidate {
  return {
    id: `place-${placeType}`,
    name: placeType,
    latitude: 51.5,
    longitude: -0.1,
    distanceMeters: 8,
    normalizedCategory: placeType,
    rank: 0,
    confidenceScore: 0.86,
    source: 'apple_maps_poi',
    evidence: {
      proximityScore: 0.9,
      accuracyScore: 1,
      categoryVisualScore: 0.8,
      ocrNameScore: 0,
      personalHistoryScore: 0,
      dwellScore: 0,
      apiRankScore: 1,
    },
    ...patch,
  };
}

function resolution(
  placeType: ScoredPlaceCandidate['normalizedCategory'],
  patch: Partial<PhotoPlaceResolution> = {}
): PhotoPlaceResolution {
  const selectedCandidate = candidate(placeType);
  return {
    photoId: memory.sourceId,
    status: 'resolved',
    selectedCandidate,
    alternatives: [],
    confidenceScore: selectedCandidate.confidenceScore,
    confidenceLevel: 'high',
    scoreModel: 'heuristic_v1',
    resolutionMetadata: {
      nearbyCandidateCount: 1,
      usedOcr: false,
      usedVisualTags: true,
      usedPersonalHistory: false,
      searchRadiusMeters: 40,
      resolvedAt: '2026-07-24T12:00:01.000Z',
    },
    ...patch,
  };
}

function day(placeResolutions: PhotoPlaceResolution[]): StoredHomeDayRecord {
  return {
    id: 'day-2026-07-24',
    isoDate: '2026-07-24',
    state: 'forming',
    stepsCount: 0,
    visitedPlaceCount: 0,
    newPlaceCount: 0,
    locationSampleCount: 0,
    shareReadyAt: null,
    moments: [],
    locations: [],
    healthRouteImport: null,
    exactRouteSegments: [],
    selectedPathId: null,
    creature: null,
    card: null,
    promptAnswers: [],
    heroPhoto: null,
    photoPlaceResolutions: placeResolutions,
  };
}

test('park quests require hybrid photo and place evidence', () => {
  const ready = evaluatePhotoForQuest(memory, 'quest-new-park', resolution('park'));
  assert.equal(ready.status, 'ready');
  assert.equal(ready.reasonCode, 'place_hybrid_match');

  const geoOnlyCandidate = candidate('park', {
    evidence: { ...candidate('park').evidence, categoryVisualScore: 0, ocrNameScore: 0 },
  });
  const geoOnly = evaluatePhotoForQuest(
    memory,
    'quest-new-park',
    resolution('park', { selectedCandidate: geoOnlyCandidate })
  );
  assert.equal(geoOnly.status, 'possible');
});

test('confirmed places are quest-ready while a wrong place type is rejected', () => {
  const confirmed = candidate('park', { userConfirmed: true });
  assert.equal(
    evaluatePhotoForQuest(
      memory,
      'quest-new-park',
      resolution('park', { selectedCandidate: confirmed })
    ).status,
    'ready'
  );
  assert.equal(
    evaluatePhotoForQuest(memory, 'quest-new-park', resolution('cafe')).status,
    'no_match'
  );
});

test('a previously selected cafe does not complete the new-cafe quest', () => {
  const knownCafe = candidate('cafe', {
    userConfirmed: true,
    evidence: {
      ...candidate('cafe').evidence,
      personalHistoryScore: 0.75,
    },
  });
  const result = evaluatePhotoForQuest(
    memory,
    'quest-new-cafe',
    resolution('cafe', { selectedCandidate: knownCafe })
  );
  assert.equal(result.status, 'no_match');
  assert.equal(result.reasonCode, 'place_already_known');
});

test('only high or confirmed place resolutions enter hatch signals and facts', () => {
  const cafe = resolution('cafe');
  const ambiguous = resolution('museum', {
    status: 'needs_confirmation',
    selectedCandidate: undefined,
    alternatives: [candidate('museum', { confidenceScore: 0.65 })],
    confidenceScore: 0.65,
    confidenceLevel: 'medium',
  });
  const homeCandidate = candidate('home', {
    source: 'personal_cluster',
    userConfirmed: true,
    confidenceScore: 0.95,
  });
  const home = resolution('home', {
    selectedCandidate: homeCandidate,
    confidenceScore: 0.95,
  });
  const today = day([cafe, ambiguous, home]);
  const signals = photoPlaceEncounterSignals(today.photoPlaceResolutions);
  assert.ok(signals.some((signal) => signal.seedId === 'coffee_shop' && signal.intensity === 0.68));
  assert.ok(signals.some((signal) => signal.seedId === 'home_evening' && signal.intensity === 0.8));
  assert.equal(signals.some((signal) => signal.seedId === 'museum'), false);
  assert.deepEqual(resolveFactsForDay(today as never)['photo.place.categories'], ['cafe', 'home']);
});
