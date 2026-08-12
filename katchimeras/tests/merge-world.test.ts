import assert from 'node:assert/strict';
import test from 'node:test';

import { KATCHIMERA_MERGE_PROFILES, MERGE_GENERATORS, MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import type { HomeDayRecord } from '@/types/home';
import type { MergeBoardItem, MergeWorldState } from '@/types/merge-world';
import { BARISTABBIT_CHAPTER_ONE_ORDER_POOL, FEASTLE_ACT_TWO_ORDER_POOL, selectAuthoredCohortOrderKeys } from '@/utils/companion-story';
import { mergeCellCenter, mergeCellFromPoint, mergeCellOrigin, mergeNeighborCellInDirection } from '@/utils/merge-world/board-geometry';
import { mergeActivityRewards } from '@/utils/merge-world/activity-rewards';
import { MERGE_ENERGY_REGEN_CAP, MERGE_INITIAL_ENERGY, mergeJournalRewardPreview } from '@/utils/merge-world/economy-policy';
import {
  createInitialMergeWorldState,
  mergeOrderReady,
  mergeWorldCatalogIssues,
  normalizeMergeWorldState,
  reduceMergeWorld,
} from '@/utils/merge-world/engine';

const NOW = new Date('2026-08-12T12:00:00.000Z').getTime();

test('board geometry renders and hit-tests with one coordinate system', () => {
  const geometry = { columns: 7, rows: 9, cellSize: 43, gap: 4, inset: 9 };
  for (let index = 0; index < 63; index += 1) {
    const origin = mergeCellOrigin(geometry, index);
    const center = mergeCellCenter(geometry, index);
    assert.equal(center.x, origin.x + geometry.cellSize / 2);
    assert.equal(center.y, origin.y + geometry.cellSize / 2);
    assert.equal(mergeCellFromPoint(geometry, center.x, center.y), index);
  }
  assert.equal(mergeNeighborCellInDirection(geometry, 28, -900, 0), null);
  assert.equal(mergeNeighborCellInDirection(geometry, 6, 900, 0), null);
});

test('a new Merge World uses the consolidated Energy economy', () => {
  const state = createInitialMergeWorldState(NOW);
  assert.deepEqual(mergeWorldCatalogIssues(), []);
  assert.equal(state.version, 5);
  assert.equal(state.energy.regenCap, MERGE_ENERGY_REGEN_CAP);
  assert.equal(state.energy.value, MERGE_INITIAL_ENERGY);
  assert.equal(state.energy.regenCap, 50);
  assert.equal(state.energy.value, 20);
  assert.equal(state.board.filter((cell) => !cell.locked).length, 33);
  assert.deepEqual(state.generators, {});
});

test('story unlock adds the Pantry and each tap costs exactly one Energy', () => {
  let state = storyWorld();
  const before = state.energy.value;
  const result = reduceMergeWorld(state, { type: 'tapGenerator', generatorId: 'hearth-pantry', now: NOW + 2, seed: 'first-drop' });
  assert.equal(result.changed, true);
  assert.equal(result.state.energy.value, before - 1);
  assert.ok(result.spawnedCell != null);
  assert.equal(result.state.board[result.spawnedCell!].occupant?.kind, 'item');
  assert.equal(result.state.discoveries.length, 1);
});

test('every Pantry tap is tier one and chooses both chains', () => {
  const base = storyWorld();
  const tiers: number[] = [];
  for (let index = 0; index < 200; index += 1) {
    const result = reduceMergeWorld(base, { type: 'tapGenerator', generatorId: 'hearth-pantry', now: NOW + index + 2, seed: `drop-curve:${index}` });
    const occupant = result.spawnedCell == null ? null : result.state.board[result.spawnedCell].occupant;
    assert.equal(occupant?.kind, 'item');
    if (occupant?.kind === 'item') tiers.push(Number(occupant.definitionId.split(':').at(-1)));
  }
  assert.deepEqual([...new Set(tiers)], [1]);
  const drops = Array.from({ length: 200 }, (_, index) => reduceMergeWorld(base, {
    type: 'tapGenerator', generatorId: 'hearth-pantry', now: NOW + index + 2, seed: `chain-curve:${index}`,
  })).flatMap((result) => result.spawnedCell == null ? [] : [result.state.board[result.spawnedCell].occupant]).filter((occupant): occupant is MergeBoardItem => occupant?.kind === 'item');
  assert.deepEqual([...new Set(drops.map((drop) => drop.definitionId))].sort(), ['food:dessert:1', 'food:table:1']);
  assert.ok(Math.abs(drops.filter((drop) => drop.definitionId === 'food:table:1').length - 100) < 25);
});

test('a full board rejects a Pantry tap without spending Energy', () => {
  const state = storyWorld();
  const board = state.board.map((cell, index) => cell.locked || cell.occupant ? cell : {
    ...cell,
    occupant: item(`fill:${index}`, 'food:table:1'),
  });
  const result = reduceMergeWorld({ ...state, board }, { type: 'tapGenerator', generatorId: 'hearth-pantry', now: NOW + 2, seed: 'full' });
  assert.equal(result.changed, false);
  assert.equal(result.state.energy.value, state.energy.value);
});

test('identical items merge and preserve deterministic item progression', () => {
  let state = withItems(createInitialMergeWorldState(NOW), [
    [29, item('a', 'food:table:1')],
    [30, item('b', 'food:table:1')],
  ]);
  const result = reduceMergeWorld(state, { type: 'move', from: 29, to: 30, now: NOW + 1 });
  assert.equal((result.state.board[30].occupant as MergeBoardItem).definitionId, 'food:table:2');
  assert.equal(result.discoveryId, 'food:table:2');
});

test('Energy regenerates every twenty minutes and stops at the natural capacity', () => {
  const state = { ...createInitialMergeWorldState(NOW), energy: { value: 48, regenCap: 50, lastRegenAt: NOW } };
  const early = reduceMergeWorld(state, { type: 'refreshTime', now: NOW + 19 * 60_000 });
  assert.equal(early.state.energy.value, 48);
  const regenerated = reduceMergeWorld(early.state, { type: 'refreshTime', now: NOW + 40 * 60_000 });
  assert.equal(regenerated.state.energy.value, 50);
});

test('daily journal, companion, and quest rewards are idempotent and limited to twenty Energy', () => {
  const state = { ...createInitialMergeWorldState(NOW), energy: { value: 0, regenCap: 50, lastRegenAt: NOW } };
  const rewards = [
    { receiptId: 'journal:today', kind: 'daily_journal_energy' as const, amount: 10, label: 'Journal', grantDayId: '2026-08-12' },
    { receiptId: 'companion:today', kind: 'daily_companion_energy' as const, amount: 5, label: 'Companion', grantDayId: '2026-08-12' },
    { receiptId: 'quest:today', kind: 'daily_quest_energy' as const, amount: 5, label: 'Quest', grantDayId: '2026-08-12' },
    { receiptId: 'extra:today', kind: 'daily_journal_energy' as const, amount: 10, label: 'Extra', grantDayId: '2026-08-12' },
  ];
  const first = reduceMergeWorld(state, { type: 'grantActivityRewardsBatch', rewards, now: NOW + 1 });
  const duplicate = reduceMergeWorld(first.state, { type: 'grantActivityRewardsBatch', rewards, now: NOW + 2 });
  assert.equal(first.state.energy.value, 20);
  assert.equal(first.energyGranted, 20);
  assert.equal(first.state.activityEnergyByDay['2026-08-12'], 20);
  assert.equal(duplicate.changed, false);
});

test('earned Energy crosses the natural capacity without losing any journal reward', () => {
  const state = { ...createInitialMergeWorldState(NOW), energy: { value: 48, regenCap: 50, lastRegenAt: NOW } };
  const result = reduceMergeWorld(state, {
    type: 'grantActivityRewardsBatch',
    rewards: [{ receiptId: 'journal:overflow', kind: 'daily_journal_energy', amount: 10, label: 'Journal', grantDayId: '2026-08-12' }],
    now: NOW + 1,
  });
  assert.equal(result.energyGranted, 10);
  assert.equal(result.state.energy.value, 58);
  const later = reduceMergeWorld(result.state, { type: 'refreshTime', now: NOW + 10 * 60 * 60_000 });
  assert.equal(later.state.energy.value, 58);
});

test('journal reward preview reports fifteen, ten, five, then zero from the same policy', () => {
  const ordinary = { id: 'ordinary', flowId: 'general', createdAt: '2026-08-12T09:00:00.000Z', source: { kind: 'manual', sourceId: 'ordinary' } };
  const companion = { id: 'companion', flowId: 'general', createdAt: '2026-08-12T10:00:00.000Z', source: { kind: 'manual', sourceId: 'companion', origin: { kind: 'companion_reflection', creatureId: 'c', promptId: 'p', promptText: 'p' } } };
  const day = (journalRecords: unknown[]) => ({ id: 'day', isoDate: '2026-08-12', journalRecords }) as unknown as HomeDayRecord;
  assert.equal(mergeJournalRewardPreview([], { companion: true, now: new Date(NOW) }).totalEnergy, 15);
  assert.equal(mergeJournalRewardPreview([], { companion: false, now: new Date(NOW) }).totalEnergy, 10);
  assert.equal(mergeJournalRewardPreview([day([ordinary])], { companion: true, now: new Date(NOW) }).totalEnergy, 5);
  assert.equal(mergeJournalRewardPreview([day([ordinary, companion])], { companion: true, now: new Date(NOW) }).totalEnergy, 0);
});

test('a Tomorrow Egg companion journal earns its own fifteen Energy immediately', () => {
  const tomorrow = {
    id: 'day-2026-08-13', isoDate: '2026-08-13',
    journalRecords: [{
      id: 'tomorrow-reflection', createdAt: '2026-08-12T14:00:00.000Z',
      source: { kind: 'manual', sourceId: 'tomorrow-reflection', origin: { kind: 'companion_reflection', reflectionMode: 'optional', creatureId: 'barista', familyId: 'baristabbit', promptId: 'pause', promptText: 'Pause' } },
    }],
  } as unknown as HomeDayRecord;
  const rewards = mergeActivityRewards([tomorrow], new Date(NOW));
  assert.deepEqual(rewards.map((reward) => reward.kind), ['daily_journal_energy', 'daily_companion_energy']);
  assert.deepEqual(rewards.map((reward) => reward.grantDayId), ['2026-08-13', '2026-08-13']);
  const result = reduceMergeWorld(createInitialMergeWorldState(NOW), { type: 'grantActivityRewardsBatch', rewards, now: NOW + 1 });
  assert.equal(result.energyGranted, 15);
  assert.equal(result.state.energy.value, 35);
});

test('an ordinary food journal grants Energy without creating a second stock economy', () => {
  const day = {
    id: 'day-2026-08-12', isoDate: '2026-08-12', promptAnswers: [], moments: [], capturedMeanings: [], stepsCount: 0,
    journalRecords: [{ id: 'food-entry', flowId: 'food', createdAt: '2026-08-12T10:00:00.000Z' }],
  } as unknown as HomeDayRecord;
  const rewards = mergeActivityRewards([day], new Date(NOW));
  assert.deepEqual(rewards.map((reward) => reward.kind), ['daily_journal_energy']);
  const result = reduceMergeWorld(createInitialMergeWorldState(NOW), { type: 'grantActivityRewardsBatch', rewards, now: NOW + 1 });
  assert.equal(result.state.rewardInbox.length, 0);
  assert.equal(result.energyGranted, 10);
});

test('claiming a retained legacy activity basket still places both ingredients', () => {
  let state: MergeWorldState = {
    ...createInitialMergeWorldState(NOW),
    rewardInbox: [{ id: 'legacy-basket', createdAt: NOW, items: ['food:table:1', 'food:table:1'], source: 'activity' as const }],
  };
  state = reduceMergeWorld(state, { type: 'claimInbox', entryId: 'legacy-basket', now: NOW + 2 }).state;
  assert.equal(state.rewardInbox.length, 0);
  assert.equal(state.board.filter((cell) => cell.occupant?.kind === 'item').length, 2);
});

test('a companion journal grants the featured family’s two starter chains once', () => {
  const day = {
    id: 'day-2026-08-12', isoDate: '2026-08-12', promptAnswers: [], moments: [], capturedMeanings: [], stepsCount: 0,
    journalRecords: [{
      id: 'pagelet-entry', flowId: 'studio', createdAt: '2026-08-12T10:00:00.000Z',
      source: { kind: 'manual', sourceId: 'handoff', origin: { kind: 'companion_reflection', reflectionMode: 'story', creatureId: 'companion:pagelet', familyId: 'pagelet', promptId: 'merge', promptText: 'A thought worth keeping' } },
    }],
  } as unknown as HomeDayRecord;
  const rewards = mergeActivityRewards([day], new Date(NOW));
  assert.deepEqual(rewards.map((reward) => reward.kind), ['daily_journal_energy', 'daily_companion_energy', 'companion_story_starter']);
  assert.deepEqual(rewards[2].itemDefinitionIds, ['mind:books:1', 'mind:work:1']);
  const first = reduceMergeWorld(createInitialMergeWorldState(NOW), { type: 'grantActivityRewardsBatch', rewards, now: NOW + 1 });
  const duplicate = reduceMergeWorld(first.state, { type: 'grantActivityRewardsBatch', rewards, now: NOW + 2 });
  assert.equal(first.energyGranted, 15);
  assert.equal(first.state.rewardInbox.length, 1);
  assert.equal(duplicate.changed, false);
});

test('one-time story starter supplies survive opening Merge World on a later day', () => {
  const day = {
    id: 'day-2026-08-11', isoDate: '2026-08-11',
    journalRecords: [{
      id: 'baristabbit-story', createdAt: '2026-08-11T10:00:00.000Z',
      source: { kind: 'manual', sourceId: 'handoff', origin: { kind: 'companion_reflection', reflectionMode: 'story', creatureId: 'barista', familyId: 'baristabbit', promptId: 'pause', promptText: 'Pause' } },
    }],
  } as unknown as HomeDayRecord;
  const rewards = mergeActivityRewards([day], new Date(NOW));
  assert.deepEqual(rewards.map((reward) => reward.kind), ['companion_story_starter']);
  assert.deepEqual(rewards[0].itemDefinitionIds, ['drink:hot:1', 'drink:refresh:1']);
});

test('featuring a character preserves every active vertical slice', () => {
  let state = createInitialMergeWorldState(NOW, ['feastle', 'pagelet']);
  state = reduceMergeWorld(state, {
    type: 'reconcileStory', familyId: 'feastle', status: 'order_active', targetLevel: 2, now: NOW + 1,
  }).state;
  state = reduceMergeWorld(state, {
    type: 'reconcileStory', familyId: 'pagelet', status: 'order_active', targetLevel: 6,
    actPhase: 'regular_orders', orderTemplateKeys: ['one', 'two', 'three', 'four', 'five'], now: NOW + 2,
  }).state;
  state = reduceMergeWorld(state, { type: 'featureCharacter', characterId: 'pagelet', now: NOW + 3 }).state;
  assert.equal(state.favouriteCharacterId, 'pagelet');
  assert.equal(state.activeOrders.length, 4);
  assert.deepEqual(new Set(state.activeOrders.map((order) => order.characterId)), new Set(['feastle', 'pagelet']));
});

test('Act Two seeds five authored orders and keeps three visible', () => {
  const keys = ['rainy-warmth', 'forgotten-lunch', 'quiet-company', 'late-shift', 'long-table'];
  const state = reduceMergeWorld(createInitialMergeWorldState(NOW, ['feastle']), {
    type: 'reconcileStory', familyId: 'feastle', status: 'order_active', targetLevel: 6,
    actPhase: 'regular_orders', orderTemplateKeys: keys, servedOrderIds: [], now: NOW + 1,
  }).state;
  assert.equal(state.activeOrders.length, 3);
  assert.deepEqual(state.activeOrders.map((order) => order.id), keys.slice(0, 3).map((key) => `merge-story:feastle:act-2:${key}`));
  assert.ok(state.activeOrders.every((order) => Boolean(order.description)));
  assert.deepEqual(state.activeOrders.map((order) => order.requirements[0].definitionId), [
    'food:table:3', 'food:table:3', 'food:table:4',
  ]);
  assert.deepEqual(state.activeOrders.map((order) => order.requirements.length), [1, 2, 2]);
  assert.ok(FEASTLE_ACT_TWO_ORDER_POOL.filter((order) => 'secondaryDefinitionId' in order || 'guestDefinitionId' in order).length > FEASTLE_ACT_TWO_ORDER_POOL.length / 2);
});

test('only Feastle’s two opening levels request tier-two food', () => {
  const levelTwo = reduceMergeWorld(createInitialMergeWorldState(NOW, ['feastle']), {
    type: 'reconcileStory', familyId: 'feastle', status: 'order_active', targetLevel: 2, now: NOW + 1,
  }).state;
  const levelThree = reduceMergeWorld(levelTwo, {
    type: 'reconcileStory', familyId: 'feastle', status: 'order_active', targetLevel: 3, now: NOW + 2,
  }).state;
  const levelFour = reduceMergeWorld(levelThree, {
    type: 'reconcileStory', familyId: 'feastle', status: 'order_active', targetLevel: 4, now: NOW + 3,
  }).state;
  assert.equal(levelTwo.activeOrders[0].requirements[0].definitionId, 'food:table:2');
  assert.ok(levelThree.activeOrders.some((order) => order.requirements[0].definitionId === 'food:table:2'));
  assert.deepEqual(levelFour.activeOrders.map((order) => order.requirements[0].definitionId), [
    'food:table:3', 'food:dessert:3', 'food:table:4',
  ]);
  assert.ok(FEASTLE_ACT_TWO_ORDER_POOL.every((order) => Number(order.definitionId.split(':').at(-1)) >= 3));
});

test('Act Two reconciliation rotates served orders out and creates the signature feast', () => {
  const keys = ['rainy-warmth', 'forgotten-lunch', 'quiet-company', 'late-shift', 'long-table'];
  let state = createInitialMergeWorldState(NOW, ['feastle']);
  state = reduceMergeWorld(state, {
    type: 'reconcileStory', familyId: 'feastle', status: 'order_active', targetLevel: 6,
    actPhase: 'regular_orders', orderTemplateKeys: keys, servedOrderIds: [`merge-story:feastle:act-2:${keys[0]}`], now: NOW + 1,
  }).state;
  assert.equal(state.activeOrders.length, 3);
  assert.equal(state.activeOrders.some((order) => order.id.endsWith(keys[0])), false);
  state = reduceMergeWorld(state, {
    type: 'reconcileStory', familyId: 'feastle', status: 'order_active', targetLevel: 8,
    actPhase: 'signature_order', orderTemplateKeys: keys, servedOrderIds: keys.map((key) => `merge-story:feastle:act-2:${key}`), now: NOW + 2,
  }).state;
  assert.equal(state.activeOrders.length, 1);
  assert.equal(state.activeOrders[0].id, 'merge-story:feastle:act-2:first-feast');
  assert.equal(state.activeOrders[0].requirements[0].definitionId, 'food:table:6');
  assert.deepEqual(state.activeOrders[0].requirements.map((requirement) => requirement.definitionId), ['food:table:6', 'food:dessert:4']);
});

test('serving a story order consumes its item, refunds Energy, and emits a durable receipt', () => {
  let state = storyWorld();
  const order = state.activeOrders[0];
  state = { ...withItems(state, [[29, item('served', order.requirements[0].definitionId)]]), energy: { ...state.energy, value: 0 } };
  assert.equal(mergeOrderReady(state, order), true);
  const result = reduceMergeWorld(state, { type: 'serveOrder', orderId: order.id, now: NOW + 2 });
  assert.equal(result.servedOrderId, order.id);
  assert.equal(result.state.energy.value, 2);
  assert.ok(result.state.externalRewardReceipts.some((receipt) => receipt.kind === 'story_order_served'));
});

test('legacy snapshots migrate into version five without discarding earned overflow Energy', () => {
  const normalized = normalizeMergeWorldState({
    ...createInitialMergeWorldState(NOW), version: 2,
    energy: { value: 99, cap: 100, lastRegenAt: NOW },
    generators: { 'starter-pantry': { id: 'starter-pantry', familyId: 'food', name: 'Picnic Pantry', level: 1, enabledBranches: ['table'], charges: 9, maxCharges: 12, readyAt: NOW + 1000 } },
  }, NOW + 1);
  assert.equal(normalized.version, 5);
  assert.equal(normalized.energy.regenCap, 50);
  assert.equal(normalized.energy.value, 99);
  assert.deepEqual(Object.keys(normalized.generators['hearth-pantry']).sort(), ['chainIds', 'id', 'level', 'name', 'tierOneDropDefinitionIds']);
  assert.deepEqual(normalized.generators['hearth-pantry'].chainIds, ['food:table', 'food:dessert']);
  assert.deepEqual(normalized.unlockedChains.sort(), ['food:dessert', 'food:table']);
});

test('the shared catalog has eight generators, sixteen chains, and all twenty-five profiles', () => {
  assert.equal(MERGE_GENERATORS.length, 8);
  assert.ok(MERGE_GENERATORS.every((generator) => generator.chainIds.length === 2));
  assert.ok(MERGE_GENERATORS.every((generator) => generator.tierOneDropDefinitionIds.every((id) => id.endsWith(':1'))));
  assert.equal(new Set(MERGE_GENERATORS.flatMap((generator) => generator.chainIds)).size, 16);
  assert.equal(Object.keys(KATCHIMERA_MERGE_PROFILES).length, 25);
  assert.ok(Object.values(KATCHIMERA_MERGE_PROFILES).every((profile) => profile.coreChains.length === 2));
});

test('guest-chain story orders fall back to core until the guest generator is unlocked', () => {
  let state = reduceMergeWorld(createInitialMergeWorldState(NOW, ['baristabbit']), {
    type: 'reconcileStory', familyId: 'baristabbit', status: 'order_active', targetLevel: 6,
    actPhase: 'regular_orders', orderTemplateKeys: ['cake-on-side'], now: NOW + 1,
  }).state;
  assert.deepEqual(Object.keys(state.generators), ['ritual-bar']);
  assert.ok(state.activeOrders[0].requirements.every((requirement) => requirement.definitionId.startsWith('drink:')));
  state = reduceMergeWorld(state, {
    type: 'reconcileStory', familyId: 'feastle', status: 'order_active', targetLevel: 2, now: NOW + 2,
  }).state;
  state = reduceMergeWorld(state, {
    type: 'reconcileStory', familyId: 'baristabbit', status: 'order_active', targetLevel: 6,
    actPhase: 'regular_orders', orderTemplateKeys: ['cake-on-side'], now: NOW + 3,
  }).state;
  assert.ok(state.activeOrders.find((order) => order.characterId === 'baristabbit')?.requirements.some((requirement) => requirement.definitionId.startsWith('food:dessert:')));
});

test('Baristabbit chapter serves five escalating drink orders and a shared-chain signature table', () => {
  const keys = ['first-pour', 'garden-glass', 'two-temperatures', 'cake-on-side', 'window-table'];
  let state = reduceMergeWorld(createInitialMergeWorldState(NOW, ['baristabbit', 'feastle']), {
    type: 'reconcileStory', familyId: 'feastle', status: 'order_active', targetLevel: 2, now: NOW + 1,
  }).state;
  state = reduceMergeWorld(state, {
    type: 'reconcileStory', familyId: 'baristabbit', status: 'order_active', targetLevel: 6,
    actPhase: 'regular_orders', orderTemplateKeys: keys, servedOrderIds: [], now: NOW + 2,
  }).state;
  const baristaOrders = state.activeOrders.filter((order) => order.characterId === 'baristabbit');
  assert.equal(baristaOrders.length, 3);
  assert.equal(baristaOrders[0].requirements[0].definitionId, 'drink:hot:2');
  assert.equal(baristaOrders[1].requirements[0].definitionId, 'drink:refresh:2');
  assert.deepEqual(baristaOrders[2].requirements.map((item) => item.definitionId), ['drink:hot:3', 'drink:refresh:3']);
  assert.ok(BARISTABBIT_CHAPTER_ONE_ORDER_POOL.filter((order) => 'secondaryDefinitionId' in order || 'guestDefinitionId' in order).length >= 7);

  state = reduceMergeWorld(state, {
    type: 'reconcileStory', familyId: 'baristabbit', status: 'order_active', targetLevel: 8,
    actPhase: 'signature_order', orderTemplateKeys: keys,
    servedOrderIds: keys.map((key) => `merge-story:baristabbit:chapter-1:${key}`), now: NOW + 3,
  }).state;
  const signature = state.activeOrders.find((order) => order.characterId === 'baristabbit')!;
  assert.equal(signature.id, 'merge-story:baristabbit:chapter-1:pause-table');
  assert.deepEqual(signature.requirements.map((item) => item.definitionId), ['drink:hot:5', 'drink:refresh:4', 'food:dessert:3']);
  assert.equal(signature.chapterId, 'baristabbit-chapter-1');
});

for (const familyId of ['steppling', 'voyagle', 'flexel', 'bedrotte'] as const) {
  test(`${familyId} chapter serves escalating shared-generator orders and an authored signature`, () => {
    const keys = selectAuthoredCohortOrderKeys(familyId, 'vertical-slice');
    let state = reduceMergeWorld(createInitialMergeWorldState(NOW, [familyId]), {
      type: 'reconcileStory', familyId, status: 'order_active', targetLevel: 6,
      actPhase: 'regular_orders', orderTemplateKeys: keys, servedOrderIds: [], now: NOW + 1,
    }).state;
    const visible = state.activeOrders.filter((order) => order.characterId === familyId);
    assert.equal(visible.length, 3);
    assert.ok(visible[0].requirements[0].definitionId.endsWith(':2'));
    assert.ok(visible[1].requirements[0].definitionId.endsWith(':2'));
    assert.ok(visible[2].requirements.length >= 2);
    const expectedChains = familyId === 'bedrotte'
      ? ['comfort:rest:', 'comfort:care:']
      : familyId === 'flexel'
        ? ['adventure:trail:', 'comfort:care:']
        : ['adventure:trail:', 'adventure:travel:'];
    assert.ok(expectedChains.every((chain) => visible.flatMap((order) => order.requirements)
      .some((item) => item.definitionId.startsWith(chain))));

    state = reduceMergeWorld(state, {
      type: 'reconcileStory', familyId, status: 'order_active', targetLevel: 8,
      actPhase: 'signature_order', orderTemplateKeys: keys,
      servedOrderIds: keys.map((key) => `merge-story:${familyId}:chapter-1:${key}`), now: NOW + 2,
    }).state;
    const signature = state.activeOrders.find((order) => order.characterId === familyId)!;
    assert.equal(signature.signature, true);
    assert.equal(signature.requirements.length, 2);
    assert.ok(signature.requirements.every((item) => expectedChains.some((chain) => item.definitionId.startsWith(chain))));
    assert.equal(signature.storyTargetLevel, 8);
  });
}

function storyWorld(): MergeWorldState {
  return reduceMergeWorld(createInitialMergeWorldState(NOW, ['feastle']), {
    type: 'reconcileStory', familyId: 'feastle', status: 'order_active', targetLevel: 2, now: NOW + 1,
  }).state;
}

function item(instanceId: string, definitionId: string): MergeBoardItem {
  assert.ok(MERGE_ITEMS_BY_ID.has(definitionId));
  return { kind: 'item', instanceId, definitionId };
}

function withItems(state: MergeWorldState, placements: Array<[number, MergeBoardItem]>): MergeWorldState {
  const board = [...state.board];
  for (const [cell, boardItem] of placements) board[cell] = { ...board[cell], locked: false, occupant: boardItem };
  return { ...state, board };
}
