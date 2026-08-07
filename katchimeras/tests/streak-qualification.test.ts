import assert from 'node:assert/strict';
import test from 'node:test';

import type { StoredHomeDayRecord, StoredHomeState } from '@/types/home';
import {
  historicalQualifyingCaptureIntents,
  newQualifyingCaptureIntents,
  qualifyingArtifacts,
} from '@/utils/streak-qualification';

function day(overrides: Partial<StoredHomeDayRecord> = {}): StoredHomeDayRecord {
  return {
    card: null,
    creature: null,
    exactRouteSegments: [],
    growth: { careActions: [], events: [], schemaVersion: 1 },
    healthRouteImport: null,
    heroPhoto: null,
    id: 'day-2026-08-07',
    isoDate: '2026-08-07',
    locationSampleCount: 800,
    locations: [],
    moments: [],
    newPlaceCount: 0,
    promptAnswers: [],
    selectedPathId: null,
    shareReadyAt: null,
    state: 'forming',
    stepsCount: 12_400,
    visitedPlaceCount: 4,
    ...overrides,
  };
}

function baseState(isoDate: string): StoredHomeState {
  return {
    archivedDays: [],
    today: day({ id: `day-${isoDate}`, isoDate }),
  } as unknown as StoredHomeState;
}

test('passive steps and location data do not qualify in v1', () => {
  assert.deepEqual(qualifyingArtifacts(day()), []);
});

test('saved journal data qualifies with a privacy-safe source reference', () => {
  const artifacts = qualifyingArtifacts(day({
    journalRecords: [{
      attachments: [],
      canonicalQualityIds: [],
      categoryId: 'general',
      confirmedFacets: [],
      createdAt: '2026-08-07T14:00:00.000Z',
      feeling: null,
      fields: {},
      flowId: 'general',
      flowVersion: 1,
      id: 'journal-1',
      idempotencyKey: 'journal-1',
      note: 'A real memory',
      schemaVersion: 1,
      source: { kind: 'manual', sourceId: 'manual-1' },
    }],
  }));
  assert.equal(artifacts.length, 1);
  assert.equal(artifacts[0].type, 'journal');
});

test('future plans and generated seed moments do not capture a day', () => {
  const now = new Date('2026-08-07T12:00:00');
  const current = baseState('2026-08-07');
  const future = baseState('2026-08-08');
  future.today.moments = [{
    accentColor: '#fff',
    createdAt: now.toISOString(),
    icon: 'sparkles',
    id: 'planned-moment',
    label: 'Plan',
    source: 'quick_tag',
    type: 'focus',
  }];
  assert.equal(newQualifyingCaptureIntents(current, future, now).length, 0);

  current.today.moments = [{
    accentColor: '#fff',
    createdAt: now.toISOString(),
    icon: 'sparkles',
    id: 'seed-moment-0-focus',
    label: 'Seed',
    source: 'quick_tag',
    type: 'focus',
  }];
  assert.equal(historicalQualifyingCaptureIntents(current, now).length, 0);
});
