import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { mossproutFtueStep } from '@/features/onboarding/mossprout-ftue-script';
import type { MergeWorldState } from '@/types/merge-world';
import { prioritizedVisibleMergeOrders } from '@/utils/merge-world/order-presentation';
import { MOSSPROUT_NATURE_ISLAND_IDS } from '@/constants/mossprout-nature-islands';
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

test('first memory targets the measured central soil bed and its button stays below the rim', () => {
  const source = { left: 0, top: 0, width: 1024, height: 1024 };
  const patch = mossproutGardenPlantSlotFrame(source, MOSSPROUT_FIRST_MEMORY_SLOT_ID);
  assert.deepEqual(patch, { left: 442, top: 270, width: 220, height: 154 });
  const centre = GARDEN_PLANT_SLOT_POSITIONS[MOSSPROUT_FIRST_MEMORY_SLOT_ID];
  assert.equal(centre.x * 1024, 550);
  assert.equal(centre.y * 1024, 350);
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

test('the first Haven restoration is linear, story-gated, and keeps neighbouring islands veiled', () => {
  let state = mossproutWorld();
  const skipped = reduceMergeWorld(state, { type: 'upgradeHavenTile', characterId: 'mossprout', stage: 2, now: NOW + 1 });
  assert.equal(skipped.changed, false);

  const first = reduceMergeWorld(state, { type: 'upgradeHavenTile', characterId: 'mossprout', stage: 1, now: NOW + 2 });
  assert.equal(first.changed, true);
  assert.equal(first.state.haven.tileStages.mossprout, 1);
  assert.equal(first.state.coins, 1_980);
  assert.equal(first.state.haven.revealState, 'first_restore_complete');
  assert.deepEqual(Object.values(first.state.haven.mossproutNatureIslands), [0, 0, 0, 0, 0, 0]);
  state = reduceMergeWorld(first.state, { type: 'reconcileHavenStory', characterId: 'mossprout', storyLevel: 2, now: NOW + 4 }).state;
  assert.equal(reduceMergeWorld(state, { type: 'upgradeHavenTile', characterId: 'mossprout', stage: 2, now: NOW + 5 }).changed, false);
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
  islandState = reduceMergeWorld(islandState, { type: 'upgradeMossproutNatureIsland', islandId: 'seed-nursery', level: 1, now: NOW + 3 }).state;
  islandState = reduceMergeWorld(islandState, { type: 'reconcileHavenStory', characterId: 'mossprout', storyLevel: 2, now: NOW + 4 }).state;
  islandState = { ...islandState, coins: 0 };
  const granted = reduceMergeWorld(islandState, {
    type: 'upgradeMossproutNatureIsland',
    islandId: 'seed-nursery',
    level: 2,
    receiptId: 'flow:journey:seed-nursery',
    economyMode: 'grant',
    grantedCoins: 60,
    now: NOW + 5,
  });
  assert.equal(granted.changed, true);
  assert.equal(granted.state.coins, 0);
  assert.equal(granted.storyWorldMutationReceipt?.coinCost, 60);
  assert.equal(granted.storyWorldMutationReceipt?.economyMode, 'grant');
});

test('six Mossprout nature islands each cost 40 Glow to unlock then retain the established upgrade curve', () => {
  let state = mossproutWorld();
  state = reduceMergeWorld(state, { type: 'upgradeHavenTile', characterId: 'mossprout', stage: 1, now: NOW + 1 }).state;
  assert.deepEqual(Object.values(state.haven.mossproutNatureIslands), [0, 0, 0, 0, 0, 0]);
  const beforeUnlocks = state.coins;
  for (const islandId of MOSSPROUT_NATURE_ISLAND_IDS) {
    state = reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId, level: 1, now: NOW + 1 }).state;
  }
  assert.equal(state.coins, beforeUnlocks - 240);
  assert.deepEqual(Object.values(state.haven.mossproutNatureIslands), [1, 1, 1, 1, 1, 1]);

  const storyReady = reduceMergeWorld(state, {
    type: 'reconcileHavenStory',
    characterId: 'mossprout',
    storyLevel: 4,
    now: NOW + 2,
  }).state;
  state = { ...storyReady, coins: 4_000 };

  const seed = reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId: 'seed-nursery', level: 2, now: NOW + 3 });
  assert.equal(seed.changed, true);
  assert.equal(seed.state.coins, 3_940);
  assert.equal(seed.state.haven.mossproutNatureIslands['seed-nursery'], 2);
  assert.equal(seed.state.haven.mossproutNatureIslands['bloom-garden'], 1);
  assert.equal(seed.natureIslandUpgrade?.completedTier, false);
  assert.equal(seed.state.haven.tileStages.mossprout, 1);

  state = seed.state;
  const levelTwoCosts = [60, 65, 65, 75, 75];
  for (const [index, islandId] of MOSSPROUT_NATURE_ISLAND_IDS.slice(1).entries()) {
    const result = reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId, level: 2, now: NOW + 4 + index });
    assert.equal(result.changed, true);
    state = result.state;
    if (index === 4) assert.equal(result.natureIslandUpgrade?.completedTier, true);
  }
  assert.equal(state.coins, 3_600);
  assert.equal(levelTwoCosts.reduce((sum, cost) => sum + cost, 60), 400);
  assert.equal(state.haven.tileStages.mossprout, 2);

  for (const islandId of MOSSPROUT_NATURE_ISLAND_IDS) {
    state = reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId, level: 3, now: NOW + 20 }).state;
  }
  assert.equal(state.coins, 2_700);
  assert.equal(state.haven.tileStages.mossprout, 3);
  for (const islandId of MOSSPROUT_NATURE_ISLAND_IDS) {
    state = reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId, level: 4, now: NOW + 30 }).state;
  }
  assert.equal(state.coins, 900);
  assert.equal(state.haven.tileStages.mossprout, 4);
});

