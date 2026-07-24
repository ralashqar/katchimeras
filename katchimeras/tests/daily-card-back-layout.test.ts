import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DAILY_CARD_BACK_RECTS,
  FULL_CARD_DESIGN_HEIGHT,
  CARD_DESIGN_WIDTH,
} from '@/utils/daily-card-layout';

test('daily card back gives Moments most of the card height', () => {
  assert.ok(DAILY_CARD_BACK_RECTS.moments.height >= 1000);
  assert.ok(DAILY_CARD_BACK_RECTS.moments.width >= 750);
});

test('daily card back header and Moments viewport do not overlap', () => {
  const headerBottom = DAILY_CARD_BACK_RECTS.header.y + DAILY_CARD_BACK_RECTS.header.height;
  assert.ok(headerBottom < DAILY_CARD_BACK_RECTS.moments.y);
});

test('daily card back content remains inside the full frame canvas', () => {
  const momentsRight = DAILY_CARD_BACK_RECTS.moments.x + DAILY_CARD_BACK_RECTS.moments.width;
  const momentsBottom = DAILY_CARD_BACK_RECTS.moments.y + DAILY_CARD_BACK_RECTS.moments.height;
  assert.ok(DAILY_CARD_BACK_RECTS.moments.x > 0);
  assert.ok(DAILY_CARD_BACK_RECTS.moments.y > 0);
  assert.ok(momentsRight < CARD_DESIGN_WIDTH);
  assert.ok(momentsBottom < FULL_CARD_DESIGN_HEIGHT);
});
