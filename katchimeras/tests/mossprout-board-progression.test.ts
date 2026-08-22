import assert from 'node:assert/strict';
import test from 'node:test';

import { KATCHIMERA_MERGE_PROFILES, MERGE_GENERATORS, MERGE_ITEMS_BY_ID, MOSSPROUT_GARDEN_GROWTH_CLEARINGS, MOSSPROUT_ROOTBOUND_GATES } from '@/constants/merge-world-catalog';
import type { MergeWorldState, MossproutProgressionSignals, MossproutRootGateState } from '@/types/merge-world';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { mossproutRootConditionCopy, mossproutRootReadyCopy, mossproutRootRewardCopy } from '@/utils/merge-world/merge-board-player-copy';
import { mossproutFocusStage } from '@/utils/merge-world/mossprout-focus-progression';
import { createMossproutChapterZeroState } from '@/utils/merge-world/onboarding';
import { answerJourneyConversation, emptyCompanionJourneyState, startJourneyConversation } from '@/utils/companion-journey';
import { addCompanionQuickGoal, completeCompanionQuickGoal, emptyCompanionQuickGoalState } from '@/utils/companion-quick-goals';

const NOW = Date.UTC(2026, 7, 22, 12);

function activeDays(count: number) {
  return Array.from({ length: count }, (_, index) => `active-${String(index + 1).padStart(2, '0')}`);
}

function signals(count: number, overrides: Partial<MossproutProgressionSignals> = {}): MossproutProgressionSignals {
  return {
    activeJourneyDayIds: activeDays(count),
    friendshipLevel: 1,
    natureMemoryDayIds: [],
    focusStage: 0,
    ownedWispIds: [],
    completedGardenDayIds: [],
    ...overrides,
  };
}

test('every Mossprout root translates internal rules into concrete player instructions', () => {
  const copy = MOSSPROUT_ROOTBOUND_GATES.flatMap((root) => [
    mossproutRootConditionCopy(root),
    mossproutRootReadyCopy(root),
    mossproutRootRewardCopy(root),
  ]).join(' ');

  assert.match(copy, /Reach Mossprout Journey Day 15/);
  assert.match(copy, /Reach Friendship Level 8 with Mossprout/);
  assert.match(copy, /Choose a nature direction with Mossprout/);
  assert.match(copy, /Complete 3 activities that support your nature direction/);
  assert.match(copy, /Adds the Memory Nursery to your board/);
  assert.match(copy, /Gives a rare Memory Card to reveal/);
  assert.doesNotMatch(copy, /generator|tier|focus stage|fallback|gate|target|definition|receipt|schema|progress \d/i);
});

test('the Mossprout direction questionnaire and its activities advance board focus roots', () => {
  let journey = startJourneyConversation(emptyCompanionJourneyState(), 'mossprout', 100);
  const answers = ['attention', 'garden', 'care-plant'];
  for (const [index, answer] of answers.entries()) {
    const session = journey.conversations.find((candidate) => candidate.familyId === 'mossprout' && !candidate.completedAt)!;
    journey = answerJourneyConversation(journey, session.id, answer, 110 + index).state;
  }
  assert.equal(mossproutFocusStage(journey, emptyCompanionQuickGoalState()), 1);

  let quickGoals = emptyCompanionQuickGoalState();
  for (let index = 0; index < 3; index += 1) {
    const added = addCompanionQuickGoal(quickGoals, {
      familyId: 'mossprout',
      title: `Nature activity ${index + 1}`,
      cadence: { kind: 'once', dayId: `2026-08-${20 + index}` },
    }, 200 + index);
    quickGoals = added.state;
    quickGoals = completeCompanionQuickGoal(
      quickGoals,
      added.goal!.id,
      `2026-08-${20 + index}`,
      300 + index,
    ).state;
  }
  assert.equal(mossproutFocusStage(journey, quickGoals), 2);

  const goal = journey.goals.find((candidate) => candidate.familyId === 'mossprout')!;
  journey = {
    ...journey,
    reflectionEvents: [{
      id: 'reflection:mossprout:test', familyId: 'mossprout', goalId: goal.id,
      sourceId: 'test', occurredAt: 400,
    }],
  };
  assert.equal(mossproutFocusStage(journey, quickGoals), 3);
  journey = { ...journey, goals: journey.goals.map((candidate) => candidate.id === goal.id ? { ...candidate, status: 'completed' } : candidate) };
  assert.equal(mossproutFocusStage(journey, quickGoals), 4);
});

