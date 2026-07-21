import assert from 'node:assert/strict';
import test from 'node:test';

import { withRefreshedPhotoLocationsForDay } from '@/game/days/photo-locations';
import type { HomeDayRecord, StoredHomeDayRecord, StoredHomeState } from '@/types/home';
import { buildDayMapContent } from '@/utils/day-map-content';
import { deriveDayMapSummary } from '@/utils/day-map-engine';

function mapDay(): HomeDayRecord {
  return {
    id: 'day-map',
    isoDate: '2026-07-20',
    moments: [],
    confirmedPlaces: [],
    journalRecords: [{
      id: 'journal-tv',
      schemaVersion: 1,
      idempotencyKey: 'journal-tv',
      source: { kind: 'photo', sourceId: 'logged-photo', thumbnailUri: 'ph://logged' },
      flowId: 'studio',
      flowVersion: 1,
      categoryId: 'show',
      canonicalQualityIds: [],
      fields: { specific: 'The Bear' },
      feeling: null,
      note: 'Watched together',
      attachments: [],
      confirmedFacets: [],
      location: { latitude: 51.50005, longitude: -0.14005, name: 'Home', source: 'manual_pin' },
      createdAt: '2026-07-20T20:00:00.000Z',
    }],
    dayMap: {
      nodes: [{
        id: 'home-node',
        latitude: 51.5,
        longitude: -0.14,
        type: 'home',
        importance: 1,
        hasPhoto: true,
        linkedMomentId: null,
        photoThumbnailUri: 'ph://logged',
        photos: [
          { id: 'camera-roll-photo-logged-photo', thumbnailUri: 'ph://logged', capturedAt: '2026-07-20T20:00:00.000Z', momentId: null },
          { id: 'camera-roll-photo-passive-photo', thumbnailUri: 'ph://passive', capturedAt: '2026-07-20T20:05:00.000Z', momentId: null },
          { id: 'duplicate-passive', sourceId: 'passive-photo', thumbnailUri: 'ph://passive', capturedAt: '2026-07-20T20:05:00.000Z', momentId: null },
        ],
        startedAt: '2026-07-20T19:00:00.000Z',
        endedAt: '2026-07-20T21:00:00.000Z',
        sampleCount: 3,
        journalRecordIds: ['journal-tv'],
      }],
      path: [],
      primaryLocationId: 'home-node',
      viewport: null,
      totalSamples: 3,
    },
  } as unknown as HomeDayRecord;
}

test('day map joins journal memories to their place and separates passive library photos', () => {
  const summary = buildDayMapContent(mapDay());
  const place = summary.places[0];

  assert.equal(place.journalItems[0]?.title, 'The Bear');
  assert.equal(place.journalItems[0]?.note, 'Watched together');
  assert.deepEqual(place.loggedPhotos.map((photo) => photo.sourceId), ['logged-photo']);
  assert.deepEqual(place.libraryPhotos.map((photo) => photo.sourceId), ['passive-photo']);
  assert.equal(place.isLibraryOnly, false);
  assert.equal(summary.memoryPinCount, 1);
  assert.equal(summary.libraryPhotoCount, 1);
});

test('a place with only unlogged geotagged photos remains a Photo Library trace', () => {
  const day = mapDay();
  day.journalRecords = [];
  day.dayMap!.nodes[0].journalRecordIds = [];
  day.dayMap!.nodes[0].photos = [
    { id: 'camera-roll-photo-passive-photo', thumbnailUri: 'ph://passive', capturedAt: '2026-07-20T20:05:00.000Z', momentId: null },
  ];

  const summary = buildDayMapContent(day);
  assert.equal(summary.places[0].isLibraryOnly, true);
  assert.equal(summary.memoryPinCount, 0);
  assert.equal(summary.libraryPinCount, 1);
});

test('map photo refresh enriches a hatched archive day without changing its memories', () => {
  const archived = {
    id: 'archive-day',
    isoDate: '2026-07-20',
    moments: [{ id: 'existing-memory' }],
    locations: [],
    creature: { id: 'creature-1' },
  } as unknown as StoredHomeDayRecord;
  const state = {
    version: 12,
    today: { id: 'today', isoDate: '2026-07-21', moments: [], locations: [] },
    archivedDays: [archived],
  } as unknown as StoredHomeState;
  const photo = {
    id: 'asset-1',
    uri: 'ph://asset-1',
    thumbnailUri: 'ph://asset-1',
    createdAt: new Date('2026-07-20T12:00:00.000Z').getTime(),
    width: 1200,
    height: 900,
    latitude: 51.5,
    longitude: -0.14,
  };

  const once = withRefreshedPhotoLocationsForDay(state, archived.id, [photo]);
  const twice = withRefreshedPhotoLocationsForDay(once, archived.id, [photo]);
  const result = twice.archivedDays[0];

  assert.equal(result.locations.length, 1);
  assert.equal(result.locations[0]?.id, 'camera-roll-photo-asset-1');
  assert.deepEqual(result.moments, archived.moments);
  assert.deepEqual(result.creature, archived.creature);
  assert.equal(twice.today, state.today);
});

