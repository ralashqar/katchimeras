import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from './helpers/content-fs';
import { loadNativeModule } from './helpers/native-motion-harness';
import * as mergeFtue from '@/features/onboarding/merge-ftue';
import * as script from '@/features/onboarding/mossprout-ftue-script';
import type { FtueStepDefinition } from '@/features/onboarding/ftue-types';
import {
  OPENING_BOARD_LAYOUT, OPENING_GUIDED_MERGES, OPENING_MERGE_REQUIRED, OPENING_MERGE_WINDOW_CELLS, OPENING_MERGE_WINDOW_COLUMNS, OPENING_MERGE_WINDOW_ROWS,
  closestOpeningPair, homeSoloForStep, homeVeilForStep, OPENING_FINAL_ITEM_ID, openingMergesOnBoard, openingMistBoardStep, openingMistProgress,
} from '@/features/onboarding/opening-mist';
import { mergeFtueAllowsCommand, mergeFtueBoardGate } from '@/features/onboarding/merge-ftue';
import type { MergeWorldState } from '@/types/merge-world';
import { MERGE_WORLD_COLUMNS } from '@/constants/merge-world-catalog';
import { mergeCellCenter, mergeCellFrame, mergeCellFromPoint, mergeNeighborCellInDirection } from '@/utils/merge-world/board-geometry';
import { createMossproutChapterZeroState, createMossproutOpeningState, MOSSPROUT_OPENING_BASKET_CELL } from '@/utils/merge-world/onboarding';
import { createOpeningMissionState, OPENING_MISSION_STORAGE_KEY } from '@/features/onboarding/opening-mission-state';
import { reduceMergeWorld } from '@/utils/merge-world/engine';

const NOW = Date.UTC(2026, 8, 10, 9);
const SEED = 'nature:garden:1';

test('the 5×4 window sits on columns 1–5, rows 2–5 of the canonical board and round-trips every touch point', () => {
  assert.equal(OPENING_MERGE_WINDOW_CELLS.length, OPENING_MERGE_WINDOW_COLUMNS * OPENING_MERGE_WINDOW_ROWS);
  for (const [visual, index] of OPENING_MERGE_WINDOW_CELLS.entries()) {
    assert.equal(index % MERGE_WORLD_COLUMNS, 1 + (visual % OPENING_MERGE_WINDOW_COLUMNS), `cell ${index} column`);
    assert.equal(Math.floor(index / MERGE_WORLD_COLUMNS), 2 + Math.floor(visual / OPENING_MERGE_WINDOW_COLUMNS), `cell ${index} row`);
  }
  for (const index of [29, 30, 32, 33]) assert.ok(OPENING_MERGE_WINDOW_CELLS.includes(index), 'the Seeds are in the window');
  assert.equal(OPENING_MERGE_WINDOW_CELLS.includes(MOSSPROUT_OPENING_BASKET_CELL), false, 'the Basket is never part of the opening');
  const geometry = { cellIndices: OPENING_MERGE_WINDOW_CELLS, cellHeight: 70, cellSize: 70, columns: OPENING_MERGE_WINDOW_COLUMNS, gap: 0, inset: 6, rows: OPENING_MERGE_WINDOW_ROWS };
  for (const index of OPENING_MERGE_WINDOW_CELLS) {
    const frame = mergeCellFrame(geometry, index);
    assert.equal(mergeCellFromPoint(geometry, frame.center.x, frame.center.y), index, `cell ${index} hit-tests to itself`);
    assert.deepEqual(mergeCellCenter(geometry, index), frame.center);
  }
  assert.equal(mergeNeighborCellInDirection(geometry, 29, 1, 0), 30, 'neighbours follow the logical board');
  assert.equal(mergeNeighborCellInDirection(geometry, 33, 1, 0), null, 'the window edge is the world edge for a flick');
  assert.equal(mergeCellFromPoint(geometry, -20, -20), null);
  assert.equal(OPENING_BOARD_LAYOUT.transparentSurface, false, 'the Merge page’s own frame');
  assert.equal(OPENING_BOARD_LAYOUT.baseArtOpacity, 0, 'no stretched base art in the window');
  assert.ok(OPENING_BOARD_LAYOUT.checkerboardCellColor, 'the window keeps the page’s checkerboard read through the native per-cell tint');
});

