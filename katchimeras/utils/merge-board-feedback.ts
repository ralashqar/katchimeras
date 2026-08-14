import type { MergeWorldFailureReason } from '@/types/merge-world';

export type MergeCellFeedbackTone = 'blocked' | 'warning' | 'hint';

export function mergeCellFeedbackForFailure(reason?: MergeWorldFailureReason): { message: string; tone: MergeCellFeedbackTone } | null {
  switch (reason) {
    case 'locked_cell': return { message: 'LOCKED', tone: 'blocked' };
    case 'no_energy': return { message: 'NO ENERGY', tone: 'warning' };
    case 'board_full': return { message: 'BOARD FULL', tone: 'warning' };
    case 'wrong_echo_match': return { message: 'FIND ITS MATCH', tone: 'hint' };
    case 'sealed_mist': return { message: 'SEALED', tone: 'blocked' };
    default: return null;
  }
}
