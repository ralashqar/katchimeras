import type { FtueReceiptStatus } from './ftue-types';

type MossproutFtueProgress = {
  receipts: readonly {
    actionId: string;
    status: FtueReceiptStatus;
  }[];
};

const DAY_ONE_COMPLETION_ACTION_ID = 'companion.complete_day_one_action';

/**
 * Durable completion boundary for the Day 1 Bond lesson.
 *
 * The current FTUE uses an inline profile choice, so Journey action status is
 * not evidence that this lesson finished. The committed graph receipt is the
 * single source of truth.
 */
export function mossproutFtueDayOneLessonCompleted(run: MossproutFtueProgress | null | undefined) {
  if (!run) return false;
  return run.receipts.some((receipt) => (
    receipt.actionId === DAY_ONE_COMPLETION_ACTION_ID
    && receipt.status !== 'pending'
  ));
}
