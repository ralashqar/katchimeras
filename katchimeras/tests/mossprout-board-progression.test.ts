import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LEGACY_RESIDENT_CARD_KEY_DEFINITION_ID,
  MOSSPROUT_RESIDENT_CARD_NODES,
  RESIDENT_CARD_DEFINITION_ID,
  RESIDENT_CARD_KEY_DEFINITION_ID,
  RETIRED_RESIDENT_NODE_ROOT_GATE_IDS,
} from '@/constants/resident-card-discovery';
import { mergeFtueBoardGate, mergeFtueRailGate, mergeFtueRepairTarget, mergeFtueStepForBoard } from '@/features/onboarding/merge-ftue';
import { mossproutFtueStep } from '@/features/onboarding/mossprout-ftue-script';
import type { MergeWorldState, MossproutProgressionSignals } from '@/types/merge-world';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld, resetMergeActivityForDay } from '@/utils/merge-world/engine';

const NOW = new Date('2026-08-25T10:00:00.000Z').getTime();

function fresh() {
  return { ...createInitialMergeWorldState(NOW, ['mossprout']), activeOrders: [] };
}

function activate(residentId = 'petalimp' as const) {
  return reduceMergeWorld(fresh(), {
    type: 'activateResidentCardDiscovery', campaignId: 'mossprout:journey', journeyDayId: 'journey-day-1', residentId, now: NOW + 1,
  }).state;
}

function claimAndReveal(state: MergeWorldState) {
  const record = state.residentCardDiscovery.records[0]!;
  const claimed = reduceMergeWorld(state, { type: 'claimArrival', arrivalId: record.parcelId!, now: NOW + 2 });
  assert.equal(claimed.changed, true);
  const keyCell = claimed.state.board.findIndex((cell) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === RESIDENT_CARD_KEY_DEFINITION_ID);
  const revealed = reduceMergeWorld(claimed.state, { type: 'move', from: keyCell, to: record.nodeCell, now: NOW + 3 });
  assert.deepEqual(revealed.residentCardRevealed, { discoveryId: record.id, residentId: record.residentId });
  return revealed.state;
}

function placeRequirement(state: MergeWorldState, definitionId: string, now: number) {
  const cell = state.board.findIndex((entry) => !entry.locked && !entry.mist && !entry.occupant);
  assert.ok(cell >= 0);
  const board = [...state.board];
  board[cell] = { ...board[cell], occupant: { kind: 'item', instanceId: `test:${now}`, definitionId } };
  return { ...state, board, revision: state.revision + 1, updatedAt: now };
}

test('all eight resident cards are visible as locked board nodes in their authored cells', () => {
  const state = fresh();
  assert.deepEqual(MOSSPROUT_RESIDENT_CARD_NODES.map((node) => node.cell), [0, 1, 5, 6, 7, 8, 12, 13]);
  for (const node of MOSSPROUT_RESIDENT_CARD_NODES) {
    const cell = state.board[node.cell];
    assert.equal(cell.locked, true);
    assert.equal(cell.mist?.kind, 'resident_card');
    if (cell.mist?.kind === 'resident_card') {
      assert.equal(cell.mist.ready, false);
      assert.equal(cell.mist.residentId, null);
    }
  }
});

test('activation is idempotent and creates one bound parcel for one card', () => {
  const state = activate();
  const replay = reduceMergeWorld(state, {
    type: 'activateResidentCardDiscovery', campaignId: 'mossprout:journey', journeyDayId: 'journey-day-1', residentId: 'petalimp', now: NOW + 2,
  });
  assert.equal(state.residentCardDiscovery.records.length, 1);
  assert.equal(state.arrivals.filter((arrival) => arrival.kind === 'resident_card_parcel').length, 1);
  assert.equal(replay.changed, false);
  const node = state.board[0].mist;
  assert.equal(node?.kind, 'resident_card');
  if (node?.kind === 'resident_card') assert.equal(node.ready, true);
});

test('a sealed resident card can reveal its Journey resident in any locked card cell', () => {
  const state = activate();
  const record = state.residentCardDiscovery.records[0]!;
  const claimed = reduceMergeWorld(state, { type: 'claimArrival', arrivalId: record.parcelId!, now: NOW + 2 }).state;
  const keyCell = claimed.board.findIndex((cell) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === RESIDENT_CARD_KEY_DEFINITION_ID);
  const sibling = MOSSPROUT_RESIDENT_CARD_NODES.find((node) => node.residentId === 'fernip')!;
  const revealed = reduceMergeWorld(claimed, { type: 'move', from: keyCell, to: sibling.cell, now: NOW + 3 });
  assert.equal(revealed.changed, true);
  assert.deepEqual(revealed.residentCardRevealed, { discoveryId: record.id, residentId: 'petalimp' });
  assert.equal(revealed.state.residentCardDiscovery.records[0]?.nodeCell, sibling.cell);
  assert.equal(revealed.state.board[sibling.cell].locked, false);
  assert.equal(revealed.state.board[record.nodeCell].mist?.kind, 'resident_card');
  assert.equal(revealed.state.board[record.nodeCell].locked, true);
});

