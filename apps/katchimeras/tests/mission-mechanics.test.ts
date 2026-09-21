import assert from 'node:assert/strict';
import test from 'node:test';

import { HATCHABLE_COMPANIONS } from '@/constants/hatchable-companions/registry';
import { ISLAND_CAMPAIGNS } from '@/constants/island-campaigns/registry';
import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { OLD_GROVE_MISSION } from '@/constants/mossprout-arc-one-copy';
import { createRestorationState, restorationMechanicHost, restorationProgress } from '@/features/island-restoration/island-restoration';
import { missionWindow, type MissionWindow } from '@/features/mission-mechanics/board-window';
import { columnShotDamage, columnShotTotalHp, dealColumnShot } from '@/features/mission-mechanics/column-shot';
import { applyStrike, createMechanicState, mechanicComplete, mechanicMove, mechanicProgress, normalizeMechanicState, resolveMechanic, strikeFor, wispViews, type MissionMechanicHost } from '@/features/mission-mechanics/mechanic';
import { COLUMN_SHOT_PREVIEW, resolveMissionForPlay, resolveRestorationForPlay } from '@/features/mission-mechanics/preview';
import { wispHitPlan, wispStates, wispTargetIndex } from '@/features/onboarding/corruption-wisps';
import { createMissionState, missionBoardStep, missionProgress } from '@/features/onboarding/steppling-mission';
import { validateMissionDefinition } from '@/features/mission-mechanics/validate';
import { missionWispTarget } from '@/features/mission-mechanics/wisp-target';
import type { MissionMechanicDefinition, MissionMechanicState } from '@/types/mission-mechanic';
import type { MergeWorldState } from '@/types/merge-world';
import { reduceMergeWorld } from '@/utils/merge-world/engine';

const NOW = Date.UTC(2026, 8, 16, 9);
const WINDOW = missionWindow();
const SHIPPED_MISSIONS = [...HATCHABLE_COMPANIONS.map((definition) => ({ name: definition.companion, mission: definition.mission })), { name: 'old-grove', mission: OLD_GROVE_MISSION }];
const SHIPPED_RESTORATIONS = ISLAND_CAMPAIGNS.flatMap((campaign) => campaign.chapters.flatMap((chapter) => chapter.restoration && !chapter.restoration.rush ? [{ name: `${campaign.campaignId}:${chapter.level}`, definition: chapter.restoration }] : []));
const strikeEvent = (resultCell: number, resultDefinitionId: string, wake = false) => ({ type: wake ? 'dream_echo_cleared' as const : 'merge_completed' as const, resultCell, resultDefinitionId });

