import assert from 'node:assert/strict';
import test from 'node:test';

import { accumulateQuietBond, AUTHORED_COHORT_ORDER_POOLS, BARISTABBIT_CHAPTER_ONE_ORDER_POOL, nextFeastleBundleOrderId, selectAuthoredCohortOrderKeys, selectBaristabbitChapterOrderKeys } from '@/utils/companion-story';

const order = (step: number) => `merge-story:feastle:chapter-1:level-4:order-${step}`;

test('Feastle three-dish chapter advances to a remaining tray without requesting chat early', () => {
  assert.equal(nextFeastleBundleOrderId([order(1)], 4, 3), order(2));
  assert.equal(nextFeastleBundleOrderId([order(2)], 4, 3), order(1));
  assert.equal(nextFeastleBundleOrderId([order(1), order(2)], 4, 3), order(3));
  assert.equal(nextFeastleBundleOrderId([order(1), order(2), order(3)], 4, 3), null);
});

for (const familyId of ['steppling', 'voyagle', 'flexel', 'bedrotte'] as const) {
  test(`${familyId} chapter opens with two tier-two orders then escalates into shared multi-item journeys`, () => {
    const selected = selectAuthoredCohortOrderKeys(familyId, 'journey-seed');
    assert.equal(selected.length, 5);
    assert.equal(new Set(selected).size, 5);
    const orders = selected.map((key) => AUTHORED_COHORT_ORDER_POOLS[familyId].find((item) => item.key === key)!);
    assert.ok(orders.slice(0, 2).every((item) => item.definitionId.endsWith(':2')));
    assert.ok(orders.slice(2).every((item) => item.difficulty === 'medium' || item.difficulty === 'major'));
    assert.ok(orders.slice(2).every((item) => 'secondaryDefinitionId' in item));
    const expectedChains = familyId === 'bedrotte'
      ? ['comfort:rest:', 'comfort:care:']
      : familyId === 'flexel'
        ? ['adventure:trail:', 'comfort:care:']
        : ['adventure:trail:', 'adventure:travel:'];
    assert.ok(expectedChains.every((chain) => orders.some((item) => item.definitionId.startsWith(chain)
      || ('secondaryDefinitionId' in item && item.secondaryDefinitionId.startsWith(chain)))));
  });
}

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

test('Baristabbit chapter selection always opens simply, then escalates to multi-item service', () => {
  const selected = selectBaristabbitChapterOrderKeys('chapter-seed');
  assert.equal(selected.length, 5);
  assert.deepEqual(selected.slice(0, 2), ['first-pour', 'garden-glass']);
  assert.equal(selected[2], 'cake-on-side');
  assert.equal(new Set(selected).size, 5);
  const orders = selected.map((key) => BARISTABBIT_CHAPTER_ONE_ORDER_POOL.find((item) => item.key === key)!);
  assert.ok(orders.slice(2).every((item) => item.difficulty === 'medium' || item.difficulty === 'major'));
  assert.ok(orders.some((item) => 'secondaryDefinitionId' in item || 'guestDefinitionId' in item));
});
