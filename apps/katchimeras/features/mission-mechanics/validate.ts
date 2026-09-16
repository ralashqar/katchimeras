import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { createMissionState } from '@/features/onboarding/steppling-mission';
import type { HatchableMissionDefinition } from '@/types/hatchable-companion';
import type { MergeItemDefinition, MergeWorldState } from '@/types/merge-world';
import type { MissionMechanicState } from '@/types/mission-mechanic';
import { reduceMissionMove } from '@/utils/merge-world/engine';
import { missionWindow } from './board-window';
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
