import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from './helpers/content-fs';
import { loadNativeModule } from './helpers/native-motion-harness';
import * as mergeFtue from '@/features/onboarding/merge-ftue';
import * as script from '@/features/onboarding/mossprout-ftue-script';
import type { FtueStepDefinition } from '@/features/onboarding/ftue-types';
import {
  OPENING_BOARD_LAYOUT, OPENING_GUIDED_MERGES, OPENING_MERGE_REQUIRED, OPENING_MERGE_WINDOW_CELLS, OPENING_MERGE_WINDOW_COLUMNS, OPENING_MERGE_WINDOW_ROWS,
  homeSoloForStep, homeVeilForStep, openingMistBoardStep, openingMistProgress,
} from '@/features/onboarding/opening-mist';
import { mergeFtueBoardGate } from '@/features/onboarding/merge-ftue';
import type { MergeWorldState } from '@/types/merge-world';
import { MOSSPROUT_DREAM_ECHOES, MOSSPROUT_FTUE_OPEN_CELLS, MERGE_WORLD_COLUMNS } from '@/constants/merge-world-catalog';
import { mergeCellCenter, mergeCellFrame, mergeCellFromPoint, mergeNeighborCellInDirection } from '@/utils/merge-world/board-geometry';
import { createMossproutChapterZeroState, createMossproutOpeningState } from '@/utils/merge-world/onboarding';
import { reduceMergeWorld } from '@/utils/merge-world/engine';

const NOW = Date.UTC(2026, 8, 10, 9);
const SEED = 'nature:garden:1';

test('the 5×4 window sits on columns 1–5, rows 2–5 of the canonical board and round-trips every touch point', () => {
  assert.equal(OPENING_MERGE_WINDOW_CELLS.length, OPENING_MERGE_WINDOW_COLUMNS * OPENING_MERGE_WINDOW_ROWS);
  for (const [visual, index] of OPENING_MERGE_WINDOW_CELLS.entries()) {
    assert.equal(index % MERGE_WORLD_COLUMNS, 1 + (visual % OPENING_MERGE_WINDOW_COLUMNS), `cell ${index} column`);
    assert.equal(Math.floor(index / MERGE_WORLD_COLUMNS), 2 + Math.floor(visual / OPENING_MERGE_WINDOW_COLUMNS), `cell ${index} row`);
  }
  for (const index of [29, 30, 31, 32, 33]) assert.ok(OPENING_MERGE_WINDOW_CELLS.includes(index), 'the Seeds and the Basket are in the window');
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
});

test('the opening board can make exactly eight merges from its placed pieces and ends holding the request’s Plant', () => {
  const state = createMossproutOpeningState(NOW);
  const items = state.board.flatMap((cell, index) => cell.occupant?.kind === 'item' ? [{ index, id: cell.occupant.definitionId }] : []);
  assert.equal(items.filter((item) => item.id === SEED).length, 8);
  assert.equal(items.filter((item) => item.id === 'nature:garden:2').length, 2);
  assert.ok(items.every((item) => OPENING_MERGE_WINDOW_CELLS.includes(item.index)), 'every piece is visible in the window');
  assert.ok(items.every((item) => MOSSPROUT_FTUE_OPEN_CELLS.has(item.index) && !MOSSPROUT_DREAM_ECHOES.some((echo) => echo.cell === item.index)));
  for (const index of OPENING_MERGE_WINDOW_CELLS) {
    const cell = state.board[index]!;
    assert.equal(cell.locked, false, `cell ${index} is open in the window`);
    assert.equal(cell.mist, null, `cell ${index} shows no mist in the window`);
  }
  assert.equal(state.board[31]!.occupant?.kind, 'generator', 'the Basket keeps its place');
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
    const tiers = ['nature:garden:1', 'nature:garden:2', 'nature:garden:3', 'nature:garden:4'];
    const pair = tiers.map((id) => current.board.flatMap((cell, index) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === id ? [index] : [])).find((cells) => cells.length >= 2);
    if (!pair) break;
    const result = reduceMergeWorld(current, { type: 'move', from: pair[0], to: pair[1], now: NOW + merges + 1 });
    assert.equal(result.changed, true);
    current = result.state;
    merges += 1;
  }
  assert.equal(merges, OPENING_MERGE_REQUIRED, 'the bar is exactly what the board holds');
  const left = current.board.flatMap((cell) => cell.occupant?.kind === 'item' ? [cell.occupant.definitionId] : []).sort();
  assert.deepEqual(left, ['nature:garden:3', 'nature:garden:4'], 'a Plant for the request and a Flower to keep');
  const chapterZero = createMossproutChapterZeroState(NOW);
  assert.equal(chapterZero.board.filter((cell) => cell.occupant?.kind === 'item').length, 4, 'the classic lesson board is untouched');
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
  assert.equal(homeSoloForStep('world.mist_open'), true, 'the first beat shows the tile alone');
  assert.equal(homeSoloForStep('world.mist_clear'), false);
  assert.equal(homeSoloForStep(null), false);
});

