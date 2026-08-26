import { AppState } from 'react-native';
import { useEffect, type ReactNode } from 'react';
import { reconcilePendingActionRewards } from '@/game/katchimeras/action-completion';

import { bootstrapContentFlowCatalog } from './content-flow-bootstrap';
import { flushContentFlowJournal } from './content-flow-repository';
import { resumeActiveContentFlows } from './content-flow-director';

export function ContentFlowProvider({ children }: { children: ReactNode }) {
  bootstrapContentFlowCatalog();
  useEffect(() => {
    reconcilePendingActionRewards();
    void resumeActiveContentFlows();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        reconcilePendingActionRewards();
        void resumeActiveContentFlows();
      }
      else void flushContentFlowJournal();
    });
    return () => subscription.remove();
  }, []);
  return children;
}
