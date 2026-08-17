import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COMPACT_CARD_ASPECT_RATIO,
  COMPACT_DAILY_CARD_MAX_HEIGHT,
  COMPACT_DAILY_CARD_MAX_WIDTH,
  FULL_CARD_ASPECT_RATIO,
  resolveCompactDailyCardSize,
  resolveCompactDailyCardSizeForWidth,
  resolveDetailDailyCardSize,
} from '@/utils/daily-card-layout';

test('standard Today cards use the compact frame ratio', () => {
  const size = resolveCompactDailyCardSize(390, 540);
  assert.equal(size.width, COMPACT_DAILY_CARD_MAX_WIDTH);
  assert.equal(size.height, COMPACT_DAILY_CARD_MAX_HEIGHT);
  assert.equal(size.width / size.height, COMPACT_CARD_ASPECT_RATIO);
});

test('short-phone Today cards shrink uniformly to the available height', () => {
  const size = resolveCompactDailyCardSize(375, 407);
  assert.equal(size.height, 407);
  assert.ok(size.width < COMPACT_DAILY_CARD_MAX_WIDTH);
  assert.equal(size.width / size.height, COMPACT_CARD_ASPECT_RATIO);
});

test('detail cards retain the frame ratio at their maximum width', () => {
  const size = resolveDetailDailyCardSize(430);
  assert.equal(size.width, 390);
  assert.equal(size.width / size.height, FULL_CARD_ASPECT_RATIO);
});

test('full reveal cards shrink uniformly to the available splash height', () => {
  const size = resolveDetailDailyCardSize(430, 500);
  assert.ok(Math.abs(size.height - 500) < 0.001);
  assert.equal(size.width / size.height, FULL_CARD_ASPECT_RATIO);
});

test('Today card is shorter than the detail card at the same width', () => {
  const compact = resolveCompactDailyCardSize(364, 1000);
  const detail = resolveDetailDailyCardSize(compact.width + 32);
  assert.equal(detail.width, compact.width);
  assert.ok(compact.height < detail.height);
});

test('deck cards preserve the exact compact frame geometry at grid width', () => {
  const size = resolveCompactDailyCardSizeForWidth(164);
  assert.equal(size.width, 164);
  assert.equal(size.height, 164 / COMPACT_CARD_ASPECT_RATIO);
  assert.equal(size.width / size.height, COMPACT_CARD_ASPECT_RATIO);
});