test('photo roll refresh keeps distinct geotagged locations beyond the old five-pin cap', () => {
  const archived = {
    id: 'photo-rich-day',
    isoDate: '2026-07-20',
    moments: [],
    locations: [],
  } as unknown as StoredHomeDayRecord;
  const state = {
    version: 12,
    today: { id: 'today', isoDate: '2026-07-21', moments: [], locations: [] },
    archivedDays: [archived],
  } as unknown as StoredHomeState;
  const photos = Array.from({ length: 7 }, (_, index) => ({
    id: `asset-${index}`,
    uri: `ph://asset-${index}`,
    thumbnailUri: `ph://asset-${index}`,
    createdAt: new Date(`2026-07-20T${String(10 + index).padStart(2, '0')}:00:00.000Z`).getTime(),
    width: 1200,
    height: 900,
    latitude: 51.4 + index * 0.01,
    longitude: -0.2,
  }));

  const refreshed = withRefreshedPhotoLocationsForDay(state, archived.id, photos);
  const map = deriveDayMapSummary(refreshed.archivedDays[0].locations, []);

  assert.equal(refreshed.archivedDays[0].locations.length, 7);
  assert.equal(map?.nodes.length, 7);
  assert.ok(map?.nodes.every((node) => node.photos.length === 1));
});

test('photo roll refresh removes stale passive pins while preserving manual and journal places', () => {
  const archived = {
    id: 'stale-photo-day',
    isoDate: '2026-07-20',
    moments: [],
    locations: [
      {
        id: 'camera-roll-photo-mirrored',
        lat: 51.5,
        lng: 120.14,
        capturedAt: '2026-07-20T12:00:00.000Z',
        type: 'unknown',
        hasPhoto: true,
        source: 'photo_attachment',
        momentId: null,
        thumbnailUri: 'ph://mirrored',
      },
      {
        id: 'journal-place',
        lat: 51.5,
        lng: -0.14,
        capturedAt: '2026-07-20T13:00:00.000Z',
        type: 'unknown',
        hasPhoto: false,
        source: 'manual',
        journalRecordId: 'journal-1',
        label: 'Natural History Museum',
      },
    ],
  } as unknown as StoredHomeDayRecord;
  const state = {
    version: 12,
    today: { id: 'today', isoDate: '2026-07-21', moments: [], locations: [] },
    archivedDays: [archived],
  } as unknown as StoredHomeState;

  const refreshed = withRefreshedPhotoLocationsForDay(state, archived.id, []);
  assert.deepEqual(refreshed.archivedDays[0].locations.map((point) => point.id), ['journal-place']);
});

test('invalid automatic coordinates are excluded and a memory place wins the Katchimera marker', () => {
  const points = [
    {
      id: 'null-island',
      lat: 0,
      lng: 0,
      capturedAt: '2026-07-20T10:00:00.000Z',
      type: 'unknown',
      hasPhoto: true,
      source: 'photo_attachment',
      thumbnailUri: 'ph://invalid',
    },
    {
      id: 'passive-photo',
      lat: 51.7,
      lng: -0.3,
      capturedAt: '2026-07-20T11:00:00.000Z',
      type: 'unknown',
      hasPhoto: true,
      source: 'photo_attachment',
      thumbnailUri: 'ph://passive',
    },
    {
      id: 'memory-place',
      lat: 51.5,
      lng: -0.14,
      capturedAt: '2026-07-20T12:00:00.000Z',
      type: 'unknown',
      hasPhoto: false,
      source: 'manual',
      journalRecordId: 'journal-1',
      label: 'Museum',
    },
  ] as unknown as import('@/types/home').StoredHomeLocationPoint[];

  const map = deriveDayMapSummary(points, []);
  assert.equal(map?.totalSamples, 2);
  assert.equal(map?.nodes.length, 2);
  const primary = map?.nodes.find((node) => node.id === map.primaryLocationId);
  assert.deepEqual(primary?.journalRecordIds, ['journal-1']);
});

test('legacy journal records without coordinates appear on Home instead of disappearing from the map', () => {
  const day = mapDay();
  day.journalRecords = [{
    ...day.journalRecords![0],
    id: 'legacy-unlocated',
    location: null,
    fields: { specific: 'An older memory' },
  }];
  day.dayMap!.nodes.push({
    ...day.dayMap!.nodes[0],
    id: 'away-node',
    latitude: 51.7,
    longitude: -0.3,
    type: 'unknown',
    journalRecordIds: [],
    photos: [],
    hasPhoto: false,
  });
  day.dayMap!.primaryLocationId = 'away-node';

  const content = buildDayMapContent(day);
  const home = content.places.find((place) => place.node.id === 'home-node');
  const away = content.places.find((place) => place.node.id === 'away-node');
  assert.deepEqual(home?.journalItems.map((item) => item.id), ['legacy-unlocated']);
  assert.deepEqual(away?.journalItems, []);
});
