import assert from 'node:assert/strict';
import test from 'node:test';

import { MAX_MOUNTED_ORDER_TRAYS, orderMountWindow, orderViewportWindows, orderVisibleWindow } from '../utils/merge-world/order-window';

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

test('only visible trays animate, not the mounted prefetch neighbours', () => {
  const visible = orderVisibleWindow(0, 390, 20, 130, 120, 3);
  assert.deepEqual(visible, { start: 0, end: 3 });
  assert.deepEqual(orderMountWindow(1, 20), { start: 0, end: 6 });
  assert.deepEqual(orderVisibleWindow(260, 390, 20, 130, 120, 3), { start: 2, end: 5 });
});

test('viewport detection includes partial cards but excludes gaps and exact outer edges', () => {
  assert.deepEqual(orderVisibleWindow(119, 20, 20, 130, 120), { start: 0, end: 2 });
  assert.deepEqual(orderVisibleWindow(120, 10, 20, 130, 120), { start: 1, end: 1 });
  assert.deepEqual(orderVisibleWindow(130, 120, 20, 130, 120), { start: 1, end: 2 });
  assert.deepEqual(orderVisibleWindow(-30, 120, 20, 130, 120), { start: 0, end: 1 });
});

test('unmeasured, empty and shortened rails cannot keep offscreen effects alive', () => {
  assert.deepEqual(orderVisibleWindow(0, 0, 20, 130, 120), { start: 0, end: 0 });
  assert.deepEqual(orderVisibleWindow(0, 390, 0, 130, 120), { start: 0, end: 0 });
  assert.deepEqual(orderVisibleWindow(260, 390, 3, 130, 120), { start: 2, end: 3 });
  assert.deepEqual(orderVisibleWindow(900, 390, 3, 130, 120), { start: 3, end: 3 });
});

test('all visible cards fit in the six-card mount budget across supported phone/tablet widths', () => {
  for (const width of [280, 390, 430, 600]) {
    for (let offset = 0; offset <= 20 * 130 - width; offset += 7) {
      const { visible, mounted } = orderViewportWindows(offset, width, 20, 130, 120, 3);
      assert.ok(visible.start >= mounted.start && visible.end <= mounted.end, JSON.stringify({ width, offset, visible, mounted }));
    }
  }
});
