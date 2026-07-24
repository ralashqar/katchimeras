import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveDailyCardFlipTarget } from '@/utils/daily-card-flip';

test('card flip settles to the closest face when released slowly', () => {
  assert.equal(resolveDailyCardFlipTarget(89, 0), 0);
  assert.equal(resolveDailyCardFlipTarget(90, 0), 180);
  assert.equal(resolveDailyCardFlipTarget(135, 0), 180);
});

test('a purposeful swipe can complete the flip before the midpoint', () => {
  assert.equal(resolveDailyCardFlipTarget(55, -420), 180);
  assert.equal(resolveDailyCardFlipTarget(125, 420), 0);
});

test('small release velocity does not override the nearest face', () => {
  assert.equal(resolveDailyCardFlipTarget(35, -80), 0);
  assert.equal(resolveDailyCardFlipTarget(145, 80), 180);
});