test('nature island upgrades reject skips, story locks, duplicate commands, and insufficient Glow', () => {
  let state = mossproutWorld();
  state = reduceMergeWorld(state, { type: 'upgradeHavenTile', characterId: 'mossprout', stage: 1, now: NOW + 1 }).state;
  assert.equal(reduceMergeWorld({ ...state, coins: 39 }, { type: 'upgradeMossproutNatureIsland', islandId: 'seed-nursery', level: 1, now: NOW + 1 }).changed, false);
  state = reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId: 'seed-nursery', level: 1, now: NOW + 1 }).state;
  assert.equal(reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId: 'seed-nursery', level: 3, now: NOW + 2 }).changed, false);
  assert.equal(reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId: 'seed-nursery', level: 2, now: NOW + 3 }).changed, false);
  state = reduceMergeWorld(state, { type: 'reconcileHavenStory', characterId: 'mossprout', storyLevel: 2, now: NOW + 4 }).state;
  state = { ...state, coins: 59 };
  assert.equal(reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId: 'seed-nursery', level: 2, now: NOW + 5 }).changed, false);
  state = { ...state, coins: 60 };
  const upgraded = reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId: 'seed-nursery', level: 2, now: NOW + 6 });
  assert.equal(upgraded.changed, true);
  assert.equal(reduceMergeWorld(upgraded.state, { type: 'upgradeMossproutNatureIsland', islandId: 'seed-nursery', level: 2, now: NOW + 7 }).changed, false);
});

test('v20 restored Havens keep their main stage but restart all new satellites at Level 1', () => {
  const current = mossproutWorld();
  const legacy = {
    ...current,
    version: 20,
    haven: { ...current.haven, tileStages: { ...current.haven.tileStages, mossprout: 4 }, revealState: 'revealed' as const },
  };
  const migrated = normalizeMergeWorldState(legacy, NOW);
  assert.equal(migrated.version, 22);
  assert.equal(migrated.haven.tileStages.mossprout, 4);
  assert.deepEqual(Object.values(migrated.haven.mossproutNatureIslands), [1, 1, 1, 1, 1, 1]);
});

