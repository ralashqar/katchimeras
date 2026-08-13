import assert from 'node:assert/strict';
import test from 'node:test';

import { formatGameCurrency } from '@/utils/game-currency';
import { enqueueGameFeedback } from '@/utils/game-feedback';

test('currency formatting stays compact and stable', () => {
  assert.equal(formatGameCurrency(42), '42');
  assert.equal(formatGameCurrency(1_250), '1.3k');
  assert.equal(formatGameCurrency(24_900), '25k');
  assert.equal(formatGameCurrency(1_250_000), '1.3m');
  assert.equal(formatGameCurrency(-8), '0');
});

test('feedback receipts deduplicate by stable id and preserve order', () => {
  const first = enqueueGameFeedback([], { id: 'save', message: 'Saved', tone: 'success' }, 'fallback:1');
  const duplicate = enqueueGameFeedback(first, { id: 'save', message: 'Saved again' }, 'fallback:2');
  const second = enqueueGameFeedback(duplicate, { id: 'offline', message: 'Offline', tone: 'danger' }, 'fallback:3');
  assert.deepEqual(second.map((item) => item.id), ['save', 'offline']);
  assert.equal(second[0].durationMs, 1_800);
});
