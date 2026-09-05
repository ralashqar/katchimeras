import { MERGE_LOCKED_TIER_ONE_ECHOES } from '@/constants/merge-world-catalog';
import type { MergeBoardCell } from '@/types/merge-world';

/**
 * Adds authored, generically mergeable Dream Echoes to cells that remain
 * locked. Existing authored FTUE Echoes, occupants, and open cells win.
 */
export function placeLockedTierOneEchoes(board: MergeBoardCell[]): MergeBoardCell[] {
  let next = board;
  for (const echo of MERGE_LOCKED_TIER_ONE_ECHOES) {
    const cell = next[echo.cell];
    if (!cell?.locked || cell.occupant) continue;
    if (cell.mist?.kind === 'echo' && cell.mist.id !== echo.id) continue;
    if (cell.mist?.kind === 'echo'
      && cell.mist.id === echo.id
      && cell.mist.definitionId === echo.definitionId
      && cell.mist.generatorId === echo.generatorId) continue;
    if (next === board) next = [...board];
    next[echo.cell] = {
      ...cell,
      mist: {
        kind: 'echo',
        id: echo.id,
        definitionId: echo.definitionId,
        generatorId: echo.generatorId,
        ownerCharacterId: null,
      },
    };
  }
  return next;
}
