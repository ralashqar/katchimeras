import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canonicalDailyCardRotation,
  dailyCardFaceForRotation,
  resolveDailyCardFlipTarget,
  resolveDirectionalDailyCardFlipTarget,
} from '@/utils/daily-card-flip';

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

test('left and right swipes turn the card in their own direction from either face', () => {
  assert.equal(resolveDirectionalDailyCardFlipTarget(0, 72, -80), 180);
  assert.equal(resolveDirectionalDailyCardFlipTarget(0, -72, 80), -180);
  assert.equal(resolveDirectionalDailyCardFlipTarget(180, 252, -80), 360);
  assert.equal(resolveDirectionalDailyCardFlipTarget(-180, -252, 80), -360);
});

test('a directional flick completes a half turn and a short drag settles back', () => {
  assert.equal(resolveDirectionalDailyCardFlipTarget(180, 202, -520), 360);
  assert.equal(resolveDirectionalDailyCardFlipTarget(180, 158, 520), 0);
  assert.equal(resolveDirectionalDailyCardFlipTarget(180, 202, -120), 180);
});

test('accumulated half turns alternate the visible card face', () => {
  assert.equal(dailyCardFaceForRotation(0), 'front');
  assert.equal(dailyCardFaceForRotation(180), 'back');
  assert.equal(dailyCardFaceForRotation(-180), 'back');
  assert.equal(dailyCardFaceForRotation(360), 'front');
  assert.equal(dailyCardFaceForRotation(-360), 'front');
});

test('settled cards canonicalize to an untransformed front or back face', () => {
  assert.equal(canonicalDailyCardRotation(360), 0);
  assert.equal(canonicalDailyCardRotation(-360), 0);
  assert.equal(canonicalDailyCardRotation(180), 180);
  assert.equal(canonicalDailyCardRotation(-180), 180);
});