test('the opening board is two mirrored chains that meet in one final merge and end the board empty', () => {
  const state = createMossproutOpeningState(NOW);
  const items = state.board.flatMap((cell, index) => cell.occupant?.kind === 'item' ? [{ index, id: cell.occupant.definitionId }] : []);
  assert.equal(items.length, 8);
  assert.equal(items.filter((item) => item.id === SEED).length, 4);
  assert.equal(items.filter((item) => item.id === 'nature:garden:2').length, 2);
  assert.equal(items.filter((item) => item.id === 'nature:garden:3').length, 2);
  assert.ok(items.every((item) => OPENING_MERGE_WINDOW_CELLS.includes(item.index)), 'every piece is visible in the window');
  assert.ok(items.every((item) => state.board[item.index]!.mist === null), 'no piece sits under mist');
  for (const index of OPENING_MERGE_WINDOW_CELLS) {
    const cell = state.board[index]!;
    assert.equal(cell.locked, false, `cell ${index} is open in the window`);
    assert.equal(cell.mist, null, `cell ${index} shows no mist in the window`);
  }
  assert.equal(state.board[MOSSPROUT_OPENING_BASKET_CELL]!.occupant?.kind, 'generator', 'the Basket waits below the window');
  assert.equal(state.board[31]!.occupant, null);
  const echoes = state.board.flatMap((cell, index) => cell.mist?.kind === 'echo' ? [`${cell.mist.id}@${index}`] : []);
  assert.deepEqual(echoes, ['mossprout-seed-echo@9', 'mossprout-sprout-echo@10', 'mossprout-plant-echo@11', 'mossprout-garden-echo@45', 'mossprout-flower-echo@47'], 'the echoes wait just outside the window');
  for (const id of ['onboarding-seed-a', 'onboarding-seed-b', 'onboarding-seed-c', 'onboarding-seed-d']) {
    assert.ok(state.board.some((cell) => cell.occupant?.kind === 'item' && cell.occupant.instanceId === id), `${id} keeps its identity for old fixtures`);
  }
  assert.ok(state.activeOrders.some((order) => order.id === 'mossprout:chapter-0:first-sprout'), 'the chapter-zero order is active from install');
  // Greedy: always merge the lowest tier available.
  let current: MergeWorldState = state;
  let merges = 0;
  for (;;) {
    const tiers = ['nature:garden:1', 'nature:garden:2', 'nature:garden:3', 'nature:garden:4', 'nature:garden:5'];
    const pair = tiers.map((id) => current.board.flatMap((cell, index) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === id ? [index] : [])).find((cells) => cells.length >= 2);
    if (!pair) break;
    const result = reduceMergeWorld(current, { type: 'move', from: pair[0], to: pair[1], now: NOW + merges + 1 });
    assert.equal(result.changed, true);
    current = result.state;
    merges += 1;
  }
  assert.equal(merges, OPENING_MERGE_REQUIRED, 'the bar is exactly what the board holds');
  const left = current.board.flatMap((cell) => cell.occupant?.kind === 'item' ? [cell.occupant.definitionId] : []);
  assert.deepEqual(left, [OPENING_FINAL_ITEM_ID], 'one Rare Flower is all that remains, and the Mist takes it');
  const chapterZero = createMossproutChapterZeroState(NOW);
  assert.equal(chapterZero.board.filter((cell) => cell.occupant?.kind === 'item').length, 4, 'the classic lesson board is untouched');
});

