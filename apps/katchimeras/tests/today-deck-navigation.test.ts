import assert from 'node:assert/strict';
import test from 'node:test';

import {
  allDeckIndices,
  clampDeckIndex,
  DECK_VISUAL_SETTLE_EPSILON,
  DECK_SPRING,
  isHatchTransitionActive,
  isDeckVisuallySettled,
  resolveDeckStride,
  resolveDraggedIndex,
  resolveSwipeTarget,
} from '@/components/katchadeck/home/today-deck/deck-navigation';

test('every deck card remains mounted regardless of its distance from selection', () => {
  assert.deepEqual(allDeckIndices(12), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.deepEqual(allDeckIndices(3), [0, 1, 2]);
  assert.deepEqual(allDeckIndices(0), []);
});

test('the hatch transition survives the egg-to-card data mutation until completion', () => {
  assert.equal(isHatchTransitionActive({ active: true, dayId: 'today', hatchingDayId: 'today' }), true);
  assert.equal(isHatchTransitionActive({ active: false, dayId: 'today', hatchingDayId: 'today' }), false);
  assert.equal(isHatchTransitionActive({ active: true, dayId: 'yesterday', hatchingDayId: 'today' }), false);
  assert.equal(isHatchTransitionActive({ active: true, dayId: 'today', hatchingDayId: null }), false);
});

test('the navigation spring resolves its final transform without an early-stop snap', () => {
  assert.equal(DECK_SPRING.energyThreshold, 6e-9);
  assert.ok(DECK_SPRING.damping >= 26);
  assert.ok(DECK_SPRING.stiffness >= 260);
});

test('visual settlement is sub-pixel but does not require the mathematical spring tail', () => {
  assert.ok(DECK_VISUAL_SETTLE_EPSILON * resolveDeckStride(390) < 0.25);
  assert.equal(isDeckVisuallySettled(2.0009, 2), true);
  assert.equal(isDeckVisuallySettled(2.002, 2), false);
});

test('deck bounds and responsive stride remain deterministic', () => {
  assert.equal(clampDeckIndex(-1, 5), 0);
  assert.equal(clampDeckIndex(8, 5), 5);
  assert.equal(resolveDeckStride(320), 168);
  assert.equal(resolveDeckStride(390), 187.2);
  assert.equal(resolveDeckStride(1024), 210);
});

test('projected swipe intent supports distance and velocity without skipping cards', () => {
  assert.equal(resolveSwipeTarget({ maxIndex: 5, originIndex: 2, translationX: 60, velocityX: 0 }), 1);
  assert.equal(resolveSwipeTarget({ maxIndex: 5, originIndex: 2, translationX: -60, velocityX: 0 }), 3);
  assert.equal(resolveSwipeTarget({ maxIndex: 5, originIndex: 2, translationX: 0, velocityX: 500 }), 1);
  assert.equal(resolveSwipeTarget({ maxIndex: 5, originIndex: 2, translationX: 0, velocityX: -500 }), 3);
  assert.equal(resolveSwipeTarget({ maxIndex: 5, originIndex: 2, translationX: 20, velocityX: 0 }), 2);
});

test('interrupted navigation resolves from the current fractional position and clamps at edges', () => {
  assert.equal(resolveSwipeTarget({ maxIndex: 5, originIndex: 2.6, translationX: -60, velocityX: 0 }), 4);
  assert.equal(resolveSwipeTarget({ maxIndex: 5, originIndex: 0.2, translationX: 90, velocityX: 0 }), 0);
  assert.equal(resolveSwipeTarget({ maxIndex: 5, originIndex: 4.8, translationX: -90, velocityX: 0 }), 5);
});

test('a long live drag stays within a bounded one-card interaction span', () => {
  const farForward = resolveDraggedIndex({ maxIndex: 8, originIndex: 4, stride: 180, translationX: -900 });
  const farBack = resolveDraggedIndex({ maxIndex: 8, originIndex: 4, stride: 180, translationX: 900 });
  assert.ok(farForward > 5.12 && farForward < 6);
  assert.ok(farBack < 2.88 && farBack > 2);
  assert.equal(resolveDraggedIndex({ maxIndex: 8, originIndex: 4, stride: 180, translationX: -90 }), 4.5);
});
