import type { MergeWorldState } from '@/types/merge-world';
import type { MissionWindow } from '@/features/mission-mechanics/board-window';
import { laneZap, laneFire, type LanesMechanic, type LanesState } from '@/features/mission-mechanics/lanes';
import { combatChain, combatFire, mergeAttack } from '@/features/mission-mechanics/combat-rules';
import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';

/** Queue on the combat clock: pausing or saving cannot lose or duplicate a burst. */
export function mergeBurst(_mechanic: LanesMechanic, state: LanesState, board: MergeWorldState, _window: MissionWindow, cell: number): LanesState {
  const piece = board.board[cell]?.occupant;
  if (piece?.kind !== 'item') return state;
  const chain = combatChain(piece.definitionId);
  if (!chain) return state;
  const tier = MERGE_ITEMS_BY_ID.get(piece.definitionId)?.tier ?? 1;
  if (chain === 'bulwark' && tier < 2) return state;
  const count = chain === 'garden' || chain === 'lantern' ? mergeAttack(tier).bullets : 1;
  const fire = chain === 'storm' ? laneZap(tier) : state.combat ? combatFire(tier, chain) : laneFire(tier);
  return { ...state, ready: { ...state.ready, [piece.instanceId]: Math.max(state.ready[piece.instanceId] ?? 0, state.clock + (fire?.periodMs ?? 1000)) }, mergeAttacks: [...state.mergeAttacks ?? [], ...Array.from({ length: count }, (_, i) => ({
    cell, instanceId: piece.instanceId, chain, tier, at: state.clock + i * 180,
  }))] };
}