test('glow strikes are the way every shipped board has always played: one hit per strike, dealt in order, the last wisp on the final strike', () => {
  const hosts: { name: string; host: MissionMechanicHost }[] = [
    ...SHIPPED_MISSIONS.map(({ name, mission }) => ({ name, host: mission })),
    ...SHIPPED_RESTORATIONS.map(({ name, definition }) => ({ name, host: restorationMechanicHost(definition) })),
  ];
  assert.ok(hosts.length >= 4);
  for (const { name, host } of hosts) {
    const mechanic = resolveMechanic(host);
    // A board authored with its own mechanic (a pack's column shot) is not a glow-strikes board.
    if (host.mechanic && host.mechanic.kind !== 'glow-strikes') continue;
    assert.equal(mechanic.kind, 'glow-strikes', `${name} plays by glow strikes`);
    const plan = wispHitPlan(host.required, host.wisps.length);
    let state = createMechanicState(mechanic);
    for (let n = 0; n < host.required; n += 1) {
      assert.deepEqual(mechanicProgress(mechanic, host, state), { current: missionProgress(n, host.required), total: host.required }, `${name}: the bar after ${n} strikes`);
      assert.equal(mechanicComplete(mechanic, host, state), false);
      assert.deepEqual(wispViews(mechanic, host, state).map((wisp) => [wisp.hp, wisp.damage, wisp.alive]), wispStates(plan, n).map((wisp) => [wisp.hp, wisp.hits, wisp.alive]), `${name}: the wisps after ${n} strikes`);
      const { next, strike } = strikeFor(mechanic, host, WINDOW, state, strikeEvent(36, 'nature:garden:2', n % 2 === 1));
      assert.ok(strike);
      assert.equal(strike.target, wispTargetIndex(plan, n), `${name}: strike ${n + 1} hits the first wisp standing`);
      assert.deepEqual(strike.hits, [{ wisp: strike.target, damage: 1 }]);
      assert.equal(strike.finale, n + 1 >= host.required, `${name}: only the last strike is the finale`);
      assert.equal(strike.wasted, false);
      assert.deepEqual(applyStrike(mechanic, state, strike), next, 'what the layer applies on landing is what the store saved');
      state = next;
    }
    assert.equal(mechanicComplete(mechanic, host, state), true);
    assert.deepEqual(wispViews(mechanic, host, state).map((wisp) => wisp.alive), host.wisps.map(() => false));
    assert.deepEqual(wispViews(mechanic, host, state).map((wisp) => wisp.placement), host.wisps.map((spec) => ({ kind: 'tile', fx: spec.fx, fy: spec.fy, size: spec.size })), `${name}: the wisps hang where they were authored`);
    // Nothing made, nothing struck.
    assert.deepEqual(strikeFor(mechanic, host, WINDOW, state, null), { next: state, strike: null });
    // The saved merge count is the state; a column-shot save is not needed.
    assert.deepEqual(normalizeMechanicState(mechanic, undefined, 3), { kind: 'glow-strikes', strikes: 3 });
  }
  for (const { definition } of SHIPPED_RESTORATIONS) {
    if (definition.mechanic && definition.mechanic.kind !== 'glow-strikes') continue;
    const host = restorationMechanicHost(definition);
    assert.equal(host.mechanic?.kind === 'glow-strikes' ? host.mechanic.flight : null, 'item', 'a restoration board sends the item it made');
    assert.deepEqual(mechanicProgress(resolveMechanic(host), host, { kind: 'glow-strikes', strikes: 2 }), restorationProgress(definition, 2));
  }
});

const SKY: Extract<MissionMechanicDefinition, { kind: 'column-shot' }> = {
  kind: 'column-shot', damageByTier: [1, 3, 7], overflow: 'carry-up', emptyColumn: 'nearest',
  wisps: { rows: 2, cells: [{ id: 'a', column: 0, row: 0, hp: 2 }, { id: 'b', column: 2, row: 0, hp: 2 }, { id: 'c', column: 2, row: 1, hp: 3 }] },
};
const SKY_HOST: MissionMechanicHost = { required: 7, wisps: [], mechanic: SKY };

test('a column shot: damage by tier, the lowest wisp standing in the column, overflow carried up or lost, an empty column to the nearest or wasted', () => {
  assert.equal(columnShotDamage(SKY, 'adventure:trail:1'), 1);
  assert.equal(columnShotDamage(SKY, 'adventure:trail:2'), 3);
  assert.equal(columnShotDamage(SKY, 'adventure:trail:3'), 7);
  assert.equal(columnShotDamage(SKY, 'adventure:trail:6'), 7, 'past the table, the last entry repeats');
  assert.equal(columnShotDamage(SKY, 'no-such-item'), 1, 'an unknown thing hits like tier one');
  assert.equal(columnShotTotalHp(SKY), 7);
  // Column 2 holds two wisps: the lower takes the shot, the rest carries up.
  assert.deepEqual(dealColumnShot(SKY, [0, 0, 0], 2, 3), { damage: [0, 2, 1], hits: [{ wisp: 1, damage: 2 }, { wisp: 2, damage: 1 }] });
  assert.deepEqual(dealColumnShot({ ...SKY, overflow: 'lost' }, [0, 0, 0], 2, 3), { damage: [0, 2, 0], hits: [{ wisp: 1, damage: 2 }] }, 'or is lost');
  // Column 1 is empty sky: the shot drifts to the nearest wisp standing (column 0 and 2 tie; the lower row, then the first authored).
  assert.deepEqual(dealColumnShot(SKY, [0, 0, 0], 1, 1).hits, [{ wisp: 0, damage: 1 }]);
  assert.deepEqual(dealColumnShot({ ...SKY, emptyColumn: 'lost' }, [0, 0, 0], 1, 1), { damage: [0, 0, 0], hits: [] }, 'or is wasted');
  // With the column spent and damage still carrying, the nearest column takes it; with nothing standing anywhere, it stops.
  assert.deepEqual(dealColumnShot(SKY, [0, 0, 0], 2, 7), { damage: [2, 2, 3], hits: [{ wisp: 1, damage: 2 }, { wisp: 2, damage: 3 }, { wisp: 0, damage: 2 }] });
  assert.deepEqual(dealColumnShot(SKY, [2, 2, 3], 2, 7), { damage: [2, 2, 3], hits: [] });
  // A shot outside the window (no column) goes to the nearest wisp too.
  assert.deepEqual(dealColumnShot(SKY, [0, 0, 0], null, 1).hits, [{ wisp: 0, damage: 1 }]);
});