test('v13 Mossprout saves reset into the v22 personal-world contract', () => {
  const current = mossproutWorld();
  const legacy = { ...current, version: 13, haven: undefined };
  const migrated = normalizeMergeWorldState(legacy, NOW);
  assert.equal(migrated.version, 22);
  assert.equal(migrated.ownerCharacterId, 'mossprout');
  assert.equal(migrated.haven.tileStages.mossprout, undefined);
  assert.equal(migrated.haven.revealState, 'hidden');
});

test('procedural Merge orders fill three slots and remain separate from story orders', () => {
  const fresh = createInitialMergeWorldState(NOW, ['mossprout', 'steppling']);
  fresh.unlockedChains = ['nature:garden', 'nature:waterside', 'adventure:trail', 'adventure:travel'];
  const state = normalizeMergeWorldState(fresh, NOW);
  const procedural = state.activeOrders.filter((order) => !order.storyArcId);
  assert.equal(procedural.length, 3);
  assert.ok(procedural.every((order) => order.purpose === 'normal' && !order.signature && !order.chapterId));
});

test('Haven order islands share canonical chapter, journey, and character priority', () => {
  const fresh = normalizeMergeWorldState(createInitialMergeWorldState(NOW, ['mossprout', 'steppling']), NOW);
  const template = fresh.activeOrders[0]!;
  const normal = { ...template, id: 'normal:steppling', characterId: 'steppling' as const };
  const favourite = { ...template, id: 'normal:baristabbit', characterId: 'baristabbit' as const };
  const focused = { ...template, id: 'focus:mossprout', characterId: 'mossprout' as const };
  const sameCharacter = { ...template, id: 'normal:mossprout', characterId: 'mossprout' as const };
  const state = {
    ...fresh,
    activeOrders: [normal, favourite, sameCharacter, focused],
    favouriteCharacterId: 'baristabbit' as const,
  };

  assert.deepEqual(
    prioritizedVisibleMergeOrders(state, { focusOrderId: focused.id }).map((order) => order.id),
    [focused.id, sameCharacter.id, favourite.id, normal.id],
  );

  const journey = { ...normal, id: 'journey:only' };
  const resident = { ...favourite, id: 'resident:only', storyArcId: 'resident:active' };
  assert.deepEqual(
    prioritizedVisibleMergeOrders({ ...state, activeOrders: [normal, journey, resident] }, {
      activeResidentDiscoveryId: 'resident:active',
      exclusiveJourney: true,
      journeyOrderIds: new Set([journey.id]),
    }).map((order) => order.id),
    [resident.id, journey.id],
  );

  const chapter = { ...focused, id: 'mossprout:chapter-0:first-sprout' };
  assert.deepEqual(
    prioritizedVisibleMergeOrders({ ...state, activeOrders: [normal, chapter, favourite] }).map((order) => order.id),
    [chapter.id],
  );
});

