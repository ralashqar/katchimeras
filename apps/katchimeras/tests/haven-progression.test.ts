import assert from 'node:assert/strict';
import { readFileSync } from './helpers/content-fs';
import test from 'node:test';

import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { mossproutFtueStep } from '@/features/onboarding/mossprout-ftue-script';
import type { MergeWorldState, MossproutNatureIslandLevel } from '@/types/merge-world';
import { prioritizedVisibleMergeOrders } from '@/utils/merge-world/order-presentation';
import { MOSSPROUT_NATURE_ISLAND_IDS, mossproutNatureIslandById } from '@/constants/mossprout-nature-islands';
import { PETALIMP_BLOOM_CAMPAIGN, PETALIMP_ISLAND_CAMPAIGN_ID, petalimpIslandChapterOrder } from '@/constants/petalimp-island-campaign';
import { ISLAND_CAMPAIGNS } from '@/constants/island-campaigns/registry';
import { ISLAND_WAKE_ORDER, islandWakeState } from '@/constants/island-campaigns/wake-order';
import { acknowledgeChapterReturn, completeChapter, completeIslandCampaign, completeRestoration, greetIslandFriend, restoreIslandLevel, revealIsland, startAndServeChapter } from './helpers/island-campaign';
import { MOSSPROUT_FTUE_FLOW } from '@/features/onboarding/mossprout-ftue-flow';
import { mossproutFtueGardenMissionOrder } from '@/utils/merge-world/chapter-zero-policy';
import { GARDEN_PLANT_SLOT_POSITIONS, MOSSPROUT_FIRST_MEMORY_SLOT_ID, mossproutGardenPlantSlotFrame } from '@/utils/mossprout-garden-layout';
import { worldTileActionFrame } from '@/utils/world-tile-action-layout';
import { reduceFirstFtueMemoryPlacement } from '@/utils/merge-world/first-ftue-memory';

const NOW = Date.UTC(2026, 7, 18, 12);

function mossproutWorld(): MergeWorldState {
  const fresh = createInitialMergeWorldState(NOW, ['mossprout']);
  return {
    ...fresh,
    coins: 2_000,
    characterProgress: {
      ...fresh.characterProgress,
      mossprout: { friendshipLevel: 4, completedChapterIds: ['mossprout-chapter-0'] },
    },
  };
}

function completeBloomCampaignRequest(state: MergeWorldState, level: MossproutNatureIslandLevel) {
  const order = petalimpIslandChapterOrder(level, NOW)!;
  const activated = reduceMergeWorld(state, {
    type: 'activateIslandCampaignChapter', campaignId: PETALIMP_ISLAND_CAMPAIGN_ID,
    islandId: 'bloom-garden', residentSkinId: 'petalimp', level, orders: [order], now: NOW,
  }).state;
  const campaign = activated.islandCampaigns![PETALIMP_ISLAND_CAMPAIGN_ID]!;
  const chapter = campaign.chapters[String(level)]!;
  return { ...activated, islandCampaigns: { ...activated.islandCampaigns, [PETALIMP_ISLAND_CAMPAIGN_ID]: {
    ...campaign, chapters: { ...campaign.chapters, [String(level)]: { ...chapter, servedOrderIds: [...chapter.orderIds] } },
  } } };
}

test('first memory targets the measured front-center circular bed and its button stays below the rim', () => {
  const source = { left: 0, top: 0, width: 1024, height: 1024 };
  const patch = mossproutGardenPlantSlotFrame(source, MOSSPROUT_FIRST_MEMORY_SLOT_ID);
  assert.ok(Math.abs(patch.left - 440.32) < 1e-8);
  assert.ok(Math.abs(patch.top - 560.128) < 1e-8);
  assert.equal(patch.width, 143.36);
  assert.equal(patch.height, 92.16);
  const centre = GARDEN_PLANT_SLOT_POSITIONS[MOSSPROUT_FIRST_MEMORY_SLOT_ID]!;
  assert.equal(centre.x, 0.5);
  assert.equal(centre.y, 0.592);
  for (const scale of [0.35, 1, 1.28, 2.7]) {
    const garden = { left: -173, top: 211, width: 1024 * scale, height: 1024 * scale };
    const projectedPatch = mossproutGardenPlantSlotFrame(garden, MOSSPROUT_FIRST_MEMORY_SLOT_ID);
    const button = worldTileActionFrame(projectedPatch, { width: 206, height: 44 }, { placement: 'below', gap: 12 });
    const contactX = garden.left + garden.width * centre.x;
    const contactY = garden.top + garden.height * centre.y;
    assert.ok(contactX > projectedPatch.left && contactX < projectedPatch.left + projectedPatch.width);
    assert.ok(contactY > projectedPatch.top && contactY < projectedPatch.top + projectedPatch.height);
    assert.ok(Math.abs(button.top - (projectedPatch.top + projectedPatch.height) - 12) < 1e-8);
    assert.ok(Math.abs(button.left + button.width / 2 - (projectedPatch.left + projectedPatch.width / 2)) < 1e-8);
  }
  // Restore retains its existing in-tile anchor; only planting uses 'below'.
  assert.deepEqual(worldTileActionFrame(source, { width: 206, height: 44 }, {}), {
    left: 409, top: 1024 * 0.76 - 22, width: 206, height: 44,
  });
});

