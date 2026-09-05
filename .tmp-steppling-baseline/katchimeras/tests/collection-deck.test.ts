import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveCollectionDeckWindow } from '@/utils/collection-deck';

test('collection deck renders a bounded window around its centered card', () => {
  assert.deepEqual(resolveCollectionDeckWindow(20, 10), [7, 8, 9, 10, 11, 12, 13]);
});

test('collection deck window stays inside the first and last card', () => {
  assert.deepEqual(resolveCollectionDeckWindow(20, 0), [0, 1, 2, 3]);
  assert.deepEqual(resolveCollectionDeckWindow(20, 19), [16, 17, 18, 19]);
});

test('collection deck window handles empty and invalid selections safely', () => {
  assert.deepEqual(resolveCollectionDeckWindow(0, 0), []);
  assert.deepEqual(resolveCollectionDeckWindow(3, -8), [0, 1, 2]);
  assert.deepEqual(resolveCollectionDeckWindow(3, 80), [0, 1, 2]);
});
