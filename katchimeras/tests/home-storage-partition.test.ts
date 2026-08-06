import assert from 'node:assert/strict';
import test from 'node:test';

import type { StoredHomeState } from '@/types/home';
import { mergeStoredHomeState, splitStoredHomeState } from '@/utils/home-storage-partition';

test('home persistence partition round-trips without copying archive into active state', () => {
  const archivedDay = { id: 'archived', isoDate: '2026-08-04' } as StoredHomeState['archivedDays'][number];
  const state = {
    version: 19,
    archivedDays: [archivedDay],
    today: { id: 'today', isoDate: '2026-08-05' },
  } as unknown as StoredHomeState;
  const partition = splitStoredHomeState(state, 4, 2);
  assert.equal('archivedDays' in partition.active.state, false);
  assert.equal(partition.archive.days[0], archivedDay);
  assert.deepEqual(mergeStoredHomeState(partition.active, partition.archive), state);
});

test('home persistence rejects incomplete partition migration', () => {
  const state = {
    version: 19,
    archivedDays: [],
    today: { id: 'today', isoDate: '2026-08-05' },
  } as unknown as StoredHomeState;
  const partition = splitStoredHomeState(state, 1, 1);
  assert.equal(mergeStoredHomeState(partition.active, null), null);
  assert.equal(mergeStoredHomeState(null, partition.archive), null);
});
