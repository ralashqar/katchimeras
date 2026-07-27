import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveTodayExplorationSwipeDirection } from '../utils/today-exploration-gesture';

const thresholds = {
  minDistance: 40,
  minVelocity: 850,
};

test('a quick left flick advances to the next day', () => {
  assert.equal(resolveTodayExplorationSwipeDirection({
    ...thresholds,
    translationX: -72,
    velocityX: -1100,
  }), 1);
});

test('a quick right flick returns to the previous day', () => {
  assert.equal(resolveTodayExplorationSwipeDirection({
    ...thresholds,
    translationX: 65,
    velocityX: 980,
  }), -1);
});

test('a slow environmental drag does not navigate even after travelling far', () => {
  assert.equal(resolveTodayExplorationSwipeDirection({
    ...thresholds,
    translationX: -180,
    velocityX: -320,
  }), null);
});

test('a short fast movement does not accidentally navigate', () => {
  assert.equal(resolveTodayExplorationSwipeDirection({
    ...thresholds,
    translationX: 22,
    velocityX: 1250,
  }), null);
});

test('reversing direction before release remains an environmental drag', () => {
  assert.equal(resolveTodayExplorationSwipeDirection({
    ...thresholds,
    translationX: 96,
    velocityX: -900,
  }), null);
});
