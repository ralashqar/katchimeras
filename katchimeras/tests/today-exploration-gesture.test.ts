import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveTodayExplorationDragTranslation,
  resolveTodayExplorationSwipeDirection,
  resolveTodayExplorationTransitionDuration,
  resolveTodayExplorationTransitionOpacity,
} from '../utils/today-exploration-gesture';

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

test('a quick release at the end of a long drag still advances the day', () => {
  assert.equal(resolveTodayExplorationSwipeDirection({
    ...thresholds,
    translationX: -180,
    velocityX: -1050,
  }), 1);
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

test('the environment follows the finger beyond its authored pan range with resistance', () => {
  assert.equal(resolveTodayExplorationDragTranslation({
    gestureStartX: 0,
    maxPan: 200,
    overscrollResistance: 0.2,
    translationX: -300,
  }), -220);
});

test('transition settling gets shorter when the drag already approached its target', () => {
  assert.equal(resolveTodayExplorationTransitionDuration({
    currentX: 0,
    targetX: -400,
  }), 280);
  assert.equal(resolveTodayExplorationTransitionDuration({
    currentX: -320,
    targetX: -400,
  }), 200);
});

test('only the selected incoming scene can fade into the foreground', () => {
  assert.equal(resolveTodayExplorationTransitionOpacity({
    plane: 'background',
    progress: 0.5,
    role: 'incoming',
    selectedIncoming: false,
  }), 0);
  assert.equal(resolveTodayExplorationTransitionOpacity({
    plane: 'subject',
    progress: 0.5,
    role: 'incoming',
    selectedIncoming: true,
  }), 0.5);
});

test('the cinematic background crossfade avoids a dark midpoint', () => {
  assert.equal(resolveTodayExplorationTransitionOpacity({
    plane: 'background',
    progress: 0.5,
    role: 'current',
    selectedIncoming: false,
  }), 1);
  assert.equal(resolveTodayExplorationTransitionOpacity({
    plane: 'background',
    progress: 1,
    role: 'current',
    selectedIncoming: false,
  }), 0);
});
