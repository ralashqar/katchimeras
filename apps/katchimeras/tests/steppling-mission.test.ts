import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from './helpers/content-fs';
import { mergeFtueAllowsCommand } from '@/features/onboarding/merge-ftue';
import { MISSION_CAMERA_ANCHOR_Y, MISSION_CAMERA_ZOOM, OPENING_CAMERA_ZOOM, OPENING_MERGE_WINDOW_CELLS } from '@/features/onboarding/opening-mist';
import {
  createStepplingMissionState, STEPPLING_MISSION_CAMERA, STEPPLING_MISSION_ECHOES, STEPPLING_MISSION_HINT_DELAY_MS, STEPPLING_MISSION_HINT_THEME, STEPPLING_MISSION_ITEMS,
  STEPPLING_MISSION_MERGE_REQUIRED, STEPPLING_MISSION_SOCK_ID, STEPPLING_MISSION_STORAGE_KEY, STEPPLING_MISSION_VEILED, stepplingMissionBoardStep, stepplingMissionItemsOnBoard, stepplingMissionProgress, stepplingMissionWake,
} from '@/features/onboarding/steppling-mission';
import { GLOW_DISCOVERY_FLOW, GLOW_GATEWAY_NODE_IDS, GLOW_MISSION_CLEAR_NODE_ID, GLOW_MISSION_CLEARED_EVENT, GLOW_MISSION_FOCUS_NODE_ID, glowDiscoveryLocksCamera, glowDiscoveryMissionNode, glowDiscoveryResumeCamera, glowDiscoveryRevealLocked } from '@/features/onboarding/glow-discovery-flow';
import { STEPPLING_STORY_TARGET } from '@/constants/shared-world';
import type { MergeWorldState } from '@/types/merge-world';
import { reduceMergeWorld } from '@/utils/merge-world/engine';

const NOW = Date.UTC(2026, 8, 10, 9);
const WINDOW = new Set(OPENING_MERGE_WINDOW_CELLS);

test('the Steppling mission board is gear left on the trail, one sleeper, and full mist hiding the next ones', () => {
  const state = createStepplingMissionState(NOW);
  state.board.forEach((cell, index) => {
    if (!WINDOW.has(index)) assert.equal(cell.occupant, null, `cell ${index} outside the window is empty`);
  });
  assert.deepEqual(state.generators, {}, 'no spawner: spawning is taught on the Garden board, by parcel');
  assert.equal(state.board.some((cell) => cell.occupant?.kind === 'generator'), false);
  assert.equal(stepplingMissionItemsOnBoard(state), STEPPLING_MISSION_ITEMS.length);
  for (const { cell, definitionId } of STEPPLING_MISSION_ITEMS) {
    assert.ok(WINDOW.has(cell), `item cell ${cell} is in the window`);
    assert.equal((state.board[cell].occupant as { definitionId: string }).definitionId, definitionId);
  }
  assert.deepEqual(STEPPLING_MISSION_ITEMS.map((item) => [item.cell, item.definitionId]), [[36, STEPPLING_MISSION_SOCK_ID], [37, STEPPLING_MISSION_SOCK_ID], [40, STEPPLING_MISSION_SOCK_ID]], 'three Socks: a pair to merge and one for the sleeper that wants it later');
  assert.deepEqual(STEPPLING_MISSION_ECHOES, [{ cell: 38, id: 'steppling-trail-1', definitionId: 'adventure:trail:2' }], 'one sleeper the player can see, wanting the merge’s result');
  assert.deepEqual(state.board[38].mist, { kind: 'echo', id: 'steppling-trail-1', definitionId: 'adventure:trail:2', ownerCharacterId: 'steppling' });
  assert.deepEqual(STEPPLING_MISSION_VEILED.map((veiled) => [veiled.cell, veiled.definitionId]), [[31, 'adventure:trail:3'], [24, 'adventure:trail:5'], [30, 'adventure:trail:1'], [23, 'adventure:trail:2'], [22, 'adventure:trail:3']], 'the chain snakes up, across and up again; the top wants the Pack two Hiking Gears make');
  for (const veiled of STEPPLING_MISSION_VEILED) assert.ok(WINDOW.has(veiled.cell), `veiled cell ${veiled.cell} is in the window`);
  for (const veiled of STEPPLING_MISSION_VEILED) {
    const cell = state.board[veiled.cell];
    assert.equal(cell.locked, true);
    assert.equal(cell.occupant, null);
    assert.deepEqual(cell.mist, { kind: 'veiled', echo: { id: veiled.id, definitionId: veiled.definitionId, ownerCharacterId: 'steppling' } });
  }
  assert.equal(state.activeOrders.length, 0);
  assert.equal(state.arrivals.length, 0);
  assert.equal(state.rewardInbox.length, 0);
  assert.equal(STEPPLING_MISSION_STORAGE_KEY, 'katchimeras.mist-mission.steppling.v3', 'a new key: the Locker board is never resumed onto this one');
});

function stepOf(state: MergeWorldState, merges: number) {
  return stepplingMissionBoardStep(state, merges)!;
}

