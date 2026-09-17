import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { createMissionState } from '@/features/onboarding/steppling-mission';
import type { HatchableMissionDefinition } from '@/types/hatchable-companion';
import type { MergeItemDefinition, MergeWorldState } from '@/types/merge-world';
import type { MissionMechanicDefinition, MissionMechanicState } from '@/types/mission-mechanic';
import { reduceMissionMove } from '@/utils/merge-world/engine';
import { missionPairs, missionWakes, missionWindow, windowColumn, type MissionWindow } from './board-window';
import { columnShotTotalHp } from './column-shot';
import { createMechanicState, mechanicComplete, mechanicMove, resolveMechanic, strikeFor } from './mechanic';

/** How many distinct positions a board may pass through before its walk is called off: a guard, not a rule. */
const MAX_WALK_STATES = 20_000;

/**
 * Whether a mission board is sound: its cells are on the window, its pieces
 * are known things, its bar and mechanic agree, and every way of playing it
 * finishes with a move to point at all the way. The same walk the registry
 * tests make, for a board a content pack brings.
 */
export function validateMissionDefinition(mission: Omit<HatchableMissionDefinition, 'camera'>, now = Date.UTC(2026, 0, 1), items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID): string[] {
  const issues: string[] = [];
  const window = missionWindow();
  const cells = new Set(window.cellIndices);
  if (!mission.id) issues.push('a mission needs an id');
  if (!mission.storageKey) issues.push(`${mission.id}: a mission needs a storage key`);
  const seed = mission.seed;
  if (!seed || !Array.isArray(seed.items) || !Array.isArray(seed.echoes) || !Array.isArray(seed.veiled)) { issues.push(`${mission.id}: a mission needs a seed of items, echoes and veiled cells`); return issues; }
  const used = new Set<number>();
  for (const entry of [...seed.items, ...seed.echoes, ...seed.veiled]) {
    if (!cells.has(entry.cell)) issues.push(`${mission.id}: cell ${entry.cell} is outside the board`);
    if (used.has(entry.cell)) issues.push(`${mission.id}: cell ${entry.cell} is seeded twice`);
    used.add(entry.cell);
    if (!items.has(entry.definitionId)) issues.push(`${mission.id}: ${entry.definitionId} is not a known item`);
  }
  const mechanic = resolveMechanic(mission);
  if (mechanic.kind === 'column-shot') {
    if (!mechanic.wisps?.cells?.length) issues.push(`${mission.id}: a column-shot board needs wisps`);
    if (!Array.isArray(mechanic.damageByTier) || !mechanic.damageByTier.length || mechanic.damageByTier.some((damage) => !Number.isFinite(damage) || damage < 0)) issues.push(`${mission.id}: damageByTier must list non-negative damage by tier`);
    for (const wisp of mechanic.wisps?.cells ?? []) {
      if (!Number.isInteger(wisp.column) || wisp.column < 0 || wisp.column >= window.columns) issues.push(`${mission.id}: wisp ${wisp.id} is in column ${wisp.column}, off the board`);
      if (!Number.isInteger(wisp.row) || wisp.row < 0 || wisp.row >= Math.max(1, mechanic.wisps.rows)) issues.push(`${mission.id}: wisp ${wisp.id} is in row ${wisp.row}, above the sky`);
      if (!Number.isInteger(wisp.hp) || wisp.hp <= 0) issues.push(`${mission.id}: wisp ${wisp.id} needs hit points`);
    }
    if (mission.required !== columnShotTotalHp(mechanic)) issues.push(`${mission.id}: required (${mission.required}) must equal the wisps' hit points (${columnShotTotalHp(mechanic)})`);
  } else {
    if (!Number.isInteger(mission.required) || mission.required <= 0) issues.push(`${mission.id}: required must be a positive count of strikes`);
    if (!mission.wisps?.length) issues.push(`${mission.id}: a glow-strikes board needs wisps over its tile`);
  }
  if (issues.length) return issues;
  if (mechanic.kind === 'column-shot' && mechanic.emptyColumn === 'lost') { issues.push(...walkWithMisses(mission, mechanic, window, now, items)); return issues; }
  // Every way of playing the board finishes, and never without a move to point at.
  const start = createMissionState(seed, 'mossprout', now);
  const seen = new Set<string>();
  let finished = 0;
  let stopped = false;
  const key = (board: MergeWorldState, state: MissionMechanicState) => JSON.stringify([board.board.map((cell) => [cell.occupant?.kind === 'item' ? cell.occupant.definitionId : null, cell.mist?.kind ?? null, cell.mist?.kind === 'echo' ? cell.mist.definitionId : null]), state]);
  const walk = (board: MergeWorldState, state: MissionMechanicState) => {
    if (stopped) return;
    const signature = key(board, state);
    if (seen.has(signature)) return;
    seen.add(signature);
    if (seen.size > MAX_WALK_STATES) { stopped = true; issues.push(`${mission.id}: the board has more positions than can be checked (${MAX_WALK_STATES})`); return; }
    if (mechanicComplete(mechanic, mission, state)) { finished += 1; return; }
    if (!mechanicMove(mechanic, board, state, window)) { issues.push(`${mission.id}: a position with wisps standing and nothing to point at`); stopped = true; return; }
    const itemCells = window.cellIndices.filter((index) => board.board[index]?.occupant?.kind === 'item');
    const targets = window.cellIndices.filter((index) => board.board[index]?.occupant?.kind === 'item' || board.board[index]?.mist?.kind === 'echo');
    let moved = false;
    for (const from of itemCells) for (const to of targets) {
      if (from === to) continue;
      const result = reduceMissionMove(board, from, to, now, items);
      if (!result.changed || result.mergedCell == null) continue;
      const made = result.state.board[result.mergedCell]?.occupant;
      if (made?.kind !== 'item') continue;
      const { next } = strikeFor(mechanic, mission, window, state, { type: result.dreamEchoClearedId ? 'dream_echo_cleared' : 'merge_completed', resultCell: result.mergedCell, resultDefinitionId: made.definitionId }, items);
      moved = true;
      walk(result.state, next);
    }
    if (!moved) { issues.push(`${mission.id}: a dead end with wisps standing`); stopped = true; }
  };
  walk(start, createMechanicState(mechanic));
  if (!stopped && !finished) issues.push(`${mission.id}: the board cannot be finished`);
  return issues;
}

