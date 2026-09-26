import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { LANE_START_ROW, laneAlive, laneArrived, laneCell, laneColumn, laneRowOf, type LanesMechanic, type LanesState } from '@/features/mission-mechanics/lanes';
import type { MissionWindow } from '@/features/mission-mechanics/board-window';
import type { CompanionAbilityDefinition, CompanionAbilityTier } from '@/types/companion-ability';
import type { MergeItemDefinition, MergeWorldState } from '@/types/merge-world';
import { openMistCell } from './mist';

/**
 * The friends' abilities in a Lanes battle (cozy 4X v2, Phase 5): each acts on the battle in play, on the wisps coming
 * down or the plants shooting up. Pure: the board and the lanes after, and what to show; null when there is nothing
 * for it to do (no wisp over the board, no free cell), so the charge is kept.
 */
export type LaneAbilityEffect =
  | { kind: 'sprouted'; cells: number[] }
  | { kind: 'snared'; wisps: number[]; untilMs: number }
  | { kind: 'volley'; plants: number }
  | { kind: 'grown'; cells: number[] }
  | { kind: 'rained'; cleared: number[]; wisps: number[] }
  | { kind: 'leaves'; wisps: number[]; damage: number }
  | { kind: 'forgot'; wisps: number[] };

export type LaneAbilityInput = { mechanic: LanesMechanic; state: LanesState };

const startRow = (mechanic: LanesMechanic, index: number) => -Math.max(1, Math.floor(mechanic.wisps[index]?.startRow ?? LANE_START_ROW));

/** Wisps in play (arrived, standing), nearest the bottom of the board first. */
function wispsInPlay(lanes: LaneAbilityInput): number[] {
  const { mechanic, state } = lanes;
  return mechanic.wisps.map((_, index) => index)
    .filter((index) => laneArrived(mechanic, state, index) && laneAlive(mechanic, state, index))
    .sort((a, b) => (state.wisps[b]?.row ?? 0) - (state.wisps[a]?.row ?? 0));
}

/** Free board cells: no piece, no Mist, not locked, and no wisp standing in it. */
function freeCells(board: MergeWorldState, window: MissionWindow, lanes: LaneAbilityInput): number[] {
  const taken = new Set(wispsInPlay(lanes).flatMap((index) => {
    const cell = laneCell(window, laneColumn(lanes.mechanic, lanes.state, index), laneRowOf(lanes.state.wisps[index]!.row));
    return cell == null ? [] : [cell];
  }));
  return window.cellIndices.filter((cell) => {
    const entry = board.board[cell];
    return entry && !entry.occupant && !entry.mist && !entry.locked && !taken.has(cell);
  });
}

