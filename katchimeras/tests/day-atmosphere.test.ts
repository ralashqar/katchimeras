import assert from 'node:assert/strict';
import test from 'node:test';

import type { StoredHomeDayRecord } from '../types/home';
import { atmosphereSettingsForPlan, resolveDayAtmosphere } from '../utils/day-atmosphere';

function day(overrides: Partial<StoredHomeDayRecord> = {}): StoredHomeDayRecord {
  return {
    card: null,
    creature: null,
    exactRouteSegments: [],
    healthRouteImport: null,
    heroPhoto: null,
    id: 'day-2026-07-22',
    isoDate: '2026-07-22',
    locationSampleCount: 0,
    locations: [],
    moments: [],
    newPlaceCount: 0,
    promptAnswers: [],
    selectedPathId: null,
    shareReadyAt: null,
    state: 'hatched',
    stepsCount: 0,
    visitedPlaceCount: 0,
    ...overrides,
  };
}

test('weather and journal atmosphere can coexist as two deliberate layers', () => {
  const plan = resolveDayAtmosphere(day({
    bigMoments: [{
      createdAt: '2026-07-22T18:00:00.000Z',
      id: 'birthday',
      label: 'Birthday',
      noteId: null,
      subject: null,
      type: 'birthday',
    }],
    weather: { condition: 'rain', source: 'forecast', tempMaxC: 17 },
  }));

  assert.equal(plan.physical?.preset, 'rain');
  assert.equal(plan.expressive?.preset, 'celebration_drift');
  assert.equal(atmosphereSettingsForPlan(plan).length, 2);
});

test('the strongest lived signal wins without stacking expressive clutter', () => {
  const plan = resolveDayAtmosphere(day({
    moments: [
      { accentColor: '#A4CA77', createdAt: '2026-07-22T12:00:00.000Z', icon: 'figure.walk', id: 'walk', label: 'A long walk', source: 'quick_tag', type: 'walk' },
      { accentColor: '#87B9D8', createdAt: '2026-07-22T13:00:00.000Z', icon: 'mappin', id: 'place', label: 'A new route', source: 'quick_tag', type: 'new_place' },
    ],
    stepsInterpretation: { createdAt: '2026-07-22T18:00:00.000Z', emoji: '🥾', label: 'A hike', movement: 'hike' },
  }));

  assert.equal(plan.expressive?.preset, 'journey_breeze');
  assert.equal(atmosphereSettingsForPlan(plan).length, 1);
});

test('resolution is stable for historical cards and celebratory language is recognized', () => {
  const input = day({
    notes: [{
      archetype: 'meaningful',
      audioUri: null,
      createdAt: '2026-07-22T18:00:00.000Z',
      durationMs: null,
      id: 'note',
      kind: 'text',
      label: 'Graduation',
      text: 'We celebrated her graduation together.',
    }],
  });

  const first = resolveDayAtmosphere(input);
  const second = resolveDayAtmosphere(input);
  assert.deepEqual(first, second);
  assert.equal(first.expressive?.preset, 'celebration_drift');
});

test('a lightly journaled day stays restrained', () => {
  const plan = resolveDayAtmosphere(day());
  assert.equal(plan.physical, null);
  assert.equal(plan.expressive, null);
  assert.deepEqual(atmosphereSettingsForPlan(plan), []);
});

test('recorded hot weather resolves to a subtle heat shimmer', () => {
  const plan = resolveDayAtmosphere(day({
    weather: { condition: 'clear', source: 'forecast', tempMaxC: 30 },
  }));

  assert.equal(plan.physical?.preset, 'heat_shimmer');
  assert.equal(plan.expressive, null);
});