test('the mission board is its own board: only the window is populated, no Basket, no orders', () => {
  const mission = createOpeningMissionState(NOW);
  const outside = mission.board.flatMap((cell, index) => cell.occupant && !OPENING_MERGE_WINDOW_CELLS.includes(index) ? [index] : []);
  assert.deepEqual(outside, [], 'nothing outside the window');
  assert.equal(mission.board.some((cell) => cell.occupant?.kind === 'generator'), false, 'no spawner anywhere');
  assert.deepEqual(mission.generators, {});
  assert.deepEqual(mission.activeOrders, []);
  assert.equal(mission.board.filter((cell) => cell.occupant?.kind === 'item').length, 8);
  assert.equal(openingMergesOnBoard(mission), 0);
  assert.equal(OPENING_MISSION_STORAGE_KEY, 'katchimeras.opening-mission.v1');
});

test('the bar reads objective progress and the veil follows the opening steps', () => {
  const run = (stepId: string, count?: number) => ({ status: 'active' as const, stepId, objectiveProgress: (count == null ? {} : { 'world.mist_clear:world.clear_mist': count }) as Record<string, number> });
  assert.equal(openingMistProgress(run('world.mist_open')), 0);
  assert.equal(openingMistProgress(run('world.mist_clear')), 0);
  assert.equal(openingMistProgress(run('world.mist_clear', 3)), 3);
  assert.equal(openingMistProgress(run('world.mist_clear', 99)), OPENING_MERGE_REQUIRED);
  assert.equal(openingMistProgress(run('world.mist_lift')), OPENING_MERGE_REQUIRED);
  assert.equal(openingMistProgress({ ...run('world.mist_clear', 3), status: 'complete' }), 0);
  assert.equal(openingMistProgress(null), 0);
  assert.equal(homeVeilForStep('world.mist_open'), 'veiled');
  assert.equal(homeVeilForStep('world.mist_clear'), 'veiled');
  assert.equal(homeVeilForStep('world.mist_lift'), 'lifting');
  assert.equal(homeVeilForStep('world.egg_intro'), 'none');
  assert.equal(homeVeilForStep(null), 'none');
  for (const stepId of ['world.mist_open', 'world.mist_clear', 'world.mist_lift', 'world.egg_intro', 'egg.opening', 'egg.context', 'egg.ready']) {
    assert.equal(homeSoloForStep(stepId), true, `${stepId}: the tile stands alone until the hatch`);
  }
  assert.equal(homeSoloForStep('companion.first_meeting'), false, 'the islands are met after the hatch');
  assert.equal(homeSoloForStep('world.garden_arrival'), false);
  assert.equal(homeSoloForStep(null), false);
});

