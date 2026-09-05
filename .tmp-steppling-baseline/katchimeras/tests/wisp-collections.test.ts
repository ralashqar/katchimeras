import assert from 'node:assert/strict';
import test from 'node:test';

import { WISP_COLLECTIONS } from '@/constants/wisp-collections';
import type { WispCollectionState } from '@/types/wisp';
import { nextWispEvolution, wispCollectionProgress, wispEvolutionTier } from '@/utils/wisp-collections';
import { EMPTY_WISP_STATE } from '@/utils/wisp-state';

test('duplicate quantities evolve through fixed visual tiers', () => {
  assert.equal(wispEvolutionTier(1), 'common');
  assert.equal(wispEvolutionTier(3), 'uncommon');
  assert.equal(wispEvolutionTier(7), 'rare');
  assert.deepEqual(nextWispEvolution(6), { tier: 'rare', remaining: 1 });
  assert.equal(nextWispEvolution(30), null);
});

test('album completion uses the existing Wisp inventory', () => {
  const definition = WISP_COLLECTIONS[2];
  const inventory = Object.fromEntries(definition.wispIds.map((id, index) => [id, {
    wispId: id,
    quantity: index === 0 ? 3 : 1,
    sources: ['experience'],
    firstGrantedAt: 1,
    giftableQuantity: index === 0 ? 2 : 0,
  }]));
  const state = { ...EMPTY_WISP_STATE, inventory } as WispCollectionState;
  assert.deepEqual(wispCollectionProgress(definition, state), { owned: definition.wispIds.length, total: definition.wispIds.length, complete: true, evolved: 1 });
});