test('first-memory live effect and recovery share one slot regardless of execution order', () => {
  const earned = reduceMergeWorld(mossproutWorld(), {
    type: 'grantPlantableMemory', definitionId: 'momentum', source: { kind: 'ftue', sourceId: 'run-1' }, receiptId: 'grant-1', now: NOW,
  }).state;
  for (const keys of [['live-effect', 'ui-recovery'], ['ui-recovery', 'live-effect']]) {
    const first = reduceFirstFtueMemoryPlacement(earned, 'run-1', keys[0], NOW + 1);
    assert.equal(first.state.haven.plantableMemories[0].slotId, MOSSPROUT_FIRST_MEMORY_SLOT_ID);
    const second = reduceFirstFtueMemoryPlacement(first.state, 'run-1', keys[1], NOW + 2);
    assert.equal(second.changed, false);
    assert.equal(second.state, first.state);
    assert.equal(second.state.haven.plantableMemories.length, 1);
  }
  // Reproduce the previous bug: recovery centres it, then the old effect moves
  // it left. The already-used old receipt must not prevent the new repair.
  const centred = reduceMergeWorld(earned, {
    type: 'placePlantableMemory', instanceId: 'memory-plant:grant-1', slotId: 'back-centre', receiptId: 'repair:back-centre', now: NOW + 1,
  }).state;
  const displaced = reduceMergeWorld(centred, {
    type: 'placePlantableMemory', instanceId: 'memory-plant:grant-1', slotId: 'front-left', receiptId: 'legacy-effect', now: NOW + 2,
  }).state;
  const repaired = reduceFirstFtueMemoryPlacement(displaced, 'run-1', 'repair', NOW + 3);
  assert.equal(repaired.changed, true);
  assert.equal(repaired.state.haven.plantableMemories[0].slotId, MOSSPROUT_FIRST_MEMORY_SLOT_ID);
  assert.equal(repaired.state.haven.plantableMemories[0].plantedAt, NOW + 1);
  assert.equal(reduceFirstFtueMemoryPlacement(repaired.state, 'run-1', 'repair', NOW + 4).changed, false);
});

test('memory plants grant, plant, swap, and grow exactly once across six durable plots', () => {
  let state = mossproutWorld();
  const granted = reduceMergeWorld(state, {
    type: 'grantPlantableMemory', definitionId: 'momentum', source: { kind: 'ftue', sourceId: 'run-1' }, receiptId: 'grant-1', now: NOW + 1,
  });
  assert.equal(granted.changed, true);
  state = granted.state;
  const plantId = 'memory-plant:grant-1';
  assert.equal(reduceMergeWorld(state, {
    type: 'grantPlantableMemory', definitionId: 'momentum', source: { kind: 'ftue', sourceId: 'run-1' }, receiptId: 'grant-1', now: NOW + 2,
  }).changed, false);
  state = reduceMergeWorld(state, { type: 'placePlantableMemory', instanceId: plantId, slotId: 'front-centre', receiptId: 'place-1', now: NOW + 3 }).state;
  state = reduceMergeWorld(state, { type: 'growPlantableMemory', instanceId: plantId, amount: 1, receiptId: 'grow-1', now: NOW + 4 }).state;
  assert.equal(state.haven.plantableMemories[0].slotId, 'front-centre');
  assert.equal(state.haven.plantableMemories[0].growthPoints, 1);
  assert.equal(reduceMergeWorld(state, { type: 'growPlantableMemory', instanceId: plantId, amount: 1, receiptId: 'grow-1', now: NOW + 5 }).changed, false);

  state = reduceMergeWorld(state, {
    type: 'grantPlantableMemory', definitionId: 'stillness', source: { kind: 'journey', sourceId: 'day-2' }, receiptId: 'grant-2', now: NOW + 6,
  }).state;
  state = reduceMergeWorld(state, { type: 'placePlantableMemory', instanceId: 'memory-plant:grant-2', slotId: 'front-centre', receiptId: 'place-2', now: NOW + 7 }).state;
  assert.equal(state.haven.plantableMemories.find((plant) => plant.id === plantId)?.slotId, null);
  assert.equal(state.haven.plantableMemories.find((plant) => plant.id === 'memory-plant:grant-2')?.slotId, 'front-centre');
});