test('the only path: a merge, six wakings as the mist bursts open cell by cell, and a merge of the two Hiking Gears for the top; eight strikes, each guided in turn', () => {
  let state = createStepplingMissionState(NOW);
  let merges = 0;
  const itemAt = (cell: number) => (state.board[cell].occupant as { definitionId: string } | null)?.definitionId;
  // 1. The first merge is spotlit and exclusive: the one thing the opening taught. Nothing can wake yet.
  const first = stepOf(state, merges);
  assert.equal(first.id, 'mission.steppling.first_merge');
  assert.ok(first.spotlight && first.cue?.kind === 'drag');
  assert.deepEqual([first.cue.from, first.cue.to], [{ kind: 'board_cell', cell: 36 }, { kind: 'board_cell', cell: 37 }], 'the pair side by side, not the Sock across the row');
  assert.equal(stepplingMissionWake(state), null, 'the sleeper wants a Shoe, and there is none yet');
  assert.equal(reduceMergeWorld(state, { type: 'move', from: 36, to: 38, now: NOW }).changed, false, 'a Sock does not wake a sleeping Shoe');
  assert.equal(mergeFtueAllowsCommand(first, state, { type: 'move', from: 36, to: 37, now: NOW }), true);
  assert.equal(mergeFtueAllowsCommand(first, state, { type: 'move', from: 40, to: 37, now: NOW }), false, 'nothing but the spotlit merge');
  let result = reduceMergeWorld(state, { type: 'move', from: 36, to: 37, now: NOW + 1 });
  assert.equal(result.changed, true, result.message);
  assert.equal(result.mergedCell, 37);
  state = result.state; merges += 1;
  // 2–7. Each waking makes what the next sleeper wants and bursts the mist that was hiding it; the top cell waits for a Pack.
  const wakings: [number, string, number[] | undefined][] = [
    [38, 'adventure:trail:3', [31]],
    [31, 'adventure:trail:4', [24, 30]],
    [30, 'adventure:trail:2', [23]],
    [23, 'adventure:trail:3', [22]],
    [22, 'adventure:trail:4', undefined],
  ];
  for (const [cell, wakesAs, reveals] of wakings) {
    const step = stepOf(state, merges);
    assert.equal(step.id, 'mission.steppling.wake', `strike ${merges + 1} is a waking`);
    assert.match(step.guide.title ?? '', /^Something under there wants an? [A-Z]/, 'the article follows the name');
    assert.equal(step.spotlight, undefined, 'nothing spotlit once the board is free');
    assert.deepEqual(step.interaction, { mode: 'none' });
    const wake = stepplingMissionWake(state)!;
    assert.equal(wake.to, cell);
    assert.deepEqual(step.cue, { kind: 'drag', from: { kind: 'board_cell', cell: wake.from }, to: { kind: 'board_cell', cell } });
    result = reduceMergeWorld(state, { type: 'move', from: wake.from, to: cell, now: NOW + 2 + merges });
    assert.equal(result.changed, true, result.message);
    assert.equal(result.mergedCell, cell, 'the waking is a strike');
    assert.deepEqual(result.revealedMistCells, reveals, reveals ? `and the mist beside ${cell} lets go` : 'nothing veiled beside the last one');
    for (const revealed of reveals ?? []) assert.equal(result.state.board[revealed].mist?.kind, 'echo');
    assert.equal((result.state.board[cell].occupant as { definitionId: string }).definitionId, wakesAs);
    state = result.state; merges += 1;
    assert.equal(state.board[24].mist?.kind, merges >= 3 ? 'echo' : 'veiled', 'the top cell is a sleeper from the second waking on');
  }
  // 8. Two Hiking Gears and a sleeper that wants a Pack: the finger points at the pair.
  const merge = stepOf(state, merges);
  assert.equal(merge.id, 'mission.steppling.merge');
  assert.equal(merge.spotlight, undefined);
  assert.equal(merge.guide.title, 'Two of the same make an Adventure Pack.');
  assert.equal(itemAt(31), 'adventure:trail:4');
  assert.equal(itemAt(22), 'adventure:trail:4');
  assert.equal(stepplingMissionWake(state), null, 'the top sleeper wants what no loose piece is yet');
  result = reduceMergeWorld(state, { type: 'move', from: 22, to: 31, now: NOW + 20 });
  assert.equal(result.changed, true, result.message);
  assert.equal(result.mergedCell, 31);
  assert.equal(result.revealedMistCells, undefined, 'a merge beside veiled mist reveals nothing; only a waking does');
  state = result.state; merges += 1;
  // 9. The Pack wakes the top cell into an Expedition Kit: the finale.
  const last = stepOf(state, merges);
  assert.equal(last.id, 'mission.steppling.wake');
  const finale = stepplingMissionWake(state)!;
  assert.deepEqual([finale.from, finale.to], [31, 24]);
  result = reduceMergeWorld(state, { type: 'move', from: 31, to: 24, now: NOW + 21 });
  assert.equal(result.changed, true, result.message);
  assert.equal(result.mergedCell, 24);
  assert.equal((result.state.board[24].occupant as { definitionId: string }).definitionId, 'adventure:trail:6');
  state = result.state; merges += 1;
  assert.equal(merges, STEPPLING_MISSION_MERGE_REQUIRED, 'eight strikes: two per wisp');
  assert.equal(stepplingMissionWake(state), null);
  assert.equal(OPENING_MERGE_WINDOW_CELLS.some((index) => state.board[index].mist?.kind === 'veiled' || state.board[index].mist?.kind === 'echo'), false, 'every full-mist cell in the window bursts into something, and everything wakes');
  assert.equal(stepplingMissionItemsOnBoard(state), 1, 'one piece left: the Kit that flies into the mist');
  // A free board with a pair and nothing to wake points at the pair; with nothing at all, at nothing.
  const pairOnly = createStepplingMissionState(NOW);
  pairOnly.board[38] = { ...pairOnly.board[38], locked: false, mist: null };
  assert.equal(stepOf(pairOnly, 1).id, 'mission.steppling.merge');
  assert.equal(stepOf(pairOnly, 1).spotlight, undefined);
  const empty = { ...pairOnly, board: pairOnly.board.map((cell) => ({ ...cell, occupant: null })) };
  assert.equal(stepOf(empty, 1).id, 'mission.steppling.free');
  assert.equal(stepOf(empty, 1).cue, undefined);
  assert.equal(stepplingMissionProgress(STEPPLING_MISSION_MERGE_REQUIRED + 3), STEPPLING_MISSION_MERGE_REQUIRED);
  assert.equal(stepplingMissionProgress(-1), 0);
  assert.equal(STEPPLING_MISSION_HINT_DELAY_MS, 2_000);
  assert.deepEqual(STEPPLING_MISSION_HINT_THEME, { fingerDelayMs: 2_000 });
  assert.equal(stepplingMissionBoardStep(null, 0), null);
});