test('a column-shot board: strikes from the merged cell’s column, the killing shot is the finale, the bar is hit points, and its save is a damage vector', () => {
  let state = createMechanicState(SKY);
  assert.deepEqual(state, { kind: 'column-shot', strikes: 0, damage: [0, 0, 0] });
  assert.deepEqual(mechanicProgress(SKY, SKY_HOST, state), { current: 0, total: 7 });
  // Cell 38 is column 2 of the window; a tier-2 lands 3 damage there.
  let step = strikeFor(SKY, SKY_HOST, WINDOW, state, strikeEvent(38, 'adventure:trail:2'));
  assert.deepEqual(step.strike, { fromCell: 38, resultDefinitionId: 'adventure:trail:2', hits: [{ wisp: 1, damage: 2 }, { wisp: 2, damage: 1 }], target: 1, finale: false, wasted: false });
  assert.deepEqual(step.next, { kind: 'column-shot', strikes: 1, damage: [0, 2, 1] });
  state = step.next;
  assert.deepEqual(wispViews(SKY, SKY_HOST, state).map((wisp) => [wisp.id, wisp.alive, wisp.placement]), [['a', true, { kind: 'board', column: 0, row: 0, size: undefined }], ['b', false, { kind: 'board', column: 2, row: 0, size: undefined }], ['c', true, { kind: 'board', column: 2, row: 1, size: undefined }]]);
  assert.deepEqual(mechanicProgress(SKY, SKY_HOST, state), { current: 3, total: 7 });
  // A waking counts the same as a merge: cell 36 is column 0.
  step = strikeFor(SKY, SKY_HOST, WINDOW, state, strikeEvent(36, 'adventure:trail:1', true));
  assert.deepEqual(step.strike?.hits, [{ wisp: 0, damage: 1 }]);
  state = step.next;
  // The shot that fells the last wisp is the finale; the layer's copy lands to the same picture.
  step = strikeFor(SKY, SKY_HOST, WINDOW, state, strikeEvent(37, 'adventure:trail:3'));
  assert.equal(step.strike?.finale, true);
  assert.equal(step.strike?.target, 0, 'column 1 is empty sky: the nearest wisp standing takes it, and the rest carries on');
  assert.equal(mechanicComplete(SKY, SKY_HOST, step.next), true);
  assert.deepEqual(applyStrike(SKY, state, step.strike!), step.next);
  assert.deepEqual(mechanicProgress(SKY, SKY_HOST, step.next), { current: 7, total: 7 });
  // After the last wisp: a further shot lands nowhere and is not a finale.
  const after = strikeFor(SKY, SKY_HOST, WINDOW, step.next, strikeEvent(36, 'adventure:trail:1'));
  assert.deepEqual([after.strike?.wasted, after.strike?.finale, after.strike?.target], [true, false, null]);
  // The save.
  assert.deepEqual(normalizeMechanicState(SKY, { damage: [0, 2, 1] }, 1), { kind: 'column-shot', strikes: 1, damage: [0, 2, 1] });
  assert.deepEqual(normalizeMechanicState(SKY, { damage: [0, 9, -1] }, 1), { kind: 'column-shot', strikes: 1, damage: [0, 2, 0] }, 'clamped to each wisp');
  assert.equal(normalizeMechanicState(SKY, { damage: [0, 2] }, 1), null, 'the wrong number of wisps cannot be read');
  assert.equal(normalizeMechanicState(SKY, { damage: [0, 'x', 1] }, 1), null);
  assert.deepEqual(normalizeMechanicState(SKY, undefined, 0), createMechanicState(SKY), 'no save and no strike yet: fresh');
  assert.equal(normalizeMechanicState(SKY, undefined, 2), null, 'strikes with no damage to show for them: unreadable');
});