test('a later resident allocates another locked card after an earlier resident chose its authored cell', () => {
  const first = activate();
  const firstRecord = first.residentCardDiscovery.records[0]!;
  const claimed = reduceMergeWorld(first, { type: 'claimArrival', arrivalId: firstRecord.parcelId!, now: NOW + 2 }).state;
  const cardCell = claimed.board.findIndex((cell) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === RESIDENT_CARD_DEFINITION_ID);
  const fernipNode = MOSSPROUT_RESIDENT_CARD_NODES.find((node) => node.residentId === 'fernip')!;
  const revealed = reduceMergeWorld(claimed, { type: 'move', from: cardCell, to: fernipNode.cell, now: NOW + 3 }).state;
  const second = reduceMergeWorld(revealed, {
    type: 'activateResidentCardDiscovery', campaignId: 'mossprout:journey', journeyDayId: 'journey-day-2', residentId: 'fernip', now: NOW + 4,
  });
  assert.equal(second.changed, true);
  assert.notEqual(second.state.residentCardDiscovery.records[1]?.nodeCell, fernipNode.cell);
  assert.equal(second.state.board[fernipNode.cell].locked, false);
});

test('resident FTUE binds its parcel and drag targets to the active discovery', () => {
  const ready = activate();
  const record = ready.residentCardDiscovery.records[0]!;
  assert.equal(mergeFtueStepForBoard(ready, null)?.id, 'merge.resident_parcel');
  assert.deepEqual(mergeFtueRailGate(mossproutFtueStep('merge.resident_parcel'), ready), { kind: 'parcel', arrivalId: record.parcelId });

  const claimed = reduceMergeWorld(ready, { type: 'claimArrival', arrivalId: record.parcelId!, now: NOW + 2 }).state;
  assert.equal(mergeFtueStepForBoard(claimed, null)?.id, 'merge.resident_card');
  const cardCell = claimed.board.findIndex((cell) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === RESIDENT_CARD_DEFINITION_ID);
  assert.deepEqual(mergeFtueBoardGate(mossproutFtueStep('merge.resident_card'), claimed), {
    kind: 'drag', fromCell: cardCell, toCell: record.nodeCell,
  });
  assert.equal(mergeFtueRepairTarget(mossproutFtueStep('merge.resident_parcel'), claimed), 'merge.resident_card');
});

test('normalization migrates a claimed legacy key and never deletes the gated card', () => {
  const state = activate();
  const record = state.residentCardDiscovery.records[0]!;
  const claimed = reduceMergeWorld(state, { type: 'claimArrival', arrivalId: record.parcelId!, now: NOW + 2 }).state;
  const legacy: MergeWorldState = {
    ...claimed,
    board: claimed.board.map((cell) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === RESIDENT_CARD_DEFINITION_ID
      ? { ...cell, occupant: { ...cell.occupant, definitionId: LEGACY_RESIDENT_CARD_KEY_DEFINITION_ID } }
      : cell),
  };
  const normalized = normalizeMergeWorldState(legacy, NOW + 3);
  const migrated = normalized.board.find((cell) => cell.occupant?.kind === 'item' && cell.occupant.progressionGateId === record.nodeGateId)?.occupant;
  assert.equal(migrated?.kind === 'item' ? migrated.definitionId : null, RESIDENT_CARD_DEFINITION_ID);
  assert.equal(normalized.arrivals.filter((arrival) => arrival.kind === 'resident_card_parcel' && arrival.claimedAt == null).length, 0);
});

test('reveal, resident dialogue, two sequential orders, and card reward form one durable lifecycle', () => {
  let state = claimAndReveal(activate());
  const record = state.residentCardDiscovery.records[0]!;
  assert.equal(record.status, 'revealed');
  state = reduceMergeWorld(state, { type: 'ackResidentCardDialogue', discoveryId: record.id, now: NOW + 4 }).state;
  assert.equal(state.activeOrders.length, 1);
  assert.equal(state.activeOrders[0]?.storyStep, 1);

  let order = state.activeOrders[0]!;
  state = placeRequirement(state, order.requirements[0]!.definitionId, NOW + 5);
  const first = reduceMergeWorld(state, { type: 'serveOrder', orderId: order.id, now: NOW + 6 });
  assert.equal(first.residentCardEarned, undefined);
  assert.equal(first.state.activeOrders.find((candidate) => candidate.storyArcId === record.id)?.storyStep, 2);

  order = first.state.activeOrders.find((candidate) => candidate.storyArcId === record.id)!;
  state = placeRequirement(first.state, order.requirements[0]!.definitionId, NOW + 7);
  const second = reduceMergeWorld(state, { type: 'serveOrder', orderId: order.id, now: NOW + 8 });
  assert.deepEqual(second.residentCardEarned, { discoveryId: record.id, residentId: 'petalimp' });
  assert.equal(second.state.residentCardDiscovery.records[0]?.status, 'card_earned');
  assert.equal(second.state.ownedKatchimeraCards.find((card) => card.cardId === 'petalimp')?.acquisition, 'resident_discovery');
  assert.equal(second.state.residentCardDiscovery.records[0]?.cardRevealSeenAt, null);

  const acknowledged = reduceMergeWorld(second.state, { type: 'ackResidentCardReveal', discoveryId: record.id, now: NOW + 9 });
  assert.equal(acknowledged.state.residentCardDiscovery.records[0]?.cardRevealSeenAt, NOW + 9);
});

