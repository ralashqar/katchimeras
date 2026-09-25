import assert from 'node:assert/strict';
import test from 'node:test';

import { upgradeStoredHomeState } from '../game/days/migrations';
import type { DaySkySnapshot, StoredHomeDayRecord } from '../types/home';
import { buildDailyCreatureCard } from '../utils/daily-card';
import {
  deriveDaySkySnapshot,
  reconcileDaySkySnapshot,
  resolveDaySky,
  skyMoodForExpressivePreset,
  skyWeatherForDay,
} from '../utils/day-sky';
import { resolveSkyStyle } from '../utils/sky-rendering';

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
    state: 'forming',
    stepsCount: 0,
    visitedPlaceCount: 0,
    ...overrides,
  };
}

test('weather and expressive presets map into the compact sky taxonomy', () => {
  assert.equal(skyWeatherForDay('cloudy'), 'overcast');
  assert.equal(skyWeatherForDay('rain'), 'rainy');
  assert.equal(skyWeatherForDay('clear', 30), 'hot');
  assert.equal(skyMoodForExpressivePreset('celebration_drift'), 'celebratory');
  assert.equal(skyMoodForExpressivePreset('dandelion_seeds'), 'garden');
  assert.equal(skyMoodForExpressivePreset('quiet_dust'), 'reflective');
});

test('forming skies respond to journal content while live hatches use their frozen snapshot', () => {
  const forming = day({
    notes: [{
      archetype: 'meaningful',
      audioUri: null,
      createdAt: '2026-07-22T18:00:00.000Z',
      durationMs: null,
      id: 'note',
      kind: 'text',
      label: 'Celebration',
      text: 'We celebrated a graduation together.',
    }],
    weather: { condition: 'rain', source: 'forecast' },
  });
  const live = resolveDaySky(forming);
  assert.equal(live.weather, 'rainy');
  assert.equal(live.mood, 'celebratory');

  const frozen: DaySkySnapshot = {
    intensity: 0.5,
    mood: 'hearth',
    seed: 12,
    version: 1,
    weather: 'snowy',
  };
  assert.deepEqual(
    resolveDaySky({ ...forming, sky: frozen, skyPolicy: 'live_frozen', state: 'hatched' }),
    frozen,
  );
});

test('sky rendering keeps severe weather dominant over journal colour', () => {
  const warmStorm = resolveSkyStyle({
    intensity: 1,
    mood: 'celebratory',
    seed: 2,
    version: 1,
    weather: 'stormy',
  });
  const warmClear = resolveSkyStyle({
    intensity: 1,
    mood: 'celebratory',
    seed: 2,
    version: 1,
    weather: 'clear',
  });

  assert.notDeepEqual(warmStorm.gradient, warmClear.gradient);
  assert.equal(warmStorm.cloudOpacity.near, 1);
  assert.ok(warmStorm.veil.includes('0.24'));
});

test('retrospective journal evidence refreshes adaptive history without changing live skies', () => {
  const generatedCreature: NonNullable<StoredHomeDayRecord['creature']> = {
    accentColor: '#fff',
    encounterProfileId: null,
    highlight: 'A day',
    highlightMomentId: null,
    id: 'historical-creature',
    motifTags: [],
    name: 'Test',
    primaryTrait: 'calm',
    rarity: 'common',
    reflection: 'A day',
    reflectionSource: 'generated',
    repeatDepth: 0,
    secondaryTrait: 'focus',
    visualKey: 'mossprout',
  };
  const historical = day({
    card: null,
    creature: generatedCreature,
    skyPolicy: 'historical_adaptive',
    state: 'hatched',
  });
  const liveSky: DaySkySnapshot = {
    intensity: 0.5,
    mood: 'hearth',
    seed: 22,
    version: 1,
    weather: 'clear',
  };
  const live = day({
    card: null,
    creature: { ...generatedCreature, id: 'live-creature' },
    id: 'day-2026-07-21',
    isoDate: '2026-07-21',
    sky: liveSky,
    skyPolicy: 'live_frozen',
    state: 'hatched',
  });
  const initialState = upgradeStoredHomeState({
    activityPermission: 'unknown',
    archivedDays: [live, historical],
    cloudIntelligenceEnabled: false,
    encounterHistory: {},
    healthPermission: 'unknown',
    locationPermission: 'unknown',
    personalEntities: [],
    today: day({ id: 'day-2026-07-23', isoDate: '2026-07-23' }),
    version: 15,
  });
  const gardenNote = {
    archetype: 'meaningful' as const,
    audioUri: null,
    createdAt: '2026-07-22T18:00:00.000Z',
    durationMs: null,
    id: 'garden-note',
    kind: 'text' as const,
    label: 'Garden',
    text: 'A spring picnic among flowers in the garden.',
  };
  const updatedDays = initialState.archivedDays.map((item) =>
    reconcileDaySkySnapshot({
        ...item,
        notes: [gardenNote],
      }),
  );

  assert.equal(updatedDays[1].sky?.mood, 'garden');
  assert.equal(resolveDaySky(updatedDays[1]).mood, 'garden');
  assert.deepEqual(updatedDays[0].sky, liveSky);
});
