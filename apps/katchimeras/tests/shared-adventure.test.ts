import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { adventureNext, emptyAdventure, reduceAdventure } from '@/features/shared-adventure/runtime';
import { LANTERN_ROUTES, SIGNAL_MISSION, PREPARATION_ORDER_ID, DOORSTEP_ORDER_ID } from '@/features/shared-adventure/catalog';
import { missionPairs, missionWakes, missionWindow } from '@/features/mission-mechanics/board-window';
import { newWorldMilestones } from '@/features/live-ops/merge-events';
import type { MergeWorldState } from '@/types/merge-world';
import { loadNativeModule } from './helpers/native-motion-harness';
import { ISLAND_CAMPAIGNS } from '@/constants/island-campaigns/registry';
import { revealIsland, greetIslandFriend } from './helpers/island-campaign';

const NOW = new Date(2026, 8, 18, 12).getTime();
function ready() { const w = createInitialMergeWorldState(NOW); w.kingdomGoal = { introducedAt: NOW, coachmarkSeenAt: null }; return w; }
function served(w: MergeWorldState, id: string) {
  // Use the real Garden serve command with exactly the requested inventory.
  const order = w.activeOrders.find(o => o.id === id)!;
  let index = 0;
  for (const requirement of order.requirements) for (let n = 0; n < requirement.quantity; n++) {
    w.board[index] = { ...w.board[index], locked: false, blocker: null, mist: null, occupant: { kind: 'item', definitionId: requirement.definitionId, instanceId: `test:${index}` } }; index++;
  }
  const result = reduceMergeWorld(w, { type: 'serveOrder', orderId: id, now: NOW });
  assert.equal(result.changed, true, result.message);
  return result.state;
}
function solve(w: MergeWorldState, now = NOW) {
  const runId = w.sharedAdventure!.run!.id;
  for (let i = 0; i < 12; i++) {
    const run = w.sharedAdventure!.run!;
    const cells = missionWindow(4).cellIndices;
    const move = missionWakes(run.board, cells)[0] ?? missionPairs(run.board, cells)[0];
    if (!move) break;
    w = reduceAdventure(w, { type: 'move', runId, from: move.from, to: move.to }, now).state;
  }
  return reduceAdventure(w, { type: 'finish_route', runId }, now).state;
}
test('the full shared arc uses real Garden receipts, preserves personal state, and builds the post once', () => {
  let w = ready();
  const personal = structuredClone(w.islandCampaigns);
  w = reduceAdventure(w, { type: 'acknowledge', beatId: 'wish', promise: 'rest' }, NOW).state;
  w = reduceAdventure(w, { type: 'acknowledge', beatId: 'trail' }, NOW).state;
  assert.equal(adventureNext(w)?.kind, 'garden');
  const coins = w.coins;
  w = served(w, PREPARATION_ORDER_ID);
  assert.equal(w.coins, coins + 60);
  assert.equal(adventureNext(w)?.kind, 'feastle');
  w.gardenLessons = { ...w.gardenLessons, feastle: { preparedAt: NOW, servedAt: NOW } };
  w = reduceAdventure(w, { type: 'acknowledge', beatId: 'hearth' }, NOW).state;
  w = reduceAdventure(w, { type: 'acknowledge', beatId: 'welcome' }, NOW).state;
  w = served(w, DOORSTEP_ORDER_ID);
  const progressed = structuredClone(w);
  delete progressed.sharedAdventure!.acknowledged.welcome;
  const replayedWelcome = reduceAdventure(progressed, { type: 'acknowledge', beatId: 'welcome' }, NOW).state;
  assert.equal(replayedWelcome.activeOrders.some(order => order.id === DOORSTEP_ORDER_ID), false, 'a previously served personal request is not recreated');
  assert.equal(adventureNext(replayedWelcome)?.beatId, 'post');
  w = reduceAdventure(w, { type: 'acknowledge', beatId: 'post' }, NOW).state;
  const before = w;
  w = reduceAdventure(w, { type: 'start_route', routeId: SIGNAL_MISSION.id }, NOW).state;
  w = solve(normalizeMergeWorldState(JSON.parse(JSON.stringify(w)), NOW));
  assert.equal(newWorldMilestones(before, w, 1).filter(e => e.context.targetId === 'lantern-post').length, 1);
  assert.equal(reduceAdventure(w, { type: 'finish_route', runId: w.sharedAdventure!.run!.id }, NOW).changed, false);
  w = reduceAdventure(w, { type: 'acknowledge', beatId: 'answer' }, NOW).state;
  assert.equal(adventureNext(w)?.kind, 'routes');
  assert.deepEqual(w.islandCampaigns, personal);
});
test('all routes solve, isolate inventory, reward once daily, and stamp all three first completions', () => {
  let w = ready();
  w.sharedAdventure = { ...emptyAdventure(), completedAt: NOW };
  const inventory = structuredClone(w.board);
  const coins = w.coins;
  for (const route of LANTERN_ROUTES) {
    w = reduceAdventure(w, { type: 'start_route', routeId: route.id }, NOW).state;
    assert.throws(() => reduceAdventure(w, { type: 'finish_route', runId: w.sharedAdventure!.run!.id }, NOW));
    w = solve(w);
    w = reduceAdventure(w, { type: 'start_route', routeId: route.id }, NOW).state;
    w = solve(w);
    assert.equal(w.sharedAdventure!.run!.reward, 0);
  }
  assert.equal(w.coins, coins + 60);
  assert.deepEqual(w.board, inventory);
  assert.equal(w.sharedAdventure!.pathfinderAt, NOW);
  const tomorrow = NOW + 86400000;
  w = reduceAdventure(w, { type: 'start_route', routeId: LANTERN_ROUTES[0].id }, tomorrow).state;
  w = solve(w, tomorrow);
  assert.equal(w.coins, coins + 80);
  w = reduceAdventure(w, { type: 'start_route', routeId: LANTERN_ROUTES[0].id }, NOW).state;
  w = solve(w, NOW);
  assert.equal(w.coins, coins + 80, 'clock rollback cannot repeat daily rewards');
});
test('gates, duplicate actions, and a single resumable board', () => {
  assert.equal(adventureNext(createInitialMergeWorldState(NOW)), null);
  let w = ready();
  assert.throws(() => reduceAdventure(w, { type: 'acknowledge', beatId: 'answer' }, NOW));
  w = reduceAdventure(w, { type: 'acknowledge', beatId: 'wish', promise: 'company' }, NOW).state;
  assert.equal(reduceAdventure(w, { type: 'acknowledge', beatId: 'wish', promise: 'rest' }, NOW).changed, false);
  w.sharedAdventure!.completedAt = NOW;
  w = reduceAdventure(w, { type: 'start_route', routeId: LANTERN_ROUTES[0].id }, NOW).state;
  assert.equal(reduceAdventure(w, { type: 'start_route', routeId: LANTERN_ROUTES[0].id }, NOW).changed, false);
  assert.throws(() => reduceAdventure(w, { type: 'start_route', routeId: LANTERN_ROUTES[1].id }, NOW));
  const saved = normalizeMergeWorldState(JSON.parse(JSON.stringify(w)), NOW + 86400000);
  assert.deepEqual(saved.sharedAdventure, w.sharedAdventure);
});