test('Garden structure, spring, path, and movement egg advance independently with receipts', () => {
  let state = mossproutWorld();
  state = reduceMergeWorld(state, { type: 'upgradeHavenStructure', structureId: 'mossprout-garden', level: 1, receiptId: 'garden-1', now: NOW + 1 }).state;
  state = reduceMergeWorld(state, { type: 'upgradeHavenFeature', structureId: 'mossprout-garden', featureId: 'spring', level: 1, receiptId: 'spring-1', now: NOW + 2 }).state;
  assert.equal(state.haven.structures.mossproutGarden.level, 1);
  assert.equal(state.haven.structures.mossproutGarden.featureLevels.spring, 1);
  assert.equal(state.haven.structures.mossproutGarden.featureLevels.path, 0);
  state = reduceMergeWorld(state, { type: 'revealMovementEgg', receiptId: 'egg-reveal', now: NOW + 3 }).state;
  state = reduceMergeWorld(state, { type: 'recordMovementEggProgress', manualMovement: true, receiptId: 'egg-manual', now: NOW + 4 }).state;
  assert.equal(state.haven.movementEgg.status, 'stirring');
  assert.equal(state.haven.movementEgg.manualMovementLogs, 1);
});

test('legacy post-FTUE Bloom requests pay Glow without silently upgrading or revealing an Egg', () => {
  let state = reduceMergeWorld(mossproutWorld(), {
    type: 'upgradeHavenTile', characterId: 'mossprout', stage: 1, economyMode: 'free', receiptId: 'first-bloom', now: NOW + 1,
  }).state;
  const mission = mossproutFtueGardenMissionOrder(NOW + 2);
  state = {
    ...state,
    activeOrders: [mission],
    board: state.board.map((cell, index) => index === 0 ? {
      ...cell,
      occupant: { kind: 'item', instanceId: 'post-ftue-bloom', definitionId: 'nature:garden:3' },
    } : cell),
  };

  const completed = reduceMergeWorld(state, { type: 'serveOrder', orderId: mission.id, now: NOW + 3 });
  assert.equal(completed.changed, true);
  assert.equal(completed.state.activeOrders.some((order) => order.id === mission.id), false);
  assert.deepEqual(completed.state.haven.structures, state.haven.structures);
  assert.deepEqual(completed.state.haven.movementEgg, state.haven.movementEgg);
  assert.equal(completed.state.haven.revealState, state.haven.revealState);
  assert.equal(completed.state.coins, state.coins + 20);
  assert.equal(completed.state.haven.mutationReceipts.filter((receipt) => receipt.id.startsWith(mission.id)).length, 0);
});

test('authored Haven upgrades are atomic, economy-explicit, and idempotent by receipt', () => {
  const initial = { ...mossproutWorld(), coins: 0 };
  const gifted = reduceMergeWorld(initial, {
    type: 'upgradeHavenTile',
    characterId: 'mossprout',
    stage: 1,
    receiptId: 'flow:ftue:restore',
    economyMode: 'free',
    now: NOW + 1,
  });
  assert.equal(gifted.changed, true);
  assert.equal(gifted.state.coins, 0);
  assert.equal(gifted.storyWorldMutationReceipt?.coinCost, 0);
  assert.equal(gifted.storyWorldMutationReceipt?.economyMode, 'free');

  const duplicate = reduceMergeWorld(gifted.state, {
    type: 'upgradeHavenTile',
    characterId: 'mossprout',
    stage: 1,
    receiptId: 'flow:ftue:restore',
    economyMode: 'free',
    now: NOW + 2,
  });
  assert.equal(duplicate.changed, false);
  assert.equal(duplicate.state.revision, gifted.state.revision);
  assert.deepEqual(duplicate.storyWorldMutationReceipt, gifted.storyWorldMutationReceipt);
  assert.equal(duplicate.state.storyWorldMutationReceipts.length, 1);

  let islandState = reduceMergeWorld(mossproutWorld(), { type: 'upgradeHavenTile', characterId: 'mossprout', stage: 1, now: NOW + 3 }).state;
  islandState = greetIslandFriend(revealIsland(islandState, PETALIMP_BLOOM_CAMPAIGN, NOW + 3), PETALIMP_BLOOM_CAMPAIGN, NOW + 3);
  islandState = acknowledgeChapterReturn(startAndServeChapter(islandState, PETALIMP_BLOOM_CAMPAIGN, 1, NOW + 3), PETALIMP_BLOOM_CAMPAIGN, 1, NOW + 3);
  islandState = completeRestoration(islandState, PETALIMP_BLOOM_CAMPAIGN, 1, NOW + 3);
  islandState = completeChapter(restoreIslandLevel(islandState, PETALIMP_BLOOM_CAMPAIGN, 1, NOW + 3), PETALIMP_BLOOM_CAMPAIGN, 1, NOW + 3);
  // A friend's chapter never costs Glow: its beds open free, and the island then grows only for free.
  const beforeStage = islandState.coins;
  islandState = acknowledgeChapterReturn(startAndServeChapter(islandState, PETALIMP_BLOOM_CAMPAIGN, 2, NOW + 4), PETALIMP_BLOOM_CAMPAIGN, 2, NOW + 4);
  assert.equal(islandState.coins, beforeStage);
  assert.equal(islandState.islandCampaigns![PETALIMP_ISLAND_CAMPAIGN_ID]!.chapters['2']!.restoration?.paidCoins, 0);
  islandState = completeRestoration(islandState, PETALIMP_BLOOM_CAMPAIGN, 2, NOW + 4);
  islandState = { ...islandState, coins: 0 };
  // Whatever economy the authored flow carries, a paid stage neither charges nor grants.
  const grown = reduceMergeWorld(islandState, {
    type: 'upgradeMossproutNatureIsland',
    islandId: 'bloom-garden',
    level: 2,
    receiptId: 'flow:journey:bloom-garden',
    economyMode: 'grant',
    grantedCoins: 60,
    now: NOW + 5,
  });
  assert.equal(grown.changed, true);
  assert.equal(grown.state.coins, 0);
  assert.equal(grown.storyWorldMutationReceipt?.coinCost, 0);
  assert.equal(grown.storyWorldMutationReceipt?.economyMode, 'free');
});