export function applyLaneAbility(
  definition: CompanionAbilityDefinition, tier: CompanionAbilityTier, board: MergeWorldState, window: MissionWindow, lanes: LaneAbilityInput,
  items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID,
): { board: MergeWorldState; lanes: LanesState; effects: LaneAbilityEffect[] } | null {
  const { mechanic, state } = lanes;
  const inPlay = wispsInPlay(lanes);
  const setWisps = (update: (index: number) => Partial<LanesState['wisps'][number]> | null) => state.wisps.map((wisp, index) => {
    const change = update(index);
    return change ? { ...wisp, ...change } : wisp;
  });
  switch (definition.id) {
    case 'petal-burst': {
      // Sprouts (the level's second Seed tier) land on free cells, the lowest rows first: they shoot at once.
      const sprout = mechanic.seeds?.drops[1];
      const free = freeCells(board, window, lanes).sort((a, b) => b - a).slice(0, Math.max(1, tier.sprouts ?? 2));
      if (!sprout || !free.length) return null;
      const cells = [...board.board];
      let nextInstance = board.nextInstance;
      for (const cell of free) {
        cells[cell] = { ...cells[cell]!, occupant: { kind: 'item', instanceId: `merge-item:${nextInstance}`, definitionId: sprout } };
        nextInstance += 1;
      }
      return { board: { ...board, board: cells, nextInstance, revision: board.revision + 1 }, lanes: state, effects: [{ kind: 'sprouted', cells: free }] };
    }
    case 'vine-snare': {
      // The nearest wisps are held where they are: they cannot come down, and the plants under them keep shooting.
      const held = inPlay.slice(0, Math.max(1, tier.wisps ?? 1));
      if (!held.length) return null;
      const untilMs = state.clock + Math.max(1, tier.seconds ?? 4) * 1_000;
      return { board, lanes: { ...state, wisps: setWisps((index) => (held.includes(index) ? { holdUntil: Math.max(state.wisps[index]!.holdUntil, untilMs) } : null)) }, effects: [{ kind: 'snared', wisps: held, untilMs }] };
    }
    case 'second-helpings': {
      // Every plant fires at once: each piece's next shot is now.
      const plants = window.cellIndices.flatMap((cell) => {
        const occupant = board.board[cell]?.occupant;
        return occupant?.kind === 'item' && !board.board[cell]?.mist && (items.get(occupant.definitionId)?.tier ?? 0) >= 2 ? [occupant.instanceId] : [];
      });
      if (!plants.length) return null;
      return { board, lanes: { ...state, ready: { ...state.ready, ...Object.fromEntries(plants.map((id) => [id, state.clock])) } }, effects: [{ kind: 'volley', plants: plants.length }] };
    }
    case 'seedkeeper': {
      // Every Seed (and, later, every Sprout) on the board grows a size.
      const cells = [...board.board];
      const grown: number[] = [];
      for (const cell of window.cellIndices) {
        const entry = cells[cell];
        const occupant = entry?.occupant;
        if (!entry || entry.mist || occupant?.kind !== 'item') continue;
        const item = items.get(occupant.definitionId);
        if (!item?.nextItemId || item.tier > Math.max(1, tier.maxTier ?? 1)) continue;
        cells[cell] = { ...entry, occupant: { ...occupant, definitionId: item.nextItemId } };
        grown.push(cell);
      }
      if (!grown.length) return null;
      return { board: { ...board, board: cells, revision: board.revision + 1 }, lanes: state, effects: [{ kind: 'grown', cells: grown }] };
    }
    case 'rainfall': {
      // The spat Mist washes off (light Mist and the pieces under it come back) and every wisp is pushed back.
      let next = board;
      const cleared: number[] = [];
      for (const cell of window.cellIndices) {
        const mist = next.board[cell]?.mist;
        if (mist?.kind === 'encounter' && (mist.type === 'light' || mist.type === 'bound')) { next = openMistCell(next, cell).board; cleared.push(cell); }
      }
      const rows = Math.max(1, tier.rows ?? 1);
      if (!cleared.length && !inPlay.length) return null;
      return { board: next, lanes: { ...state, wisps: setWisps((index) => (inPlay.includes(index) ? { row: Math.max(startRow(mechanic, index), state.wisps[index]!.row - rows) } : null)) }, effects: [{ kind: 'rained', cleared, wisps: inPlay }] };
    }
    case 'falling-leaves': {
      // Every wisp over the board (not those still coming in over the top) takes the leaves' damage.
      const over = inPlay.filter((index) => (state.wisps[index]?.row ?? -1) > -1);
      if (!over.length) return null;
      const damage = Math.max(1, tier.damage ?? 1);
      return { board, lanes: { ...state, wisps: setWisps((index) => (over.includes(index) ? { damage: Math.min(mechanic.wisps[index]!.hp, state.wisps[index]!.damage + damage) } : null)) }, effects: [{ kind: 'leaves', wisps: over, damage }] };
    }
    case 'forget': {
      // The nearest wisps drift back up to where they came in.
      const sent = inPlay.slice(0, Math.max(1, tier.wisps ?? 1));
      if (!sent.length) return null;
      return { board, lanes: { ...state, wisps: setWisps((index) => (sent.includes(index) ? { row: startRow(mechanic, index), holdUntil: state.clock } : null)) }, effects: [{ kind: 'forgot', wisps: sent }] };
    }
    default:
      return null;
  }
}
