import { AppState } from 'react-native';
import { useEffect, type ReactNode } from 'react';
import { reconcilePendingActionRewards } from '@/game/katchimeras/action-completion';
import { loadFtueRun } from '@/features/onboarding/ftue-runtime';

import { bootstrapContentFlowCatalog } from './content-flow-bootstrap';
import { flushContentFlowJournal } from './content-flow-repository';
import { resumeActiveContentFlows } from './content-flow-director';
import { dismissFtueContentFlow } from './ftue-content-flow-runtime';

async function resumeStoryFlows() {
  // Recover a process kill between the synchronous terminal checkpoint and
  // its asynchronous flow-journal write. Completed FTUE must never reappear.
  const ftue = loadFtueRun();
  if (ftue?.status === 'complete') await dismissFtueContentFlow(ftue.runId);
  await resumeActiveContentFlows();
}

export function ContentFlowProvider({ children }: { children: ReactNode }) {
  bootstrapContentFlowCatalog();
  useEffect(() => {
    reconcilePendingActionRewards();
    void resumeStoryFlows().catch((error) => console.warn('Could not resume story flows', error));
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        reconcilePendingActionRewards();
        void resumeStoryFlows().catch((error) => console.warn('Could not resume story flows', error));
      }
      else void flushContentFlowJournal();
    });
    return () => subscription.remove();
  }, []);
  return children;
}