/** Every way of playing a board, deduped by what it holds and what its wisps have taken. */
function walkBoard(name: string, host: MissionMechanicHost, window: MissionWindow, start: MergeWorldState, onState: (board: MergeWorldState, state: MissionMechanicState) => void) {
  const mechanic = resolveMechanic(host);
  const seen = new Set<string>();
  let terminals = 0;
  const key = (board: MergeWorldState, state: MissionMechanicState) => JSON.stringify([board.board.map((cell) => [cell.occupant?.kind === 'item' ? cell.occupant.definitionId : null, cell.mist?.kind ?? null, cell.mist?.kind === 'echo' ? cell.mist.definitionId : null]), state]);
  const walk = (board: MergeWorldState, state: MissionMechanicState, depth: number) => {
    const signature = key(board, state);
    if (seen.has(signature)) return;
    seen.add(signature);
    assert.ok(depth < 64, `${name}: a path that never ends`);
    if (mechanicComplete(mechanic, host, state)) { terminals += 1; return; }
    onState(board, state);
    const items = window.cellIndices.filter((index) => board.board[index]?.occupant?.kind === 'item');
    const targets = window.cellIndices.filter((index) => board.board[index]?.occupant?.kind === 'item' || board.board[index]?.mist?.kind === 'echo');
    let moved = false;
    for (const from of items) for (const to of targets) {
      if (from === to) continue;
      const result = reduceMergeWorld(board, { type: 'move', from, to, now: NOW });
      if (!result.changed || result.mergedCell == null) continue;
      const made = result.state.board[result.mergedCell]?.occupant;
      assert.equal(made?.kind, 'item');
      const { next, strike } = strikeFor(mechanic, host, window, state, { type: result.dreamEchoClearedId ? 'dream_echo_cleared' : 'merge_completed', resultCell: result.mergedCell, resultDefinitionId: (made as { definitionId: string }).definitionId });
      assert.ok(strike, `${name}: every merge strikes`);
      assert.equal(strike.finale, mechanicComplete(mechanic, host, next), `${name}: the finale is the strike that completes the board, and only that one`);
      moved = true;
      walk(result.state, next, depth + 1);
    }
    assert.ok(moved, `${name}: a dead end with wisps still standing`);
  };
  walk(start, createMechanicState(mechanic), 0);
  assert.ok(terminals > 0, `${name}: the board can be finished`);
  return seen.size;
}

