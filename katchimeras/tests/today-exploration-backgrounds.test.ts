import assert from 'node:assert/strict';
import test from 'node:test';

import todayScene from '../data/today-scene.json';
import {
  todayKatchimeraExplorationBackgroundKeyForFamily,
  todayKatchimeraExplorationBackgroundKeyForPresentation,
} from '../utils/today-exploration-backgrounds';
import { DEV_EXPLORATION_ENVIRONMENT_PREVIEWS } from '../utils/dev-exploration-environments';
import { TODAY_KATCHIMERA_EXPLORATION_BACKGROUND_KEYS } from '../constants/today-exploration-background-keys.gen';
import { todayExplorationCreatureStageFrame } from '../utils/today-kingdom-hero-layout';

const skyloCreature = {
  aspectId: 'weather-atmosphere' as const,
  companionId: 'companion:skylo' as const,
  encounterProfileId: null,
  familyId: 'skylo',
  skinId: 'skylo',
  visualKey: 'skylo' as const,
};

test('a Feastle environment uses its cinematic background even when the creature is Skylo', () => {
  assert.equal(
    todayKatchimeraExplorationBackgroundKeyForPresentation({
      creature: skyloCreature,
      environmentVisualKey: 'feastle',
    }),
    'feastle',
  );
});

test('a Relicoon environment uses its cinematic background independently of creature identity', () => {
  assert.equal(
    todayKatchimeraExplorationBackgroundKeyForPresentation({
      creature: skyloCreature,
      environmentVisualKey: 'relicoon',
    }),
    'relicoon',
  );
});

test('a Steppling environment uses its cinematic trailhead background', () => {
  assert.equal(
    todayKatchimeraExplorationBackgroundKeyForPresentation({
      creature: skyloCreature,
      environmentVisualKey: 'steppling',
    }),
    'steppling',
  );
});

test('a Flickerbun environment uses its cinematic pocket-cinema background', () => {
  assert.equal(
    todayKatchimeraExplorationBackgroundKeyForPresentation({
      creature: skyloCreature,
      environmentVisualKey: 'flickerbun',
    }),
    'flickerbun',
  );
});

test('a Pagelet environment uses its cinematic library background', () => {
  assert.equal(
    todayKatchimeraExplorationBackgroundKeyForPresentation({
      creature: skyloCreature,
      environmentVisualKey: 'pagelet',
    }),
    'pagelet',
  );
});

test('new cinematic environments resolve independently of the shown creature', () => {
  for (const environmentVisualKey of [
    'skylo',
    'bedrotte',
    'mossprout',
    'tasklet',
    'cheerlet',
  ] as const) {
    assert.equal(
      todayKatchimeraExplorationBackgroundKeyForPresentation({
        creature: {
          ...skyloCreature,
          familyId: 'feastle',
          visualKey: 'feastle',
        },
        environmentVisualKey,
      }),
      environmentVisualKey,
    );
  }
});

test('an explicit unsupported environment does not borrow the creature background', () => {
  assert.equal(
    todayKatchimeraExplorationBackgroundKeyForPresentation({
      creature: {
        ...skyloCreature,
        aspectId: 'food-cooking',
        companionId: 'companion:feastle',
        familyId: 'feastle',
        skinId: 'feastle',
        visualKey: 'feastle',
      },
      environmentVisualKey: 'baristabbit',
    }),
    null,
  );
});

test('families without an exported background retain the hex presentation', () => {
  assert.equal(
    todayKatchimeraExplorationBackgroundKeyForFamily('baristabbit'),
    null,
  );
  assert.equal(
    todayKatchimeraExplorationBackgroundKeyForFamily(undefined),
    null,
  );
});

test('the developer gallery previews every exported environment without ownership state', () => {
  assert.deepEqual(
    DEV_EXPLORATION_ENVIRONMENT_PREVIEWS.map((preview) => preview.backgroundKey),
    [...TODAY_KATCHIMERA_EXPLORATION_BACKGROUND_KEYS],
  );
  for (const preview of DEV_EXPLORATION_ENVIRONMENT_PREVIEWS) {
    assert.equal(preview.creature.visualKey, preview.backgroundKey);
    assert.match(preview.creature.id, /^dev-environment-preview:/u);
  }
});

test('cinematic creature framing places visible Feastle feet on the platform contact', () => {
  const frame = todayExplorationCreatureStageFrame(390, 844, 169, 'feastle');
  const expectedSize = Math.min(
    390 * todayScene.homeExplorationBackground.creatureWidthViewportWidthRatio,
    844 * todayScene.homeExplorationBackground.creatureWidthViewportHeightRatio,
  );
  const expectedScreenContact =
    844 * todayScene.homeExplorationBackground.creatureContactYRatio;
  const visibleAlphaBottom = 0.894531;

  assert.equal(frame.size, expectedSize);
  assert.ok(Math.abs(frame.contactY - expectedScreenContact) < 0.0001);
  assert.ok(
    Math.abs(
      frame.top + frame.size * visibleAlphaBottom - frame.stageContactY,
    ) < 0.0001,
  );
});
