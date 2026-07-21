import assert from 'node:assert/strict';
import test from 'node:test';

import type { LocalCreatureRecord, StoredHomeDayRecord } from '@/types/home';
import { upgradeStoredHomeState } from '@/game/days/migrations';
import { buildDailyCreatureCard, updateCardMemorySpark } from '@/utils/daily-card';

const creature: LocalCreatureRecord = {
  id: 'creature-test-mossprout',
  name: 'Mossprout',
  primaryTrait: 'calm',
  secondaryTrait: 'exploration',
  rarity: 'rare',
  visualKey: 'mossprout',
  accentColor: '#8FD8BE',
  highlightMomentId: 'moment-coffee',
  highlight: 'A quiet walk after coffee.',
  reflection: 'The day kept a calm green edge.',
  motifTags: ['Park'],
  encounterProfileId: 'mossprout',
  repeatDepth: 3,
  bondVisitCount: 4,
  mood: 'cozy',
  bondDepth: 'familiar',
  variantCell: 'cozy_familiar',
  birthSignals: ['park', 'rain_day'],
  livingFactors: ['new_place'],
};

function makeDay(overrides: Partial<StoredHomeDayRecord> = {}): StoredHomeDayRecord {
  return {
    id: 'day-2026-07-20',
    isoDate: '2026-07-20',
    state: 'hatched',
    stepsCount: 5316,
    visitedPlaceCount: 2,
    newPlaceCount: 1,
    locationSampleCount: 1,
    shareReadyAt: '2026-07-20T21:00:00.000Z',
    moments: [{
      id: 'moment-coffee',
      type: 'coffee',
      source: 'quick_tag',
      label: 'Coffee',
      icon: 'cup.and.saucer.fill',
      accentColor: '#C99E72',
      createdAt: '2026-07-20T10:00:00.000Z',
      metadata: {},
    }],
    locations: [{
      id: 'location-park',
      lat: 51.5,
      lng: -0.1,
      capturedAt: '2026-07-20T12:00:00.000Z',
      type: 'park',
      hasPhoto: false,
      source: 'manual',
      label: 'Riverwalk',
    }],
    healthRouteImport: null,
    exactRouteSegments: [],
    selectedPathId: null,
    creature,
    card: null,
    promptAnswers: [{
      id: 'prompt-calm',
      kind: 'feeling',
      choiceIds: ['calm'],
      labels: ['Calm'],
      createdAt: '2026-07-20T20:00:00.000Z',
      source: 'prompt_chip',
      semanticTags: ['feeling:calm'],
      scoreBias: { calm: 0.4 },
    }],
    heroPhoto: null,
    weather: { condition: 'rain', source: 'forecast' },
    sleep: { quality: 'good', source: 'manual', totalSleepMinutes: 450 },
    storedNonce: 'stable-test-nonce',
    ...overrides,
  };
}

test('daily card resolution is deterministic and keeps trait families distinct', () => {
  const day = makeDay();
  const options = { mode: 'live_hatch' as const, sealedAt: '2026-07-20T21:00:00.000Z' };
  const first = buildDailyCreatureCard(day, creature, options);
  const second = buildDailyCreatureCard(day, creature, options);

  assert.deepEqual(first, second);
  assert.equal(first.id, `card:${day.id}`);
  assert.equal(first.schemaVersion, 2);
  assert.equal(first.engineVersion, 'daily-card-v2');
  assert.equal(first.state.label, 'Calm & Well Rested');
  assert.equal(first.meetingNumber, 4);
  assert.equal(first.bondStage, 0);
  assert.ok(first.traits.length >= 1 && first.traits.length <= 3);
  assert.equal(new Set(first.traits.map((trait) => trait.family)).size, first.traits.length);
  assert.equal(first.facets?.sleep.value, '7h 30m');
  assert.equal(first.facets?.place.value, 'Riverwalk');
  assert.equal(first.dayFacts?.steps, 5316);
  assert.equal(first.scene?.backdrop, 'rain');
  assert.match(first.storyLine ?? '', /rain-softened day/);
});

