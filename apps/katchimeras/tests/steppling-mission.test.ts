import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from './helpers/content-fs';
import { mergeFtueAllowsCommand } from '@/features/onboarding/merge-ftue';
import { MISSION_CAMERA_ANCHOR_Y, MISSION_CAMERA_ZOOM, OPENING_CAMERA_ZOOM, OPENING_MERGE_WINDOW_CELLS } from '@/features/onboarding/opening-mist';
import {
  createStepplingMissionState, STEPPLING_MISSION_CAMERA, STEPPLING_MISSION_ECHOES, STEPPLING_MISSION_GENERATOR_ID, STEPPLING_MISSION_HINT_DELAY_MS, STEPPLING_MISSION_HINT_THEME, STEPPLING_MISSION_LOCKER_CELL,
  STEPPLING_MISSION_MERGE_REQUIRED, STEPPLING_MISSION_SOCK_ID, STEPPLING_MISSION_STORAGE_KEY, stepplingMissionBoardStep, stepplingMissionItemsOnBoard, stepplingMissionProgress, stepplingMissionWake,
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

test('the Steppling mission board starts with the Locker alone and a sleeping trail above it', () => {
  const state = createStepplingMissionState(NOW);
  state.board.forEach((cell, index) => {
    if (!WINDOW.has(index)) assert.equal(cell.occupant, null, `cell ${index} outside the window is empty`);
  });
  assert.deepEqual(state.board[STEPPLING_MISSION_LOCKER_CELL].occupant, { kind: 'generator', generatorId: STEPPLING_MISSION_GENERATOR_ID });
  assert.equal(stepplingMissionItemsOnBoard(state), 0, 'no items to start with: everything comes out of the Locker');
  assert.equal(STEPPLING_MISSION_ECHOES.length, 3);
  for (const echo of STEPPLING_MISSION_ECHOES) {
    assert.ok(WINDOW.has(echo.cell), `sleeping cell ${echo.cell} is in the window`);
    const cell = state.board[echo.cell];
    assert.equal(cell.occupant, null);
    assert.equal(cell.locked, true, 'asleep under the Mist');
    assert.deepEqual(cell.mist, { kind: 'echo', id: echo.id, definitionId: echo.definitionId, ownerCharacterId: 'steppling' });
  }
  // Each sleeper wants exactly what the one below it wakes into: the trail climbs one tier at a time.
  assert.deepEqual(STEPPLING_MISSION_ECHOES.map((echo) => echo.definitionId), ['adventure:trail:2', 'adventure:trail:3', 'adventure:trail:4']);
  assert.deepEqual(STEPPLING_MISSION_ECHOES.map((echo) => echo.cell), [31, 24, 17], 'straight up from the Locker');
  const locker = state.generators[STEPPLING_MISSION_GENERATOR_ID];
  assert.ok(locker, 'the Locker is a real generator on this board');
  assert.equal(locker.forcedDropDefinitionId, STEPPLING_MISSION_SOCK_ID, 'it only ever makes Socks');
  assert.ok(locker.charges >= 99, 'and never rests during the mission');
  assert.equal(Object.keys(state.generators).join(','), STEPPLING_MISSION_GENERATOR_ID);
  assert.equal(state.activeOrders.length, 0);
  assert.equal(state.arrivals.length, 0);
  assert.equal(state.rewardInbox.length, 0);
  assert.equal(STEPPLING_MISSION_STORAGE_KEY, 'katchimeras.mist-mission.steppling.v2', 'a new key: the old walking-gear board is never resumed onto this one');
});

test('two Socks, one merge and three wakings fill the bar, each guided in turn', () => {
  let state = createStepplingMissionState(NOW);
  assert.equal(stepplingMissionBoardStep(state, 0)!.id, 'mission.steppling.spawn');
  const first = reduceMergeWorld(state, { type: 'tapGenerator', generatorId: STEPPLING_MISSION_GENERATOR_ID, now: NOW + 1, seed: 'tap-1', spendEnergy: false });
  assert.equal(first.changed, true, first.message);
  assert.ok(first.spawnedCell != null && WINDOW.has(first.spawnedCell), 'the Sock lands in the window');
  assert.equal((first.state.board[first.spawnedCell!].occupant as { definitionId: string }).definitionId, STEPPLING_MISSION_SOCK_ID);
  state = first.state;
  assert.equal(stepplingMissionBoardStep(state, 0)!.id, 'mission.steppling.spawn_again', 'one Sock is not enough');
  state = reduceMergeWorld(state, { type: 'tapGenerator', generatorId: STEPPLING_MISSION_GENERATOR_ID, now: NOW + 2, seed: 'tap-2', spendEnergy: false }).state;
  let merges = 0;
  const merge = stepplingMissionBoardStep(state, merges)!;
  assert.equal(merge.id, 'mission.steppling.merge');
  assert.equal(merge.spotlight, undefined, 'nothing spotlit once the Locker has been introduced');
  assert.equal(merge.cue?.kind, 'drag');
  const pair = closestPair(state)!;
  const merged = reduceMergeWorld(state, { type: 'move', from: pair[0], to: pair[1], now: NOW + 3 });
  assert.equal(merged.changed, true, merged.message);
  assert.ok(merged.mergedCell != null);
  assert.equal((merged.state.board[merged.mergedCell!].occupant as { definitionId: string }).definitionId, 'adventure:trail:2', 'two Socks make a Shoe');
  state = merged.state;
  merges += 1;
  const expected = ['adventure:trail:3', 'adventure:trail:4', 'adventure:trail:5'];
  for (const [index, echo] of STEPPLING_MISSION_ECHOES.entries()) {
    const step = stepplingMissionBoardStep(state, merges)!;
    assert.equal(step.id, 'mission.steppling.wake', `the ${index + 1}. sleeper's match is on the board, so the finger points at it`);
    const wake = stepplingMissionWake(state)!;
    assert.equal(wake.to, echo.cell, 'the lowest sleeper first');
    assert.deepEqual(step.cue, { kind: 'drag', from: { kind: 'board_cell', cell: wake.from }, to: { kind: 'board_cell', cell: echo.cell } });
    assert.equal(mergeFtueAllowsCommand(step, state, { type: 'move', from: wake.from, to: echo.cell, now: NOW }), true, 'free: any drag is allowed');
    const wrong = reduceMergeWorld(state, { type: 'tapGenerator', generatorId: STEPPLING_MISSION_GENERATOR_ID, now: NOW + 10 + index, seed: `extra-${index}`, spendEnergy: false });
    const sock = wrong.spawnedCell!;
    const refused = reduceMergeWorld(wrong.state, { type: 'move', from: sock, to: echo.cell, now: NOW + 11 + index });
    assert.equal(refused.changed, false, 'a Sock does not wake a sleeper that wants something higher');
    const woken = reduceMergeWorld(state, { type: 'move', from: wake.from, to: echo.cell, now: NOW + 12 + index });
    assert.equal(woken.changed, true, woken.message);
    assert.equal(woken.mergedCell, echo.cell, 'a waking counts like a merge');
    assert.ok(woken.dreamEchoClearedId, 'and is reported as the sleeper clearing');
    assert.equal(woken.state.board[echo.cell].locked, false);
    assert.equal(woken.state.board[echo.cell].mist, null);
    assert.equal((woken.state.board[echo.cell].occupant as { definitionId: string }).definitionId, expected[index], 'it wakes as the next piece up the trail');
    state = woken.state;
    merges += 1;
  }
  assert.equal(merges, STEPPLING_MISSION_MERGE_REQUIRED, 'four strikes: one per wisp');
  assert.equal(stepplingMissionWake(state), null);
  assert.equal(stepplingMissionProgress(STEPPLING_MISSION_MERGE_REQUIRED + 3), STEPPLING_MISSION_MERGE_REQUIRED);
  assert.equal(stepplingMissionProgress(-1), 0);
});

test('the mission’s guidance: two spotlit Locker taps and nothing else, then a finger that waits for a pause', () => {
  const state = createStepplingMissionState(NOW);
  const first = stepplingMissionBoardStep(state, 0)!;
  assert.equal(first.id, 'mission.steppling.spawn');
  assert.ok(first.spotlight && first.cue?.kind === 'tap', 'the new thing is spotlit and pointed at');
  assert.equal(mergeFtueAllowsCommand(first, state, { type: 'tapGenerator', generatorId: STEPPLING_MISSION_GENERATOR_ID, now: NOW, seed: 'x' }), true);
  assert.equal(mergeFtueAllowsCommand(first, state, { type: 'move', from: 16, to: 18, now: NOW }), false, 'nothing but the tap');
  const once = reduceMergeWorld(state, { type: 'tapGenerator', generatorId: STEPPLING_MISSION_GENERATOR_ID, now: NOW + 1, seed: 'tap', spendEnergy: false }).state;
  const second = stepplingMissionBoardStep(once, 0)!;
  assert.equal(second.id, 'mission.steppling.spawn_again');
  assert.ok(second.spotlight && second.cue?.kind === 'tap', 'the second tap is spotlit too');
  assert.equal(mergeFtueAllowsCommand(second, once, { type: 'move', from: 16, to: 18, now: NOW }), false);
  const twice = reduceMergeWorld(once, { type: 'tapGenerator', generatorId: STEPPLING_MISSION_GENERATOR_ID, now: NOW + 2, seed: 'tap-2', spendEnergy: false }).state;
  const merge = stepplingMissionBoardStep(twice, 0)!;
  assert.equal(merge.id, 'mission.steppling.merge');
  assert.equal(merge.spotlight, undefined, 'no spotlight for a merge the player already knows');
  assert.equal(mergeFtueAllowsCommand(merge, twice, { type: 'tapGenerator', generatorId: STEPPLING_MISSION_GENERATOR_ID, now: NOW, seed: 'y' }), true, 'another tap is allowed');
  // Two Socks merged into a Shoe with the first sleeper wanting one: the finger points at the sleeper.
  const pair = closestPair(twice)!;
  const shoe = reduceMergeWorld(twice, { type: 'move', from: pair[0], to: pair[1], now: NOW + 3 }).state;
  assert.equal(stepplingMissionBoardStep(shoe, 1)!.id, 'mission.steppling.wake');
  // A lone Sock and nothing to wake: the finger points back at the Locker, with no spotlight.
  const lone = reduceMergeWorld(shoe, { type: 'move', from: 31, to: 30, now: NOW + 4 });
  assert.equal(lone.changed, false, 'the sleeper cannot be moved');
  const free = stepplingMissionBoardStep(once, 1)!;
  assert.equal(free.id, 'mission.steppling.free');
  assert.equal(free.cue?.kind, 'tap');
  assert.equal(free.spotlight, undefined);
  assert.equal(stepplingMissionBoardStep(null, 0), null);
  assert.equal(STEPPLING_MISSION_HINT_DELAY_MS, 2_000);
  assert.deepEqual(STEPPLING_MISSION_HINT_THEME, { fingerDelayMs: 2_000 });
});

test('the Glow story opens the mission from the bubble and pays the reveal only after the bar fills', () => {
  const focus = GLOW_DISCOVERY_FLOW.nodes.find((node) => node.id === GLOW_MISSION_FOCUS_NODE_ID)!;
  assert.equal(focus.kind, 'presentation');
  assert.deepEqual((focus.payload as { target: unknown }).target, STEPPLING_STORY_TARGET);
  assert.equal((focus.payload as { zoom: number }).zoom, MISSION_CAMERA_ZOOM, 'closer than the opening, the rest of the map faded');
  assert.ok(MISSION_CAMERA_ZOOM > OPENING_CAMERA_ZOOM);
  assert.equal((focus.payload as { anchorY: number }).anchorY, MISSION_CAMERA_ANCHOR_Y);
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
  assert.equal(STEPPLING_MISSION_CAMERA.kind === 'focus_target' ? STEPPLING_MISSION_CAMERA.zoom : null, MISSION_CAMERA_ZOOM);
  const screen = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  const canvas = readFileSync('components/katchadeck/world/kingdom-hex-canvas.tsx', 'utf8');
  assert.match(screen, /const soloLayerId = stepplingBoardBusy \? 'structure:steppling-home' : restorationBoardBusy && restorationIslandId \? `nature:mossprout:\$\{restorationIslandId\}` : null;/, 'only the board’s tile stays on the map');
  assert.match(screen, /const stepplingBoardBusy = stepplingMissionActive && !stepplingMissionLanded;\s*const restorationBoardBusy = restorationBoardVisible && !restorationLanded;/, 'the map comes back the moment the last item lands');
  assert.match(canvas, /setFadeSolo\(soloLayerId\);\s*othersOpacity\.value = withTiming\(0, \{ duration, easing/, 'the other tiles fade out while a board is up');
  assert.match(canvas, /<Animated\.View pointerEvents=\{soloLayerId \? 'none' : 'box-none'\} style=\{\[StyleSheet\.absoluteFill, othersStyle\]\}>\{creatureNodes\}<\/Animated\.View>/, 'and every Katchimera with them');
  assert.match(canvas, /style=\{\[StyleSheet\.absoluteFill, othersStyle\]\}>\{memoryPlantProjections\.map/, 'and the planted memories');
  assert.match(canvas, /style=\{fadeSolo && layer\.id !== fadeSolo \? \[StyleSheet\.absoluteFill, othersStyle\] : StyleSheet\.absoluteFill\}/, 'the fading style stays attached until the tiles are back');
  assert.match(canvas, /othersOpacity\.value = withTiming\(1, \{ duration, easing: Easing\.inOut\(Easing\.quad\) \}, \(finished\) => \{\s*if \(finished\) runOnJS\(setFadeSolo\)\(null\);/, 'and only detaches once the fade-in has finished');
  assert.match(canvas, /hidden=\{Boolean\(selectedUpgradeOffer\) \|\| Boolean\(soloLayerId && offer\.id !== soloOfferId\)\}/, 'markers hide while a board is up, except one the caller keeps');
});

test('the Kingdom docks the mission under Steppling’s tile and clears the mist when its final item lands', () => {
  const screen = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  const dock = readFileSync('components/katchadeck/world/steppling-mission-dock.tsx', 'utf8');
  const store = readFileSync('features/onboarding/use-opening-mission-board.ts', 'utf8');
  const runtime = readFileSync('features/onboarding/glow-discovery-runtime.ts', 'utf8');
  const upgrade = readFileSync('features/onboarding/glow-upgrade-runtime.ts', 'utf8');
  const offers = readFileSync('features/world-upgrades/world-upgrade-offers.ts', 'utf8');
  assert.match(screen, /const stepplingMissionActive = glowRun\?\.status === 'active' && glowRun\.nodeId === GLOW_MISSION_CLEAR_NODE_ID;/);
  assert.match(screen, /useOpeningGlow\(stepplingMissionActive \? gatewayTileNode : islandRestoration \? restorationTileNode : homeTileNode\)/, 'Glow flies into the misted clearing during its mission');
  assert.match(screen, /const stepplingMission = useMissionBoard\(STEPPLING_MISSION_STORAGE_KEY, stepplingMissionActive \? STEPPLING_MISSION_ID : null, createStepplingMissionState\);/, 'its own board and store');
  assert.match(screen, /stepplingFinaleIdRef\.current = launchGlowFinale\(from, definitionId\);/);
  assert.match(screen, /const stepplingMissionLanded = stepplingFinaleIdRef\.current != null && openingGlow\.finaleLandedId === stepplingFinaleIdRef\.current;/);
  assert.match(screen, /if \(!\(stepplingMissionActive && stepplingMissionCleared && stepplingMissionLanded\)\) return;\s*const timer = setTimeout\(finishStepplingMission, WISP_FALL_MS\);/, 'the mist clears once the final item has struck the last wisp and it has fallen');
  assert.match(screen, /const stepplingBoardBusy = stepplingMissionActive && !stepplingMissionLanded;/, 'the map stays faded while the last item is in the air');
  assert.match(screen, /if \(stepplingMission\.merges >= STEPPLING_MISSION_MERGE_REQUIRED\) finishStepplingMission\(\);/, 'a board saved with a full bar clears on resume');
  assert.match(screen, /<StepplingMissionDock[\s\S]*?onFinale=\{launchStepplingFinale\}/);
  assert.match(screen, /if \(glowRun && glowDiscoveryMissionNode\(glowRun\.nodeId\)\) return;/, 'tile taps are inert while the board is up');
  assert.match(screen, /await advanceGlowUpgrade\('open'\);\s*setSelectedUpgrade\(null\);\s*return;/, 'the bubble never opens a purchase sheet');
  assert.doesNotMatch(screen, /'gateway\.buy'/);
  assert.match(dock, /spendEnergy: false as const/, 'Locker taps cost nothing');
  assert.match(dock, /if \(!result \|\| \(event\?\.type !== 'merge_completed' && event\?\.type !== 'dream_echo_cleared'\)\) return result;/, 'a waking sends Glow like a merge');
  assert.match(screen, /visualTheme=\{stepplingMissionStep\?\.spotlight \? undefined : STEPPLING_MISSION_HINT_THEME\}/, 'with nothing spotlit, the finger waits two seconds of the player’s pause');
  assert.match(dock, /if \(\(mergesRef\.current \?\? 0\) >= STEPPLING_MISSION_MERGE_REQUIRED\) \{[\s\S]*?setHiddenItemIds[\s\S]*?onFinale\?\.\(from, event\.resultDefinitionId\);/, 'the merge that fills the bar sends its item into the mist');
  assert.match(dock, /<MistMissionDock[\s\S]*?required=\{STEPPLING_MISSION_MERGE_REQUIRED\}/);
  assert.match(store, /const merged = command\.type === 'move' && result\.mergedCell != null;[\s\S]*?saveMission\(storageKey, activeRunId, result\.state, nextMerges, placedRef\.current\);/, 'every merge is counted and saved with the board');
  assert.match(runtime, /eventId: `\$\{run\.runId\}:\$\{GLOW_MISSION_CLEAR_NODE_ID\}:cleared:\$\{run\.revision\}`, type: GLOW_MISSION_CLEARED_EVENT/);
  assert.doesNotMatch(upgrade, /actionId: 'unlock'/, 'no confirm step: the mission is the price');
  assert.match(offers, /\['gateway\.ready', 'gateway\.return', 'gateway\.offer'\]\.includes\(glowRun\.nodeId\) && offer\.id === 'mist:steppling-home'/, 'no markers while the board is up');
});