test('Mossprout FTUE turns one Bond answer into a Garden upgrade and an intimate rest', () => {
  assert.equal(mossproutFtueStep('egg.ready')?.actions[0]?.nextStepId, 'companion.first_meeting');
  assert.equal(mossproutFtueStep('companion.first_meeting')?.actions[0]?.nextStepId, 'companion.garden_intro');
  assert.equal(mossproutFtueStep('companion.day_one_action')?.actions.find((action) => action.id === 'companion.choose_growth_intent')?.options?.length, 3);
  assert.equal(mossproutFtueStep('companion.day_one_action')?.actions.find((action) => action.id === 'companion.complete_day_one_action')?.nextStepId, 'companion.bond_spotlight');
  assert.equal(mossproutFtueStep('companion.bond_spotlight')?.actions[0]?.nextStepId, 'companion.garden_intro');
  assert.equal(mossproutFtueStep('companion.garden_intro')?.actions[0]?.nextStepId, 'world.garden_arrival');
  assert.equal(mossproutFtueStep('companion.order_preview')?.actions[0]?.nextStepId, 'world.garden_arrival');
  assert.equal(mossproutFtueStep('world.garden_arrival')?.actions[0]?.nextStepId, 'world.seed_planted');
  assert.equal(mossproutFtueStep('world.seed_planted')?.actions[0]?.nextStepId, 'merge.seed_drag');
  assert.equal(mossproutFtueStep('world.seed_planted')?.autoAdvanceMs, undefined);
  const gardenArrivalProjection = mossproutFtueStep('world.garden_arrival')?.camera;
  const gardenArrival = mossproutFtueStep('world.garden_arrival');
  assert.equal(gardenArrival?.actions[0]?.presentation, 'cta_action');
  assert.deepEqual(gardenArrival?.interaction, {
    mode: 'exclusive',
    allowed: { kind: 'target_tap', target: { kind: 'haven_garden_plant_button', characterId: 'mossprout' } },
  });
  assert.deepEqual(gardenArrival?.cue, {
    kind: 'tap', target: { kind: 'haven_garden_plant_button', characterId: 'mossprout' },
  });
  assert.deepEqual(gardenArrival?.spotlight?.targets, [
    { kind: 'haven_guide' },
    { kind: 'haven_garden_plot', characterId: 'mossprout', slotId: 'back-centre' },
    { kind: 'haven_garden_plant_button', characterId: 'mossprout' },
  ]);
  const gardenHandoffProjection = mossproutFtueStep('world.garden_handoff')?.camera;
  assert.equal(gardenArrivalProjection?.kind === 'focus_target' ? gardenArrivalProjection.projectionOnly : false, true);
  assert.equal(gardenHandoffProjection?.kind === 'focus_target' ? gardenHandoffProjection.projectionOnly : false, true);
  const firstGardenFocus = MOSSPROUT_FTUE_FLOW.nodes.find((node) => node.id === 'garden.first-visit.focus');
  const restoredGardenFocus = MOSSPROUT_FTUE_FLOW.nodes.find((node) => node.id === 'garden.first-bloom-offer.focus');
  const preservedRestoreCamera = MOSSPROUT_FTUE_FLOW.nodes.find((node) => node.id === 'garden.first-bloom.focus');
  assert.equal(firstGardenFocus?.kind, 'presentation');
  assert.equal(restoredGardenFocus?.kind, 'presentation');
  if (firstGardenFocus?.kind === 'presentation' && restoredGardenFocus?.kind === 'presentation') {
    assert.deepEqual(firstGardenFocus.payload, restoredGardenFocus.payload);
    assert.deepEqual(firstGardenFocus.payload?.target, { kind: 'haven_structure', structureId: 'mossprout-hex-garden' });
    assert.equal(firstGardenFocus.payload?.anchorY, 0.55);
    assert.equal(firstGardenFocus.payload?.durationMs, 900);
  }
  assert.equal(preservedRestoreCamera?.kind, 'presentation');
  if (preservedRestoreCamera?.kind === 'presentation') {
    assert.equal(preservedRestoreCamera.presentationType, 'world.camera');
    assert.deepEqual(preservedRestoreCamera.payload, { operation: 'preserve', holdWorldState: true, lockInput: true });
  }
  assert.equal(mossproutFtueStep('world.garden_handoff')?.actions[0]?.nextStepId, 'merge.seed_drag');
  assert.equal(mossproutFtueStep('merge.serve_sprout')?.edges?.[0]?.nextStepId, 'world.first_bloom_restore');
  assert.equal(mossproutFtueStep('world.first_bloom_restore')?.edges?.[0]?.nextStepId, 'world.first_seed_grew');
  assert.equal(mossproutFtueStep('world.first_seed_grew')?.actions[0]?.nextStepId, 'companion.water_together');
  const firstBloomProjection = mossproutFtueStep('world.first_bloom_restore')?.camera;
  assert.equal(firstBloomProjection?.kind === 'focus_target' ? firstBloomProjection.projectionOnly : false, true);
  assert.deepEqual(mossproutFtueStep('world.first_bloom_restore')?.spotlight?.targets, [
    { kind: 'haven_guide' },
    { kind: 'haven_upgrade_button', characterId: 'mossprout' },
  ]);
  assert.equal(mossproutFtueStep('companion.chapter_zero_return')?.actions[0]?.nextStepId, 'companion.water_together');
  assert.equal(mossproutFtueStep('companion.water_together')?.actions[0]?.nextStepId, 'companion.first_rest');
  assert.equal(mossproutFtueStep('companion.water_response')?.actions[0]?.nextStepId, 'companion.first_insight');
  assert.equal(mossproutFtueStep('companion.first_insight')?.actions[0]?.nextStepId, 'companion.first_rest');
  assert.equal(mossproutFtueStep('companion.first_rest')?.actions[0]?.nextStepId, 'companion.meditating');
  assert.equal(mossproutFtueStep('companion.meditating')?.actions[0]?.nextStepId, 'complete');
  assert.equal(mossproutFtueStep('haven.first_bloom'), null);
  // Retained as a recovery route for older resident-matching saves.
  assert.equal(mossproutFtueStep('companion.resident_affinity')?.actions[0]?.nextStepId, 'companion.resident_parcel_ready');
  assert.equal(mossproutFtueStep('companion.resident_parcel_ready')?.actions[0]?.nextStepId, 'merge.resident_parcel');
  assert.equal(mossproutFtueStep('merge.resident_card_reward')?.edges?.[0]?.nextStepId, 'companion.resident_match_result');
  assert.equal(mossproutFtueStep('companion.resident_match_result')?.actions[0]?.nextStepId, 'companion.meditating');
  assert.equal(mossproutFtueStep('world.complete'), null);
});

