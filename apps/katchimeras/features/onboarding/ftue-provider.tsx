import { useEffect, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { flushDeferredStoredWrites } from '@/utils/app-storage';

import { flushFtueReceipts, scheduleFtueReceiptSync } from './ftue-sync';
import { flushFtuePersistence, useFtueRun } from './ftue-runtime';
import { FtueNavigationReconciler } from './ftue-navigation-reconciler';

/** Boots the offline-first FTUE outbox; screens remain owners of domain actions. */
export function FtueProvider({ children }: { children: ReactNode }) {
  const run = useFtueRun();
  useEffect(() => {
    if (run) scheduleFtueReceiptSync();
  }, [run?.runId]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') return;
      // Everything written behind the frame (mission boards, counted merges) lands before the app can be killed.
      flushDeferredStoredWrites();
      void flushFtuePersistence();
      void flushFtueReceipts();
    });
    return () => subscription.remove();
  }, []);
  return <>{children}<FtueNavigationReconciler /></>;
}
