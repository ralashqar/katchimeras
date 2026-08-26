import { AppState } from 'react-native';
import { useEffect, type ReactNode } from 'react';
import { reconcilePendingActionRewards } from '@/game/katchimeras/action-completion';

import { bootstrapContentFlowCatalog } from './content-flow-bootstrap';
import { flushContentFlowJournal } from './content-flow-repository';

export function ContentFlowProvider({ children }: { children: ReactNode }) {
  bootstrapContentFlowCatalog();
  useEffect(() => {
    reconcilePendingActionRewards();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') reconcilePendingActionRewards();
      else void flushContentFlowJournal();
    });
    return () => subscription.remove();
  }, []);
  return children;
}