function awakenedEarlierGates(state: MergeWorldState, beforeGateId: string): MergeWorldState {
  const gates: Record<string, MossproutRootGateState> = { ...state.mossproutBoardProgression.gates };
  for (const definition of MOSSPROUT_ROOTBOUND_GATES) {
    if (definition.id === beforeGateId) break;
    gates[definition.id] = {
      gateId: definition.id,
      status: 'awakened',
      readyAt: NOW,
      awakenedAt: NOW,
      parcelId: `arrival:root-match:${definition.id}`,
      fallbackUsed: false,
    };
  }
  return {
    ...state,
    mossproutBoardProgression: { ...state.mossproutBoardProgression, gates, lastParcelDayId: null },
  };
}

function claimAndAwaken(state: MergeWorldState, gateId: string, now: number) {
  const arrivalId = `arrival:root-match:${gateId}`;
  const claimed = reduceMergeWorld(state, { type: 'claimArrival', arrivalId, now });
  assert.equal(claimed.changed, true);
  assert.equal(claimed.spawnedItems?.length, 1);
  const sourceCell = claimed.spawnedItems![0].cell;
  const targetCell = MOSSPROUT_ROOTBOUND_GATES.find((gate) => gate.id === gateId)!.cell;
  return reduceMergeWorld(claimed.state, { type: 'move', from: sourceCell, to: targetCell, now: now + 1 });
}

test('Mossprout queues one exact root match per active day and reconciliation is idempotent', () => {
  let state = createInitialMergeWorldState(NOW, ['mossprout']);
  const dayFive = signals(5);
  const first = reduceMergeWorld(state, {
    type: 'reconcileMossproutBoardProgression', signals: dayFive, dayId: 'active-05', now: NOW + 1,
  });
  assert.equal(first.changed, true);
  state = first.state;
  assert.equal(state.arrivals.filter((arrival) => arrival.kind === 'root_match_parcel').length, 1);
  assert.deepEqual(state.arrivals.find((arrival) => arrival.kind === 'root_match_parcel')?.itemDefinitionIds, ['mossprout:root-memory:returning-seed']);
  assert.equal(state.arrivals.find((arrival) => arrival.kind === 'root_match_parcel')?.chainId, 'nature:root-memory');
  assert.equal(state.mossproutBoardProgression.gates['root:day-5-first-return'].status, 'ready');
  assert.equal(state.board[0].mist?.kind === 'rootbound_echo' ? state.board[0].mist.ready : null, true);

  const repeated = reduceMergeWorld(state, {
    type: 'reconcileMossproutBoardProgression', signals: dayFive, dayId: 'active-05', now: NOW + 2,
  });
  assert.equal(repeated.changed, false);
  assert.equal(repeated.state.arrivals.filter((arrival) => arrival.kind === 'root_match_parcel').length, 1);
});

test('every covered board cell belongs to one clear progression lane', () => {
  const state = createInitialMergeWorldState(NOW, ['mossprout']);
  assert.equal(state.board.filter((cell) => !cell.locked).length, 13);
  assert.equal(state.board.filter((cell) => cell.mist?.kind === 'rootbound_echo').length, 12);
  assert.equal(state.board.filter((cell) => cell.mist?.kind === 'garden_growth').length, 18);
  assert.equal(state.board.filter((cell) => cell.mist?.kind === 'discovery_dormant').length, 20);
});

test('v16 dormant fog migrates into the authored Garden Growth and Discovery lanes', () => {
  const legacy = structuredClone(createInitialMergeWorldState(NOW, ['mossprout'])) as unknown as { version: number; board: MergeWorldState['board'] };
  legacy.version = 16;
  legacy.board = legacy.board.map((cell) => cell.locked && cell.mist?.kind !== 'rootbound_echo'
    ? { ...cell, mist: { kind: 'dormant' as const } }
    : cell);
  const migrated = normalizeMergeWorldState(legacy, NOW + 1);
  assert.equal(migrated.version, 17);
  assert.equal(migrated.board.filter((cell) => cell.mist?.kind === 'garden_growth').length, 18);
  assert.equal(migrated.board.filter((cell) => cell.mist?.kind === 'discovery_dormant').length, 20);
});

