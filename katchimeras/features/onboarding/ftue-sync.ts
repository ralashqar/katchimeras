import { ensureStreakIdentity } from '@/utils/streak-sync';
import { supabase } from '@/utils/supabase';

import { loadFtueRun, markFtueReceiptSynced, noteFtueSyncAttempt } from './ftue-runtime';
import { mossproutFtueAction } from './mossprout-ftue-script';

let flushing: Promise<void> | null = null;

export function flushFtueReceipts() {
  if (flushing) return flushing;
  flushing = (async () => {
    if (!await ensureStreakIdentity()) return;
    const run = loadFtueRun();
    if (!run) return;
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