/**
 * A board where a shot up an empty column is lost cannot promise that every
 * path finishes: missing is the player's choice. What it promises instead is
 * that at every position reached by hitting, a hit is still at hand, sliding
 * a piece under a wisp first if need be, and that hitting all the way ends
 * the board. Positions are the same when their columns hold the same pieces,
 * so a slide within a column is never a new position.
 */
function walkWithMisses(mission: Omit<HatchableMissionDefinition, 'camera'>, mechanic: Extract<MissionMechanicDefinition, { kind: 'column-shot' }>, window: MissionWindow, now: number, items: ReadonlyMap<string, MergeItemDefinition>): string[] {
  const issues: string[] = [];
  const start = createMissionState(mission.seed, 'mossprout', now);
  const seen = new Set<string>();
  let finished = 0;
  let stopped = false;
  const columnOf = (cell: number) => windowColumn(window, cell);
  const key = (board: MergeWorldState, state: MissionMechanicState) => {
    const columns: string[][] = Array.from({ length: window.columns }, () => []);
    for (const cell of window.cellIndices) {
      const entry = board.board[cell];
      const column = columnOf(cell)!;
      if (entry?.occupant?.kind === 'item' && !entry.mist) columns[column]!.push(entry.occupant.definitionId);
      else if (entry?.mist) columns[column]!.push(`${cell}:${entry.mist.kind}:${entry.mist.kind === 'echo' ? entry.mist.definitionId : ''}`);
    }
    return JSON.stringify([columns.map((column) => column.sort()), state]);
  };
  const walk = (board: MergeWorldState, state: MissionMechanicState) => {
    if (stopped) return;
    const signature = key(board, state);
    if (seen.has(signature)) return;
    seen.add(signature);
    if (seen.size > MAX_WALK_STATES) { stopped = true; issues.push(`${mission.id}: the board has more positions than can be checked (${MAX_WALK_STATES})`); return; }
    if (mechanicComplete(mechanic, mission, state)) { finished += 1; return; }
    const open = window.cellIndices.filter((cell) => { const entry = board.board[cell]; return entry && !entry.locked && !entry.mist && !entry.occupant; });
    const strike = (after: MergeWorldState, mergedCell: number, wake: boolean) => {
      const made = after.board[mergedCell]?.occupant;
      if (made?.kind !== 'item') return null;
      return strikeFor(mechanic, mission, window, state, { type: wake ? 'dream_echo_cleared' : 'merge_completed', resultCell: mergedCell, resultDefinitionId: made.definitionId }, items);
    };
    let options = 0;
    let hits = 0;
    const consider = (after: MergeWorldState, mergedCell: number, wake: boolean) => {
      const result = strike(after, mergedCell, wake);
      if (!result?.strike) return;
      options += 1;
      if (result.strike.wasted) return;
      hits += 1;
      walk(after, result.next);
    };
    // A waking lands where the sleeper lies.
    for (const wake of missionWakes(board, window.cellIndices)) {
      const result = reduceMissionMove(board, wake.from, wake.to, now, items);
      if (result.changed && result.mergedCell != null) consider(result.state, result.mergedCell, true);
    }
    // A pair may merge where either twin lies, or where one of them can first be slid to.
    for (const pair of missionPairs(board, window.cellIndices)) {
      for (const [from, to] of [[pair.from, pair.to], [pair.to, pair.from]] as const) {
        const result = reduceMissionMove(board, from, to, now, items);
        if (result.changed && result.mergedCell != null) consider(result.state, result.mergedCell, false);
      }
      const covered = new Set([columnOf(pair.from), columnOf(pair.to)]);
      for (const cell of open) {
        const column = columnOf(cell);
        if (column == null || covered.has(column)) continue;
        covered.add(column);
        const slid = reduceMissionMove(board, pair.to, cell, now, items);
        if (!slid.changed || slid.mergedCell != null) continue;
        const result = reduceMissionMove(slid.state, pair.from, cell, now, items);
        if (result.changed && result.mergedCell != null) consider(result.state, result.mergedCell, false);
      }
    }
    if (!options) { issues.push(`${mission.id}: a dead end with wisps standing`); stopped = true; return; }
    if (!hits) { issues.push(`${mission.id}: a position where every merge would miss`); stopped = true; }
  };
  walk(start, createMechanicState(mechanic));
  if (!stopped && !finished) issues.push(`${mission.id}: the board cannot be finished`);
  return issues;
}