test('a board that ran ahead of the checkpoint is caught up from what it shows, with no refill and no spawner', () => {
  const authored: FtueStepDefinition = { id: 'world.mist_clear', surface: 'haven', guide: { eyebrow: '', title: 'Two of the same', body: '' }, actions: [], interaction: { mode: 'none' } };
  const state = createMossproutOpeningState(NOW);
  assert.equal(openingMergesOnBoard(state), 0);
  // Guided like the original lesson: one allowed drag, the spotlight only on the first.
  const first = openingMistBoardStep(authored, state, 0)!;
  assert.equal(first.id, 'world.mist_clear.guided-1');
  assert.equal(first.surface, 'merge');
  assert.deepEqual(closestOpeningPair(state), { from: 16, to: 17 }, 'the closest same-item pair');
  assert.deepEqual(mergeFtueBoardGate(first, state), { kind: 'drag', fromCell: 16, toCell: 17 }, 'exactly one drag is allowed');
  assert.equal(mergeFtueAllowsCommand(first, state, { type: 'move', from: 16, to: 17, now: NOW }), true);
  assert.equal(mergeFtueAllowsCommand(first, state, { type: 'move', from: 29, to: 30, now: NOW }), false, 'other pairs are locked');
  assert.equal(mergeFtueAllowsCommand(first, state, { type: 'tapGenerator', generatorId: 'wild-garden', now: NOW, seed: 'x' }), false, 'the Basket is locked too');
  assert.equal(first.cue?.kind, 'drag');
  assert.equal(first.spotlight?.targets.length, 2, 'the first merge is spotlit');
  const afterFirst = reduceMergeWorld(state, { type: 'move', from: 16, to: 17, now: NOW + 1 }).state;
  assert.equal(openingMergesOnBoard(afterFirst), 1, 'the board shows its merges');
  const second = openingMistBoardStep(authored, afterFirst, 1)!;
  assert.equal(second.id, 'world.mist_clear.guided-2');
  assert.equal(second.cue?.kind, 'drag', 'the second merge keeps the finger');
  assert.equal(second.spotlight, undefined, 'but drops the spotlight');
  assert.equal(mergeFtueBoardGate(second, afterFirst).kind, 'drag', 'still one allowed drag');
  const secondPair = closestOpeningPair(afterFirst)!;
  const afterSecond = reduceMergeWorld(afterFirst, { type: 'move', from: secondPair.from, to: secondPair.to, now: NOW + 2 }).state;
  const third = openingMistBoardStep(authored, afterSecond, 2)!;
  assert.equal(third.surface, 'haven', 'from the third merge the board is free');
  assert.equal(mergeFtueBoardGate(third, afterSecond).kind, 'open');
  assert.equal(third.cue, undefined);
  assert.equal(mergeFtueBoardGate(authored, state).kind, 'open', 'a haven-surface step never gates the docked board');
  // The lost-write case: the board holds only the final piece, the checkpoint says one less.
  const finished = { ...state, board: state.board.map((cell, index) => cell.occupant?.kind === 'item' && index !== 16 ? { ...cell, occupant: null } : cell) };
  assert.equal(openingMergesOnBoard(finished), OPENING_MERGE_REQUIRED, 'one piece left means every merge happened');
  const stuck = openingMistBoardStep(authored, finished, OPENING_MERGE_REQUIRED - 1)!;
  assert.equal(stuck.id, authored.id, 'no refill beat: the dock replays the missing merge from the board instead');
  assert.equal(stuck.cue, undefined);
  const guided: FtueStepDefinition = { ...authored, cue: { kind: 'drag', from: { kind: 'board_items', definitionId: SEED, occurrence: 0 }, to: { kind: 'board_items', definitionId: SEED, occurrence: 1 } }, spotlight: { targets: [] } };
  const free = openingMistBoardStep(guided, state, OPENING_GUIDED_MERGES)!;
  assert.equal(free.id, guided.id);
  assert.equal(free.cue, undefined, 'after the guided merges the authored guidance is stripped');
  assert.equal(free.spotlight, undefined);
  assert.equal(openingMistBoardStep(authored, null, 0), authored);
  assert.equal(openingMistBoardStep(null, state, 0), null);
});

