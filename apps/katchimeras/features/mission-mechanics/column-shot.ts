import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import type { MergeItemDefinition, MergeWorldState } from '@/types/merge-world';
import type { MissionMechanicDefinition, MissionMechanicMove, MissionMechanicState, MissionStrike, MissionWispView } from '@/types/mission-mechanic';
import { missionPairs, missionWakes, windowColumn, type MissionWindow } from './board-window';

export type ColumnShotDefinition = Extract<MissionMechanicDefinition, { kind: 'column-shot' }>;
export type ColumnShotState = Extract<MissionMechanicState, { kind: 'column-shot' }>;

/**
 * A merge fires what it made straight up the board's column. The lowest wisp
 * standing in that column takes the item's damage (by its tier); what is left
 * over carries up the column or is lost, as authored; a column with nothing
 * left in it sends the shot to the nearest wisp standing, or wastes it. The
 * mission is done when every wisp is down, and the shot that fells the last
 * is the finale.
 */
export function columnShotDamage(mechanic: ColumnShotDefinition, definitionId: string, items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID): number {
  const tier = Math.max(1, Math.floor(items.get(definitionId)?.tier ?? 1));
  const table = mechanic.damageByTier;
  if (!table.length) return 0;
  return Math.max(0, Math.floor(table[Math.min(tier, table.length) - 1]!));
}

export function columnShotTotalHp(mechanic: ColumnShotDefinition): number {
  return mechanic.wisps.cells.reduce((sum, wisp) => sum + Math.max(0, Math.floor(wisp.hp)), 0);
}

export function createColumnShotState(mechanic: ColumnShotDefinition): ColumnShotState {
  return { kind: 'column-shot', strikes: 0, damage: mechanic.wisps.cells.map(() => 0) };
}

function alive(mechanic: ColumnShotDefinition, damage: readonly number[], index: number): boolean {
  return damage[index]! < mechanic.wisps.cells[index]!.hp;
}

/** The wisps still standing in a column, lowest row first. */
function columnStanding(mechanic: ColumnShotDefinition, damage: readonly number[], column: number): number[] {
  return mechanic.wisps.cells
    .map((wisp, index) => ({ wisp, index }))
    .filter(({ wisp, index }) => wisp.column === column && alive(mechanic, damage, index))
    .sort((a, b) => a.wisp.row - b.wisp.row)
    .map(({ index }) => index);
}

/** The wisp standing nearest a column: the smallest column distance, then the lowest row. */
function nearestStanding(mechanic: ColumnShotDefinition, damage: readonly number[], column: number | null): number | null {
  const standing = mechanic.wisps.cells
    .map((wisp, index) => ({ wisp, index }))
    .filter(({ index }) => alive(mechanic, damage, index))
    .sort((a, b) => (column == null ? 0 : Math.abs(a.wisp.column - column) - Math.abs(b.wisp.column - column)) || a.wisp.row - b.wisp.row || a.index - b.index);
  return standing[0]?.index ?? null;
}

/**
 * Deal a shot of `damage` fired up `column`: the hits it lands, in order. Pure
 * over a copy of the damage vector.
 */
export function dealColumnShot(mechanic: ColumnShotDefinition, damage: readonly number[], column: number | null, amount: number): { damage: number[]; hits: { wisp: number; damage: number }[] } {
  const next = [...damage];
  const hits: { wisp: number; damage: number }[] = [];
  let remaining = amount;
  let lane = column;
  while (remaining > 0) {
    let targets = lane == null ? [] : columnStanding(mechanic, next, lane);
    if (!targets.length) {
      if (mechanic.emptyColumn !== 'nearest') break;
      const nearest = nearestStanding(mechanic, next, lane);
      if (nearest == null) break;
      lane = mechanic.wisps.cells[nearest]!.column;
      targets = columnStanding(mechanic, next, lane);
    }
    for (const index of targets) {
      const hp = mechanic.wisps.cells[index]!.hp;
      const dealt = Math.min(remaining, hp - next[index]!);
      if (dealt <= 0) continue;
      next[index] = next[index]! + dealt;
      hits.push({ wisp: index, damage: dealt });
      remaining -= dealt;
      if (remaining <= 0 || mechanic.overflow === 'lost') { remaining = 0; break; }
    }
    // Damage left with the column spent: the next pass looks for the nearest wisp standing, or gives up.
  }
  return { damage: next, hits };
}

export function columnShotComplete(mechanic: ColumnShotDefinition, state: ColumnShotState): boolean {
  return mechanic.wisps.cells.every((wisp, index) => (state.damage[index] ?? 0) >= wisp.hp);
}

