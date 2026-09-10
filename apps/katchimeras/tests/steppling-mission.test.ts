import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from './helpers/content-fs';
import { mergeFtueAllowsCommand } from '@/features/onboarding/merge-ftue';
import { OPENING_CAMERA_ANCHOR_Y, OPENING_CAMERA_ZOOM, OPENING_MERGE_WINDOW_CELLS } from '@/features/onboarding/opening-mist';
import {
  createStepplingMissionState, STEPPLING_MISSION_CAMERA, STEPPLING_MISSION_GENERATOR_ID, STEPPLING_MISSION_ITEMS, STEPPLING_MISSION_LOCKER_CELL,
  STEPPLING_MISSION_MERGE_REQUIRED, STEPPLING_MISSION_SOCK_ID, STEPPLING_MISSION_STORAGE_KEY, stepplingMissionBoardStep, stepplingMissionItemsOnBoard, stepplingMissionProgress,
} from '@/features/onboarding/steppling-mission';
import { GLOW_DISCOVERY_FLOW, GLOW_GATEWAY_NODE_IDS, GLOW_MISSION_CLEAR_NODE_ID, GLOW_MISSION_CLEARED_EVENT, GLOW_MISSION_FOCUS_NODE_ID, glowDiscoveryLocksCamera, glowDiscoveryMissionNode, glowDiscoveryResumeCamera, glowDiscoveryRevealLocked } from '@/features/onboarding/glow-discovery-flow';
import { STEPPLING_STORY_TARGET } from '@/constants/shared-world';
import type { MergeWorldState } from '@/types/merge-world';
import { reduceMergeWorld } from '@/utils/merge-world/engine';

const NOW = Date.UTC(2026, 8, 10, 9);
const WINDOW = new Set(OPENING_MERGE_WINDOW_CELLS);

function itemCells(state: MergeWorldState) {
  return OPENING_MERGE_WINDOW_CELLS.filter((index) => state.board[index]?.occupant?.kind === 'item');
}

function closestPair(state: MergeWorldState): [number, number] | null {
  const cells = itemCells(state);
  for (const a of cells) for (const b of cells) {
    if (a < b && state.board[a].occupant?.kind === 'item' && state.board[b].occupant?.kind === 'item'
      && (state.board[a].occupant as { definitionId: string }).definitionId === (state.board[b].occupant as { definitionId: string }).definitionId) return [a, b];
  }
  return null;
}

test('the Steppling mission board is its own window: walking gear, the Journey Locker as a piece, nothing else', () => {
  const state = createStepplingMissionState(NOW);
  for (const [index, cell] of state.board.entries()) {
    if (!WINDOW.has(index)) assert.equal(cell.occupant, null, `cell ${index} outside the window is empty`);
  }
  assert.deepEqual(state.board[STEPPLING_MISSION_LOCKER_CELL].occupant, { kind: 'generator', generatorId: STEPPLING_MISSION_GENERATOR_ID });
  for (const { cell, definitionId } of STEPPLING_MISSION_ITEMS) {
    assert.ok(WINDOW.has(cell), `item cell ${cell} is in the window`);
    assert.equal((state.board[cell].occupant as { definitionId: string }).definitionId, definitionId);
  }
  assert.equal(stepplingMissionItemsOnBoard(state), STEPPLING_MISSION_ITEMS.length);
  const locker = state.generators[STEPPLING_MISSION_GENERATOR_ID];
  assert.ok(locker, 'the Locker is a real generator on this board');
  assert.equal(locker.forcedDropDefinitionId, STEPPLING_MISSION_SOCK_ID, 'it only ever makes Socks');
  assert.ok(locker.charges >= 99, 'and never rests during the mission');
  assert.equal(Object.keys(state.generators).join(','), STEPPLING_MISSION_GENERATOR_ID);
  assert.equal(state.activeOrders.length, 0);
  assert.equal(state.arrivals.length, 0);
  assert.equal(state.rewardInbox.length, 0);
  assert.equal(STEPPLING_MISSION_STORAGE_KEY, 'katchimeras.mist-mission.steppling.v1');
});