test('Garden Growth Mist opens three cells at each authored Journey beat', () => {
  let state = createInitialMergeWorldState(NOW, ['mossprout']);
  for (const [index, clearing] of MOSSPROUT_GARDEN_GROWTH_CLEARINGS.entries()) {
    state = reduceMergeWorld(state, {
      type: 'reconcileMossproutBoardProgression',
      signals: signals(clearing.revealDay),
      dayId: `growth-${clearing.revealDay}`,
      now: NOW + index + 1,
    }).state;
    assert.ok(state.expansions.includes(clearing.id));
    assert.ok(clearing.cells.every((cell) => state.board[cell].mist?.kind !== 'garden_growth'));
    assert.equal(state.board.filter((cell) => cell.mist?.kind === 'garden_growth').length, 18 - ((index + 1) * 3));
  }
});

test('all Garden Growth, Discovery Mist, and Rootbound cells can be permanently opened', () => {
  const fullSignals = signals(28, {
    friendshipLevel: 20,
    natureMemoryDayIds: ['memory-1', 'memory-2', 'memory-3'],
    focusStage: 4,
    ownedWispIds: ['fern'],
    completedGardenDayIds: ['garden-1', 'garden-2', 'garden-3', 'garden-4'],
  });
  let state = createInitialMergeWorldState(NOW, ['mossprout']);
  for (let index = 0; index < MOSSPROUT_ROOTBOUND_GATES.length; index += 1) {
    state = reduceMergeWorld(state, {
      type: 'reconcileMossproutBoardProgression', signals: fullSignals, dayId: `root-queue-${index}`, now: NOW + index * 4 + 1,
    }).state;
    const ready = MOSSPROUT_ROOTBOUND_GATES.find((gate) => state.mossproutBoardProgression.gates[gate.id]?.status === 'ready');
    assert.ok(ready);
    state = claimAndAwaken(state, ready.id, NOW + index * 4 + 2).state;
  }
  state = reduceMergeWorld(state, {
    type: 'reconcileCharacters', characterIds: Object.keys(KATCHIMERA_MERGE_PROFILES), now: NOW + 100,
  }).state;
  assert.equal(state.board.filter((cell) => cell.locked || cell.mist).length, 0);
  assert.equal(state.expansions.length, MOSSPROUT_GARDEN_GROWTH_CLEARINGS.length);
});

test('every root uses progression-only Mossprout art and no generator can drop it', () => {
  const generatorDrops = new Set(MERGE_GENERATORS.flatMap((generator) => generator.tierOneDropDefinitionIds));
  for (const gate of MOSSPROUT_ROOTBOUND_GATES) {
    const item = MERGE_ITEMS_BY_ID.get(gate.rootMemoryDefinitionId);
    assert.ok(item, gate.id);
    assert.equal(item.familyId, 'nature');
    assert.equal(item.chainId, 'nature:root-memory');
    assert.equal(item.progressionOnly, true);
    assert.equal(generatorDrops.has(item.id), false);
  }
});

test('Root Memories are gate-bound and cannot be stored, sold, or used on a sibling root', () => {
  let state = createInitialMergeWorldState(NOW, ['mossprout']);
  state = reduceMergeWorld(state, {
    type: 'reconcileMossproutBoardProgression', signals: signals(5), dayId: 'active-05', now: NOW + 1,
  }).state;
  state = reduceMergeWorld(state, {
    type: 'reconcileMossproutBoardProgression', signals: signals(7), dayId: 'active-07', now: NOW + 2,
  }).state;
  const claimed = reduceMergeWorld(state, {
    type: 'claimArrival', arrivalId: 'arrival:root-match:root:day-5-first-return', now: NOW + 3,
  });
  const sourceCell = claimed.spawnedItems![0].cell;
  assert.equal(claimed.state.board[sourceCell].occupant?.kind === 'item' ? claimed.state.board[sourceCell].occupant.progressionGateId : null, 'root:day-5-first-return');
  assert.equal(reduceMergeWorld(claimed.state, { type: 'storeItem', cell: sourceCell, now: NOW + 4 }).changed, false);
  assert.equal(reduceMergeWorld(claimed.state, { type: 'sellItem', cell: sourceCell, now: NOW + 5 }).changed, false);
  const wrongRoot = reduceMergeWorld(claimed.state, { type: 'move', from: sourceCell, to: 1, now: NOW + 6 });
  assert.equal(wrongRoot.changed, false);
  assert.equal(wrongRoot.failureReason, 'wrong_echo_match');
  assert.ok(wrongRoot.state.board[sourceCell].occupant);
});