test('every board the column-shot preview is laid over finishes on every path, with a move to point at all the way', () => {
  for (const { name, mission } of SHIPPED_MISSIONS) {
    const played = resolveMissionForPlay(mission, 'column-shot');
    assert.notEqual(played, mission);
    assert.equal(played.storageKey, `${mission.storageKey}.preview-column-shot`, 'saved apart from the real board');
    assert.equal(played.mechanic?.kind, 'column-shot');
    assert.equal(played.required, columnShotTotalHp(COLUMN_SHOT_PREVIEW.mechanic), 'the bar is the wisps’ hit points');
    assert.equal(played.seed.items.length, COLUMN_SHOT_PREVIEW.seedCells.length);
    assert.deepEqual(played.seed.echoes, []);
    const tierOne = played.seed.items[0]!.definitionId;
    assert.equal(MERGE_ITEMS_BY_ID.get(tierOne)?.tier, 1, `${name}: the preview is made of the board’s own tier one`);
    assert.equal(MERGE_ITEMS_BY_ID.get(tierOne)?.chainId, MERGE_ITEMS_BY_ID.get(mission.seed.items[0]!.definitionId)?.chainId, `${name}: from the board’s own chain`);
    assert.ok(played.seed.items.every((item) => item.definitionId === tierOne && WINDOW.cellIndices.includes(item.cell)));
    assert.equal(resolveMissionForPlay(mission, null), mission, 'with no preview, the board is itself');
    const start = createMissionState(played.seed, 'mossprout', NOW);
    assert.equal(missionBoardStep(played, start, 0)?.id, `mission.${played.id.replace(/^mission:/, '')}.first_merge`, `${name}: the first merge is still the guided one`);
    const states = walkBoard(name, played, WINDOW, start, (board, state) => {
      const move = mechanicMove(resolveMechanic(played), board, state, WINDOW);
      assert.ok(move, `${name}: a move to point at`);
      const step = missionBoardStep(played, board, state.strikes, state);
      assert.ok(step?.cue, `${name}: the finger has somewhere to point`);
      if (state.strikes > 0) assert.equal(step?.id, `mission.${played.id.replace(/^mission:/, '')}.aim`, `${name}: the merge beat speaks of aiming`);
    });
    assert.ok(states > 8, `${name}: the player has real choices (${states} states)`);
  }
  for (const { name, definition } of SHIPPED_RESTORATIONS) {
    const played = resolveRestorationForPlay(definition, 'column-shot');
    assert.equal(played.mechanic?.kind, 'column-shot');
    assert.equal(played.merges, columnShotTotalHp(COLUMN_SHOT_PREVIEW.mechanic));
    assert.equal(played.rows, definition.rows);
    const window = missionWindow(played.rows);
    assert.ok(played.items.every((item) => window.cellIndices.includes(item.cell)), `${name}: the seed fits the board's rows`);
    assert.equal(resolveRestorationForPlay(definition, null), definition);
    walkBoard(name, restorationMechanicHost(played), window, createRestorationState(played, NOW), (board, state) => {
      assert.ok(mechanicMove(resolveMechanic(restorationMechanicHost(played)), board, state, window), `${name}: a move to point at`);
    });
  }
});

test('where the wisps hang: over the tile for glow strikes, on the sky grid above the board for a column shot', () => {
  const mission = SHIPPED_MISSIONS[0]!.mission;
  const tile = missionWispTarget({ key: 'k', host: mission, mechanicState: { kind: 'glow-strikes', strikes: 2 }, node: null, boardMetrics: null, lines: mission.lines, settled: true, revealNonce: 1 });
  assert.equal(tile.anchor, undefined);
  assert.deepEqual([tile.key, tile.host, tile.mechanicState, tile.lines, tile.settled, tile.revealNonce], ['k', mission, { kind: 'glow-strikes', strikes: 2 }, mission.lines, true, 1]);
  const played = resolveMissionForPlay(mission, 'column-shot');
  const board = missionWispTarget({ key: 'k', host: played, mechanicState: createMechanicState(SKY), node: null, boardMetrics: null });
  assert.deepEqual(board.anchor, { kind: 'board', metrics: null, window: WINDOW });
  // The guidance beats of a column-shot board: the guided first merge, then aiming, then nothing left to say.
  const start = createMissionState(played.seed, 'mossprout', NOW);
  assert.equal(missionBoardStep(played, start, 0)?.id, `mission.${played.id.replace(/^mission:/, '')}.first_merge`);
  const aim = missionBoardStep(played, start, 1, createMechanicState(COLUMN_SHOT_PREVIEW.mechanic))!;
  assert.equal(aim.id, `mission.${played.id.replace(/^mission:/, '')}.aim`);
  assert.equal(aim.guide.eyebrow, COLUMN_SHOT_PREVIEW.guides.aim.eyebrow);
  assert.equal(aim.interaction?.mode, 'none');
  const empty = { ...start, board: start.board.map((cell) => ({ ...cell, occupant: null })) };
  assert.equal(missionBoardStep(played, empty, 1)?.id, `mission.${played.id.replace(/^mission:/, '')}.free`);
  // Without aim copy, the merge beat keeps its old name and words.
  const plain = { ...played, guides: { ...played.guides, aim: undefined } };
  assert.equal(missionBoardStep(plain, start, 1)?.id, `mission.${played.id.replace(/^mission:/, '')}.merge`);
});

