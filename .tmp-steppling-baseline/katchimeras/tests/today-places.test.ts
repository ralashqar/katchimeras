import assert from 'node:assert/strict';
import test from 'node:test';

import { withDismissedPlaceCandidate, withEnrichedDayPlace, withRemovedDayPlace, withSavedDayPlace } from '@/game/days/mutations/day-fields';
import type { HomeDayRecord, StoredHomeDayRecord } from '@/types/home';
import { deriveDayMapSummary } from '@/utils/day-map-engine';
import { detectedPlaceCandidates, placeIsEnriched } from '@/utils/today-places';

function day(): StoredHomeDayRecord {
  return { id: 'day-places', isoDate: '2026-07-20', moments: [], locations: [], promptAnswers: [], notes: [], foodMoments: [], studioMoments: [], bigMoments: [], evidence: [], classifiedMemories: [] } as unknown as StoredHomeDayRecord;
}

test('location-first place save persists its exact name and point without fabricated enrichment', () => {
  const result = withSavedDayPlace(day(), { location: { latitude: 51.501, longitude: -0.141, name: 'Buckingham Palace', address: 'London', placeId: 'apple-1', source: 'apple_maps' } }, new Date('2026-07-20T12:00:00Z'));
  const place = result.confirmedPlaces?.[0];
  assert.equal(place?.name, 'Buckingham Palace');
  assert.equal(place?.category, 'other_place');
  assert.equal(place?.archetype, 'unassigned');
  assert.equal(placeIsEnriched(place!), false);
  assert.equal(result.locations[0]?.label, 'Buckingham Palace');
});

test('saving the same Apple Maps place upserts rather than duplicates', () => {
  const first = withSavedDayPlace(day(), { location: { latitude: 51.501, longitude: -0.141, name: 'Buckingham Palace', placeId: 'apple-1', source: 'apple_maps' } }, new Date('2026-07-20T12:00:00Z'));
  const second = withSavedDayPlace(first, { location: { latitude: 51.5011, longitude: -0.1411, name: 'The Palace', placeId: 'apple-1', source: 'apple_maps' } }, new Date('2026-07-20T12:05:00Z'));
  assert.equal(second.confirmedPlaces?.length, 1);
  assert.equal(second.confirmedPlaces?.[0]?.name, 'The Palace');
  assert.equal(second.locations.length, 1);
});

test('enrichment updates the same place and removal preserves passive evidence', () => {
  const passive = { id: 'passive', lat: 51.5, lng: -0.14, capturedAt: '2026-07-20T11:00:00Z', type: 'unknown' as const, hasPhoto: false, source: 'foreground' as const, momentId: null };
  const saved = withSavedDayPlace({ ...day(), locations: [passive] }, { location: { latitude: 51.501, longitude: -0.141, name: 'Museum', source: 'manual_pin' } }, new Date('2026-07-20T12:00:00Z'));
  const id = saved.confirmedPlaces![0].id;
  const enriched = withEnrichedDayPlace(saved, { id, category: 'museum', categoryLabel: 'Museum or gallery', archetype: 'meaningful', meaningLabel: 'Inspiring' }, new Date('2026-07-20T12:01:00Z'));
  assert.equal(enriched.confirmedPlaces?.[0]?.category, 'museum');
  assert.equal(placeIsEnriched(enriched.confirmedPlaces![0]), true);
  const removed = withRemovedDayPlace(enriched, id);
  assert.equal(removed.confirmedPlaces?.length, 0);
  assert.deepEqual(removed.locations.map((point) => point.id), ['passive']);
});

test('only credible non-home dwell clusters become review suggestions and dismissal persists', () => {
  const base = day();
  const points = [
    { id: 'a', lat: 51.5, lng: -0.14, capturedAt: '2026-07-20T10:00:00Z', type: 'unknown' as const, hasPhoto: false, source: 'foreground' as const, momentId: null },
    { id: 'b', lat: 51.5001, lng: -0.1401, capturedAt: '2026-07-20T10:10:00Z', type: 'unknown' as const, hasPhoto: false, source: 'foreground' as const, momentId: null },
    { id: 'noise', lat: 51.7, lng: -0.2, capturedAt: '2026-07-20T11:00:00Z', type: 'unknown' as const, hasPhoto: false, source: 'foreground' as const, momentId: null },
  ];
  const dayMap = deriveDayMapSummary(points, []);
  const hydrated = { ...base, locations: points, dayMap } as unknown as HomeDayRecord;
  const candidates = detectedPlaceCandidates(hydrated, null);
  assert.equal(candidates.length, 1);
  const dismissed = withDismissedPlaceCandidate(base, candidates[0].id);
  assert.equal(detectedPlaceCandidates({ ...hydrated, dismissedPlaceCandidateIds: dismissed.dismissedPlaceCandidateIds }, null).length, 0);
});
