import type { MergeWorldState } from '@/types/merge-world';
import type { MissionWindow } from '@/features/mission-mechanics/board-window';
import { laneAlive, laneArrived, laneColumn, laneOf, type LanesMechanic, type LanesState } from '@/features/mission-mechanics/lanes';
import { combatChain, heroDamageMultiplier } from '@/features/mission-mechanics/combat-rules';
import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';

/** A merge is a deliberate attack: short range, immediate, and immune to reflection. */
export function mergeBurst(mechanic: LanesMechanic, state: LanesState, board: MergeWorldState, window: MissionWindow, cell: number, level = 1): LanesState {
  if (state.combat && state.combat.preparingMs > 0) return state;
  const piece = board.board[cell]?.occupant;
  if (piece?.kind !== 'item') return state;
  const chain = combatChain(piece.definitionId);
  // Use the real zap path on the next simulation tick: range, chain jumps, visible
  // bolts and damage all belong to one attack, with no extra invisible burst.
  if (chain === 'storm') return { ...state, ready: { ...state.ready, [piece.instanceId]: state.clock } };
  if (!state.combat) return state;
  if (!chain || chain === 'bulwark' || chain === 'dew') return state;
  const origin = laneOf(window, cell)!;
  const tier = MERGE_ITEMS_BY_ID.get(piece.definitionId)?.tier ?? 1;
  const echo = mechanic.terrain?.some((t) => t.cell === cell && t.kind === 'echo') ? 1.5 : 1;
  const damage = Math.max(1, tier - 1) * heroDamageMultiplier(level) * echo;
  let seq = state.seq;
  const shots = mechanic.wisps.flatMap((_, index) => {
    if (!laneArrived(mechanic, state, index) || !laneAlive(mechanic, state, index)) return [];
    const column = laneColumn(mechanic, state, index);
    const row = state.wisps[index]!.row;
    if (column !== origin.column || row >= origin.row || origin.row - row > 5) return [];
    return [{ id: ++seq, fromCell: cell, wisp: index, kind: 'burst' as const, damage, firedAt: state.clock, landsAt: state.clock + 150 }];
  });
  return { ...state, seq, shots: [...state.shots, ...shots] };
}
