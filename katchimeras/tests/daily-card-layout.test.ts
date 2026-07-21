import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CARD_ASPECT_RATIO,
  COMPACT_DAILY_CARD_MAX_HEIGHT,
  resolveCompactDailyCardSize,
  resolveDetailDailyCardSize,
} from '@/utils/daily-card-layout';

test('standard Today cards use the full native frame size', () => {
  const size = resolveCompactDailyCardSize(390, 540);
  assert.equal(size.width, 276);
  assert.equal(size.height, COMPACT_DAILY_CARD_MAX_HEIGHT);
  assert.equal(size.width / size.height, CARD_ASPECT_RATIO);
});

test('short-phone Today cards shrink uniformly to the available height', () => {
  const size = resolveCompactDailyCardSize(375, 407);
  assert.equal(size.height, 407);
  assert.ok(size.width < 276);
  assert.equal(size.width / size.height, CARD_ASPECT_RATIO);
});

test('detail cards retain the frame ratio at their maximum width', () => {
  const size = resolveDetailDailyCardSize(430);
  assert.equal(size.width, 390);
  assert.equal(size.width / size.height, CARD_ASPECT_RATIO);
});