test('Locker taps drop Socks inside the window without Energy, and the bar’s merges are reachable', () => {
  let state = createStepplingMissionState(NOW);
  const spawned = reduceMergeWorld(state, { type: 'tapGenerator', generatorId: STEPPLING_MISSION_GENERATOR_ID, now: NOW + 1, seed: 'tap-1', spendEnergy: false });
  assert.equal(spawned.changed, true, spawned.message);
  assert.ok(spawned.spawnedCell != null && WINDOW.has(spawned.spawnedCell), 'the Sock lands in the window');
  assert.equal((spawned.state.board[spawned.spawnedCell!].occupant as { definitionId: string }).definitionId, STEPPLING_MISSION_SOCK_ID);
  state = spawned.state;
  let merges = 0;
  for (let step = 0; step < 200 && merges < STEPPLING_MISSION_MERGE_REQUIRED; step++) {
    const pair = closestPair(state);
    if (pair) {
      const result = reduceMergeWorld(state, { type: 'move', from: pair[0], to: pair[1], now: NOW + 10 + step });
      assert.equal(result.changed, true, result.message);
      assert.ok(result.mergedCell != null, 'a same-item drop is a merge');
      state = result.state;
      merges += 1;
      continue;
    }
    const tap = reduceMergeWorld(state, { type: 'tapGenerator', generatorId: STEPPLING_MISSION_GENERATOR_ID, now: NOW + 10 + step, seed: `tap-${step}`, spendEnergy: false });
    assert.equal(tap.changed, true, tap.message);
    assert.ok(WINDOW.has(tap.spawnedCell!), 'every Sock lands in the window');
    state = tap.state;
  }
  assert.equal(merges, STEPPLING_MISSION_MERGE_REQUIRED, 'the Locker keeps the board supplied to the end of the bar');
  assert.ok(STEPPLING_MISSION_MERGE_REQUIRED > 7, 'more than the opening asked for');
  assert.equal(stepplingMissionProgress(STEPPLING_MISSION_MERGE_REQUIRED + 3), STEPPLING_MISSION_MERGE_REQUIRED);
  assert.equal(stepplingMissionProgress(-1), 0);
});

test('the mission’s guidance: a spotlit Locker tap first and nothing else, then the finger on the first pair, then free', () => {
  const state = createStepplingMissionState(NOW);
  const first = stepplingMissionBoardStep(state, 0)!;
  assert.equal(first.id, 'mission.steppling.spawn');
  assert.ok(first.spotlight && first.cue?.kind === 'tap', 'the new thing is spotlit and pointed at');
  assert.equal(mergeFtueAllowsCommand(first, state, { type: 'tapGenerator', generatorId: STEPPLING_MISSION_GENERATOR_ID, now: NOW, seed: 'x' }), true);
  assert.equal(mergeFtueAllowsCommand(first, state, { type: 'move', from: 16, to: 18, now: NOW }), false, 'merging the placed Socks waits for the tap');
  const spawned = reduceMergeWorld(state, { type: 'tapGenerator', generatorId: STEPPLING_MISSION_GENERATOR_ID, now: NOW + 1, seed: 'tap', spendEnergy: false }).state;
  const second = stepplingMissionBoardStep(spawned, 0)!;
  assert.equal(second.id, 'mission.steppling.merge');
  assert.equal(second.cue?.kind, 'drag');
  assert.equal(second.spotlight, undefined, 'no spotlight for a merge the player already knows');
  assert.equal(mergeFtueAllowsCommand(second, spawned, { type: 'move', from: 22, to: 26, now: NOW }), true, 'any drag is allowed');
  assert.equal(mergeFtueAllowsCommand(second, spawned, { type: 'tapGenerator', generatorId: STEPPLING_MISSION_GENERATOR_ID, now: NOW, seed: 'y' }), true, 'and so is another tap');
  const free = stepplingMissionBoardStep(spawned, 1)!;
  assert.equal(free.id, 'mission.steppling.free');
  assert.equal(free.cue, undefined);
  assert.equal(free.spotlight, undefined);
  assert.equal(stepplingMissionBoardStep(null, 0), null);
});

test('the Glow story opens the mission from the bubble and pays the reveal only after the bar fills', () => {
  const focus = GLOW_DISCOVERY_FLOW.nodes.find((node) => node.id === GLOW_MISSION_FOCUS_NODE_ID)!;
  assert.equal(focus.kind, 'presentation');
  assert.deepEqual((focus.payload as { target: unknown }).target, STEPPLING_STORY_TARGET);
  assert.equal((focus.payload as { zoom: number }).zoom, OPENING_CAMERA_ZOOM, 'the opening’s framing');
  assert.equal((focus.payload as { anchorY: number }).anchorY, OPENING_CAMERA_ANCHOR_Y);
  const clear = GLOW_DISCOVERY_FLOW.nodes.find((node) => node.id === GLOW_MISSION_CLEAR_NODE_ID)!;
  assert.equal(clear.kind, 'task');
  if (clear.kind !== 'task' || focus.kind !== 'presentation') return;
  assert.equal(focus.next, GLOW_MISSION_CLEAR_NODE_ID);
  assert.equal(clear.requirements[0].event.type, GLOW_MISSION_CLEARED_EVENT);
  assert.equal(clear.next, 'gateway.purchase.focus', 'the paid reveal follows the bar');
  const offer = GLOW_DISCOVERY_FLOW.nodes.find((node) => node.id === 'gateway.offer')!;
  assert.equal(offer.kind === 'scene' ? offer.actions[0].next : null, GLOW_MISSION_FOCUS_NODE_ID, 'the bubble opens the mission');
  assert.equal(GLOW_DISCOVERY_FLOW.nodes.some((node) => node.id === 'gateway.buy'), false, 'no purchase sheet beat');
  assert.deepEqual(GLOW_GATEWAY_NODE_IDS, ['gateway.ready', 'gateway.return', 'gateway.offer']);
  for (const nodeId of [GLOW_MISSION_FOCUS_NODE_ID, GLOW_MISSION_CLEAR_NODE_ID]) {
    assert.equal(glowDiscoveryMissionNode(nodeId), true);
    assert.deepEqual(glowDiscoveryResumeCamera({ nodeId, status: 'active' }), STEPPLING_MISSION_CAMERA, 'a resume reframes the tile the same way');
    assert.equal(glowDiscoveryLocksCamera({ nodeId, status: 'active' }), true);
    assert.equal(glowDiscoveryRevealLocked({ nodeId, status: 'active' }), true);
  }
  assert.equal(glowDiscoveryMissionNode('gateway.offer'), false);
  assert.equal(STEPPLING_MISSION_CAMERA.kind === 'focus_target' ? STEPPLING_MISSION_CAMERA.zoom : null, OPENING_CAMERA_ZOOM);
});

