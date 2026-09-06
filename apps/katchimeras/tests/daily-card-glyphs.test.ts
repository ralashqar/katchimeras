import assert from 'node:assert/strict';
import test from 'node:test';

import type { JournalRecord, StoredHomeDayRecord } from '@/types/home';
import { resolveDailyCardGlyphs } from '@/utils/daily-card-glyphs';

function makeDay(overrides: Partial<StoredHomeDayRecord> = {}): StoredHomeDayRecord {
  return {
    id: 'glyph-day',
    isoDate: '2026-07-24',
    state: 'hatched',
    stepsCount: 2_400,
    visitedPlaceCount: 1,
    newPlaceCount: 0,
    locationSampleCount: 0,
    shareReadyAt: '2026-07-24T21:00:00.000Z',
    moments: [],
    locations: [],
    healthRouteImport: null,
    exactRouteSegments: [],
    selectedPathId: null,
    creature: null,
    card: null,
    promptAnswers: [],
    heroPhoto: null,
    ...overrides,
  };
}

function journalRecord(
  id: string,
  flowId: string,
  categoryId = 'other'
): JournalRecord {
  return {
    id,
    schemaVersion: 1,
    idempotencyKey: id,
    source: { kind: 'manual', sourceId: id },
    flowId,
    flowVersion: 1,
    categoryId,
    canonicalQualityIds: [],
    fields: {},
    feeling: null,
    note: null,
    attachments: [],
    confirmedFacets: [],
    createdAt: '2026-07-24T18:00:00.000Z',
  };
}

test('movement requires an interpreted, routed, journaled, or notably high-step day', () => {
  assert.equal(resolveDailyCardGlyphs(makeDay({ stepsCount: 6_000 })).some((glyph) => glyph.key === 'movement'), false);
  assert.equal(resolveDailyCardGlyphs(makeDay({
    stepsCount: 6_000,
    stepsInterpretation: {
      movement: 'walk',
      label: 'A long walk',
      emoji: 'Walk',
      createdAt: '2026-07-24T19:00:00.000Z',
    },
  })).some((glyph) => glyph.key === 'movement'), true);
  assert.equal(resolveDailyCardGlyphs(makeDay({ stepsCount: 8_000 })).some((glyph) => glyph.key === 'movement'), true);
});

test('a day can show independent connection and food highlights', () => {
  const glyphs = resolveDailyCardGlyphs(makeDay({
    moments: [{
      id: 'social',
      type: 'social',
      label: 'Together',
      icon: 'person.2.fill',
      accentColor: '#fff',
      createdAt: '2026-07-24T12:00:00.000Z',
      source: 'quick_tag',
    }],
    foodMoments: [{
      id: 'meal',
      label: 'Dinner',
      emoji: 'Dinner',
      createdAt: '2026-07-24T19:00:00.000Z',
    }],
  }));
  assert.deepEqual(new Set(glyphs.map((glyph) => glyph.key)), new Set(['connection', 'food']));
});

test('confirmed milestones and family evidence remain separate highlights', () => {
  const glyphs = resolveDailyCardGlyphs(makeDay({
    bigMoments: [{
      id: 'birthday',
      type: 'birthday',
      label: 'A birthday',
      subject: 'Son',
      noteId: null,
      createdAt: '2026-07-24T18:00:00.000Z',
    }],
    promptAnswers: [{
      id: 'family',
      kind: 'highlight',
      choiceIds: ['family'],
      labels: ['Family'],
      createdAt: '2026-07-24T19:00:00.000Z',
      source: 'prompt_chip',
      semanticTags: ['people:family'],
      scoreBias: {},
    }],
  }));
  assert.deepEqual(glyphs.map((glyph) => glyph.key), ['milestone', 'connection']);
});

test('nature replaces generic exploration when both come from the same place evidence', () => {
  const glyphs = resolveDailyCardGlyphs(makeDay({
    newPlaceCount: 1,
    confirmedPlaces: [{
      id: 'park',
      category: 'park',
      archetype: 'calm',
      label: 'Park',
      confirmedAt: '2026-07-24T17:00:00.000Z',
    }],
  }));
  assert.equal(glyphs.some((glyph) => glyph.key === 'nature'), true);
  assert.equal(glyphs.some((glyph) => glyph.key === 'explore'), false);
});

test('studio and work journal records produce culture and focus glyphs', () => {
  const glyphs = resolveDailyCardGlyphs(makeDay({
    journalRecords: [
      journalRecord('studio', 'studio', 'book'),
      journalRecord('work', 'work', 'deep_work'),
    ],
  }));
  assert.deepEqual(new Set(glyphs.map((glyph) => glyph.key)), new Set(['culture', 'focus']));
});

test('selection is deterministic and capped at four strong glyphs', () => {
  const day = makeDay({
    stepsInterpretation: {
      movement: 'walk',
      label: 'A long walk',
      emoji: 'Walk',
      createdAt: '2026-07-24T19:00:00.000Z',
    },
    bigMoments: [{
      id: 'milestone',
      type: 'achievement',
      label: 'An achievement',
      subject: null,
      noteId: null,
      createdAt: '2026-07-24T18:00:00.000Z',
    }],
    journalRecords: [
      journalRecord('people', 'people'),
      journalRecord('place', 'went_somewhere'),
      journalRecord('food', 'food'),
      journalRecord('studio', 'studio'),
      journalRecord('work', 'work'),
    ],
  });
  const first = resolveDailyCardGlyphs(day);
  const second = resolveDailyCardGlyphs(day);
  assert.equal(first.length, 4);
  assert.deepEqual(first, second);
  assert.deepEqual(first.map((glyph) => glyph.key), ['milestone', 'movement', 'connection', 'explore']);
});

test('low-signal days produce no glyphs', () => {
  assert.deepEqual(resolveDailyCardGlyphs(makeDay()), []);
});

test('canonical journal records prevent legacy projections from double-counting', () => {
  const glyphs = resolveDailyCardGlyphs(makeDay({
    journalRecords: [journalRecord('canonical-food', 'food', 'meal')],
    manualJournalEntries: [{
      id: 'legacy-food',
      flowId: 'food',
      flowVersion: 1,
      path: ['food', 'meal'],
      categoryId: 'meal',
      canonicalQualityIds: [],
      fields: {},
      createdAt: '2026-07-24T18:00:00.000Z',
    }],
  }));
  assert.equal(glyphs.find((glyph) => glyph.key === 'food')?.strength, 0.95);
});

test('personal step history can promote an unusually active day', () => {
  const pastDays = [3_900, 4_000, 4_100].map((stepsCount, index) =>
    makeDay({
      id: `past-${index}`,
      isoDate: `2026-07-${20 + index}`,
      stepsCount,
    })
  );
  const glyphs = resolveDailyCardGlyphs(makeDay({ stepsCount: 5_500 }), { pastDays });
  assert.equal(glyphs.some((glyph) => glyph.key === 'movement'), true);
});