test('a sealed root rejects its match until its life condition is ready', () => {
  const state = createInitialMergeWorldState(NOW, ['mossprout']);
  const sourceCell = state.board.findIndex((cell) => !cell.locked && !cell.mist && !cell.occupant);
  assert.ok(sourceCell >= 0);
  const board = [...state.board];
  board[sourceCell] = {
    ...board[sourceCell],
    occupant: { kind: 'item', instanceId: 'test:sealed-root-match', definitionId: 'mossprout:root-memory:returning-seed', progressionGateId: 'root:day-5-first-return' },
  };
  const result = reduceMergeWorld({ ...state, board }, { type: 'move', from: sourceCell, to: 0, now: NOW + 1 });
  assert.equal(result.changed, false);
  assert.equal(result.failureReason, 'sealed_mist');
  assert.equal(result.state.board[sourceCell].occupant?.kind, 'item');
});

test('authored roots upgrade Mossprout generators and award a visible rare Wisp', () => {
  let garden = awakenedEarlierGates(createMossproutChapterZeroState(NOW), 'root:day-7-two-shores');
  garden = reduceMergeWorld(garden, {
    type: 'reconcileMossproutBoardProgression', signals: signals(7), dayId: 'active-07', now: NOW + 1,
  }).state;
  const grown = claimAndAwaken(garden, 'root:day-7-two-shores', NOW + 2);
  assert.equal(grown.state.generators['wild-garden'].level, 2);

  let fern = awakenedEarlierGates(createInitialMergeWorldState(NOW, ['mossprout']), 'root:memory-two-days');
  fern = reduceMergeWorld(fern, {
    type: 'reconcileMossproutBoardProgression',
    signals: signals(12, { natureMemoryDayIds: ['memory-1', 'memory-2'] }),
    dayId: 'active-12', now: NOW + 4,
  }).state;
  const woken = claimAndAwaken(fern, 'root:memory-two-days', NOW + 5);
  assert.equal(woken.state.externalRewardReceipts.find((receipt) => receipt.sourceId === 'root:memory-two-days')?.wispId, 'fern');
});

test('the day-21 root awards a separate rare Memory Card and reveal receipt', () => {
  let state = awakenedEarlierGates(createInitialMergeWorldState(NOW, ['mossprout']), 'root:focus-second');
  state = reduceMergeWorld(state, {
    type: 'reconcileMossproutBoardProgression', signals: signals(21, { focusStage: 2 }), dayId: 'active-21', now: NOW + 1,
  }).state;
  const awakened = claimAndAwaken(state, 'root:focus-second', NOW + 2);
  assert.equal(awakened.state.ownedKatchimeraCards.length, 0);
  assert.equal(awakened.state.ownedMemoryCards.length, 1);
  assert.equal(awakened.state.ownedMemoryCards[0].rarity, 'rare');
  assert.equal(awakened.state.ownedMemoryCards[0].revealedAt, null);
  const revealed = reduceMergeWorld(awakened.state, { type: 'revealMemoryCard', cardId: awakened.state.ownedMemoryCards[0].cardId, now: NOW + 4 });
  assert.equal(revealed.state.ownedMemoryCards[0].revealedAt, NOW + 4);
});

test('v15 claimed foreign matches migrate safely to a replacement Root Memory parcel', () => {
  let current = createInitialMergeWorldState(NOW, ['mossprout']);
  current = reduceMergeWorld(current, {
    type: 'reconcileMossproutBoardProgression', signals: signals(5), dayId: 'active-05', now: NOW + 1,
  }).state;
  const claimed = reduceMergeWorld(current, {
    type: 'claimArrival', arrivalId: 'arrival:root-match:root:day-5-first-return', now: NOW + 2,
  });
  const itemCell = claimed.spawnedItems![0].cell;
  const legacy = structuredClone(claimed.state) as unknown as { version: number; board: MergeWorldState['board']; arrivals: MergeWorldState['arrivals'] };
  legacy.version = 15;
  legacy.board[itemCell].occupant = { kind: 'item', instanceId: 'legacy-foreign-match', definitionId: 'food:table:1' };
  legacy.arrivals[0].itemDefinitionIds = ['food:table:1'];
  const migrated = normalizeMergeWorldState(legacy, NOW + 3);
  assert.equal(migrated.version, 17);
  assert.equal(migrated.board[itemCell].occupant?.kind === 'item' ? migrated.board[itemCell].occupant.definitionId : null, 'food:table:1');
  const replacement = migrated.arrivals.find((arrival) => arrival.id === 'arrival:root-memory-reissue:root:day-5-first-return:v16');
  assert.deepEqual(replacement?.itemDefinitionIds, ['mossprout:root-memory:returning-seed']);
  assert.equal(replacement?.claimedAt, null);
});

