import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import type { HomeDayRecord } from '@/types/home';
import { earnedWispIds, selectFeaturedWisps, wispProgress } from '@/utils/wisp-engine';
import { normalizeWispState } from '@/utils/wisp-state';
import { todayEggShoulderWispFrame } from '@/utils/today-kingdom-hero-layout';

function day(id: string, overrides: Partial<HomeDayRecord> = {}): HomeDayRecord {
  return {
    id,
    isoDate: id,
    state: 'hatched',
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
    kind: 'day',
    dayLabel: id,
    dateLabel: id,
    isToday: false,
    scores: { energy: 0, calm: 0, social: 0, exploration: 0, focus: 0 },
    egg: { stage: 'forming', progress: 0, accentColor: '#fff' },
    insightLine: '',
    pathOptions: [],
    canAddMoments: false,
    canHatch: false,
    highlight: null,
    dayMap: null,
    ...overrides,
  } as HomeDayRecord;
}

test('park and cafe outrank a weaker photo candidate while preserving family diversity', () => {
  const result = selectFeaturedWisps(day('2026-08-08', {
    confirmedPlaces: [
      { id: 'park', category: 'park', archetype: 'calm', label: 'Park', venueKey: 'park:one', confirmedAt: '' },
      { id: 'cafe', category: 'cafe', archetype: 'calm', label: 'Cafe', venueKey: 'cafe:one', confirmedAt: '' },
    ],
    moments: [{ id: 'photo', type: 'photo', label: 'Photo', icon: 'photo', accentColor: '#fff', source: 'photo_library', createdAt: '', metadata: { assetId: 'one' } }],
  }));
  assert.deepEqual(result.map((item) => item.wispId), ['sprout', 'steam']);
});

test('a wisp can feature before its permanent unlock', () => {
  const cafeDay = day('2026-08-01', { confirmedPlaces: [{ id: 'cafe', category: 'cafe', archetype: 'calm', label: 'Cafe', confirmedAt: '' }] });
  assert.equal(selectFeaturedWisps(cafeDay)[0]?.wispId, 'steam');
  assert.deepEqual(wispProgress('steam', [cafeDay]), { current: 1, target: 5, unit: 'café days' });
  assert.equal(earnedWispIds([cafeDay]).includes('steam'), false);
});

test('distinct park progress uses stable venue identity', () => {
  const days = Array.from({ length: 5 }, (_, index) => day(`2026-08-0${index + 1}`, {
    confirmedPlaces: [{ id: `node-${index}`, category: 'park', archetype: 'calm', label: 'Park', venueKey: index < 2 ? 'same' : `park-${index}`, confirmedAt: '' }],
  }));
  assert.equal(wispProgress('sprout', days).current, 4);
});

test('seven unique consecutive hatched dates unlock Spark idempotently', () => {
  const days = Array.from({ length: 7 }, (_, index) => day(`2026-08-0${index + 1}`));
  assert.equal(wispProgress('spark', days).current, 7);
  assert.equal(earnedWispIds(days).includes('spark'), true);
  assert.deepEqual(earnedWispIds(days), earnedWispIds(days));
});

test('invalid equipped IDs normalize to null', () => {
  assert.equal(normalizeWispState({ version: 1, equippedWispId: 'unknown', unlocked: {}, baselinedCatalogVersion: 1 }).equippedWispId, null);
});

test('the Egg shoulder companion frame scales proportionally with the Egg stage', () => {
  assert.deepEqual(todayEggShoulderWispFrame(1), {
    size: 64,
    translateX: 108,
    translateY: -62,
  });
  assert.deepEqual(todayEggShoulderWispFrame(1.5), {
    size: 96,
    translateX: 162,
    translateY: -93,
  });
});

test('Today passes the equipped Wisp into the Egg hero instead of a page overlay', () => {
  const root = path.resolve(__dirname, '..');
  const todaySource = fs.readFileSync(path.join(root, 'app/(tabs)/today.tsx'), 'utf8');
  const heroSource = fs.readFileSync(path.join(root, 'components/katchadeck/home/today-kingdom-egg-hero.tsx'), 'utf8');
  assert.match(todaySource, /companionWispId=\{active && !isHatching \? activeWispId : null\}/);
  assert.match(todaySource, /companionWispId=\{activeWispId\}/);
  assert.doesNotMatch(todaySource, /styles\.activeWisp/);
  assert.match(heroSource, /styles\.eggShoulderWisp/);
  assert.match(heroSource, /todayEggShoulderWispFrame\(eggStageScale\)/);
});

test('the all-Katchimeras developer switch unlocks Wisps without persisting debug ownership', () => {
  const root = path.resolve(__dirname, '..');
  const providerSource = fs.readFileSync(path.join(root, 'features/wisps/wisp-provider.tsx'), 'utf8');
  assert.match(providerSource, /useDevAllKatchimerasAvailable\(\)/);
  assert.match(providerSource, /allKatchimerasAvailable \|\| Boolean\(state\.unlocked\[id\]\)/);
  assert.match(providerSource, /if \(allKatchimerasAvailable\) \{\s*setDebugEquippedWispId\(id\);\s*return;/);
  assert.match(providerSource, /if \(!allKatchimerasAvailable\) setDebugEquippedWispId\(undefined\)/);
});
