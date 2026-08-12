import assert from 'node:assert/strict';
import test from 'node:test';

import { accumulateQuietBond, nextFeastleBundleOrderId } from '@/utils/companion-story';

const order = (step: number) => `merge-story:feastle:chapter-1:level-4:order-${step}`;

test('Feastle three-dish chapter advances to a remaining tray without requesting chat early', () => {
  assert.equal(nextFeastleBundleOrderId([order(1)], 4, 3), order(2));
  assert.equal(nextFeastleBundleOrderId([order(2)], 4, 3), order(1));
  assert.equal(nextFeastleBundleOrderId([order(1), order(2)], 4, 3), order(3));
  assert.equal(nextFeastleBundleOrderId([order(1), order(2), order(3)], 4, 3), null);
});

test('quiet story bond rolls into one idempotent chapter summary', () => {
  const first = accumulateQuietBond(0, [], 'merge-friendship:order-1', 2);
  assert.deepEqual(first, {
    points: 2,
    processedReceiptIds: ['merge-friendship:order-1'],
    changed: true,
  });

  const duplicate = accumulateQuietBond(first.points, first.processedReceiptIds, 'merge-friendship:order-1', 2);
  assert.equal(duplicate.points, 2);
  assert.equal(duplicate.changed, false);

  const second = accumulateQuietBond(duplicate.points, duplicate.processedReceiptIds, 'merge-friendship:order-2', 3);
  assert.equal(second.points, 5);
  assert.deepEqual(second.processedReceiptIds, ['merge-friendship:order-1', 'merge-friendship:order-2']);
});