/** A board where a shot up an empty column is lost: three wisps on the sky's first row, one above the middle, every one three hits. */
const LOST: Extract<MissionMechanicDefinition, { kind: 'column-shot' }> = {
  kind: 'column-shot', damageByTier: [1, 3, 7], overflow: 'lost', emptyColumn: 'lost',
  wisps: { rows: 2, cells: [{ id: 'w0', column: 0, row: 0, hp: 3 }, { id: 'w2', column: 2, row: 0, hp: 3 }, { id: 'w4', column: 4, row: 0, hp: 3 }, { id: 'w2b', column: 2, row: 1, hp: 3 }] },
};
const guide = { eyebrow: 'Aim', title: 'x', body: 'x' };
const lostMission = (cells: readonly number[], mechanic = LOST) => ({
  id: 'mission:lost', storageKey: 'test.lost', required: columnShotTotalHp(mechanic), mechanic,
  seed: { items: cells.map((cell) => ({ cell, definitionId: 'adventure:trail:1' })), echoes: [], veiled: [] },
  guides: { firstMerge: guide, wake: guide, merge: guide, mergeFallbackTitle: 'x', free: guide, aim: guide }, wisps: [], lines: { firstStrike: 'x', fell: ['x'], last: 'x' },
});

test('a board where a miss is lost: the finger never points at a miss, and the board is sound when a hit is always at hand, sliding a piece under a wisp first', () => {
  // Ten of the same on the bottom two rows: every column has a pair to merge, so a hit is always at hand.
  const spread = lostMission([36, 37, 38, 39, 40, 29, 30, 31, 32, 33]);
  assert.deepEqual(validateMissionDefinition(spread, NOW), []);
  assert.deepEqual(validateMissionDefinition(lostMission(spread.seed.items.map((item) => item.cell), { ...LOST, emptyColumn: 'nearest' }), NOW), [], 'the same board played to the nearest wisp passes the plain walk');
  // Twins only under empty sky (columns 1 and 3): every merge at hand would miss, but a slide first hits.
  const aside = lostMission([37, 39, 30, 32, 23, 25, 16, 18]);
  assert.deepEqual(validateMissionDefinition(aside, NOW), [], 'accepted, because a piece can be slid under a wisp');
  const start = createMissionState(aside.seed, 'mossprout', NOW);
  assert.equal(mechanicMove(LOST, start, createMechanicState(LOST), WINDOW), null, 'the finger rests rather than point at a miss');
  assert.equal(missionBoardStep(aside, start, 0, createMechanicState(LOST))?.id, 'mission.lost.free', 'the free beat says to slide a piece under a wisp');
  assert.ok(mechanicMove({ ...LOST, emptyColumn: 'nearest' }, start, createMechanicState(LOST), WINDOW), 'to the nearest wisp, any merge is worth pointing at');
  // Too little to finish: refused.
  assert.match(validateMissionDefinition(lostMission([36, 37, 38, 39]), NOW).join(' | '), /dead end with wisps standing|cannot be finished/);
  // A merge into a live column is what the finger shows when there is one.
  const move = mechanicMove(LOST, createMissionState(spread.seed, 'mossprout', NOW), createMechanicState(LOST), WINDOW);
  assert.ok(move && [0, 2, 4].includes(WINDOW.cellIndices.indexOf(move.to) % 5), 'under a wisp');
});