test('the docked board dispatches through the FTUE contract: Basket taps spend no Energy, merges advance the counted objective', () => {
  const module = loadNativeModule('features/onboarding/use-ftue-merge-dispatch.ts', {
    react: { useCallback: (fn: unknown) => fn },
    './ftue-runtime': { dispatchFtueEvent: (event: { type: string }) => { dispatched.push(event.type); return { status: 'active', stepId: 'world.mist_clear' }; } },
    './merge-ftue': mergeFtue,
    './mossprout-ftue-script': script,
  });
  const dispatched: string[] = [];
  const sent: { command: { type: string; spendEnergy?: boolean }; options: unknown }[] = [];
  const state = createMossproutOpeningState(NOW);
  const coordinator = { leased: false, begin: () => ({ commandId: 1 }), complete: () => true, abort: () => true };
  const authored: FtueStepDefinition = { id: 'world.mist_clear', surface: 'haven', guide: { eyebrow: '', title: '', body: '' }, actions: [], interaction: { mode: 'none' } };
  const stateRef = { current: state }; const runRef = { current: { status: 'active', stepId: 'world.mist_clear' } }; const stepRef = { current: authored };
  const events: string[] = [];
  const dispatch = (module.useFtueMergeDispatch as (input: unknown) => (command: unknown) => unknown)({
    send: (command: { type: string }, options: unknown) => { sent.push({ command, options }); return reduceMergeWorld(stateRef.current, command as never); },
    coordinator, sessionId: 's', stateRef, runRef, stepRef, guided: true,
    onEvent: (event: { type: string }) => events.push(event.type),
  });
  const [from, to] = state.board.flatMap((cell, index) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === SEED ? [index] : []);
  dispatch({ type: 'move', from, to, now: NOW + 1 });
  assert.equal((sent[0]!.options as { persist?: string }).persist, 'immediate', 'guided boards never buffer their writes behind the checkpoint');
  assert.equal(dispatched.at(-1), 'merge_completed');
  assert.equal(events.at(-1), 'merge_completed');
  dispatch({ type: 'tapGenerator', generatorId: 'wild-garden', now: NOW + 2, seed: 'tap' });
  assert.equal(sent[1]!.command.spendEnergy, false, 'chapter zero has no Energy to spend');
  assert.equal(dispatched.at(-1), 'item_spawned');

  const dock = readFileSync('components/katchadeck/world/kingdom-opening-merge-dock.tsx', 'utf8');
  assert.match(dock, /useFtueMergeDispatch\(\{[\s\S]*?guided: true, deferEvent: true/, 'the run advances on the next frame, off the merge animation');
  assert.match(dock, /const missing = openingMergesOnBoard\(state\) - progress;[\s\S]*?dispatchFtueEvent\(\{ type: 'merge_completed'/, 'the dock replays merges the board shows but the checkpoint missed');
  assert.match(dock, /const caughtUpRef = useRef\(false\);\s*useEffect\(\(\) => \{\s*if \(!run \|\| run\.status !== 'active' \|\| caughtUpRef\.current\) return;\s*caughtUpRef\.current = true;/, 'the replay runs once, for the mounted board only: a live merge rerenders before its deferred event lands and must not be counted twice');
  assert.doesNotMatch(dock, /caughtUpRevisionRef/, 'no per-revision replay');
  assert.doesNotMatch(dock, /boxShadow: `0 0 \d+px \$\{GLOW_COLOR\}`/, 'no blurred shadows on the animating impact views');
  assert.doesNotMatch(dock, /entering=\{FadeIn/, 'no layout animation on the Glow tokens');
  assert.match(dock, /layout = OPENING_BOARD_LAYOUT, barTitle = 'Clear the Mist'/, 'the opening window and title are the defaults');
  assert.match(dock, /boardLayout=\{layout\}[\s\S]*?railHidden[\s\S]*?counterHidden[\s\S]*?inspectorHidden[\s\S]*?trayEntries=\{\[\]\}/);
  assert.match(dock, /animateEntrance=\{false\}/, 'one entrance, owned by the dock');
  assert.match(dock, /onVisualReady=\{markBoardReady\}[\s\S]*?screenMetricsRevision=\{metricsRevision\}/, 'the dock waits for the board and re-measures after settling');
  assert.match(dock, /if \(!boardReady\) return;\s*entrance\.value = withTiming\(1,/, 'fade and scale up only once the board has painted');
  assert.match(dock, /awaitingSettledMetricsRef\.current = true;\s*setMetricsRevision\(\(revision\) => revision \+ 1\);/, 'the entrance end asks the board to re-measure');
  assert.match(dock, /onBoardMetrics\?\.\(metrics\);\s*if \(awaitingSettledMetricsRef\.current\) \{\s*awaitingSettledMetricsRef\.current = false;\s*onEntranceSettledRef\.current\?\.\(\);/, 'guidance is told only once the settled measurement has landed');
  assert.doesNotMatch(dock, /SlideInDown/, 'no layout-animation entrance that measures mid-flight');
  assert.doesNotMatch(dock, /FtueGuideCopy/, 'guidance comes from the Merge overlay, not a second copy block');
  const surface = readFileSync('components/katchadeck/games/merge-play-surface.tsx', 'utf8');
  assert.match(surface, /\{railHidden \? null : <MergeOrderRail[\s\S]*?\{counterHidden \? null : <ServiceCounter[\s\S]*?<SubscribedMergeBoard[\s\S]*?<MergeCellInspector/);
});