export function columnShotStrike(mechanic: ColumnShotDefinition, window: MissionWindow, state: ColumnShotState, event: { resultCell: number; resultDefinitionId: string }, items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID): { next: ColumnShotState; strike: MissionStrike } {
  const column = windowColumn(window, event.resultCell);
  const { damage, hits } = dealColumnShot(mechanic, state.damage, column, columnShotDamage(mechanic, event.resultDefinitionId, items));
  const next: ColumnShotState = { kind: 'column-shot', strikes: state.strikes + 1, damage };
  return {
    next,
    strike: { fromCell: event.resultCell, resultDefinitionId: event.resultDefinitionId, hits, target: hits[0]?.wisp ?? null, finale: hits.length > 0 && columnShotComplete(mechanic, next), wasted: hits.length === 0 },
  };
}

export function applyColumnShot(state: ColumnShotState, strike: MissionStrike): ColumnShotState {
  const damage = [...state.damage];
  for (const hit of strike.hits) damage[hit.wisp] = (damage[hit.wisp] ?? 0) + hit.damage;
  return { kind: 'column-shot', strikes: state.strikes + 1, damage };
}

export function columnShotViews(mechanic: ColumnShotDefinition, state: ColumnShotState): MissionWispView[] {
  return mechanic.wisps.cells.map((wisp, index) => {
    const damage = Math.min(wisp.hp, state.damage[index] ?? 0);
    return { id: wisp.id, hp: wisp.hp, damage, alive: damage < wisp.hp, placement: { kind: 'board', column: wisp.column, row: wisp.row, size: wisp.size } };
  });
}

export function columnShotProgress(mechanic: ColumnShotDefinition, state: ColumnShotState): { current: number; total: number } {
  const total = columnShotTotalHp(mechanic);
  const current = mechanic.wisps.cells.reduce((sum, wisp, index) => sum + Math.min(wisp.hp, state.damage[index] ?? 0), 0);
  return { current: Math.min(total, current), total };
}

/**
 * The move the finger shows: of every waking and pair on the board, the one
 * whose shot lands in a column with a wisp standing, hits hardest, and is
 * closest at hand, in that order. On a board where a shot up an empty column
 * is lost, no move is shown when every merge at hand would miss.
 */
export function columnShotMove(mechanic: ColumnShotDefinition, board: MergeWorldState, state: ColumnShotState, window: MissionWindow): MissionMechanicMove | null {
  const wakes = missionWakes(board, window.cellIndices).map((move) => ({ move, distance: 0 }));
  const pairs = missionPairs(board, window.cellIndices).map((pair) => ({ move: { kind: pair.kind, from: pair.from, to: pair.to, definitionId: pair.definitionId } as MissionMechanicMove, distance: pair.distance }));
  const scored = [...wakes, ...pairs].map(({ move, distance }) => {
    const made = move.definitionId ? MERGE_ITEMS_BY_ID.get(move.definitionId)?.nextItemId ?? null : null;
    const column = windowColumn(window, move.to);
    const standing = column != null && columnStanding(mechanic, state.damage, column).length > 0;
    const damage = made ? dealColumnShot(mechanic, state.damage, column, columnShotDamage(mechanic, made)).hits.reduce((sum, hit) => sum + hit.damage, 0) : 0;
    return { move, standing, damage, distance };
  });
  scored.sort((a, b) => Number(b.standing) - Number(a.standing) || b.damage - a.damage || a.distance - b.distance);
  const best = scored[0];
  if (!best) return null;
  // Where a shot up an empty column is lost, the finger never shows a merge that would miss: it rests, and the free beat says to slide a piece under a wisp first.
  if (mechanic.emptyColumn === 'lost' && !best.standing) return null;
  return best.move;
}

/** A saved damage vector for this mechanic, or null when it cannot be read. */
export function normalizeColumnShotState(mechanic: ColumnShotDefinition, value: unknown, strikes: number): ColumnShotState | null {
  const damage = value && typeof value === 'object' ? (value as { damage?: unknown }).damage : undefined;
  if (!Array.isArray(damage) || damage.length !== mechanic.wisps.cells.length) return null;
  const clean = damage.map((entry, index) => {
    const hp = mechanic.wisps.cells[index]!.hp;
    return typeof entry === 'number' && Number.isFinite(entry) ? Math.max(0, Math.min(hp, Math.floor(entry))) : NaN;
  });
  if (clean.some((entry) => Number.isNaN(entry))) return null;
  return { kind: 'column-shot', strikes: Math.max(0, Math.floor(strikes)), damage: clean };
}
