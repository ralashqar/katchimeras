import { ensureStreakIdentity } from '@/utils/streak-sync';
import { supabase } from '@/utils/supabase';
import { waitForCriticalInteractionIdle } from '@/utils/critical-interaction';

import { loadFtueRun, markFtueReceiptSynced, noteFtueSyncAttempt } from './ftue-runtime';
import { mossproutFtueAction } from './mossprout-ftue-script';

let flushing: Promise<void> | null = null;
let scheduledFlush: ReturnType<typeof setTimeout> | null = null;
const RECEIPT_SYNC_QUIET_MS = 1_500;

export function scheduleFtueReceiptSync() {
  if (scheduledFlush) clearTimeout(scheduledFlush);
  scheduledFlush = setTimeout(() => {
    scheduledFlush = null;
    void flushFtueReceipts();
  }, RECEIPT_SYNC_QUIET_MS);
}

export function flushFtueReceipts() {
  if (scheduledFlush) {
    clearTimeout(scheduledFlush);
    scheduledFlush = null;
  }
  if (flushing) return flushing;
  flushing = (async () => {
    await waitForCriticalInteractionIdle();
    const run = loadFtueRun();
    if (!run) return;
    if (!await ensureStreakIdentity()) return;
    for (const receipt of run.receipts.filter((item) => item.status !== 'pending' && !item.syncedAt && mossproutFtueAction(item.stepId, item.actionId)?.backendEvent)) {
      noteFtueSyncAttempt(receipt.clientEventId);
      const { error } = await supabase.rpc('register_ftue_action_v1', {
        event_payload: {
          client_event_id: receipt.clientEventId,
          run_id: run.runId,
          script_id: receipt.scriptId,
          script_version: receipt.scriptVersion,
          step_id: receipt.stepId,
          action_id: receipt.actionId,
          surface: receipt.surface,
          committed_at: receipt.committedAt,
        },
      });
      if (!error) markFtueReceiptSynced(receipt.clientEventId, receipt.syncAttempts + 1);
    }
  })().finally(() => { flushing = null; });
  return flushing;
}

export async function retryFtueSync() { await flushFtueReceipts(); }