test('a board that ran ahead of the checkpoint refills from the Basket, and only then', () => {
  const authored: FtueStepDefinition = { id: 'world.mist_clear', surface: 'haven', guide: { eyebrow: '', title: 'Two of the same', body: '' }, actions: [], interaction: { mode: 'none' } };
  const state = createMossproutOpeningState(NOW);
  assert.equal(openingMistBoardStep(authored, state, 0), authored, 'pairs exist: the authored beat');
  const guided: FtueStepDefinition = { ...authored, cue: { kind: 'drag', from: { kind: 'board_items', definitionId: SEED, occurrence: 0 }, to: { kind: 'board_items', definitionId: SEED, occurrence: 1 } }, spotlight: { targets: [] } };
  assert.equal(openingMistBoardStep(guided, state, 0), guided, 'the first merge keeps the finger and spotlight');
  assert.equal(openingMistBoardStep(guided, state, OPENING_GUIDED_MERGES - 1), guided);
  const free = openingMistBoardStep(guided, state, OPENING_GUIDED_MERGES)!;
  assert.equal(free.id, guided.id);
  assert.equal(free.cue, undefined, 'after the guided merges the board is free');
  assert.equal(free.spotlight, undefined);
  assert.equal(mergeFtueBoardGate(authored, state).kind, 'open', 'a haven-surface step never gates the docked board');
  // Strip the board down to one Seed: the lost-write case.
  const stripped = { ...state, board: state.board.map((cell, index) => cell.occupant?.kind === 'item' && index !== 29 ? { ...cell, occupant: null } : cell) };
  const refill = openingMistBoardStep(authored, stripped, 5)!;
  assert.equal(refill.id, 'world.mist_clear.refill');
  assert.equal(refill.surface, 'merge');
  assert.deepEqual(mergeFtueBoardGate(refill, stripped), { kind: 'generator', cell: 31, generatorId: 'wild-garden' });
  assert.equal(openingMistBoardStep(authored, stripped, OPENING_MERGE_REQUIRED)?.id, authored.id, 'a full bar never asks for more');
  const refilled = reduceMergeWorld(stripped, { type: 'tapGenerator', generatorId: 'wild-garden', now: NOW + 1, seed: 'refill' });
  assert.equal(refilled.changed, true);
  assert.equal(openingMistBoardStep(authored, refilled.state, 5)?.id, authored.id, 'one more Seed makes a pair again');
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
  assert.match(dock, /useFtueMergeDispatch\(\{[\s\S]*?guided: true/);
  assert.match(dock, /boardLayout=\{OPENING_BOARD_LAYOUT\}[\s\S]*?railHidden[\s\S]*?counterHidden[\s\S]*?inspectorHidden[\s\S]*?trayEntries=\{\[\]\}/);
  assert.doesNotMatch(dock, /FtueGuideCopy/, 'guidance comes from the Merge overlay, not a second copy block');
  const surface = readFileSync('components/katchadeck/games/merge-play-surface.tsx', 'utf8');
  assert.match(surface, /\{railHidden \? null : <MergeOrderRail[\s\S]*?\{counterHidden \? null : <ServiceCounter[\s\S]*?<SubscribedMergeBoard[\s\S]*?<MergeCellInspector/);
});
