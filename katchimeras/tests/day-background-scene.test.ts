import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import type {
  DaySkySnapshot,
  SkyMoodId,
  SkyWeatherId,
  StoredHomeDayRecord,
} from '../types/home';
import {
  rankDayBackgroundSceneCandidates,
  resolveDayBackgroundSceneIds,
} from '../utils/day-background-scene-ranking';
import { resolveDayBackgroundSceneId } from '../utils/day-background-scene-id';

const MOODS: SkyMoodId[] = [
  'neutral',
  'radiant',
  'celebratory',
  'garden',
  'autumn',
  'hearth',
  'twilight',
  'inspired',
  'journey',
  'connected',
  'reflective',
];
const WEATHER: SkyWeatherId[] = [
  'clear',
  'partly_cloudy',
  'overcast',
  'foggy',
  'rainy',
  'snowy',
  'stormy',
  'hot',
];

function sky(weather: SkyWeatherId, mood: SkyMoodId): DaySkySnapshot {
  return { intensity: 0.7, mood, seed: 407, version: 1, weather };
}

function day(
  isoDate: string,
  overrides: Partial<StoredHomeDayRecord> = {},
): StoredHomeDayRecord {
  return {
    card: null,
    creature: null,
    exactRouteSegments: [],
    healthRouteImport: null,
    heroPhoto: null,
    id: `day-${isoDate}`,
    isoDate,
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

test('every weather and mood combination resolves to a manifest scene', () => {
  const manifestPath = path.join(process.cwd(), 'design', 'today-atmosphere-backgrounds', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { scenes: Record<string, unknown> };
  assert.equal(Object.keys(manifest.scenes).length, 10);

  for (const weather of WEATHER) {
    for (const mood of MOODS) {
      assert.ok(resolveDayBackgroundSceneId(sky(weather, mood)) in manifest.scenes);
    }
  }
});

test('physical weather overrides journal mood for the authored weather plates', () => {
  for (const mood of MOODS) {
    assert.equal(resolveDayBackgroundSceneId(sky('stormy', mood)), 'storm');
    assert.equal(resolveDayBackgroundSceneId(sky('foggy', mood)), 'mist_cold');
    assert.equal(resolveDayBackgroundSceneId(sky('snowy', mood)), 'mist_cold');
    assert.equal(resolveDayBackgroundSceneId(sky('rainy', mood)), 'rain_overcast');
    assert.equal(resolveDayBackgroundSceneId(sky('overcast', mood)), 'rain_overcast');
    assert.equal(resolveDayBackgroundSceneId(sky('hot', mood)), 'radiant_golden');
  }
});

test('fair weather preserves the strongest journal mood', () => {
  assert.equal(resolveDayBackgroundSceneId(sky('clear', 'garden')), 'garden_bloom');
  assert.equal(resolveDayBackgroundSceneId(sky('partly_cloudy', 'connected')), 'celebration_connected');
  assert.equal(resolveDayBackgroundSceneId(sky('clear', 'reflective')), 'twilight_reflective');
  assert.equal(resolveDayBackgroundSceneId(sky('clear', 'journey')), 'inspired_journey');
});

test('journal evidence scores the matching authored plate above generic clear sky', () => {
  const gardenDay = day('2026-07-20', {
    notes: [{
      archetype: 'meaningful',
      audioUri: null,
      createdAt: '2026-07-20T18:00:00.000Z',
      durationMs: null,
      id: 'garden-note',
      kind: 'text',
      label: 'Garden',
      text: 'A spring picnic among flowers in the garden.',
    }],
    weather: { condition: 'clear', source: 'forecast' },
  });
  const journeyDay = day('2026-07-21', {
    moments: [{
      accentColor: '#87B9D8',
      createdAt: '2026-07-21T12:00:00.000Z',
      icon: 'figure.walk',
      id: 'walk',
      label: 'A long walk',
      source: 'quick_tag',
      type: 'walk',
    }],
    stepsInterpretation: {
      createdAt: '2026-07-21T18:00:00.000Z',
      emoji: '🥾',
      label: 'A hike',
      movement: 'hike',
    },
    weather: { condition: 'clear', source: 'forecast' },
  });

  assert.equal(rankDayBackgroundSceneCandidates(gardenDay)[0].sceneId, 'garden_bloom');
  assert.equal(rankDayBackgroundSceneCandidates(journeyDay)[0].sceneId, 'inspired_journey');
});

test('archive resolution never repeats the immediately previous plate', () => {
  const days = [
    day('2026-07-18', { weather: { condition: 'cloudy', source: 'forecast' } }),
    day('2026-07-19', { weather: { condition: 'cloudy', source: 'forecast' } }),
    day('2026-07-20', { weather: { condition: 'cloudy', source: 'forecast' } }),
    day('2026-07-21', { weather: { condition: 'cloudy', source: 'forecast' } }),
  ];
  const first = resolveDayBackgroundSceneIds(days);
  const second = resolveDayBackgroundSceneIds([...days].reverse());
  const sceneIds = days.map((item) => first.get(item.id));

  for (let index = 1; index < sceneIds.length; index += 1) {
    assert.notEqual(sceneIds[index], sceneIds[index - 1]);
  }
  assert.deepEqual(first, second);
  assert.ok(new Set(sceneIds).size > 1);
});

test('live-frozen sky ranking ignores retrospective journal runner-up changes', () => {
  const frozenSky: DaySkySnapshot = {
    intensity: 0.7,
    mood: 'reflective',
    seed: 77,
    version: 1,
    weather: 'clear',
  };
  const frozen = day('2026-07-19', {
    notes: [{
      archetype: 'meaningful',
      audioUri: null,
      createdAt: '2026-07-22T18:00:00.000Z',
      durationMs: null,
      id: 'late-garden-note',
      kind: 'text',
      label: 'Garden',
      text: 'A garden full of spring flowers.',
    }],
    sky: frozenSky,
    skyPolicy: 'live_frozen',
  });

  assert.equal(rankDayBackgroundSceneCandidates(frozen)[0].sceneId, 'twilight_reflective');
});

test('Today always uses an authored plate instead of the dynamic background sky', () => {
  const backdropSource = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'home', 'today-scene-backdrop.tsx'),
    'utf8',
  );
  const todaySource = fs.readFileSync(
    path.join(process.cwd(), 'app', '(tabs)', 'today.tsx'),
    'utf8',
  );
  assert.match(backdropSource, /source=\{background\.source\}/);
  assert.doesNotMatch(backdropSource, /StaticKingdomSkyBackground/);
  assert.doesNotMatch(backdropSource, /ResolvedAtmosphereLayer/);
  assert.doesNotMatch(backdropSource, /BlurMask/);
  assert.match(
    todaySource,
    /todayAtmosphereBackgroundForDay\(atmosphereDay, allDays\)/,
  );
});