test('FTUE upgrade is explicit and meditation Back exits without reopening Merge', () => {
  const rosterRoute = readFileSync('components/katchadeck/roster/katchimera-roster-route-screen.tsx', 'utf8');
  const mergeRoute = readFileSync('components/katchadeck/games/merge-world-screen.tsx', 'utf8');
  const havenScreen = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  const canvas = readFileSync('components/katchadeck/world/kingdom-hex-canvas.tsx', 'utf8');

  assert.match(rosterRoute, /stepId === 'companion\.meditating'[\s\S]*?completeFtueRun\(\)/);
  assert.match(mergeRoute, /ftueRun\.stepId !== 'companion\.chapter_zero_return'[\s\S]*?target: 'companion'/);
  assert.match(mergeRoute, /ftueRun\.stepId !== 'world\.first_bloom_restore'[\s\S]*?announcement: 'Returning to the Garden'[\s\S]*?target: 'katchimeras'[\s\S]*?flushFtuePersistence/);
  assert.match(havenScreen, /gardenOrdersInteractive=\{false\}/);
  assert.match(havenScreen, /!interactionCreatureId \|\| !ftueStepId \|\| ftueStepId\.startsWith\('companion\.'\)[\s\S]*?closeResidentInteraction\(\)/);
  assert.match(havenScreen, /!upgradePresentation && !interactionCreatureId && \(ftueStepId === 'haven\.mossprout\.focus'/);
  assert.match(havenScreen, /FIRST_BLOOM_GARDEN_UPGRADE_OFFER[\s\S]*?anchor: \{ x: 0\.5, y: 0\.76 \}[\s\S]*?target: \{ kind: 'haven_structure', structureId: 'mossprout-hex-garden' \}/);
  assert.match(havenScreen, /FIRST_SEED_GARDEN_PLANT_OFFER[\s\S]*?placement: 'below'[\s\S]*?target: \{ kind: 'haven_garden_plot', slotId: MOSSPROUT_FIRST_MEMORY_SLOT_ID \}/);
  assert.match(havenScreen, /tileUpgradeOffer=\{ftueStepId === 'world\.garden_arrival'[\s\S]*?FIRST_SEED_GARDEN_PLANT_OFFER[\s\S]*?ftueStepId === 'world\.first_bloom_restore'[\s\S]*?FIRST_BLOOM_GARDEN_UPGRADE_OFFER/);
  assert.match(canvas, /function TileUpgradeOffer[\s\S]*?worldTileActionFrame\(frame,[\s\S]*?styles\.tileUpgradeOffer,[\s\S]*?actionFrame/);
  assert.match(canvas, /interactionEnabled[\s\S]*?!camera\.isMoving[\s\S]*?!upgradePresentation[\s\S]*?tileUpgradeOffer/);
  assert.match(canvas, /camera\.isMoving \? null : tileUpgradeOfferNodeRef\.current/);
  assert.match(canvas, /const committedScene = useMemo[\s\S]*?const upgradeFromScene = useMemo[\s\S]*?upgradePresentation\.fromStage[\s\S]*?complete rendered world on the receipt's from-state[\s\S]*?storySceneGuard\?\.scene \?\? committedScene/);
  assert.match(canvas, /payload\.operation === 'preserve'[\s\S]*?payload\.holdWorldState[\s\S]*?setStorySceneGuard[\s\S]*?requestAnimationFrame/);
  assert.match(readFileSync('components/katchadeck/world/mossprout-hex-neighborhood-scene.ts', 'utf8'), /GARDEN_LAYOUT_BOUNDS = Object\.values\(GARDEN_LEVELS\)\.reduce[\s\S]*?GARDEN_LEVELS\[gardenArtLevel\],[\s\S]*?GARDEN_LAYOUT_BOUNDS/);
  assert.match(readFileSync('components/katchadeck/world/mossprout-hex-neighborhood-scene.ts', 'utf8'), /MEMORY_PLANT_ART_CONTACT_Y = 366 \/ 384[\s\S]*?baseY - size \* MEMORY_PLANT_ART_CONTACT_Y/);
  assert.match(canvas, /const ProjectedMemoryPlant[\s\S]*?allowDownscaling=\{false\}/);
  assert.match(canvas, /MEMORY_PLANT_NATIVE_SURFACE_SCALE[\s\S]*?revealScale\.value[\s\S]*?withSequence\([\s\S]*?withTiming\(1\.14[\s\S]*?withTiming\(1,/);
  assert.match(canvas, /revealRequestedForVisualKeyRef[\s\S]*?if \(animateReveal\) revealRequestedForVisualKeyRef\.current = visualKey[\s\S]*?revealRequestedForVisualKeyRef\.current !== visualKey/);
  assert.doesNotMatch(canvas, /\}, \[animateReveal, celebrationOpacity/);
  assert.match(canvas, /RotatingRadialSunburst[\s\S]*?CelebrationParticles[\s\S]*?memory-plant-confetti-/);
  assert.match(canvas, /Centre the celebration on the planted[\s\S]*?top: \(nativeHeight - raySize\) \/ 2 \+ nativeHeight \* 0\.14/);
  assert.doesNotMatch(canvas, /animatePlant/);
  assert.match(havenScreen, /onGardenPlotTargetChange=\{setGardenPlotNode\}/);
  assert.match(havenScreen, /icon=\{ftueStep\.actions\[0\]\?\.icon \?\? 'sparkles'\}/);
  assert.match(havenScreen, /ftueStepId === 'world\.first_seed_grew'[\s\S]*?beginFirstSeedReturn/);
  assert.match(havenScreen, /garden-plant-button:mossprout/);
  assert.match(havenScreen, /beginFirstSeedReturn[\s\S]*?setFtueReturnFocusCreatureId\(mossprout\.creature\.creatureId\)/);
  assert.match(havenScreen, /ftueReturnFocusCreatureId === creatureId[\s\S]*?advanceFtueActionDurably\([\s\S]*?world\.acknowledge_first_seed_growth[\s\S]*?companion\.water_together/);
  assert.match(havenScreen, /mossproutFtueStep\('companion\.chapter_zero_return'\)\?\.camera[\s\S]*?interactionResidentAnchorY=\{ftueReturnResidentAnchorY\}/);
  assert.doesNotMatch(rosterRoute, /announcement: 'Returning to Mossprout'[\s\S]*?target: 'companion'/);
  assert.doesNotMatch(canvas, /gardenIslandHitTarget/);
  assert.doesNotMatch(havenScreen, /collapsable=\{false\} ref=\{setFirstBloomRestoreButtonNode\}/);
});

test('live Chapter 0 board installation preserves the planted Haven memory', () => {
  const companionRoute = readFileSync('components/katchadeck/world/katchimera-companion-route-screen.tsx', 'utf8');
  const repository = readFileSync('utils/merge-world/repository.ts', 'utf8');
  const havenScreen = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');

  assert.match(companionRoute, /installMossproutOnboardingMergeWorld\(Date\.now\(\), ftueWispForRun\(run\), \{ preserveHaven: true \}\)/);
  assert.match(repository, /options: \{ preserveHaven\?: boolean \}/);
  assert.match(repository, /options\.preserveHaven[\s\S]*?haven: current\.haven/);
  assert.match(havenScreen, /beginFirstSeedPlanting[\s\S]*?evidenceRef: `garden-plot:\$\{MOSSPROUT_FIRST_MEMORY_SLOT_ID\}`/);
  assert.match(repository, /ensureStoredFirstFtueMemoryPlacement[\s\S]*?reduceFirstFtueMemoryPlacement\(state, sourceId, receiptId, now\)/);
  const bootstrap = readFileSync('features/content-flow/content-flow-bootstrap.ts', 'utf8');
  assert.match(bootstrap, /registerContentFlowEffect\('haven.place_first_memory'[\s\S]*?ensureStoredFirstFtueMemoryPlacement\(sourceId, effectKey\)/);
  assert.doesNotMatch(bootstrap, /placeStoredPlantableMemory|slotId: 'front-left'/);
  assert.match(havenScreen, /run\.stepId === 'world\.seed_planted'[\s\S]*?ensureStoredFirstFtueMemoryPlacement/);
  assert.match(havenScreen, /world\.seed_planted'[\s\S]*?firstSeedPlanted/);
  assert.match(havenScreen, /world\.first_seed_grew'[\s\S]*?firstSeedGrown/);
});

test('focused Haven owns one canonical Merge provider and no sandbox subscription', () => {
  const rosterRoute = readFileSync('components/katchadeck/roster/katchimera-roster-route-screen.tsx', 'utf8');
  const havenScreen = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');

  assert.match(rosterRoute, /return isFocused \? \([\s\S]*?<FocusedKatchimeraRosterBoundary[\s\S]*?\) : null/);
  assert.match(rosterRoute, /<MergeWorldProvider[\s\S]*?active[\s\S]*?<FocusedKatchimeraRoster/);
  assert.doesNotMatch(rosterRoute, /loadMergeWorldState|subscribeMergeWorldSnapshots/);
  assert.match(havenScreen, /mergeWorld: MergeWorldState/);
  assert.match(havenScreen, /prioritizedVisibleMergeOrders\(mergeWorld/);
  assert.doesNotMatch(havenScreen, /useHavenMergeSandbox/);
  assert.doesNotMatch(havenScreen, /useMergeWorldActions|loadMergeWorldState|subscribeMergeWorldSnapshots/);
});