test('sensitive solo trait is never inferred from missing social evidence', () => {
  const day = makeDay({ promptAnswers: [], moments: [], weather: undefined, sleep: undefined });
  const card = buildDailyCreatureCard(day, creature, {
    mode: 'live_hatch',
    sealedAt: '2026-07-20T21:00:00.000Z',
  });
  assert.equal(card.traits.some((trait) => trait.id === 'solo_time'), false);
});

test('memory updates preserve every sealed collectible field', () => {
  const day = makeDay();
  const card = buildDailyCreatureCard(day, creature, {
    mode: 'live_hatch',
    sealedAt: '2026-07-20T21:00:00.000Z',
  });
  const changedDay = makeDay({ bigMoments: [{ id: 'reunion', type: 'reunion', label: 'Dinner with old friends', subject: null, noteId: null, createdAt: '2026-07-20T19:00:00.000Z' }] });
  const updated = updateCardMemorySpark(card, changedDay, creature);

  assert.equal(updated.memorySpark?.caption, 'Dinner with old friends');
  assert.deepEqual({ ...updated, memorySpark: card.memorySpark }, card);
});

test('v12 migration backfills one stable card without rerolling creature or rarity', () => {
  const legacyDay = makeDay();
  const { card: _card, ...dayWithoutCard } = legacyDay;
  const legacyState = {
    version: 12,
    locationPermission: 'unknown',
    activityPermission: 'unknown',
    healthPermission: 'unknown',
    encounterHistory: {},
    personalEntities: [],
    cloudIntelligenceEnabled: false,
    archivedDays: [dayWithoutCard],
    today: { ...dayWithoutCard, id: 'day-2026-07-21', isoDate: '2026-07-21', creature: null, state: 'forming' },
  };

  const migrated = upgradeStoredHomeState(legacyState as Parameters<typeof upgradeStoredHomeState>[0]);
  const migratedAgain = upgradeStoredHomeState(migrated);
  const card = migrated.archivedDays[0].card;

  assert.equal(migrated.version, 14);
  assert.equal(card?.provenance, 'legacy_backfill');
  assert.equal(card?.creatureId, creature.id);
  assert.equal(card?.rarity, 'rare');
  assert.equal(card?.schemaVersion, 2);
  assert.deepEqual(migratedAgain.archivedDays[0].card, card);
});

test('v13 migration enriches a v1 card without changing its collectible identity', () => {
  const day = makeDay();
  const built = buildDailyCreatureCard(day, creature, {
    mode: 'live_hatch',
    sealedAt: '2026-07-20T21:00:00.000Z',
  });
  const { storyLine: _storyLine, facets: _facets, dayFacts: _dayFacts, scene: _scene, ...v1Fields } = built;
  const v1Card = { ...v1Fields, schemaVersion: 1 as const, engineVersion: 'daily-card-v1' as const };
  const v13State = {
    version: 13 as const,
    locationPermission: 'unknown' as const,
    activityPermission: 'unknown' as const,
    healthPermission: 'unknown' as const,
    encounterHistory: {},
    personalEntities: [],
    cloudIntelligenceEnabled: false,
    archivedDays: [{ ...day, card: v1Card }],
    today: { ...day, id: 'day-2026-07-21', isoDate: '2026-07-21', creature: null, card: null, state: 'forming' as const },
  };

  const migrated = upgradeStoredHomeState(v13State);
  const card = migrated.archivedDays[0].card;
  assert.equal(migrated.version, 14);
  assert.equal(card?.schemaVersion, 2);
  assert.equal(card?.id, built.id);
  assert.equal(card?.creatureId, built.creatureId);
  assert.equal(card?.rarity, built.rarity);
  assert.deepEqual(card?.traits, built.traits);
  assert.ok(card?.facets && card.dayFacts && card.scene && card.storyLine);
});
