import assert from 'node:assert/strict';
import test from 'node:test';

import {
  todayTileTransitionIndices,
  todayTileWindowIndices,
} from '../utils/today-tile-window';

test('Today keeps only the selected tile and its immediate neighbors', () => {
  assert.deepEqual(todayTileWindowIndices(3, 7), [2, 3, 4]);
  assert.deepEqual(todayTileWindowIndices(0, 7), [0, 1]);
  assert.deepEqual(todayTileWindowIndices(6, 7), [5, 6]);
});

test('Today retains both endpoint neighborhoods while an adjacent camera move settles', () => {
  assert.deepEqual(todayTileTransitionIndices(2, 3, 7), [1, 2, 3, 4]);
});

test('Today mounts the corridor before a distant top-bar jump begins', () => {
  assert.deepEqual(todayTileTransitionIndices(1, 5, 7), [0, 1, 2, 3, 4, 5, 6]);
});
