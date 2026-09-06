import { useEffect, useRef } from 'react';
import type { FtueRunState } from './ftue-types';

/** Only the interaction that witnessed meditation may finish its exit.
 * Old receipts recover the world story in ContentFlowProvider, not navigation.
 */
export function useFtueMistHandoff({ run, active, handoffActive, onHandoff }: {
  run: Pick<FtueRunState, 'runId' | 'status' | 'stepId' | 'receipts'> | null;
  active: boolean; handoffActive: boolean; onHandoff: () => Promise<void>;
}) {
  const meditationRun = useRef<string | null>(null);
  const pending = Boolean(active && run?.status === 'complete' && meditationRun.current === run.runId
    && run.receipts.some((receipt) => receipt.actionId === 'companion.tend_garden' && receipt.status !== 'pending'));
  useEffect(() => {
    if (!active || !run) { meditationRun.current = null; return; }
    if (run.status === 'active' && run.stepId === 'companion.meditating') {
      meditationRun.current = run.runId;
      return;
    }
    if (pending) {
      meditationRun.current = null;
      if (!handoffActive) void onHandoff();
    }
  }, [active, handoffActive, onHandoff, pending, run]);
  return pending;
}