test('nature island upgrades reject skips, duplicate commands, and insufficient Glow', () => {
  let state = mossproutWorld();
  state = reduceMergeWorld(state, { type: 'upgradeHavenTile', characterId: 'mossprout', stage: 1, now: NOW + 1 }).state;
  // A friend's mist lifts with no Glow at all.
  assert.equal(reduceMergeWorld({ ...state, coins: 0 }, { type: 'revealMossproutNatureIsland', islandId: 'bloom-garden', campaignId: PETALIMP_ISLAND_CAMPAIGN_ID,
    residentSkinId: 'petalimp', cost: 40, receiptId: 'poor', now: NOW + 1 }).changed, true);
  state = greetIslandFriend(revealIsland(state, PETALIMP_BLOOM_CAMPAIGN, NOW + 1), PETALIMP_BLOOM_CAMPAIGN, NOW + 1);
  assert.equal(reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId: 'bloom-garden', level: 1, economyMode: 'free', now: NOW + 1 }).changed, false,
    'the friend must be asked before the gift restoration');
  state = acknowledgeChapterReturn(startAndServeChapter(state, PETALIMP_BLOOM_CAMPAIGN, 1, NOW + 1), PETALIMP_BLOOM_CAMPAIGN, 1, NOW + 1);
  assert.equal(reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId: 'bloom-garden', level: 3, now: NOW + 2 }).changed, false);
  assert.equal(reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId: 'bloom-garden', level: 1, now: NOW + 2 }).changed, false,
    'the first restoration is a gift, never a purchase');
  assert.equal(reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId: 'bloom-garden', level: 1, economyMode: 'free', now: NOW + 2 }).changed, false,
    'the gift waits for the beds');
  state = completeRestoration(state, PETALIMP_BLOOM_CAMPAIGN, 1, NOW + 2);
  state = completeChapter(restoreIslandLevel(state, PETALIMP_BLOOM_CAMPAIGN, 1, NOW + 2), PETALIMP_BLOOM_CAMPAIGN, 1, NOW + 2);
  // The second stage's beds open with no Glow at all.
  state = acknowledgeChapterReturn(startAndServeChapter({ ...state, coins: 0 }, PETALIMP_BLOOM_CAMPAIGN, 2, NOW + 3), PETALIMP_BLOOM_CAMPAIGN, 2, NOW + 3);
  assert.equal(state.coins, 0);
  state = completeRestoration(state, PETALIMP_BLOOM_CAMPAIGN, 2, NOW + 4);
  const upgraded = reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId: 'bloom-garden', level: 2, now: NOW + 6 });
  assert.equal(upgraded.changed, true, 'the level flow’s normal economy still grows a paid stage');
  assert.equal(upgraded.state.coins, 0, 'never charged twice');
  assert.equal(reduceMergeWorld(upgraded.state, { type: 'upgradeMossproutNatureIsland', islandId: 'bloom-garden', level: 2, economyMode: 'free', now: NOW + 7 }).changed, false);
});

test('v13 Mossprout saves reset into the current personal-world contract', () => {
  const current = mossproutWorld();
  const legacy = { ...current, version: 13, haven: undefined };
  const migrated = normalizeMergeWorldState(legacy, NOW);
  assert.equal(migrated.version, 25);
  assert.equal(migrated.ownerCharacterId, 'mossprout');
  assert.equal(migrated.haven.tileStages.mossprout, undefined);
  assert.equal(migrated.haven.revealState, 'hidden');
});