test('an existing Petalimp arc keeps tracker priority over the shared adventure', () => {
  const { kingdomProgress } = loadNativeModule('features/kingdom-progress/kingdom-progress.ts', {
    '@/features/shared-adventure/catalog': { SHARED_ADVENTURE_ENABLED: true },
  });
  let w = ready();
  w.coins = 5000;
  w = reduceMergeWorld(w, { type: 'upgradeHavenTile', characterId: 'mossprout', stage: 1, now: NOW }).state;
  assert.equal(kingdomProgress(w).next.kind, 'shared_adventure');
  const campaign = ISLAND_CAMPAIGNS[0]!;
  w = greetIslandFriend(revealIsland(w, campaign, NOW), campaign, NOW);
  assert.equal(kingdomProgress(w).next.campaignId, campaign.campaignId);
});

test('a full main board does not block a route or lose inventory', () => {
  let w = ready();
  w.sharedAdventure = { ...emptyAdventure(), completedAt: NOW };
  w.board = w.board.map((cell, index) => ({ ...cell, occupant: { kind: 'item', instanceId: `full:${index}`, definitionId: 'nature:garden:1' } }));
  const main = structuredClone(w.board);
  w = reduceAdventure(w, { type: 'start_route', routeId: 'warm-delivery' }, NOW).state;
  w = solve(w);
  assert.deepEqual(w.board, main);
});
