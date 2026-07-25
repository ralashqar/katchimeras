import assert from 'node:assert/strict';
import test from 'node:test';

import type { DailyCreatureCard } from '@/types/home';
import {
  resolveDailyCardAtmosphere,
  resolveDailyCardSkySceneId,
} from '@/utils/daily-card-scene';

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

test('sealed v4 atmosphere keeps journal mood as the sky while weather remains a modifier', () => {
  const day = {
    id: 'rainy-birthday',
    isoDate: '2026-07-25',
    moments: [],
    promptAnswers: [],
    bigMoments: [{
      createdAt: '2026-07-25T18:00:00.000Z',
      id: 'birthday',
      label: 'Birthday',
      noteId: null,
      subject: null,
      type: 'birthday',
    }],
    weather: { condition: 'rain', source: 'forecast' },
  } as unknown as Parameters<typeof resolveDailyCardAtmosphere>[0];
  const atmosphere = resolveDailyCardAtmosphere(day);

  assert.equal(atmosphere.sceneId, 'celebration_connected');
  assert.equal(atmosphere.mood, 'celebratory');
  assert.deepEqual(atmosphere.weatherModifier, { condition: 'rain', strength: 0.25 });
  assert.equal(resolveDailyCardSkySceneId({
    scene: {
      atmosphere,
      backdrop: 'rain',
      compositionSeed: 'rainy-birthday',
      environment: {
        candidateProfileId: null,
        probability: null,
        source: 'primary_fallback',
        visualKey: 'mossprout',
      },
      foregroundMotifs: [],
      lighting: 'day',
      weather: 'rain',
    },
    treatment: { backdrop: 'rain' },
  } as unknown as DailyCreatureCard), 'celebration_connected');
});
