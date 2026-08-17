import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { KATCHIMERA_MERGE_PROFILES, MERGE_GENERATORS, MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { COMPANION_BOARD_ALLOCATIONS, COMPANION_BOARD_RESERVE_CELLS, COMPANION_DISCOVERY_CATALOG, MERGE_STARTING_DIAMOND_CELLS } from '@/constants/companion-discovery-catalog';
import type { HomeDayRecord } from '@/types/home';
import type { MergeBoardItem, MergeWorldState } from '@/types/merge-world';
import { mergeFtueAllowsChatNote, mergeFtueAllowsCommand, mergeFtueBoardGate, mergeFtueEventForCommand, mergeFtueRailGate, mergeFtueRepairTarget, mergeFtueStepEntryBaseline, recoverMergeFtueEvent } from '@/features/onboarding/merge-ftue';
import { mossproutFtueStep } from '@/features/onboarding/mossprout-ftue-script';
import { BARISTABBIT_CHAPTER_ONE_ORDER_POOL, FEASTLE_ACT_TWO_ORDER_POOL, selectAuthoredCohortOrderKeys, selectFeastleActTwoOrderKeys } from '@/utils/companion-story';
import { mergeCellCenter, mergeCellFromPoint, mergeCellOrigin, mergeNeighborCellInDirection } from '@/utils/merge-world/board-geometry';
import { mergeCellFeedbackForFailure } from '@/utils/merge-board-feedback';
import { MERGE_MORPH_DURATION_MS, SPAWN_MOTION_DURATION_MS, isMistMergeTransition, mergeSpriteMotionFrame, spawnSpriteMotionFrame } from '@/utils/merge-board-motion';
import { mergeArtWarmupPlan } from '@/utils/merge-world/art-warmup';
import { mergeActivityRewards } from '@/utils/merge-world/activity-rewards';
import { createMossproutChapterZeroState } from '@/utils/merge-world/onboarding';
import { nextEligibleCompanionGate, recommendCompanionPath } from '@/utils/merge-world/companion-discovery-progression';
import { MERGE_ENERGY_REGEN_CAP, MERGE_ENERGY_REGEN_MS, MERGE_INITIAL_ENERGY, MOSSPROUT_FTUE_JOURNAL_ENERGY, STEPS_PER_MERGE_ENERGY, mergeJournalRewardPreview, mergeYesterdayStepEnergyPreview } from '@/utils/merge-world/economy-policy';
import {
  createInitialMergeWorldState,
  mergeOrderReady,
  mergeWorldCatalogIssues,
  normalizeMergeWorldState,
  reduceMergeWorld,
  resetMergeActivityForDay,
} from '@/utils/merge-world/engine';

const NOW = new Date('2026-08-12T12:00:00.000Z').getTime();

test('Merge FTUE gates the exact authored seed drag and emits a verified merge event', () => {
  const state = createMossproutChapterZeroState(NOW);
  const step = mossproutFtueStep('merge.seed_drag');
  const from = state.board.findIndex((cell) => cell.occupant?.kind === 'item' && cell.occupant.instanceId === 'onboarding-seed-a');
  const to = state.board.findIndex((cell) => cell.occupant?.kind === 'item' && cell.occupant.instanceId === 'onboarding-seed-b');
  assert.deepEqual(mergeFtueBoardGate(step, state), { kind: 'drag', fromCell: from, toCell: to });
  assert.deepEqual(mergeFtueRailGate(step), { kind: 'locked' });
  assert.equal(mergeFtueAllowsCommand(step, state, { type: 'move', from, to, now: NOW + 1 }), true);
  assert.equal(mergeFtueAllowsCommand(step, state, { type: 'move', from: to, to: from, now: NOW + 1 }), false);
  assert.equal(mergeFtueAllowsCommand(step, state, { type: 'tapGenerator', generatorId: 'wild-garden', seed: 'blocked', now: NOW + 1 }), false);
  const command = { type: 'move' as const, from, to, now: NOW + 1 };
  const result = reduceMergeWorld(state, command);
  assert.deepEqual(mergeFtueEventForCommand(state, command, result), {
    type: 'merge_completed',
    fromInstanceId: 'onboarding-seed-a',
    targetInstanceId: 'onboarding-seed-b',
    resultDefinitionId: 'nature:garden:2',
    resultCell: to,
    revision: result.state.revision,
  });
  assert.equal(recoverMergeFtueEvent('merge.seed_drag', result.state, {
    'baseline:merge.seed_drag:merge.create_sprout': 0,
  })?.type, 'merge_completed');
});

test('Dream Echoes accept only their match and emit persistent FTUE evidence', () => {
  let state = createMossproutChapterZeroState(NOW);
  const wrongCell = state.board.findIndex((cell) => cell.occupant?.kind === 'item');
  const wrong = reduceMergeWorld({
    ...state,
    board: state.board.map((cell, index) => index === wrongCell && cell.occupant?.kind === 'item'
      ? { ...cell, occupant: { ...cell.occupant, definitionId: 'nature:garden:2' } }
      : cell),
  }, { type: 'move', from: wrongCell, to: 23, now: NOW + 1 });
  assert.equal(wrong.changed, false);
  assert.equal(wrong.message, 'Find its match.');
  assert.equal(wrong.failureReason, 'wrong_echo_match');

  state = reduceMergeWorld(state, { type: 'move', from: wrongCell, to: 23, now: NOW + 2 }).state;
  const receipt = state.boardAwakeningReceipts.find((entry) => entry.id === 'dream-echo:mossprout-seed-echo');
  assert.deepEqual(receipt?.clearedCells, [23]);
  assert.equal(state.board[23].mist, null);
  assert.equal(state.board[23].occupant?.kind === 'item' ? state.board[23].occupant.definitionId : null, 'nature:garden:2');
});

test('Merge FTUE locks the board for Serve and advances only for its exact order', () => {
  const initial = createMossproutChapterZeroState(NOW);
  const from = initial.board.findIndex((cell) => cell.occupant?.kind === 'item' && cell.occupant.instanceId === 'onboarding-seed-a');
  const to = initial.board.findIndex((cell) => cell.occupant?.kind === 'item' && cell.occupant.instanceId === 'onboarding-seed-b');
  const merged = reduceMergeWorld(initial, { type: 'move', from, to, now: NOW + 1 }).state;
  const step = mossproutFtueStep('merge.serve_sprout');
  const orderId = 'mossprout:chapter-0:first-sprout';
  assert.deepEqual(mergeFtueBoardGate(step, merged), { kind: 'locked' });
  assert.deepEqual(mergeFtueRailGate(step), { kind: 'serve', orderId });
  assert.equal(mergeFtueAllowsCommand(step, merged, { type: 'serveOrder', orderId, now: NOW + 2 }), true);
  assert.equal(mergeFtueAllowsCommand(step, merged, { type: 'serveOrder', orderId: 'wrong', now: NOW + 2 }), false);
  const command = { type: 'serveOrder' as const, orderId, now: NOW + 2 };
  const result = reduceMergeWorld(merged, command);
  assert.deepEqual(mergeFtueEventForCommand(merged, command, result), { type: 'order_served', orderId, revision: result.state.revision });
  assert.equal(recoverMergeFtueEvent('merge.serve_sprout', result.state, {
    'baseline:merge.serve_sprout:merge.serve_sprout': 0,
  })?.type, 'order_served');
  assert.deepEqual(result.state.activeOrders.map((order) => order.id), ['mossprout:chapter-0:home-plant']);
});

test('Merge FTUE exposes only Mossprout’s highlighted return note after Chapter 0', () => {
  const step = mossproutFtueStep('merge.return_note');
  assert.deepEqual(mergeFtueRailGate(step), { kind: 'chat_note', noteId: 'mossprout:chapter-0:return-note' });
  assert.equal(mergeFtueAllowsChatNote(step, 'mossprout:chapter-0:return-note'), true);
  assert.equal(mergeFtueAllowsChatNote(step, 'chat-note:someone-else'), false);
});

test('Mossprout Chapter One reconciles its three authored rain-garden requests', () => {
  let state = reduceMergeWorld(createInitialMergeWorldState(NOW), { type: 'reconcileCharacters', characterIds: ['mossprout'], now: NOW }).state;
  const expected = [
    { level: 2, title: 'A Place for Rain', requirements: ['nature:waterside:2'] },
    { level: 3, title: 'A Bank That Holds', requirements: ['nature:garden:3', 'nature:waterside:2'] },
    { level: 4, title: 'The Little Rain Garden', requirements: ['nature:garden:4', 'nature:waterside:3'] },
  ];
  for (const item of expected) {
    state = reduceMergeWorld(state, {
      type: 'reconcileStory', familyId: 'mossprout', status: 'order_active',
      targetLevel: item.level, actPhase: item.level === 4 ? 'signature_order' : 'regular_orders', now: NOW + item.level,
    }).state;
    const order = state.activeOrders.find((candidate) => candidate.characterId === 'mossprout');
    assert.equal(order?.title, item.title);
    assert.deepEqual(order?.requirements.map((requirement) => requirement.definitionId), item.requirements);
    assert.equal(order?.signature, item.level === 4);
  }
});

test('Merge FTUE permits only the highlighted generator and emits spawn evidence', () => {
  let state = createMossproutChapterZeroState(NOW);
  const seedCells = state.board.flatMap((cell, index) => cell.occupant?.kind === 'item' ? [index] : []);
  state = reduceMergeWorld(state, { type: 'move', from: seedCells[0], to: seedCells[1], now: NOW + 1 }).state;
  state = reduceMergeWorld(state, { type: 'serveOrder', orderId: 'mossprout:chapter-0:first-sprout', now: NOW + 2 }).state;
  const step = mossproutFtueStep('merge.plant.spawn');
  const generatorCell = state.board.findIndex((cell) => cell.occupant?.kind === 'generator' && cell.occupant.generatorId === 'wild-garden');
  assert.deepEqual(mergeFtueBoardGate(step, state), { kind: 'generator', cell: generatorCell, generatorId: 'wild-garden' });
  const command = { type: 'tapGenerator' as const, generatorId: 'wild-garden', now: NOW + 3, seed: 'ftue-spawn' };
  assert.equal(mergeFtueAllowsCommand(step, state, command), true);
  const result = reduceMergeWorld(state, command);
  assert.equal(mergeFtueEventForCommand(state, command, result)?.type, 'item_spawned');
});

test('Merge art warm-up stays bounded to visible and immediately reachable artwork', () => {
  const state = createMossproutChapterZeroState(NOW);
  const plan = mergeArtWarmupPlan(state);
  assert.deepEqual(plan.generatorIds, ['wild-garden']);
  assert.ok(plan.itemDefinitionIds.includes('nature:garden:1'));
  assert.equal(plan.itemDefinitionIds.includes('nature:garden:2'), false);
  assert.equal(new Set(plan.itemDefinitionIds).size, plan.itemDefinitionIds.length);
  assert.equal(plan.itemDefinitionIds.includes('food:table:6'), false);
});

test('Merge board uses its existing native cells without a Skia surface', () => {
  const board = readFileSync('components/katchadeck/games/feastle-persistent-merge-board.tsx', 'utf8');
  const spawnEffects = readFileSync('components/katchadeck/games/merge-spawn-effects-layer.tsx', 'utf8');
  const ftueOverlay = readFileSync('components/katchadeck/games/merge-ftue-overlay.tsx', 'utf8');
  assert.doesNotMatch(board, /MergeBoardStaticLayer|gpuStaticLayerReady|gpuVisuals/);
  assert.match(board, /backgroundColor: compatible \? '#F1D995'/);
  assert.match(board, /\{blocked \? <Image[\s\S]*?source=\{LOCKED_CELL_OVERLAY\}/);
  assert.match(board, /\{mist\?\.kind === 'echo' \? <View/);
  assert.doesNotMatch(board, /@shopify\/react-native-skia|<Canvas/);
  assert.doesNotMatch(spawnEffects, /@shopify\/react-native-skia|<Canvas/);
  assert.doesNotMatch(ftueOverlay, /@shopify\/react-native-skia|<Canvas/);
});

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
  assert.equal(state.version, 13);
  assert.equal(state.storageCapacity, 8);
  assert.equal(state.energy.regenCap, MERGE_ENERGY_REGEN_CAP);
  assert.equal(state.energy.value, MERGE_INITIAL_ENERGY);
  assert.equal(state.energy.regenCap, 50);
  assert.equal(state.energy.value, 20);
  assert.equal(state.board.filter((cell) => !cell.locked).length, 13);
  assert.deepEqual(state.generators, {});
});

test('Mossprout Chapter 0 stays inside the centered thirteen-cell clearing', () => {
  let state = createMossproutChapterZeroState(NOW, 'heartlet');
  const openCount = () => state.board.filter((cell) => !cell.locked).length;
  assert.equal(openCount(), 13);
  assert.equal(state.energy.value, 4);
  assert.equal(state.energy.regenPaused, true);
  assert.deepEqual(state.generators['wild-garden'].tierOneDropDefinitionIds, ['nature:garden:1', 'nature:waterside:1']);
  assert.equal(state.generators['wild-garden'].forcedDropDefinitionId, 'nature:garden:1');
  assert.deepEqual(state.activeOrders.map((order) => order.id), ['mossprout:chapter-0:first-sprout']);
  assert.deepEqual(state.activeOrders[0].requirements, [{ definitionId: 'nature:garden:2', quantity: 1 }]);
  assert.deepEqual(state.board.flatMap((cell, index) => cell.mist?.kind === 'echo' && cell.mist.ownerCharacterId === 'mossprout' ? [[index, cell.mist.definitionId]] : []), [
    [23, 'nature:garden:1'], [25, 'nature:garden:2'], [37, 'nature:garden:3'], [39, 'nature:garden:4'], [45, 'nature:garden:5'],
  ]);

  const seedCells = state.board.flatMap((cell, index) => cell.occupant?.kind === 'item' ? [index] : []);
  assert.equal(seedCells.length, 2);
  assert.ok(seedCells.every((cell) => state.board[cell].occupant?.kind === 'item' && state.board[cell].occupant.definitionId === 'nature:garden:1'));
  state = reduceMergeWorld(state, { type: 'move', from: seedCells[0], to: seedCells[1], now: NOW + 1 }).state;
  const echoSeed = reduceMergeWorld(state, { type: 'tapGenerator', generatorId: 'wild-garden', now: NOW + 2, seed: 'echo-seed' });
  assert.ok(echoSeed.spawnedCell != null);
  state = echoSeed.state;
  const seedEcho = reduceMergeWorld(state, { type: 'move', from: echoSeed.spawnedCell!, to: 23, now: NOW + 3 });
  assert.equal(seedEcho.dreamEchoClearedId, 'mossprout-seed-echo');
  state = seedEcho.state;
  assert.equal(openCount(), 13);

  state = reduceMergeWorld(state, { type: 'serveOrder', orderId: 'mossprout:chapter-0:first-sprout', now: NOW + 4 }).state;
  assert.equal(openCount(), 13);
  assert.deepEqual(state.activeOrders.map((order) => order.id), ['mossprout:chapter-0:home-plant']);
  assert.equal(state.energy.value, 3);
  assert.equal(Boolean(state.characterProgress.mossprout?.completedChapterIds.includes('mossprout-chapter-0')), false);
  assert.equal(state.externalRewardReceipts.some((receipt) => receipt.kind === 'wisp'), false);

  const mergePair = (definitionId: string, at: number) => {
    const cells = state.board.flatMap((cell, index) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === definitionId ? [index] : []);
    assert.ok(cells.length >= 2);
    state = reduceMergeWorld(state, { type: 'move', from: cells[0], to: cells[1], now: at }).state;
  };
  const remainingSprout = state.board.findIndex((cell) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === 'nature:garden:2');
  const sproutEcho = reduceMergeWorld(state, { type: 'move', from: remainingSprout, to: 25, now: NOW + 5 });
  assert.equal(sproutEcho.dreamEchoClearedId, 'mossprout-sprout-echo');
  state = sproutEcho.state;
  assert.equal(openCount(), 13);
  state = reduceMergeWorld(state, { type: 'serveOrder', orderId: 'mossprout:chapter-0:home-plant', now: NOW + 6 }).state;
  assert.equal(openCount(), 13);
  assert.deepEqual(state.activeOrders.map((order) => order.id), ['mossprout:chapter-0:energy-plant']);
  assert.deepEqual(state.activeOrders[0].requirements, [{ definitionId: 'nature:garden:4', quantity: 1 }]);

  for (let index = 0; index < 2; index += 1) {
    state = reduceMergeWorld(state, { type: 'tapGenerator', generatorId: 'wild-garden', now: NOW + 7 + index, seed: `energy-pair:${index}` }).state;
  }
  mergePair('nature:garden:1', NOW + 9);
  state = reduceMergeWorld(state, { type: 'tapGenerator', generatorId: 'wild-garden', now: NOW + 10, seed: 'energy-last-seed' }).state;
  assert.equal(state.energy.value, 0);
  assert.equal(reduceMergeWorld(state, { type: 'refreshTime', now: NOW + 86_400_000 }).state.energy.value, 0);

  const journal = reduceMergeWorld(state, {
    type: 'grantActivityRewardsBatch',
    rewards: [{ receiptId: 'activity:egg-journal:2026-08-12', kind: 'daily_journal_energy', amount: MOSSPROUT_FTUE_JOURNAL_ENERGY, label: 'Mossprout memory', grantDayId: '2026-08-12' }],
    now: NOW + 11,
  });
  assert.equal(journal.energyGranted, 20);
  assert.equal(journal.state.energy.value, 20);
  const duplicateJournal = reduceMergeWorld(journal.state, {
    type: 'grantActivityRewardsBatch',
    rewards: [{ receiptId: 'activity:egg-journal:2026-08-12', kind: 'daily_journal_energy', amount: MOSSPROUT_FTUE_JOURNAL_ENERGY, label: 'Mossprout memory', grantDayId: '2026-08-12' }],
    now: NOW + 12,
  });
  assert.equal(duplicateJournal.changed, false);

  const returnStep = mossproutFtueStep('merge.energy.finish_seed');
  const generatorCell = journal.state.board.findIndex((cell) => cell.occupant?.kind === 'generator' && cell.occupant.generatorId === 'wild-garden');
  const finalSeedCommand = { type: 'tapGenerator' as const, generatorId: 'wild-garden', now: NOW + 13, seed: 'energy-final-seed' };
  assert.deepEqual(mergeFtueBoardGate(returnStep, journal.state), { kind: 'generator', cell: generatorCell, generatorId: 'wild-garden' });
  assert.equal(mergeFtueAllowsCommand(returnStep, journal.state, finalSeedCommand), true);
  state = reduceMergeWorld(journal.state, finalSeedCommand).state;
  const finishSproutStep = mossproutFtueStep('merge.energy.finish_sprout');
  const finishSproutBaseline = mergeFtueStepEntryBaseline(finishSproutStep, state);
  assert.deepEqual(finishSproutBaseline, {
    actionId: 'merge.energy.finish_sprout',
    stepId: 'merge.energy.finish_sprout',
    value: 1,
  });
  assert.equal(
    recoverMergeFtueEvent(finishSproutStep, state, {
      'baseline:merge.energy.finish_sprout:merge.energy.finish_sprout': finishSproutBaseline!.value,
    }),
    null,
    'the Sprout carried through Today must not auto-complete the post-return Seed merge',
  );
  assert.equal(mergeFtueBoardGate(finishSproutStep, state).kind, 'drag');
  assert.equal(mergeFtueRepairTarget(mossproutFtueStep('merge.energy.finish_plant'), state), 'merge.energy.finish_sprout');
  mergePair('nature:garden:1', NOW + 14);
  assert.equal(recoverMergeFtueEvent(finishSproutStep, state, {
    'baseline:merge.energy.finish_sprout:merge.energy.finish_sprout': finishSproutBaseline!.value,
  })?.type, 'merge_completed');
  assert.equal(mergeFtueRepairTarget(mossproutFtueStep('merge.energy.finish_plant'), state), null);
  mergePair('nature:garden:2', NOW + 15);
  const plantCell = state.board.findIndex((cell) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === 'nature:garden:3');
  const plantEcho = reduceMergeWorld(state, { type: 'move', from: plantCell, to: 37, now: NOW + 16 });
  assert.equal(plantEcho.dreamEchoClearedId, 'mossprout-plant-echo');
  state = plantEcho.state;
  assert.equal(openCount(), 13);
  state = reduceMergeWorld(state, { type: 'serveOrder', orderId: 'mossprout:chapter-0:energy-plant', now: NOW + 17 }).state;
  assert.equal(openCount(), 13);
  assert.deepEqual(state.activeOrders, []);
  assert.equal(state.energy.regenPaused, false);
  assert.equal(state.generators['wild-garden'].forcedDropDefinitionId, null);
  assert.ok(state.characterProgress.mossprout?.completedChapterIds.includes('mossprout-chapter-0'));
  assert.ok(state.externalRewardReceipts.some((receipt) => receipt.kind === 'wisp' && receipt.wispId === 'heartlet'));
});

test('the all-roster board manifest budgets every cell without sacrificing endgame workspace', () => {
  const allocatedCells = COMPANION_BOARD_ALLOCATIONS.flatMap((allocation) => allocation.cells);
  const everyCell = [...MERGE_STARTING_DIAMOND_CELLS, ...allocatedCells, ...COMPANION_BOARD_RESERVE_CELLS];
  assert.equal(COMPANION_BOARD_ALLOCATIONS.length, 25);
  assert.equal(new Set(COMPANION_BOARD_ALLOCATIONS.map((allocation) => allocation.characterId)).size, 25);
  assert.equal(everyCell.length, 63);
  assert.equal(new Set(everyCell).size, 63);
  assert.ok(everyCell.every((cell) => cell >= 0 && cell < 63));
  assert.deepEqual(Object.fromEntries(['foundation', 'expansion', 'utility_founder', 'utility_upgrade'].map((role) => [
    role, COMPANION_BOARD_ALLOCATIONS.filter((allocation) => allocation.role === role).length,
  ])), { foundation: 8, expansion: 9, utility_founder: 4, utility_upgrade: 4 });
  for (const allocation of COMPANION_BOARD_ALLOCATIONS) {
    for (let index = 1; index < allocation.cells.length; index += 1) {
      const left = allocation.cells[index - 1];
      const right = allocation.cells[index];
      assert.equal(Math.abs(left % 7 - right % 7) + Math.abs(Math.floor(left / 7) - Math.floor(right / 7)), 1, `${allocation.characterId} path must be contiguous`);
    }
  }
  const permanentObjects = COMPANION_BOARD_ALLOCATIONS.filter((allocation) => allocation.role === 'foundation' || allocation.role === 'utility_founder').length;
  assert.equal(MERGE_STARTING_DIAMOND_CELLS.length + allocatedCells.length, 60);
  assert.equal(permanentObjects, 12);
  assert.equal(60 - permanentObjects, 48);
});

/* Superseded by authored Dreambound discovery paths.
  const initial = createMossproutChapterZeroState(NOW);
  const sharedEchoes = initial.board.flatMap((cell, index) => cell.mist?.kind === 'echo' && cell.mist.ownerCharacterId == null
    ? [{ cell: index, definitionId: cell.mist.definitionId, generatorId: cell.mist.generatorId }]
    : []);
  const tierOneDrops = MERGE_GENERATORS.flatMap((generator) => generator.tierOneDropDefinitionIds);
  const tierOneEchoes = initial.board.flatMap((cell, index) => cell.mist?.kind === 'echo' && MERGE_ITEMS_BY_ID.get(cell.mist.definitionId)?.tier === 1
    ? [{ cell: index, definitionId: cell.mist.definitionId, id: cell.mist.id }]
    : []);

  assert.equal(sharedEchoes.length, 15);
  assert.equal(MERGE_LOCKED_TIER_ONE_ECHOES.length, 15);
  assert.equal(new Set(sharedEchoes.map((echo) => echo.cell)).size, sharedEchoes.length);
  assert.ok(sharedEchoes.every((echo) => initial.board[echo.cell].locked));
  assert.ok(sharedEchoes.every((echo) => MERGE_ITEMS_BY_ID.get(echo.definitionId)?.tier === 1));
  assert.ok(sharedEchoes.every((echo) => MERGE_GENERATORS.some((generator) => generator.id === echo.generatorId
    && generator.tierOneDropDefinitionIds.includes(echo.definitionId))));
  assert.equal(sharedEchoes.some((echo) => echo.definitionId === 'nature:garden:1'), false);
  assert.equal(tierOneEchoes.filter((echo) => echo.definitionId === 'nature:garden:1').length, 1);
  assert.equal(tierOneEchoes.find((echo) => echo.definitionId === 'nature:garden:1')?.id, 'mossprout-seed-echo');
  assert.deepEqual(new Set(tierOneEchoes.map((echo) => echo.definitionId)), new Set(tierOneDrops));
  assert.equal(initial.board.some((cell) => (cell.mist as { kind?: string } | null)?.kind === 'katchimera'), false);

  const genericState = createInitialMergeWorldState(NOW);
  const echoCell = genericState.board.findIndex((cell) => cell.mist?.kind === 'echo' && cell.mist.definitionId === 'food:table:1');
  const echo = genericState.board[echoCell].mist;
  assert.ok(echo?.kind === 'echo');
  const source = genericState.board.findIndex((cell) => !cell.locked && !cell.occupant);
  const board = [...genericState.board];
  board[source] = { ...board[source], occupant: { kind: 'item', instanceId: 'generic-echo-match', definitionId: echo.definitionId } };
  const ready = { ...genericState, board };
  assert.equal(ready.unlockedRegions.includes(ready.board[echoCell].regionId), false);

  const wrongBoard = [...genericState.board];
  wrongBoard[source] = { ...wrongBoard[source], occupant: { kind: 'item', instanceId: 'generic-echo-wrong-match', definitionId: 'nature:garden:1' } };
  const wrong = reduceMergeWorld({ ...genericState, board: wrongBoard }, { type: 'move', from: source, to: echoCell, now: NOW + 1 });
  assert.equal(wrong.changed, false);
  assert.equal(wrong.failureReason, 'wrong_echo_match');

  const merged = reduceMergeWorld(ready, { type: 'move', from: source, to: echoCell, now: NOW + 2 });
  assert.equal(merged.changed, true);
  assert.equal(merged.dreamEchoClearedId, 'shared-echo:food:table:1');
  assert.equal(merged.state.board[echoCell].locked, false);
  assert.equal(merged.state.board[echoCell].mist, null);
  assert.deepEqual(merged.state.board[echoCell].occupant, {
    kind: 'item', instanceId: 'merge-item:1', definitionId: 'food:table:2',
  });
  assert.equal(merged.state.board[source].occupant, null);
});

test('every newly unlocked non-Mossprout generator can clear either cold tier-one Dream Echo in one session', () => {
  for (const generator of MERGE_GENERATORS.filter((entry) => entry.id !== 'wild-garden')) {
    const profile = Object.values(KATCHIMERA_MERGE_PROFILES).find((entry) => entry.coreChains.some((chainId) => generator.chainIds.includes(chainId)));
    assert.ok(profile, `${generator.id} should belong to a companion's core chains`);
    for (const [dropIndex, definitionId] of generator.tierOneDropDefinitionIds.entries()) {
      let state: MergeWorldState = reduceMergeWorld(createInitialMergeWorldState(NOW, [profile.characterId]), {
        type: 'reconcileStory', familyId: profile.characterId, status: 'order_active', targetLevel: 2, now: NOW + 1,
      }).state;
      assert.ok(state.generators[generator.id]);
      assert.ok(state.generatorUnlockReceipts.some((receipt) => receipt.generatorId === generator.id));
      state = reduceMergeWorld(state, {
        type: 'setGeneratorForcedDrop', generatorId: generator.id, definitionId, now: NOW + 2,
      }).state;
      const spawned = reduceMergeWorld(state, {
        type: 'tapGenerator', generatorId: generator.id, now: NOW + 3, seed: `cold-first-spawn:${generator.id}:${dropIndex}`,
      });
      assert.ok(spawned.spawnedCell != null);
      state = spawned.state;
      const spawnedItem: MergeWorldState['board'][number]['occupant'] = state.board[spawned.spawnedCell!].occupant;
      assert.equal(spawnedItem?.kind === 'item' ? spawnedItem.definitionId : null, definitionId);
      assert.ok(spawnedItem?.kind === 'item');
      const echoCell: number = state.board.findIndex((cell) => cell.mist?.kind === 'echo' && cell.mist.definitionId === definitionId);
      assert.ok(echoCell >= 0, `${definitionId} should have a Dream Echo`);
      const merged = reduceMergeWorld(state, { type: 'move', from: spawned.spawnedCell!, to: echoCell, now: NOW + 4 });
      assert.equal(merged.dreamEchoClearedId, `shared-echo:${definitionId}`);
      assert.equal(merged.state.board[echoCell].mist, null);
      assert.equal(merged.state.board[spawned.spawnedCell!].occupant, null);
    }
  }
});

*/

test('normalization removes legacy moon, walking mysteries, and shared tier-one Echoes', () => {
  const legacy = structuredClone(createMossproutChapterZeroState(NOW)) as unknown as { board: { mist: unknown }[] };
  legacy.board[8].mist = { kind: 'katchimera', id: 'future-moon', mysteryId: 'moon', ownerCharacterId: null };
  legacy.board[57].mist = { kind: 'katchimera', id: 'future-trail', mysteryId: 'trail', ownerCharacterId: 'steppling' };

  const normalized = normalizeMergeWorldState(legacy, NOW + 1);
  assert.deepEqual(normalized.board[8].mist, { kind: 'dormant' });
  assert.deepEqual(normalized.board[57].mist, { kind: 'dormant' });
});

test('step Energy checkpoints cumulative pedometer totals without paying the same steps twice', () => {
  const initial = createMossproutChapterZeroState(NOW);
  const first = reduceMergeWorld(initial, {
    type: 'claimStepEnergy', dayId: '2026-08-12', observedSteps: 6_000,
    observedAt: new Date(NOW).toISOString(), allowBootstrap: true, receiptId: 'steps:first', now: NOW + 1,
  });
  assert.equal(first.energyGranted, 20);
  assert.equal(first.stepEnergyClaim?.consumedSteps, 20 * STEPS_PER_MERGE_ENERGY);
  assert.equal(first.state.energy.value, 24);
  const duplicate = reduceMergeWorld(first.state, {
    type: 'claimStepEnergy', dayId: '2026-08-12', observedSteps: 6_000,
    observedAt: new Date(NOW + 2).toISOString(), allowBootstrap: true, receiptId: 'steps:first', now: NOW + 2,
  });
  assert.equal(duplicate.changed, false);
  assert.equal(duplicate.stepEnergyClaim?.status, 'duplicate');
  const secondDailyConversion = reduceMergeWorld(first.state, {
    type: 'claimStepEnergy', dayId: '2026-08-12', observedSteps: 6_300,
    observedAt: new Date(NOW + 3).toISOString(), allowBootstrap: true, receiptId: 'steps:second-bootstrap', now: NOW + 3,
  });
  assert.equal(secondDailyConversion.changed, false);
  assert.equal(secondDailyConversion.energyGranted, 0);
  assert.equal(secondDailyConversion.stepEnergyClaim?.status, 'duplicate');
  assert.equal(mergeYesterdayStepEnergyPreview(6_300, first.state.stepEnergyByDay['2026-08-12']), 0);
  const correctedDown = reduceMergeWorld(first.state, {
    type: 'claimStepEnergy', dayId: '2026-08-12', observedSteps: 5_500,
    observedAt: new Date(NOW + 3).toISOString(), allowBootstrap: false, receiptId: 'steps:correction', now: NOW + 3,
  });
  assert.equal(correctedDown.energyGranted, 0);
  assert.equal(correctedDown.state.energy.value, 24);

  const remainderStart = reduceMergeWorld(createMossproutChapterZeroState(NOW), {
    type: 'claimStepEnergy', dayId: '2026-08-13', observedSteps: 299,
    observedAt: new Date(NOW).toISOString(), allowBootstrap: true, receiptId: 'steps:299', now: NOW + 4,
  });
  assert.equal(remainderStart.energyGranted, 0);
  const threshold = reduceMergeWorld(remainderStart.state, {
    type: 'claimStepEnergy', dayId: '2026-08-13', observedSteps: 300,
    observedAt: new Date(NOW + 5).toISOString(), allowBootstrap: false, receiptId: 'steps:300', now: NOW + 5,
  });
  assert.equal(threshold.energyGranted, 1);
  assert.equal(threshold.stepEnergyClaim?.consumedSteps, STEPS_PER_MERGE_ENERGY);
});

test('generator forced-drop mode validates, emits the exact item, and can be cleared', () => {
  let state = createMossproutChapterZeroState(NOW);
  state = {
    ...state,
    energy: { ...state.energy, value: 20 },
    board: state.board.map((cell) => cell.occupant?.kind === 'generator'
      ? cell
      : { ...cell, locked: false, mist: null, blocker: null, occupant: null }),
    generators: {
      ...state.generators,
      'wild-garden': { ...state.generators['wild-garden'], level: 4, forcedDropDefinitionId: null },
    },
  };

  const rejected = reduceMergeWorld(state, {
    type: 'setGeneratorForcedDrop', generatorId: 'wild-garden', definitionId: 'food:table:1', now: NOW + 1,
  });
  assert.equal(rejected.changed, false);
  assert.equal(rejected.state.generators['wild-garden'].forcedDropDefinitionId, null);

  state = reduceMergeWorld(state, {
    type: 'setGeneratorForcedDrop', generatorId: 'wild-garden', definitionId: 'nature:garden:1', now: NOW + 2,
  }).state;
  assert.equal(state.generators['wild-garden'].forcedDropDefinitionId, 'nature:garden:1');

  for (let index = 0; index < 8; index += 1) {
    const result = reduceMergeWorld(state, {
      type: 'tapGenerator', generatorId: 'wild-garden', now: NOW + 3 + index, seed: `forced-drop:${index}`,
    });
    assert.equal(result.changed, true);
    assert.ok(result.spawnedCell != null);
    const occupant = result.state.board[result.spawnedCell!].occupant;
    assert.equal(occupant?.kind === 'item' ? occupant.definitionId : null, 'nature:garden:1');
    state = result.state;
  }

  state = reduceMergeWorld(state, {
    type: 'setGeneratorForcedDrop', generatorId: 'wild-garden', definitionId: null, now: NOW + 20,
  }).state;
  assert.equal(state.generators['wild-garden'].forcedDropDefinitionId, null);
});

test('normalization repairs the Seed override on a persisted active Mossprout tutorial', () => {
  const active = createMossproutChapterZeroState(NOW);
  const stale = {
    ...active,
    version: 8,
    generators: {
      ...active.generators,
      'wild-garden': { ...active.generators['wild-garden'], forcedDropDefinitionId: null },
    },
  };
  const normalized = normalizeMergeWorldState(stale, NOW + 1);
  assert.equal(normalized.generators['wild-garden'].forcedDropDefinitionId, 'nature:garden:1');
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

test('generator fragments upgrade drops without changing chain ownership', () => {
  const base = storyWorld();
  const pantry = base.generators['hearth-pantry'];
  const ready = {
    ...base,
    generators: { ...base.generators, 'hearth-pantry': { ...pantry, upgradeFragments: 3 } },
  };
  const upgraded = reduceMergeWorld(ready, { type: 'upgradeGenerator', generatorId: 'hearth-pantry', now: NOW + 1 });
  assert.equal(upgraded.changed, true);
  assert.equal(upgraded.state.generators['hearth-pantry'].level, 2);
  assert.equal(upgraded.state.generators['hearth-pantry'].upgradeFragments, 0);
  assert.deepEqual(upgraded.state.generators['hearth-pantry'].chainIds, pantry.chainIds);
  const drops = Array.from({ length: 120 }, (_, index) => reduceMergeWorld(upgraded.state, {
    type: 'tapGenerator', generatorId: 'hearth-pantry', now: NOW + index + 2, seed: `upgraded:${index}`,
  })).flatMap((result) => result.spawnedCell == null ? [] : [result.state.board[result.spawnedCell].occupant]);
  assert.ok(drops.some((drop) => drop?.kind === 'item' && drop.definitionId.endsWith(':2')));
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
  assert.equal(result.failureReason, 'board_full');
});

test('Merge board failures map to concise anchored callouts', () => {
  assert.deepEqual(mergeCellFeedbackForFailure('locked_cell'), { message: 'LOCKED', tone: 'blocked' });
  assert.deepEqual(mergeCellFeedbackForFailure('no_energy'), { message: 'NO ENERGY', tone: 'warning' });
  assert.deepEqual(mergeCellFeedbackForFailure('board_full'), { message: 'BOARD FULL', tone: 'warning' });
  assert.deepEqual(mergeCellFeedbackForFailure('wrong_echo_match'), { message: 'FIND ITS MATCH', tone: 'hint' });
  assert.deepEqual(mergeCellFeedbackForFailure('sealed_mist'), { message: 'SEALED', tone: 'blocked' });
  assert.equal(mergeCellFeedbackForFailure(), null);

  const chapterZero = createMossproutChapterZeroState(NOW);
  const sourceCell = chapterZero.board.findIndex((cell) => cell.occupant?.kind === 'item');
  const lockedCell = chapterZero.board.findIndex((cell) => cell.locked && cell.mist?.kind === 'dormant');
  const locked = reduceMergeWorld(chapterZero, { type: 'move', from: sourceCell, to: lockedCell, now: NOW + 1 });
  assert.equal(locked.changed, false);
  assert.equal(locked.failureReason, 'locked_cell');
  const noEnergy = reduceMergeWorld({ ...chapterZero, energy: { ...chapterZero.energy, value: 0 } }, {
    type: 'tapGenerator', generatorId: 'wild-garden', now: NOW + 2, seed: 'empty-energy',
  });
  assert.equal(noEnergy.changed, false);
  assert.equal(noEnergy.failureReason, 'no_energy');
});

test('Merge motion contracts old art before the new item overshoots into place', () => {
  assert.equal(MERGE_MORPH_DURATION_MS, 460);
  assert.deepEqual(mergeSpriteMotionFrame('merge-source', 0), { opacity: 1, scale: 1 });
  assert.deepEqual(mergeSpriteMotionFrame('merge-source', 0.12), { opacity: 1, scale: 1 });
  assert.ok(mergeSpriteMotionFrame('merge-source', 0.58).scale <= 0.1);
  assert.equal(mergeSpriteMotionFrame('merge-source', 0.58).opacity, 0);
  assert.equal(mergeSpriteMotionFrame('merge-result', 0.22).opacity, 0);
  assert.equal(mergeSpriteMotionFrame('merge-result', 0.22).scale, 0.06);
  assert.ok(mergeSpriteMotionFrame('merge-source', 0.4).scale > 0.4);
  assert.ok(mergeSpriteMotionFrame('merge-result', 0.4).scale > 0.3);
  assert.ok(mergeSpriteMotionFrame('merge-result', 0.78).scale > 1);
  assert.deepEqual(mergeSpriteMotionFrame('merge-result', 1), { opacity: 1, scale: 1 });
  assert.deepEqual(mergeSpriteMotionFrame('merge-result', 0.5, true), { opacity: 0.5, scale: 1 });
});

test('generator spawn pops from its source, arcs short, then slides into the destination', () => {
  const board = readFileSync('components/katchadeck/games/feastle-persistent-merge-board.tsx', 'utf8');
  assert.equal(SPAWN_MOTION_DURATION_MS, 760);
  const pop = spawnSpriteMotionFrame(0.18);
  const apex = spawnSpriteMotionFrame(0.39);
  const landing = spawnSpriteMotionFrame(0.78);
  const slide = spawnSpriteMotionFrame(0.9);
  assert.ok(pop.scale > 1.1);
  assert.ok(pop.travel < 0.15);
  assert.ok(apex.arc < -0.95);
  assert.ok(landing.travel > 0.8 && landing.travel < 0.9);
  assert.ok(Math.abs(landing.arc) < 0.0001);
  assert.ok(landing.scale < 1);
  assert.ok(slide.travel > landing.travel && slide.travel < 1);
  assert.ok(slide.settleY < 0.04);
  assert.deepEqual(spawnSpriteMotionFrame(1), { arc: 0, opacity: 1, scale: 1, settleY: 0, travel: 1 });
  assert.match(board, /const start = mergeCellOrigin\(geometry, from\)/);
  assert.match(board, /startX: start\.x, startY: start\.y/);
  assert.match(board, /duration: motion\.kind === 'spawn' \? SPAWN_MOTION_DURATION_MS/);
  assert.match(board, /spawnFrame \? arcHeight\.value \* spawnFrame\.arc \+ cellSize \* spawnFrame\.settleY/);
  const spawnEffects = readFileSync('components/katchadeck/games/merge-spawn-effects-layer.tsx', 'utf8');
  assert.match(board, /<MergeSpawnEffectsLayer bursts=\{spawnBursts\}/);
  assert.match(spawnEffects, /NATIVE_SPAWN_BURST_SLOT_IDS = \[0, 1, 2, 3, 4, 5\]/);
  assert.match(spawnEffects, /NATIVE_SPAWN_PARTICLES\.map/);
  assert.match(spawnEffects, /<View pointerEvents="none" style=\{StyleSheet\.absoluteFill\}>/);
  assert.doesNotMatch(spawnEffects, /@shopify\/react-native-skia|<Canvas|usePathValue/);
  assert.match(board, /useReducer\(mergeBoardVisualReducer/);
  assert.doesNotMatch(board, /setPresentation|setSprites|setMotions|setBusy/);
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

test('Energy regenerates every three minutes and stops at the natural capacity', () => {
  const state = { ...createInitialMergeWorldState(NOW), energy: { value: 48, regenCap: 50, lastRegenAt: NOW } };
  assert.equal(MERGE_ENERGY_REGEN_MS, 3 * 60_000);
  const early = reduceMergeWorld(state, { type: 'refreshTime', now: NOW + MERGE_ENERGY_REGEN_MS - 1 });
  assert.equal(early.state.energy.value, 48);
  const firstTick = reduceMergeWorld(early.state, { type: 'refreshTime', now: NOW + MERGE_ENERGY_REGEN_MS });
  assert.equal(firstTick.state.energy.value, 49);
  const regenerated = reduceMergeWorld(firstTick.state, { type: 'refreshTime', now: NOW + MERGE_ENERGY_REGEN_MS * 2 });
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

test('debug Today reset restores journal Energy eligibility without removing earned Energy or other days', () => {
  const rewards = [
    { receiptId: 'activity:egg-journal:2026-08-12', kind: 'daily_journal_energy' as const, amount: 10, label: 'Journal', grantDayId: '2026-08-12' },
    { receiptId: 'activity:egg-companion:2026-08-12', kind: 'daily_companion_energy' as const, amount: 5, label: 'Companion', grantDayId: '2026-08-12' },
    { receiptId: 'activity:egg-journal:2026-08-13', kind: 'daily_journal_energy' as const, amount: 10, label: 'Tomorrow', grantDayId: '2026-08-13' },
  ];
  const granted = reduceMergeWorld(createInitialMergeWorldState(NOW), { type: 'grantActivityRewardsBatch', rewards, now: NOW + 1 }).state;
  const energyBeforeReset = granted.energy.value;
  const reset = resetMergeActivityForDay(granted, '2026-08-12', NOW + 2);

  assert.equal(reset.energy.value, energyBeforeReset);
  assert.equal(reset.activityEnergyByDay['2026-08-12'], undefined);
  assert.equal(reset.activityEnergyByDay['2026-08-13'], 10);
  assert.equal(reset.processedActivityReceiptIds.includes('activity:egg-journal:2026-08-12'), false);
  assert.equal(reset.processedActivityReceiptIds.includes('activity:egg-companion:2026-08-12'), false);
  assert.equal(reset.processedActivityReceiptIds.includes('activity:egg-journal:2026-08-13'), true);

  const journalAgain = reduceMergeWorld(reset, {
    type: 'grantActivityRewardsBatch', rewards: [rewards[0]], now: NOW + 3,
  });
  assert.equal(journalAgain.energyGranted, 10);
  assert.equal(journalAgain.state.energy.value, energyBeforeReset + 10);
});

test('debug Today reset reopens only yesterday step conversion without taking back earned Energy', () => {
  const initial = createInitialMergeWorldState(NOW);
  const yesterday = reduceMergeWorld(initial, {
    type: 'claimStepEnergy', dayId: '2026-08-11', observedSteps: 3_000,
    observedAt: new Date(NOW - 86_400_000).toISOString(), allowBootstrap: true, receiptId: 'steps:yesterday', now: NOW + 1,
  });
  const older = reduceMergeWorld(yesterday.state, {
    type: 'claimStepEnergy', dayId: '2026-08-10', observedSteps: 1_500,
    observedAt: new Date(NOW - 2 * 86_400_000).toISOString(), allowBootstrap: true, receiptId: 'steps:older', now: NOW + 2,
  });
  const energyBeforeReset = older.state.energy.value;

  const reset = resetMergeActivityForDay(older.state, '2026-08-12', NOW + 3, '2026-08-11');

  assert.equal(reset.energy.value, energyBeforeReset);
  assert.equal(reset.stepEnergyByDay['2026-08-11'], undefined);
  assert.ok(reset.stepEnergyByDay['2026-08-10']);
  assert.equal(mergeYesterdayStepEnergyPreview(3_000, reset.stepEnergyByDay['2026-08-11']), 10);

  const claimedAgain = reduceMergeWorld(reset, {
    type: 'claimStepEnergy', dayId: '2026-08-11', observedSteps: 3_000,
    observedAt: new Date(NOW - 86_400_000).toISOString(), allowBootstrap: true, receiptId: 'steps:yesterday:dev-reset', now: NOW + 4,
  });
  assert.equal(claimedAgain.energyGranted, 10);
  assert.equal(claimedAgain.state.energy.value, energyBeforeReset + 10);
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

test('journal reward preview follows the diminishing capture curve with a separate companion bonus', () => {
  const ordinary = { id: 'ordinary', flowId: 'general', createdAt: '2026-08-12T09:00:00.000Z', source: { kind: 'manual', sourceId: 'ordinary' } };
  const second = { ...ordinary, id: 'second', createdAt: '2026-08-12T09:30:00.000Z', source: { kind: 'manual', sourceId: 'second' } };
  const third = { ...ordinary, id: 'third', createdAt: '2026-08-12T09:45:00.000Z', source: { kind: 'manual', sourceId: 'third' } };
  const fourth = { ...ordinary, id: 'fourth', createdAt: '2026-08-12T09:50:00.000Z', source: { kind: 'manual', sourceId: 'fourth' } };
  const companion = { id: 'companion', flowId: 'general', createdAt: '2026-08-12T10:00:00.000Z', source: { kind: 'manual', sourceId: 'companion', origin: { kind: 'companion_reflection', creatureId: 'c', promptId: 'p', promptText: 'p' } } };
  const day = (journalRecords: unknown[]) => ({ id: 'day', isoDate: '2026-08-12', journalRecords }) as unknown as HomeDayRecord;
  assert.equal(mergeJournalRewardPreview([], { companion: true, now: new Date(NOW) }).totalEnergy, 15);
  assert.equal(mergeJournalRewardPreview([], { companion: false, now: new Date(NOW) }).totalEnergy, 10);
  assert.equal(mergeJournalRewardPreview([day([ordinary])], { companion: true, now: new Date(NOW) }).totalEnergy, 11);
  assert.equal(mergeJournalRewardPreview([day([ordinary, companion])], { companion: true, now: new Date(NOW) }).totalEnergy, 3);
  assert.equal(mergeJournalRewardPreview([day([ordinary, second, third])], { companion: false, now: new Date(NOW) }).totalEnergy, 1);
  assert.equal(mergeJournalRewardPreview([day([ordinary, second, third, fourth])], { companion: false, now: new Date(NOW) }).totalEnergy, 0);
  assert.deepEqual(
    mergeActivityRewards([day([ordinary, second, third, fourth])], new Date(NOW))
      .filter((reward) => reward.kind === 'daily_journal_energy')
      .map((reward) => reward.amount),
    [10, 6, 3, 1],
  );
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

test('the first meaningful daily capture creates Energy and a safe non-item memory arrival only', () => {
  const day = {
    id: 'day-2026-08-12', isoDate: '2026-08-12',
    journalRecords: [{
      id: 'walk-entry', schemaVersion: 1, idempotencyKey: 'walk-entry', flowId: 'movement', flowVersion: 1,
      categoryId: 'walk', canonicalQualityIds: [], fields: {}, feeling: null, note: 'raw text stays outside Merge',
      attachments: [], confirmedFacets: [], createdAt: '2026-08-12T10:00:00.000Z', source: { kind: 'manual', sourceId: 'walk-entry' },
    }],
  } as unknown as HomeDayRecord;
  const state = reduceMergeWorld(createInitialMergeWorldState(NOW, ['steppling']), {
    type: 'reconcileStory', familyId: 'steppling', status: 'order_active', targetLevel: 6,
    actPhase: 'regular_orders', orderTemplateKeys: selectAuthoredCohortOrderKeys('steppling', 'capture'), now: NOW,
  }).state;
  const rewards = mergeActivityRewards([day], new Date(NOW), { state });
  assert.deepEqual(rewards.map((reward) => reward.kind), ['daily_journal_energy', 'memory_arrival']);
  assert.deepEqual(rewards[1].arrival?.itemDefinitionIds, []);
  assert.equal(JSON.stringify(rewards).includes('raw text stays outside Merge'), false);

  const granted = reduceMergeWorld(state, { type: 'grantActivityRewardsBatch', rewards, now: NOW + 1 });
  assert.equal(granted.state.arrivals.length, 1);
  assert.equal(granted.state.arrivals[0].kind, 'memory_arrival');
  assert.equal(granted.state.arrivals[0].memoryRef?.journalRecordId, 'walk-entry');
  const duplicate = reduceMergeWorld(granted.state, { type: 'grantActivityRewardsBatch', rewards, now: NOW + 2 });
  assert.equal(duplicate.changed, false);

});

test('Dream Echo and Dreambound locked cells use the regular merge morph transaction', () => {
  assert.equal(isMistMergeTransition('echo', 18, 18, true), true);
  assert.equal(isMistMergeTransition('dreambound_item', 18, 18, true), true);
  assert.equal(isMistMergeTransition('dormant', 18, 18, true), false);
  assert.equal(isMistMergeTransition('dreambound_item', 19, 18, true), false);
  assert.equal(isMistMergeTransition('dreambound_item', 18, 18, false), false);
});

test('a featured companion does not turn journal activity into item parcels', () => {
  const day = {
    id: 'day-2026-08-12', isoDate: '2026-08-12',
    journalRecords: [{
      id: 'walk-with-feastle', schemaVersion: 1, idempotencyKey: 'walk-with-feastle', flowId: 'movement', flowVersion: 1,
      categoryId: 'walk', canonicalQualityIds: [], fields: {}, feeling: null, note: null, attachments: [], confirmedFacets: [],
      createdAt: '2026-08-12T10:00:00.000Z', source: { kind: 'manual', sourceId: 'walk-with-feastle' },
    }],
  } as unknown as HomeDayRecord;
  const state = storyWorld();
  const rewards = mergeActivityRewards([day], new Date(NOW), { state });
  assert.equal(rewards.some((reward) => reward.kind === 'contextual_parcel'), false);
  assert.equal(rewards.some((reward) => (reward.arrival?.itemDefinitionIds.length ?? 0) > 0), false);
});

test('a completed companion goal does not create an item chest', () => {
  const state = reduceMergeWorld(createInitialMergeWorldState(NOW, ['bedrotte']), {
    type: 'reconcileStory', familyId: 'bedrotte', status: 'order_active', targetLevel: 6,
    actPhase: 'regular_orders', orderTemplateKeys: selectAuthoredCohortOrderKeys('bedrotte', 'goal'), now: NOW,
  }).state;
  const rewards = mergeActivityRewards([], new Date(NOW), {
    state,
    quickGoals: {
      schemaVersion: 3,
      goals: [{ id: 'rest-goal', familyId: 'bedrotte', title: 'Rest for ten minutes', cadence: { kind: 'once', dayId: '2026-08-12' }, status: 'active', createdAt: NOW, updatedAt: NOW }],
      completions: [{ id: 'quick-goal-completion:rest-goal:2026-08-12', goalId: 'rest-goal', familyId: 'bedrotte', dayId: '2026-08-12', completedAt: NOW }],
      dismissals: [],
    },
  });
  assert.deepEqual(rewards, []);
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

test('schema seven migrates old activity parcels into companion-owned typed arrivals', () => {
  const source = storyWorld();
  const normalized = normalizeMergeWorldState({
    ...source,
    version: 6,
    rewardInbox: [{ id: 'unknown-old-parcel', createdAt: NOW, items: ['adventure:trail:4'], source: 'activity' }],
  }, NOW + 1);
  assert.equal(normalized.rewardInbox.some((entry) => entry.source === 'activity'), false);
  const parcel = normalized.arrivals.find((arrival) => arrival.id === 'arrival:migrated:unknown-old-parcel');
  assert.equal(parcel?.characterId, 'feastle');
  assert.equal(parcel?.source, 'legacy');
  assert.deepEqual(parcel?.itemDefinitionIds, ['food:table:1', 'food:dessert:1']);

  const repeated = normalizeMergeWorldState(normalized, NOW + 2);
  assert.equal(repeated.arrivals.filter((arrival) => arrival.id === parcel?.id).length, 1);
});

test('legacy companion starter receipts retain their encoded companion ownership', () => {
  const source = createInitialMergeWorldState(NOW, ['feastle', 'pagelet']);
  const normalized = normalizeMergeWorldState({
    ...source,
    version: 6,
    rewardInbox: [{ id: 'activity:companion-story-starter:pagelet', createdAt: NOW, items: ['food:table:1'], source: 'activity' }],
  }, NOW + 1);
  const parcel = normalized.arrivals.find((arrival) => arrival.characterId === 'pagelet');
  assert.equal(parcel?.source, 'companion_story');
  assert.deepEqual(parcel?.itemDefinitionIds, ['mind:books:1', 'mind:work:1']);
});

test('item parcels reject a full board without consuming the arrival', () => {
  const state = storyWorld();
  const parcel: MergeWorldState['arrivals'][number] = {
    id: 'arrival:legacy:test', kind: 'contextual_parcel', createdAt: NOW, dayId: '2026-08-12',
    label: 'Retained legacy parcel', theme: 'food', familyId: 'food', chainId: 'food:table',
    characterId: 'feastle', source: 'legacy', itemDefinitionIds: ['food:table:1'], claimedAt: null, seenAt: null,
  };
  const granted = { ...state, arrivals: [...state.arrivals, parcel] };
  const fullBoard = granted.board.map((cell, index) => cell.locked ? cell : {
    ...cell,
    occupant: cell.occupant ?? { kind: 'item' as const, instanceId: `filler:${index}`, definitionId: 'food:table:1' },
  });
  const result = reduceMergeWorld({ ...granted, board: fullBoard }, { type: 'claimArrival', arrivalId: parcel.id, now: NOW + 2 });
  assert.equal(result.changed, false);
  assert.equal(result.state.arrivals.find((arrival) => arrival.id === parcel.id)?.claimedAt, null);
  assert.match(result.message ?? '', /more board spaces/);
});

test('Merge page keeps a stable parcel stack first in the tray and the board attached to its separator', () => {
  const screen = readFileSync('components/katchadeck/games/merge-world-screen.tsx', 'utf8');
  const parcel = readFileSync('components/katchadeck/games/merge-parcel-overlay.tsx', 'utf8');
  const gameSurface = readFileSync('components/katchadeck/ui/game-surface.tsx', 'utf8');
  const rail = readFileSync('components/katchadeck/games/merge-order-rail.tsx', 'utf8');
  assert.doesNotMatch(screen, /arrivalDock|Memory Shelf|worldChangeRow|basketButton/);
  assert.match(screen, /return \[\.\.\.parcelEntries, \.\.\.returnEntries, \.\.\.orderEntries\]/);
  assert.match(screen, /id: 'parcel-stack'/);
  assert.doesNotMatch(screen, /<MergeParcelButton/);
  assert.match(screen, /boardStage: \{[^}]*justifyContent: 'flex-start'/);
  assert.match(screen, /mergeArea: \{[^}]*marginTop: 18/);
  assert.match(parcel, /<GameBadge label=\{count\} style=\{styles\.countBadge\} tone="gold"/);
  assert.match(parcel, /arrival\.kind === 'discovery_parcel'[\s\S]*?<GameBadge icon="sparkles"/);
  assert.match(gameSurface, /badgeText: \{[^}]*fontFamily: GameUI\.type\.title\.fontFamily/);
  assert.match(gameSurface, /badge: \{[^}]*alignItems: 'center'[^}]*justifyContent: 'center'/);
  assert.match(parcel, /opacity: interpolate\(value, \[0, 0\.08, 1\], \[0, 1, 1\]\)/);
  assert.doesNotMatch(parcel, /\[0, 1, 1, 0\.18\]/);
  assert.match(screen, /destinationSize: boardMetrics\.geometry\.cellSize - 4/);
  assert.match(parcel, /FLIGHT_ITEM_SIZE \/ item\.destinationSize/);
  assert.match(parcel, /<PersistentMergeItemArt definitionId=\{item\.definitionId\} size=\{item\.destinationSize\}/);
  assert.doesNotMatch(parcel, /\[0\.6, 1\.1, 1, 0\.92\]/);
  assert.match(rail, /entry\.kind === 'parcel' \? PARCEL_STACK_EXIT : TRAY_SERVE_EXIT/);
  assert.match(rail, /layout=\{reduceMotion \? undefined : LinearTransition/);
  assert.match(screen, /arrival\.kind === 'discovery_parcel'/);
  assert.match(screen, /postFtueDiscoveryGuidance/);
  assert.match(screen, /kind: 'board_discovery_fork'/);
});

test('rail FTUE target refs keep stable callback identities across target revision renders', () => {
  const rail = readFileSync('components/katchadeck/games/merge-order-rail.tsx', 'utf8');
  assert.match(rail, /onRailTargetRef=\{onRailTargetRef\}/);
  assert.match(rail, /const setServeTargetRef = useCallback\(/);
  assert.match(rail, /const setTargetRef = useCallback\(/);
  assert.match(rail, /const handleParcelTargetRef = useCallback\(/);
  assert.doesNotMatch(rail, /onServeTargetRef=\{\(orderId, view\)/);
  assert.doesNotMatch(rail, /targetRef=\{\(view\) => onRailTargetRef/);
});

test('served item sprites stay suppressed until the board confirms they are retired', () => {
  const screen = readFileSync('components/katchadeck/games/merge-world-screen.tsx', 'utf8');
  const board = readFileSync('components/katchadeck/games/feastle-persistent-merge-board.tsx', 'utf8');
  assert.match(screen, /const \[serveHiddenItemIds, setServeHiddenItemIds\] = useState/);
  assert.match(screen, /setServeHiddenItemIds\(new Set\(items\.map\(\(item\) => item\.instanceId\)\)\);[\s\S]*?setServeFlight\(/);
  assert.match(screen, /if \(!result\?\.changed\) setServeHiddenItemIds\(new Set\(\)\);[\s\S]*?setServeFlight\(null\);/);
  assert.match(screen, /onHiddenItemsRetired=\{handleHiddenItemsRetired\}/);
  assert.match(board, /const retiredIds = \[\.\.\.hiddenItemInstanceIds\]\.filter\(\(instanceId\) => !mountedItemIds\.has\(instanceId\)\);/);
  assert.match(board, /if \(retiredIds\.length\) onHiddenItemsRetired\(retiredIds\);/);
});

test('Merge board retains destination selection and decorates generators with ambient motion', () => {
  const board = readFileSync('components/katchadeck/games/feastle-persistent-merge-board.tsx', 'utf8');
  assert.match(board, /onSelect\(to\);/);
  assert.match(board, /onSelect\(sprite\.cell\);/);
  assert.match(board, /SelectedCellCorners[\s\S]*?selectionCornerTopLeft[\s\S]*?selectionCornerBottomRight/);
  assert.match(board, /withRepeat\(withSequence\([\s\S]*?withTiming\(1[\s\S]*?withTiming\(0/);
  assert.match(board, /GeneratorSparkles[\s\S]*?GENERATOR_SPARKLE_LANES[\s\S]*?GeneratorSparkle/);
  assert.match(board, /GENERATOR_SPARKLE_CYCLE_MS = 700/);
  assert.match(board, /translateY: interpolate\(p, \[0, 1\], \[size \* 0\.24, -size \* 0\.62\]\)/);
  assert.match(board, /DreamEchoItemArt compatible=\{compatible\}/);
  assert.match(board, /size=\{Math\.min\(width, height\) - 4\}/);
  assert.match(board, /DreamMistDissipation/);
  assert.match(board, /emitEmptyCellTap/);
  assert.match(board, /MergeCellCallout/);
  assert.doesNotMatch(board, /from '@shopify\/react-native-skia'/);
  assert.doesNotMatch(board, /useImage\(/);
  assert.match(board, /Dream Echoes on the same Expo Image decode\/cache path/);
});

test('Merge FTUE commits before visual settlement and preserves all native animation paths', () => {
  const screen = readFileSync('components/katchadeck/games/merge-world-screen.tsx', 'utf8');
  const board = readFileSync('components/katchadeck/games/feastle-persistent-merge-board.tsx', 'utf8');
  const overlay = readFileSync('components/katchadeck/games/merge-ftue-overlay.tsx', 'utf8');
  const route = readFileSync('components/katchadeck/games/merge-world-route-screen.tsx', 'utf8');
  const crashReporting = readFileSync('utils/crash-reporting.ts', 'utf8');
  const runtime = readFileSync('features/onboarding/ftue-runtime.ts', 'utf8');
  const sync = readFileSync('features/onboarding/ftue-sync.ts', 'utf8');
  const artCache = readFileSync('hooks/use-merge-art-cache.ts', 'utf8');
  assert.match(screen, /ftueCoordinator\.begin\(currentStep\?\.id \?\? 'unknown', currentState\.revision\)/);
  assert.match(screen, /const nextRun = dispatchFtueEvent\(/);
  assert.match(screen, /ftueCoordinator\.complete\(commandToken\)/);
  assert.doesNotMatch(screen, /ftueCoordinator\.settle|ftueCoordinator\.awaitGate|ftueCoordinator\.acknowledgeGate/);
  assert.doesNotMatch(screen, /onCommandSettled=|onInteractionGateCommitted=/);
  assert.doesNotMatch(screen, /ftueAdvanceFrameRef|pendingAnimatedFtueEventsRef|requestAnimationFrame\(\(\) => \{\s*requestAnimationFrame/);
  assert.match(board, /settledRevision: predicted\.state\.revision/);
  assert.match(board, /onCommandSettledRef\.current\?\.\(\{ operationId: operation\.id, revision: operation\.settledRevision, sessionId \}\)/);
  assert.match(board, /useLayoutEffect\(\(\) => \{[\s\S]*?onInteractionGateCommittedRef\.current\?\.\(\{ interactionKey: interactionSessionKey, sessionId \}\)/);
  assert.doesNotMatch(overlay, /return \(\) => \{\s*cancelAnimation\(progress\);\s*progress\.value = 0;/);
  assert.doesNotMatch(overlay, /key=\{`(?:spotlight|cue):|entering=|exiting=/);
  assert.match(overlay, /measurementGenerationRef/);
  assert.match(overlay, /stateRef\.current/);
  assert.doesNotMatch(overlay, /requestAnimationFrame/);
  assert.match(overlay, /spotlightTransitionDurationMs: 420/);
  assert.match(overlay, /<SpotlightDimPanels/);
  assert.match(overlay, /<NativeSpotlightRing slot=\{slot0\}/);
  assert.doesNotMatch(overlay, /@shopify\/react-native-skia|<Canvas|usePathValue|BlurMask/);
  assert.doesNotMatch(route, /useSharedValue|effectsPaused/);
  assert.doesNotMatch(board, /useMergeMotionPerformanceProbe|effectsPaused|motionActive|reducedFx/);
  assert.doesNotMatch(screen, /addMergeFtueBreadcrumb|setMergeFtueDiagnosticContext|markFlowStart|reportFlowReady/);
  assert.doesNotMatch(overlay, /addMergeFtueBreadcrumb/);
  assert.doesNotMatch(crashReporting, /tracesSampleRate|tracesSampler|enableTracing/);
  assert.match(runtime, /setStoredJsonAsync/);
  assert.match(runtime, /objectiveProgress,[\s\S]*?receipts: \[\.\.\.current\.receipts, receipt\]/);
  assert.match(sync, /RECEIPT_SYNC_QUIET_MS = 1_500/);
  assert.match(sync, /waitForCriticalInteractionIdle/);
  assert.match(artCache, /workerCount = Math\.min\(1, missing\.length\)/);
  assert.match(artCache, /await waitForCriticalInteractionIdle\(\)/);
  const spawnEffects = readFileSync('components/katchadeck/games/merge-spawn-effects-layer.tsx', 'utf8');
  assert.match(spawnEffects, /NATIVE_SPAWN_PARTICLES\.map/);
  assert.doesNotMatch(spawnEffects, /@shopify\/react-native-skia|<Canvas/);
  assert.match(board, /DREAM_MIST_PARTICLES\.map/);
});

test('a companion journal grants Energy without starter item parcels', () => {
  const day = {
    id: 'day-2026-08-12', isoDate: '2026-08-12', promptAnswers: [], moments: [], capturedMeanings: [], stepsCount: 0,
    journalRecords: [{
      id: 'pagelet-entry', flowId: 'studio', createdAt: '2026-08-12T10:00:00.000Z',
      source: { kind: 'manual', sourceId: 'handoff', origin: { kind: 'companion_reflection', reflectionMode: 'story', creatureId: 'companion:pagelet', familyId: 'pagelet', promptId: 'merge', promptText: 'A thought worth keeping' } },
    }],
  } as unknown as HomeDayRecord;
  const rewards = mergeActivityRewards([day], new Date(NOW));
  assert.deepEqual(rewards.map((reward) => reward.kind), ['daily_journal_energy', 'daily_companion_energy']);
  const first = reduceMergeWorld(createInitialMergeWorldState(NOW), { type: 'grantActivityRewardsBatch', rewards, now: NOW + 1 });
  const duplicate = reduceMergeWorld(first.state, { type: 'grantActivityRewardsBatch', rewards, now: NOW + 2 });
  assert.equal(first.energyGranted, 15);
  assert.equal(first.state.rewardInbox.length, 0);
  assert.equal(first.state.arrivals.length, 0);
  assert.equal(duplicate.changed, false);
});

test('past companion stories no longer enqueue starter parcels', () => {
  const day = {
    id: 'day-2026-08-11', isoDate: '2026-08-11',
    journalRecords: [{
      id: 'baristabbit-story', createdAt: '2026-08-11T10:00:00.000Z',
      source: { kind: 'manual', sourceId: 'handoff', origin: { kind: 'companion_reflection', reflectionMode: 'story', creatureId: 'barista', familyId: 'baristabbit', promptId: 'pause', promptText: 'Pause' } },
    }],
  } as unknown as HomeDayRecord;
  const rewards = mergeActivityRewards([day], new Date(NOW));
  assert.deepEqual(rewards, []);
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

test('Act Two keeps all five authored orders durable and visible in the scrolling rail', () => {
  const keys = ['rainy-warmth', 'forgotten-lunch', 'quiet-company', 'late-shift', 'long-table'];
  const state = reduceMergeWorld(createInitialMergeWorldState(NOW, ['feastle']), {
    type: 'reconcileStory', familyId: 'feastle', status: 'order_active', targetLevel: 6,
    actPhase: 'regular_orders', orderTemplateKeys: keys, servedOrderIds: [], now: NOW + 1,
  }).state;
  assert.equal(state.activeOrders.length, 5);
  assert.deepEqual(state.activeOrders.map((order) => order.id), keys.map((key) => `merge-story:feastle:act-2:${key}`));
  assert.ok(state.activeOrders.every((order) => Boolean(order.description)));
  assert.deepEqual(state.activeOrders.slice(0, 3).map((order) => order.requirements[0].definitionId), [
    'food:table:3', 'food:table:3', 'food:table:4',
  ]);
  assert.deepEqual(state.activeOrders.slice(0, 3).map((order) => order.requirements.length), [1, 2, 2]);
  assert.ok(FEASTLE_ACT_TWO_ORDER_POOL.filter((order) => 'secondaryDefinitionId' in order || 'guestDefinitionId' in order).length > FEASTLE_ACT_TWO_ORDER_POOL.length / 2);
});

test('every Feastle Act Two deck deliberately mixes table and cake-path orders', () => {
  for (let index = 0; index < 32; index += 1) {
    const keys = selectFeastleActTwoOrderKeys(`feastle-mix:${index}`);
    const orders = keys.map((key) => FEASTLE_ACT_TWO_ORDER_POOL.find((order) => order.key === key)!);
    const cakeOrders = orders.filter((order) => order.definitionId.startsWith('food:dessert:')
      || ('secondaryDefinitionId' in order && order.secondaryDefinitionId.startsWith('food:dessert:')));
    assert.equal(keys.length, 5);
    assert.ok(cakeOrders.length >= 3, `seed ${index} should contain at least three cake or cake-pairing orders`);
    assert.deepEqual(orders.map((order) => order.difficulty), ['small', 'small', 'medium', 'medium', 'major']);
  }
});

test('Feastle’s two opening levels introduce both Pantry paths at tier two', () => {
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
  assert.equal(levelThree.activeOrders[0].requirements[0].definitionId, 'food:dessert:2');
  assert.equal(levelThree.activeOrders[0].requirements[0].quantity, 2);
  assert.deepEqual(levelFour.activeOrders.map((order) => order.requirements[0].definitionId), [
    'food:table:3', 'food:dessert:3', 'food:table:4',
  ]);
  assert.deepEqual(levelFour.activeOrders[2].requirements.map((requirement) => requirement.definitionId), ['food:table:4', 'food:dessert:3']);
  assert.ok(FEASTLE_ACT_TWO_ORDER_POOL.every((order) => Number(order.definitionId.split(':').at(-1)) >= 3));
});

test('Act Two reconciliation rotates served orders out and creates the signature feast', () => {
  const keys = ['rainy-warmth', 'forgotten-lunch', 'quiet-company', 'late-shift', 'long-table'];
  let state = createInitialMergeWorldState(NOW, ['feastle']);
  state = reduceMergeWorld(state, {
    type: 'reconcileStory', familyId: 'feastle', status: 'order_active', targetLevel: 6,
    actPhase: 'regular_orders', orderTemplateKeys: keys, servedOrderIds: [`merge-story:feastle:act-2:${keys[0]}`], now: NOW + 1,
  }).state;
  assert.equal(state.activeOrders.length, 4);
  assert.equal(state.activeOrders.some((order) => order.id.endsWith(keys[0])), false);
  state = reduceMergeWorld(state, {
    type: 'reconcileStory', familyId: 'feastle', status: 'order_active', targetLevel: 8,
    actPhase: 'signature_order', orderTemplateKeys: keys, servedOrderIds: keys.map((key) => `merge-story:feastle:act-2:${key}`), now: NOW + 2,
  }).state;
  assert.equal(state.activeOrders.length, 1);
  assert.equal(state.activeOrders[0].id, 'merge-story:feastle:act-2:first-feast');
  assert.deepEqual(state.activeOrders[0].requirements.map((requirement) => requirement.definitionId), ['food:table:5', 'food:dessert:5']);
});

test('Feastle midpoint note preserves the three unserved Act Two orders', () => {
  const keys = ['rainy-warmth', 'forgotten-lunch', 'quiet-company', 'late-shift', 'long-table'];
  const servedOrderIds = keys.slice(0, 2).map((key) => `merge-story:feastle:act-2:${key}`);
  let state = reduceMergeWorld(createInitialMergeWorldState(NOW, ['feastle']), {
    type: 'reconcileStory', familyId: 'feastle', status: 'order_active', targetLevel: 6,
    actPhase: 'regular_orders', orderTemplateKeys: keys, servedOrderIds: [], now: NOW + 1,
  }).state;

  state = reduceMergeWorld(state, {
    type: 'reconcileStory', familyId: 'feastle', status: 'return_available', targetLevel: 6,
    actPhase: 'midpoint_return', orderTemplateKeys: keys, servedOrderIds, now: NOW + 2,
  }).state;
  const expectedRemaining = keys.slice(2).map((key) => `merge-story:feastle:act-2:${key}`);
  assert.deepEqual(state.activeOrders.filter((order) => order.characterId === 'feastle').map((order) => order.id), expectedRemaining);

  state = reduceMergeWorld(state, {
    type: 'reconcileStory', familyId: 'feastle', status: 'conversation_active', targetLevel: 6,
    actPhase: 'midpoint_return', orderTemplateKeys: keys, servedOrderIds, now: NOW + 3,
  }).state;
  assert.deepEqual(state.activeOrders.filter((order) => order.characterId === 'feastle').map((order) => order.id), expectedRemaining);
});

test('Merge provider reconciles story projection after guarded receipt application and hydration', () => {
  const provider = readFileSync('features/merge-world/merge-world-provider.tsx', 'utf8');
  assert.match(provider, /const reconciled = featureAndReconcile\(friendshipState\)/);
  assert.match(provider, /next = featureAndReconcile\(next\)/);
});

test('a retained hidden Merge provider receives debug resets before Games is reopened', () => {
  const provider = readFileSync('features/merge-world/merge-world-provider.tsx', 'utf8');
  const subscriptionStart = provider.indexOf("acquireLifecycleResource('store_subscription', 'merge:world-resets')");
  const subscriptionEnd = provider.indexOf('const drainPersistence', subscriptionStart);
  assert.ok(subscriptionStart >= 0 && subscriptionEnd > subscriptionStart);
  const subscription = provider.slice(subscriptionStart, subscriptionEnd);
  assert.match(subscription, /subscribeMergeWorldResets\(\(freshState\) =>/);
  assert.match(subscription, /if \(!mountedRef\.current\) return;/);
  assert.doesNotMatch(subscription, /if \(!active/);
  assert.doesNotMatch(subscription, /if \(!activeRef\.current\)/);
});

test('a retained hidden Merge provider adopts repository Energy rewards before Games is reopened', () => {
  const provider = readFileSync('features/merge-world/merge-world-provider.tsx', 'utf8');
  assert.match(provider, /subscribeMergeWorldSnapshots\(\(freshState\) =>/);
  assert.match(provider, /freshState\.revision <= \(stateRef\.current\?\.revision \?\? -1\)/);
  assert.match(provider, /persistenceGenerationRef\.current \+= 1;[\s\S]*?pendingPersistenceRef\.current = null;/);
  assert.match(provider, /stateRef\.current = freshState;[\s\S]*?setState\(freshState\);/);
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

test('legacy snapshots migrate into the current version without discarding earned overflow Energy', () => {
  const normalized = normalizeMergeWorldState({
    ...createInitialMergeWorldState(NOW), version: 2,
    energy: { value: 99, cap: 100, lastRegenAt: NOW },
    generators: { 'starter-pantry': { id: 'starter-pantry', familyId: 'food', name: 'Picnic Pantry', level: 1, enabledBranches: ['table'], charges: 9, maxCharges: 12, readyAt: NOW + 1000 } },
  }, NOW + 1);
  assert.equal(normalized.version, 13);
  assert.equal(normalized.energy.regenCap, 50);
  assert.equal(normalized.energy.value, 99);
  assert.deepEqual(Object.keys(normalized.generators['hearth-pantry']).sort(), ['chainIds', 'forcedDropDefinitionId', 'id', 'level', 'name', 'tierOneDropDefinitionIds', 'upgradeFragments']);
  assert.equal(normalized.generators['hearth-pantry'].forcedDropDefinitionId, null);
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

test('serving an authored signature order permanently unlocks its chapter landmark', () => {
  const familyId = 'steppling';
  const keys = selectAuthoredCohortOrderKeys(familyId, 'landmark');
  let state = reduceMergeWorld(createInitialMergeWorldState(NOW, [familyId]), {
    type: 'reconcileStory', familyId, status: 'order_active', targetLevel: 8,
    actPhase: 'signature_order', orderTemplateKeys: keys,
    servedOrderIds: keys.map((key) => `merge-story:${familyId}:chapter-1:${key}`), now: NOW + 1,
  }).state;
  const signature = state.activeOrders.find((order) => order.characterId === familyId)!;
  state = withItems(state, signature.requirements.map((requirement, index) => [29 + index, item(`signature-${index}`, requirement.definitionId)]));
  const result = reduceMergeWorld(state, { type: 'serveOrder', orderId: signature.id, now: NOW + 2 });
  assert.deepEqual(result.state.landmarks.map((landmark) => landmark.id), ['steppling-path-outside']);
});

test('Steppling FTUE parcel completes three Dreambound merges into the Journey Locker', () => {
  let state = createMossproutChapterZeroState(NOW);
  state = {
    ...state,
    activeOrders: [],
    characterProgress: { ...state.characterProgress, mossprout: { friendshipLevel: 1, completedChapterIds: ['mossprout-chapter-0'] } },
  };
  let result = reduceMergeWorld(state, { type: 'startStepplingDiscovery', now: NOW + 1 });
  assert.equal(result.changed, true);
  state = result.state;
  const anchor = state.companionDiscovery.active?.anchorCell ?? -1;
  assert.deepEqual(state.companionDiscovery.active?.pathCells, [18, 19, 20]);
  assert.equal(state.board[18].mist?.kind, 'dreambound_item');
  assert.equal(state.board[19].mist?.kind === 'dreambound_item' ? state.board[19].mist.active : null, false);
  const parcelId = 'arrival:discovery:discovery:ftue-steppling';
  assert.deepEqual(state.arrivals.find((arrival) => arrival.id === parcelId)?.itemDefinitionIds, ['adventure:trail:1']);
  state = reduceMergeWorld(state, { type: 'claimArrival', arrivalId: parcelId, now: NOW + 2 }).state;

  for (const [definitionId, expectedStage] of [['adventure:trail:1', 1], ['adventure:trail:2', 2], ['adventure:trail:3', 3]] as const) {
    const from = state.board.findIndex((cell) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === definitionId);
    const to = state.board.findIndex((cell) => cell.mist?.kind === 'dreambound_item' && cell.mist.discoveryId === 'discovery:ftue-steppling' && cell.mist.active);
    result = reduceMergeWorld(state, { type: 'move', from, to, now: NOW + 2 + expectedStage });
    assert.equal(result.mergedCell, to);
    assert.deepEqual(result.companionDiscoveryAdvanced, {
      discoveryId: 'discovery:ftue-steppling',
      stage: expectedStage,
      ...(expectedStage === 3 ? { completedCharacterId: 'steppling' } : {}),
    });
    state = result.state;
  }

  assert.equal(state.board[anchor].occupant?.kind, 'generator');
  assert.equal(state.board[anchor].occupant?.kind === 'generator' ? state.board[anchor].occupant.generatorId : null, 'journey-locker');
  assert.ok(state.unlockedCharacters.includes('steppling'));
  assert.equal(state.companionDiscovery.records.find((record) => record.characterId === 'steppling')?.source, 'board_discovery');
  assert.deepEqual(state.activeOrders.map((order) => order.id), ['steppling:discovery:first-trail']);

  state = reduceMergeWorld(state, { type: 'tapGenerator', generatorId: 'journey-locker', seed: 'sock-a', now: NOW + 10 }).state;
  state = reduceMergeWorld(state, { type: 'tapGenerator', generatorId: 'journey-locker', seed: 'sock-b', now: NOW + 11 }).state;
  const socks = state.board.flatMap((cell, index) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === 'adventure:trail:1' ? [index] : []);
  state = reduceMergeWorld(state, { type: 'move', from: socks[0], to: socks[1], now: NOW + 12 }).state;
  state = reduceMergeWorld(state, { type: 'serveOrder', orderId: 'steppling:discovery:first-trail', now: NOW + 13 }).state;
  assert.equal(state.generators['journey-locker'].forcedDropDefinitionId, null);
  assert.equal(state.activeOrders.some((order) => order.id === 'steppling:discovery:first-trail'), false);
  assert.equal(state.companionDiscovery.records.find((record) => record.characterId === 'steppling')?.firstOrderCompletedAt, NOW + 13);
  assert.deepEqual(new Set(state.companionDiscovery.events.map((event) => event.kind)), new Set([
    'gate_eligible', 'gate_activated', 'path_chosen', 'parcel_claimed', 'stage_advanced', 'character_revealed', 'first_order_completed',
  ]));
  assert.equal(state.board.filter((cell) => !cell.locked).length, 16);
});

test('v10 companion ownership migrates into seen grandfathered discovery records', () => {
  const current = createInitialMergeWorldState(NOW, ['feastle', 'bedrotte']);
  const legacy = { ...current, version: 10 } as unknown as Record<string, unknown>;
  delete legacy.companionDiscovery;
  const migrated = normalizeMergeWorldState(legacy, NOW + 1);
  assert.equal(migrated.version, 13);
  assert.deepEqual(new Set(migrated.unlockedCharacters), new Set(['feastle', 'bedrotte']));
  assert.ok(migrated.companionDiscovery.records.every((record) => record.source === 'legacy_grandfather' && record.revealSeenAt != null));
});

test('v12 discovery records infer introduction completion without skipping an active first order', () => {
  const base = createInitialMergeWorldState(NOW, ['steppling']);
  const record = {
    characterId: 'steppling', source: 'board_discovery' as const, gateId: 'gate-2-steppling', pathId: 'overgrown-trail',
    discoveredAt: NOW, revealSeenAt: NOW, permanentFeatureId: 'journey-locker',
  };
  const completed = normalizeMergeWorldState({
    ...base, version: 12,
    companionDiscovery: { ...base.companionDiscovery, records: [record] },
  }, NOW + 1);
  assert.equal(completed.companionDiscovery.records[0].firstOrderCompletedAt, NOW + 1);

  const pending = normalizeMergeWorldState({
    ...base, version: 12,
    activeOrders: [{
      id: 'steppling:discovery:first-trail', characterId: 'steppling', title: 'Trail', description: 'Trail', difficulty: 'small',
      requirements: [{ definitionId: 'adventure:trail:2', quantity: 1 }],
      reward: { coins: 1, mergeXp: 1, friendshipXp: 1, energy: 0 }, createdAt: NOW,
      signature: false, purpose: 'normal', storyArcId: 'steppling:discovery',
    }],
    companionDiscovery: { ...base.companionDiscovery, records: [record] },
  }, NOW + 1);
  assert.equal(pending.companionDiscovery.records[0].firstOrderCompletedAt, null);
});

test('normalization restores a missing deterministic parcel for an untouched active path', () => {
  let state = createMossproutChapterZeroState(NOW);
  state = {
    ...state,
    activeOrders: [],
    characterProgress: { ...state.characterProgress, mossprout: { friendshipLevel: 1, completedChapterIds: ['mossprout-chapter-0'] } },
  };
  state = reduceMergeWorld(state, { type: 'startStepplingDiscovery', now: NOW + 1 }).state;
  const repaired = normalizeMergeWorldState({ ...state, arrivals: [] }, NOW + 2);
  assert.equal(repaired.arrivals.filter((arrival) => arrival.id === 'arrival:discovery:discovery:ftue-steppling').length, 1);
  assert.deepEqual(repaired.arrivals[0].itemDefinitionIds, ['adventure:trail:1']);
});

test('life affinity recommends but never removes an early discovery choice', () => {
  const none = recommendCompanionPath(['feastle', 'baristabbit', 'bedrotte'], {
    nature: 0, adventure: 0, social: 0, rest: 0, creativity: 0, discovery: 0, food: 0, home: 0,
  });
  assert.deepEqual(none, { characterId: null, strength: 'none' });
  const food = recommendCompanionPath(['feastle', 'baristabbit', 'bedrotte'], {
    nature: 0, adventure: 0, social: 1, rest: 0, creativity: 0, discovery: 0, food: 8, home: 2,
  });
  assert.deepEqual(food, { characterId: 'feastle', strength: 'strong' });
});

test('Gate 3 waits for Steppling first order and returns the complete non-missable pool', () => {
  let state = createInitialMergeWorldState(NOW, ['mossprout', 'steppling']);
  state = {
    ...state,
    mergeXp: 100,
    mergeLevel: 3,
    completedOrderCount: 6,
    companionDiscovery: {
      ...state.companionDiscovery,
      records: [
        ...state.companionDiscovery.records.filter((record) => record.characterId !== 'steppling'),
        {
          characterId: 'steppling', source: 'board_discovery', gateId: 'gate-2-steppling', pathId: 'overgrown-trail',
          discoveredAt: NOW, revealSeenAt: NOW, firstOrderCompletedAt: null, permanentFeatureId: 'journey-locker',
        },
      ],
      completedGateIds: ['gate-1-mossprout', 'gate-2-steppling'],
    },
  };
  assert.equal(nextEligibleCompanionGate(state, 1), null);
  state = {
    ...state,
    companionDiscovery: {
      ...state.companionDiscovery,
      records: state.companionDiscovery.records.map((record) => record.characterId === 'steppling'
        ? { ...record, firstOrderCompletedAt: NOW + 1 }
        : record),
    },
  };
  assert.deepEqual(nextEligibleCompanionGate(state, 1), {
    gateId: 'gate-3-first-choice',
    candidateIds: ['feastle', 'baristabbit', 'bedrotte'],
  });
});

test('Gate 4 offers the remaining two paths and Gate 5 guarantees the final early foundation', () => {
  const discoveryRecord = (characterId: 'steppling' | 'feastle' | 'baristabbit', gateId: string) => ({
    characterId, source: 'board_discovery' as const, gateId, pathId: 'path', discoveredAt: NOW,
    revealSeenAt: NOW, firstOrderCompletedAt: NOW, permanentFeatureId: 'feature',
  });
  let state = createInitialMergeWorldState(NOW, ['mossprout', 'steppling', 'feastle']);
  state = {
    ...state,
    mergeLevel: 5,
    completedOrderCount: 15,
    expansions: ['expansion:1'],
    companionDiscovery: {
      ...state.companionDiscovery,
      records: [
        ...state.companionDiscovery.records.filter((record) => !['steppling', 'feastle'].includes(record.characterId)),
        discoveryRecord('steppling', 'gate-2-steppling'), discoveryRecord('feastle', 'gate-3-first-choice'),
      ],
      completedGateIds: ['gate-1-mossprout', 'gate-2-steppling', 'gate-3-first-choice'],
    },
  };
  assert.deepEqual(nextEligibleCompanionGate(state, 2), {
    gateId: 'gate-4-expanding-world', candidateIds: ['baristabbit', 'bedrotte'],
  });

  state = {
    ...state,
    unlockedCharacters: [...state.unlockedCharacters, 'baristabbit'],
    mergeLevel: 7,
    completedOrderCount: 28,
    expansions: ['expansion:1', 'expansion:2'],
    companionDiscovery: {
      ...state.companionDiscovery,
      records: [...state.companionDiscovery.records, discoveryRecord('baristabbit', 'gate-4-expanding-world')],
      completedGateIds: [...state.companionDiscovery.completedGateIds, 'gate-4-expanding-world'],
    },
  };
  assert.deepEqual(nextEligibleCompanionGate(state, 3), {
    gateId: 'gate-5-complete-foundations', candidateIds: ['bedrotte'],
  });
});

test('an earned gate queues behind the one-discovery-per-day safeguard and opens later', () => {
  let state = createInitialMergeWorldState(NOW, ['mossprout', 'steppling']);
  state = {
    ...state,
    companionDiscovery: { ...state.companionDiscovery, lastStartedDayId: '2026-08-12' },
  };
  let result = reduceMergeWorld(state, {
    type: 'openCompanionDiscoveryGate', gateId: 'gate-3-first-choice',
    candidateIds: ['feastle', 'baristabbit', 'bedrotte'], recommendedCharacterId: null, now: NOW,
  });
  assert.equal(result.changed, true);
  assert.deepEqual(result.state.companionDiscovery.queuedGateIds, ['gate-3-first-choice']);
  assert.equal(result.state.companionDiscovery.active, null);
  result = reduceMergeWorld(result.state, {
    type: 'openCompanionDiscoveryGate', gateId: 'gate-3-first-choice',
    candidateIds: ['feastle', 'baristabbit', 'bedrotte'], recommendedCharacterId: null, now: NOW + 86_400_000,
  });
  assert.equal(result.state.companionDiscovery.active?.gateId, 'gate-3-first-choice');
  assert.deepEqual(result.state.companionDiscovery.queuedGateIds, []);
});

test('Gate 3 choice hides no candidate permanently and turns the selected mystery into its generator', () => {
  let state = createInitialMergeWorldState(NOW - 86_400_000, ['mossprout', 'steppling']);
  state = {
    ...state,
    companionDiscovery: { ...state.companionDiscovery, lastStartedDayId: '2026-08-11' },
  };
  state = reduceMergeWorld(state, {
    type: 'openCompanionDiscoveryGate', gateId: 'gate-3-first-choice',
    candidateIds: ['feastle', 'baristabbit', 'bedrotte'], recommendedCharacterId: 'feastle', now: NOW,
  }).state;
  assert.deepEqual(state.companionDiscovery.active?.candidateIds, ['feastle', 'baristabbit', 'bedrotte']);
  assert.equal(state.board[34].mist?.kind, 'discovery_fork');
  state = reduceMergeWorld(state, { type: 'selectCompanionDiscoveryPath', characterId: 'feastle', now: NOW + 1 }).state;
  assert.equal(state.companionDiscovery.active?.selectedCharacterId, 'feastle');
  const anchor = state.companionDiscovery.active!.anchorCell;
  const parcelId = 'arrival:discovery:discovery:feastle-warm-table';
  state = reduceMergeWorld(state, { type: 'claimArrival', arrivalId: parcelId, now: NOW + 2 }).state;
  for (const definitionId of ['food:table:1', 'food:table:2', 'food:table:3']) {
    const from = state.board.findIndex((cell) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === definitionId);
    const to = state.board.findIndex((cell) => cell.mist?.kind === 'dreambound_item' && cell.mist.discoveryId === 'discovery:feastle-warm-table' && cell.mist.active);
    state = reduceMergeWorld(state, { type: 'move', from, to, now: state.updatedAt + 1 }).state;
  }
  assert.ok(state.unlockedCharacters.includes('feastle'));
  assert.equal(state.board[anchor].occupant?.kind === 'generator' ? state.board[anchor].occupant.generatorId : null, 'hearth-pantry');
  assert.ok(state.companionDiscovery.completedGateIds.includes('gate-3-first-choice'));
  assert.equal(state.unlockedCharacters.includes('baristabbit'), false);
  assert.equal(state.unlockedCharacters.includes('bedrotte'), false);
});

test('every early path creates its authored generator, first order, and durable introduction completion', () => {
  for (const definition of COMPANION_DISCOVERY_CATALOG.filter((candidate) => ['feastle', 'baristabbit', 'bedrotte'].includes(candidate.characterId))) {
    let state = createInitialMergeWorldState(NOW - 86_400_000, ['mossprout', 'steppling']);
    state = reduceMergeWorld(state, {
      type: 'openCompanionDiscoveryGate', gateId: 'gate-3-first-choice',
      candidateIds: [definition.characterId], recommendedCharacterId: null, now: NOW,
    }).state;
    state = reduceMergeWorld(state, { type: 'selectCompanionDiscoveryPath', characterId: definition.characterId, now: NOW + 1 }).state;
    state = reduceMergeWorld(state, { type: 'claimArrival', arrivalId: `arrival:discovery:${definition.id}`, now: NOW + 2 }).state;
    for (const stage of definition.stages) {
      const from = state.board.findIndex((cell) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === stage.boundDefinitionId);
      const to = state.board.findIndex((cell) => cell.mist?.kind === 'dreambound_item' && cell.mist.discoveryId === definition.id && cell.mist.active);
      state = reduceMergeWorld(state, { type: 'move', from, to, now: state.updatedAt + 1 }).state;
    }
    assert.ok(definition.permanentGeneratorId);
    assert.ok(Object.values(state.generators).some((generator) => generator.id === definition.permanentGeneratorId));
    const firstOrder = state.activeOrders.find((order) => order.storyArcId === `${definition.characterId}:discovery`);
    assert.ok(firstOrder);
    assert.equal(state.companionDiscovery.records.find((record) => record.characterId === definition.characterId)?.firstOrderCompletedAt, null);
    const openCell = state.board.findIndex((cell) => !cell.locked && cell.mist == null && cell.occupant == null);
    state = withItems(state, [[openCell, item(`first-order:${definition.characterId}`, firstOrder.requirements[0].definitionId)]]);
    state = reduceMergeWorld(state, { type: 'serveOrder', orderId: firstOrder.id, now: state.updatedAt + 1 }).state;
    assert.ok(state.companionDiscovery.records.find((record) => record.characterId === definition.characterId)?.firstOrderCompletedAt);
  }
});

function storyWorld(): MergeWorldState {
  return reduceMergeWorld(createInitialMergeWorldState(NOW, ['feastle']), {
    type: 'reconcileStory', familyId: 'feastle', status: 'order_active', targetLevel: 2, now: NOW + 1,
  }).state;
}

function item(instanceId: string, definitionId: string): MergeBoardItem {
  assert.ok(MERGE_ITEMS_BY_ID.has(definitionId));
  return { kind: 'item', instanceId, definitionId };
}

function withItems(state: MergeWorldState, placements: [number, MergeBoardItem][]): MergeWorldState {
  const board = [...state.board];
  for (const [cell, boardItem] of placements) board[cell] = { ...board[cell], locked: false, occupant: boardItem };
  return { ...state, board };
}
