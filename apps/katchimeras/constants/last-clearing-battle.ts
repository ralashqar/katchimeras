import { islandLevel, type IslandLevelSpec } from '@/constants/island-campaigns/island-levels';
import { FIRST_BATTLE_LINES } from '@/features/onboarding/last-clearing';
import type { EncounterDefinition } from '@/types/encounter';
import type { MergeItemDefinition, MergeWorldState } from '@/types/merge-world';
import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { missionWindow } from '@/features/mission-mechanics/board-window';
import { laneAlive, laneArrived, laneCell, laneFire, laneOf } from '@/features/mission-mechanics/lanes';
import { closestOpeningPair } from '@/features/onboarding/opening-mist';
import type { MissionMechanicState } from '@/types/mission-mechanic';

/**
 * The Last Clearing's first battle (`docs/cozy-4x-ftue-the-last-clearing.md`, beats 3 to 6): "They found us". A Lanes
 * level scripted by its own data, and one that cannot be lost (`forgiving`):
 * - two Seeds side by side, guided into the first Sprout, under the first wisp's column (the middle);
 * - one slow wisp down the middle ("first light");
 * - then a spitter down the second column, whose Mist teaches clearing by merging beside it;
 * - then the last stand: three at once, down the outside and the middle.
 * Seeds keep arriving on their own; a wave cleared early brings the next straight in.
 */
const SPEC: IslandLevelSpec = {
  title: 'They found us', objective: 'Merge plants that shoot. Bring down every wisp.', difficulty: 'calm',
  pieces: [[37, 1], [38, 1], [44, 1]], mist: [], wisps: [], seeds: { every: 3 }, forgiving: true,
  lanes: [
    { id: 'first', column: 3, at: 1, hp: 2, step: 7 },
    { id: 'spitter', column: 2, at: 14, hp: 3, step: 6, spit: 3 },
    { id: 'last-left', column: 1, at: 26, hp: 3, step: 5.5 },
    { id: 'last-middle', column: 3, at: 26.6, hp: 3, step: 5.5 },
    { id: 'last-right', column: 5, at: 27.2, hp: 3, step: 5.5 },
  ],
};

export const FIRST_BATTLE: EncounterDefinition = islandLevel('last-clearing', 'first-battle', SPEC).encounter;

/** A line stays up this long after a wisp was pushed back. */
const PUSHED_LINE_MS = 4_000;

/**
 * What Mossprout says over the first battle, from how it stands: the rule before the first merge, the aim while the
 * first wisp comes down, relief when it falls, the spitter's Mist, the last stand, and a steadying word whenever a
 * wisp had to be pushed back.
 */
export function firstBattleLine(input: { mechanicState: MissionMechanicState; merges: number; board: MergeWorldState }): string | null {
  const lanes = input.mechanicState.kind === 'lanes' ? input.mechanicState : null;
  if (!lanes) return null;
  const mechanic = FIRST_BATTLE.mechanic?.kind === 'lanes' ? FIRST_BATTLE.mechanic : null;
  if (!mechanic) return null;
  const advance = lanes.advance ?? 0;
  const arrived = (index: number) => lanes.clock >= (mechanic.wisps[index]?.at ?? 0) - advance;
  const alive = (index: number) => (lanes.wisps[index]?.damage ?? 0) < (mechanic.wisps[index]?.hp ?? 0);
  if (lanes.lastPushAt != null && lanes.clock - lanes.lastPushAt < PUSHED_LINE_MS) return FIRST_BATTLE_LINES.pushed;
  if (input.merges === 0) return FIRST_BATTLE_LINES.found;
  if (alive(0)) return FIRST_BATTLE_LINES.aim;
  const lastStand = [2, 3, 4];
  if (lastStand.some(arrived) && lastStand.some(alive)) return FIRST_BATTLE_LINES.lastStand;
  if (arrived(1) && alive(1)) {
    const misted = input.board.board.some((cell) => cell?.mist?.kind === 'encounter' && cell.mist.type === 'light');
    return misted ? FIRST_BATTLE_LINES.spitting : FIRST_BATTLE_LINES.another;
  }
  if (!alive(0) && !arrived(1)) return FIRST_BATTLE_LINES.works;
  return null;
}

/** What the finger shows on the first battle: a merge, or a move from a wasted lane to a wisp's lane. */
export type FirstBattleGuide = { kind: 'merge' | 'move'; from: number; to: number };

/**
 * The first battle's finger (`docs/cozy-4x-ftue-the-last-clearing.md`, beats 3 to 6), from how the board stands:
 * - a move first, and only when it matters: a piece that fires is shooting up a lane with no wisp in it while a wisp
 *   comes down a lane nothing covers. The finger drags it to the lowest free cell under that wisp (the most time
 *   before the wisp reaches it). A piece already under a wisp is never pulled away;
 * - otherwise the closest pair to merge;
 * - otherwise nothing.
 */
export function firstBattleGuide(board: MergeWorldState, mechanicState: MissionMechanicState, items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID): FirstBattleGuide | null {
  const lanes = mechanicState.kind === 'lanes' ? mechanicState : null;
  const mechanic = FIRST_BATTLE.mechanic?.kind === 'lanes' ? FIRST_BATTLE.mechanic : null;
  if (!lanes || !mechanic || lanes.breached != null) return null;
  const window = missionWindow(FIRST_BATTLE.rows ?? 4);
  const loose = (cell: number) => {
    const entry = board.board[cell];
    return entry && !entry.locked && !entry.mist && entry.occupant?.kind === 'item' ? entry.occupant : null;
  };
  const free = (cell: number) => { const entry = board.board[cell]; return Boolean(entry && !entry.locked && !entry.mist && !entry.occupant); };
  // Wisps here and standing, by column, with the cell each is on (a piece cannot be dropped there).
  const wispColumns = new Set<number>();
  const wispCells = new Set<number>();
  mechanic.wisps.forEach((spec, index) => {
    if (!laneArrived(mechanic, lanes, index) || !laneAlive(mechanic, lanes, index)) return;
    wispColumns.add(spec.column);
    const row = Math.floor((lanes.wisps[index]?.row ?? -1) + 0.5);
    const cell = row >= 0 ? laneCell(window, spec.column, row) : null;
    if (cell != null) wispCells.add(cell);
  });
  const shooters = window.cellIndices.flatMap((cell) => {
    const item = loose(cell);
    const tier = item ? items.get(item.definitionId)?.tier ?? 1 : 0;
    const lane = laneOf(window, cell);
    return item && lane && laneFire(tier) ? [{ cell, column: lane.column, tier }] : [];
  });
  const covered = new Set(shooters.map((shooter) => shooter.column));
  const uncovered = [...wispColumns].filter((column) => !covered.has(column)).sort((a, b) => a - b);
  const wasted = shooters.filter((shooter) => !wispColumns.has(shooter.column)).sort((a, b) => b.tier - a.tier);
  if (uncovered.length && wasted.length) {
    const piece = wasted[0]!;
    for (const column of uncovered) {
      for (let row = window.rows - 1; row >= 0; row -= 1) {
        const cell = laneCell(window, column, row);
        if (cell != null && free(cell) && !wispCells.has(cell)) return { kind: 'move', from: piece.cell, to: cell };
      }
    }
  }
  const pair = closestOpeningPair(board, window.cellIndices);
  return pair ? { kind: 'merge', from: pair.from, to: pair.to } : null;
}