test('the Kingdom docks the mission under Steppling’s tile and clears the mist when its final item lands', () => {
  const screen = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  const dock = readFileSync('components/katchadeck/world/steppling-mission-dock.tsx', 'utf8');
  const store = readFileSync('features/onboarding/use-opening-mission-board.ts', 'utf8');
  const runtime = readFileSync('features/onboarding/glow-discovery-runtime.ts', 'utf8');
  const upgrade = readFileSync('features/onboarding/glow-upgrade-runtime.ts', 'utf8');
  const offers = readFileSync('features/world-upgrades/world-upgrade-offers.ts', 'utf8');
  assert.match(screen, /const stepplingMissionActive = glowRun\?\.status === 'active' && glowRun\.nodeId === GLOW_MISSION_CLEAR_NODE_ID;/);
  assert.match(screen, /useOpeningGlow\(stepplingMissionActive \? gatewayTileNode : homeTileNode\)/, 'Glow flies into the misted clearing during its mission');
  assert.match(screen, /const stepplingMission = useMissionBoard\(STEPPLING_MISSION_STORAGE_KEY, stepplingMissionActive \? STEPPLING_MISSION_ID : null, createStepplingMissionState\);/, 'its own board and store');
  assert.match(screen, /stepplingFinaleIdRef\.current = openingGlow\.launchFinale\(from, definitionId\);/);
  assert.match(screen, /if \(stepplingMissionActive && stepplingMissionCleared && stepplingFinaleIdRef\.current != null && openingGlow\.finaleLandedId === stepplingFinaleIdRef\.current\) finishStepplingMission\(\);/, 'the mist clears on the final item’s impact');
  assert.match(screen, /if \(stepplingMission\.merges >= STEPPLING_MISSION_MERGE_REQUIRED\) finishStepplingMission\(\);/, 'a board saved with a full bar clears on resume');
  assert.match(screen, /<StepplingMissionDock[\s\S]*?onFinale=\{launchStepplingFinale\}/);
  assert.match(screen, /if \(glowRun && glowDiscoveryMissionNode\(glowRun\.nodeId\)\) return;/, 'tile taps are inert while the board is up');
  assert.match(screen, /await advanceGlowUpgrade\('open'\);\s*setSelectedUpgrade\(null\);\s*return;/, 'the bubble never opens a purchase sheet');
  assert.doesNotMatch(screen, /'gateway\.buy'/);
  assert.match(dock, /spendEnergy: false as const/, 'Locker taps cost nothing');
  assert.match(dock, /if \(\(mergesRef\.current \?\? 0\) >= STEPPLING_MISSION_MERGE_REQUIRED\) \{[\s\S]*?setHiddenItemIds[\s\S]*?onFinale\?\.\(from, event\.resultDefinitionId\);/, 'the merge that fills the bar sends its item into the mist');
  assert.match(dock, /<MistMissionDock[\s\S]*?required=\{STEPPLING_MISSION_MERGE_REQUIRED\}/);
  assert.match(store, /const merged = command\.type === 'move' && result\.mergedCell != null;[\s\S]*?saveMission\(storageKey, activeRunId, result\.state, nextMerges\);/, 'every merge is counted and saved with the board');
  assert.match(runtime, /eventId: `\$\{run\.runId\}:\$\{GLOW_MISSION_CLEAR_NODE_ID\}:cleared:\$\{run\.revision\}`, type: GLOW_MISSION_CLEARED_EVENT/);
  assert.doesNotMatch(upgrade, /actionId: 'unlock'/, 'no confirm step: the mission is the price');
  assert.match(offers, /\['gateway\.ready', 'gateway\.return', 'gateway\.offer'\]\.includes\(glowRun\.nodeId\) && offer\.id === 'mist:steppling-home'/, 'no markers while the board is up');
});