test('normalization resumes parcel, reveal, orders, and unacknowledged card states without duplication', () => {
  let state = activate();
  state = normalizeMergeWorldState(state, NOW + 10);
  assert.equal(state.residentCardDiscovery.records.length, 1);
  assert.equal(state.arrivals.filter((arrival) => arrival.kind === 'resident_card_parcel').length, 1);

  state = claimAndReveal(state);
  const revealed = normalizeMergeWorldState(state, NOW + 11);
  assert.equal(revealed.residentCardDiscovery.records[0]?.status, 'revealed');
  assert.equal(revealed.board[0].locked, false);

  const orders = reduceMergeWorld(revealed, { type: 'ackResidentCardDialogue', discoveryId: revealed.residentCardDiscovery.records[0]!.id, now: NOW + 12 }).state;
  const resumed = normalizeMergeWorldState(orders, NOW + 13);
  assert.equal(resumed.activeOrders.filter((order) => order.storyArcId === resumed.residentCardDiscovery.records[0]!.id).length, 1);
});

test('reset current Journey rewinds its parcel, card node, orders, sealed card, and earned resident', () => {
  let state = claimAndReveal(activate());
  const record = state.residentCardDiscovery.records[0]!;
  state = reduceMergeWorld(state, { type: 'ackResidentCardDialogue', discoveryId: record.id, now: NOW + 4 }).state;
  const reset = resetMergeActivityForDay(state, 'journey-day-1', NOW + 5);
  assert.equal(reset.residentCardDiscovery.records.some((candidate) => candidate.id === record.id), false);
  assert.equal(reset.arrivals.some((arrival) => arrival.discoveryId === record.id), false);
  assert.equal(reset.activeOrders.some((order) => order.storyArcId === record.id), false);
  assert.equal(reset.ownedKatchimeraCards.some((card) => card.cardId === record.residentId), false);
  assert.equal(reset.board[record.nodeCell].mist?.kind, 'resident_card');
  assert.equal(reset.board[record.nodeCell].locked, true);
});

test('v18 owned resident cards migrate to earned records and never replay their reveal', () => {
  const old = createInitialMergeWorldState(NOW, ['mossprout']);
  const migrated = normalizeMergeWorldState({
    ...old,
    version: 18,
    residentCardDiscovery: undefined,
    ownedKatchimeraCards: [{ cardId: 'fernip', familyId: 'mossprout', acquisition: 'story_resident', sourceReceiptId: 'legacy:fernip', acquiredAt: NOW, coinCost: 0 }],
  }, NOW + 1);
  const record = migrated.residentCardDiscovery.records.find((candidate) => candidate.residentId === 'fernip');
  assert.equal(record?.status, 'card_earned');
  assert.equal(record?.cardRevealSeenAt, NOW);
  assert.equal(migrated.board[1].locked, false);
});

test('retired root parcels are removed while their material rewards settle once through receipts', () => {
  const signals: MossproutProgressionSignals = {
    activeJourneyDayIds: Array.from({ length: 17 }, (_, index) => `day-${index + 1}`),
    completedBeatIds: [], friendshipLevel: 1, natureMemoryDayIds: [], focusStage: 0, ownedWispIds: [], completedGardenDayIds: [],
  };
  const first = reduceMergeWorld(fresh(), { type: 'reconcileMossproutBoardProgression', signals, dayId: 'day-17', now: NOW + 1 }).state;
  const replay = reduceMergeWorld(first, { type: 'reconcileMossproutBoardProgression', signals, dayId: 'day-17', now: NOW + 2 }).state;
  assert.equal(first.generators['wild-garden']?.level, 3);
  assert.ok(first.generators['memory-nursery']);
  assert.ok(first.externalRewardReceipts.some((receipt) => receipt.id === 'retired-root:wisp:fern'));
  assert.ok(first.rewardInbox.some((entry) => entry.id === 'retired-root:keepsake'));
  assert.equal(first.residentCardDiscovery.campaignMilestoneReceiptIds.length, 5);
  assert.equal(replay.residentCardDiscovery.campaignMilestoneReceiptIds.length, 5);
  assert.equal(replay.arrivals.some((arrival) => arrival.progressionGateId && RETIRED_RESIDENT_NODE_ROOT_GATE_IDS.has(arrival.progressionGateId)), false);
});
