import type { MissionWindow } from '@/features/mission-mechanics/board-window';

/**
 * Territory battles (`docs/encounter-territory.md`): a merge sends a Harmony
 * pulse out from where its result lands. Bigger things reach further and hit
 * harder: a Sprout touches the four cells beside it, a Plant the eight around
 * it, a Flower hits those eight twice, and anything above a Flower reaches two
 * cells out. The same area is where a merge can strike a Dark Wisp's nest.
 * Pure geometry over the docked board's window.
 */
export type PulseReach = 'cross' | 'ring' | 'diamond';
export type Pulse = { reach: PulseReach; hits: number };

export function pulseFor(tier: number): Pulse {
  if (tier >= 5) return { reach: 'diamond', hits: 2 };
  if (tier >= 4) return { reach: 'ring', hits: 2 };
  if (tier >= 3) return { reach: 'ring', hits: 1 };
  return { reach: 'cross', hits: 1 };
}

/** The window cell at a column and row, or null off the window. */
function at(window: MissionWindow, column: number, row: number): number | null {
  return column >= 0 && column < window.columns && row >= 0 && row < window.rows ? window.cellIndices[row * window.columns + column] ?? null : null;
}

/** The cells a reach touches around `cell` (never the cell itself), kept to the window. */
export function windowArea(cell: number, window: MissionWindow, reach: PulseReach): number[] {
  const index = window.cellIndices.indexOf(cell);
  if (index < 0) return [];
  const column = index % window.columns;
  const row = Math.floor(index / window.columns);
  const out: number[] = [];
  const radius = reach === 'diamond' ? 2 : 1;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (!dx && !dy) continue;
      const manhattan = Math.abs(dx) + Math.abs(dy);
      if (reach === 'cross' && manhattan !== 1) continue;
      if (reach === 'diamond' && manhattan > 2) continue;
      const other = at(window, column + dx, row + dy);
      if (other != null) out.push(other);
    }
  }
  return out;
}

export function pulseArea(cell: number, tier: number, window: MissionWindow): { cells: number[]; hits: number } {
  const pulse = pulseFor(tier);
  return { cells: windowArea(cell, window, pulse.reach), hits: pulse.hits };
}

/** Steps between two window cells along the board (orthogonal moves). */
export function windowDistance(a: number, b: number, window: MissionWindow): number {
  const ia = window.cellIndices.indexOf(a);
  const ib = window.cellIndices.indexOf(b);
  if (ia < 0 || ib < 0) return Number.POSITIVE_INFINITY;
  return Math.abs((ia % window.columns) - (ib % window.columns)) + Math.abs(Math.floor(ia / window.columns) - Math.floor(ib / window.columns));
}
