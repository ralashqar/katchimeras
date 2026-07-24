import assert from 'node:assert/strict';
import test from 'node:test';

import type { DailyCreatureCard } from '@/types/home';
import { resolveDailyCardSkySceneId } from '@/utils/daily-card-scene';

function cardWithScene(
  backdrop: NonNullable<DailyCreatureCard['scene']>['backdrop'],
  overrides: Partial<NonNullable<DailyCreatureCard['scene']>> = {}
): DailyCreatureCard {
  return {
    scene: {
      backdrop,
      compositionSeed: 'card-scene-test',
      foregroundMotifs: [],
      lighting: 'day',
      weather: 'clear',
      ...overrides,
    },
    treatment: { backdrop },
  } as DailyCreatureCard;
}

test('daily card sky follows weather before place styling', () => {
  assert.equal(resolveDailyCardSkySceneId(cardWithScene('cafe', { weather: 'storm' })), 'storm');
  assert.equal(resolveDailyCardSkySceneId(cardWithScene('meadow', { weather: 'rain' })), 'rain_overcast');
  assert.equal(resolveDailyCardSkySceneId(cardWithScene('city', { weather: 'snow' })), 'mist_cold');
});

test('daily card sky follows time-of-day lighting', () => {
  assert.equal(resolveDailyCardSkySceneId(cardWithScene('meadow', { lighting: 'night' })), 'twilight_reflective');
  assert.equal(resolveDailyCardSkySceneId(cardWithScene('city', { lighting: 'golden_hour' })), 'radiant_golden');
  assert.equal(resolveDailyCardSkySceneId(cardWithScene('home', { lighting: 'dawn' })), 'radiant_golden');
});

test('daily card sky complements its environment when weather is clear', () => {
  assert.equal(resolveDailyCardSkySceneId(cardWithScene('home')), 'autumn_hearth');
  assert.equal(resolveDailyCardSkySceneId(cardWithScene('cafe')), 'autumn_hearth');
  assert.equal(resolveDailyCardSkySceneId(cardWithScene('nature')), 'garden_bloom');
  assert.equal(resolveDailyCardSkySceneId(cardWithScene('city')), 'inspired_journey');
});
