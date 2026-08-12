import assert from 'node:assert/strict';
import test from 'node:test';

import { MAX_MOUNTED_ORDER_TRAYS, orderMountWindow } from '../utils/merge-world/order-window';

test('the order rail mounts no more than six trays around its visible centre', () => {
  assert.deepEqual(orderMountWindow(0, 20), { start: 0, end: 6 });
  assert.deepEqual(orderMountWindow(9, 20), { start: 6, end: 12 });
  assert.deepEqual(orderMountWindow(19, 20), { start: 14, end: 20 });
  assert.equal(orderMountWindow(9, 20).end - orderMountWindow(9, 20).start, MAX_MOUNTED_ORDER_TRAYS);
});

test('short and empty rails mount only the entries they contain', () => {
  assert.deepEqual(orderMountWindow(2, 4), { start: 0, end: 4 });
  assert.deepEqual(orderMountWindow(0, 0), { start: 0, end: 0 });
});