test('nature-memory roots use the authored soft fallback after sustained garden play', () => {
  let state = awakenedEarlierGates(createInitialMergeWorldState(NOW, ['mossprout']), 'root:memory-first');
  state = reduceMergeWorld(state, {
    type: 'reconcileMossproutBoardProgression',
    signals: signals(11, { completedGardenDayIds: ['garden-1', 'garden-2'] }),
    dayId: 'active-11',
    now: NOW + 1,
  }).state;
  assert.equal(state.mossproutBoardProgression.gates['root:memory-first'].status, 'ready');
  assert.equal(state.mossproutBoardProgression.gates['root:memory-first'].fallbackUsed, true);
});

test('awakening the day-15 Nursery Key installs the keepsake generator and chain', () => {
  let state = awakenedEarlierGates(createInitialMergeWorldState(NOW, ['mossprout']), 'root:nursery-key');
  state = reduceMergeWorld(state, {
    type: 'reconcileMossproutBoardProgression', signals: signals(15), dayId: 'active-15', now: NOW + 1,
  }).state;
  const awakened = claimAndAwaken(state, 'root:nursery-key', NOW + 2);
  assert.equal(awakened.changed, true);
  assert.equal(awakened.state.mossproutBoardProgression.gates['root:nursery-key'].status, 'awakened');
  assert.ok(awakened.state.generators['memory-nursery']);
  assert.ok(awakened.state.unlockedChains.includes('nature:keepsake'));
  assert.ok(awakened.state.board.some((cell) => cell.occupant?.kind === 'generator' && cell.occupant.generatorId === 'memory-nursery'));
});

test('Grovelight replaces a consumed or lost match parcel once per cooldown window', () => {
  let state = createInitialMergeWorldState(NOW, ['mossprout']);
  state = reduceMergeWorld(state, {
    type: 'reconcileMossproutBoardProgression',
    signals: signals(5, { ownedWispIds: ['grovelight'] }),
    dayId: 'active-05',
    now: NOW + 1,
  }).state;
  const claimed = reduceMergeWorld(state, {
    type: 'claimArrival', arrivalId: 'arrival:root-match:root:day-5-first-return', now: NOW + 2,
  });
  assert.equal(claimed.changed, true);
  const matchCell = claimed.spawnedItems![0].cell;
  const board = [...claimed.state.board];
  board[matchCell] = { ...board[matchCell], occupant: null };

  const recovered = reduceMergeWorld({ ...claimed.state, board }, {
    type: 'useGrovelightResonance', gateId: 'root:day-5-first-return', dayId: 'active-05', now: NOW + 3,
  });
  assert.equal(recovered.changed, true);
  assert.ok(recovered.state.arrivals.some((arrival) => arrival.id === 'arrival:grovelight:root:day-5-first-return:active-05'));
  const duplicate = reduceMergeWorld(recovered.state, {
    type: 'useGrovelightResonance', gateId: 'root:day-5-first-return', dayId: 'active-05', now: NOW + 4,
  });
  assert.equal(duplicate.changed, false);
});

test('the day-28 Heartwood root awards Grovelight exactly once', () => {
  let state = awakenedEarlierGates(createInitialMergeWorldState(NOW, ['mossprout']), 'root:heartwood');
  state = reduceMergeWorld(state, {
    type: 'reconcileMossproutBoardProgression', signals: signals(28), dayId: 'active-28', now: NOW + 1,
  }).state;
  const awakened = claimAndAwaken(state, 'root:heartwood', NOW + 2);
  assert.equal(awakened.changed, true);
  const rewards = awakened.state.externalRewardReceipts.filter((receipt) => receipt.id === 'merge-wisp:mossprout:grovelight');
  assert.equal(rewards.length, 1);
  assert.equal(rewards[0].wispId, 'grovelight');
});