test('every way of playing the board reaches the bar: no move leaves the mission short of its strikes', () => {
  // Exhaustive over merges and wakings from the seed (moves onto empty cells change nothing that matters).
  const seen = new Set<string>();
  let leaves = 0;
  const key = (state: MergeWorldState) => JSON.stringify(state.board.map((cell) => [cell.occupant?.kind === 'item' ? cell.occupant.definitionId : null, cell.mist?.kind ?? null, cell.mist?.kind === 'echo' ? cell.mist.definitionId : null]));
  const walk = (state: MergeWorldState, strikes: number) => {
    const signature = `${key(state)}:${strikes}`;
    if (seen.has(signature)) return;
    seen.add(signature);
    if (strikes >= STEPPLING_MISSION_MERGE_REQUIRED) return;
    const items = OPENING_MERGE_WINDOW_CELLS.filter((index) => state.board[index]?.occupant?.kind === 'item');
    const targets = OPENING_MERGE_WINDOW_CELLS.filter((index) => state.board[index]?.occupant?.kind === 'item' || state.board[index]?.mist?.kind === 'echo');
    let moved = false;
    for (const from of items) for (const to of targets) {
      if (from === to) continue;
      const result = reduceMergeWorld(state, { type: 'move', from, to, now: NOW });
      if (!result.changed || result.mergedCell == null) continue;
      moved = true;
      walk(result.state, strikes + 1);
    }
    if (!moved) { leaves += 1; assert.fail(`a dead end after ${strikes} strikes`); }
  };
  walk(createStepplingMissionState(NOW), 0);
  assert.equal(leaves, 0);
  assert.ok(seen.size >= STEPPLING_MISSION_MERGE_REQUIRED, 'every strike along the way is a state of its own');
  // And every path is the same path: the only freedom is which two of the three Socks meet first.
  let forcedStates = 0;
  const walkChoices = (state: MergeWorldState, strikes: number) => {
    if (strikes >= STEPPLING_MISSION_MERGE_REQUIRED) return;
    const items = OPENING_MERGE_WINDOW_CELLS.filter((index) => state.board[index]?.occupant?.kind === 'item');
    const targets = OPENING_MERGE_WINDOW_CELLS.filter((index) => state.board[index]?.occupant?.kind === 'item' || state.board[index]?.mist?.kind === 'echo');
    const outcomes = new Set<string>();
    let next: MergeWorldState | null = null;
    for (const from of items) for (const to of targets) {
      if (from === to) continue;
      const result = reduceMergeWorld(state, { type: 'move', from, to, now: NOW });
      if (!result.changed || result.mergedCell == null) continue;
      outcomes.add(JSON.stringify(result.state.board.map((cell) => [cell.occupant?.kind === 'item' ? cell.occupant.definitionId : null, cell.mist?.kind ?? null]).filter((entry) => entry[0] != null || entry[1] === 'echo' || entry[1] === 'veiled').sort()));
      next = result.state;
    }
    assert.ok(outcomes.size <= (strikes === 0 ? 3 : 1), `strike ${strikes + 1}: one thing to do, not ${outcomes.size}`);
    forcedStates += 1;
    if (next) walkChoices(next, strikes + 1);
  };
  walkChoices(createStepplingMissionState(NOW), 0);
  assert.equal(forcedStates, STEPPLING_MISSION_MERGE_REQUIRED);
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
