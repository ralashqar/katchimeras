import { useEffect, type ReactNode } from 'react';

import { flushFtueReceipts } from './ftue-sync';
import { useFtueRun } from './ftue-runtime';

/** Boots the offline-first FTUE outbox; screens remain owners of domain actions. */
export function FtueProvider({ children }: { children: ReactNode }) {
  const run = useFtueRun();
  useEffect(() => { void flushFtueReceipts(); }, [run?.runId]);
  return children;
}
