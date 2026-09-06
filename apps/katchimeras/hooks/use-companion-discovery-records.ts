import { useEffect, useState } from 'react';

import type { CompanionDiscoveryRecord, MergeWorldState } from '@/types/merge-world';
import {
  loadMergeWorldState,
  subscribeMergeWorldSnapshots,
} from '@/utils/merge-world/repository';

type CompanionDiscoveryRecordsSnapshot = {
  ready: boolean;
  records: readonly CompanionDiscoveryRecord[];
};

const LOADING_SNAPSHOT: CompanionDiscoveryRecordsSnapshot = {
  ready: false,
  records: [],
};

/** Keeps non-Merge routes aligned with the persisted companion ownership ledger. */
export function useCompanionDiscoveryRecords(): CompanionDiscoveryRecordsSnapshot {
  const [snapshot, setSnapshot] = useState<CompanionDiscoveryRecordsSnapshot>(LOADING_SNAPSHOT);

  useEffect(() => {
    let active = true;
    let receivedLiveSnapshot = false;
    const apply = (state: MergeWorldState) => {
      if (!active) return;
      setSnapshot({ ready: true, records: state.companionDiscovery.records });
    };
    const unsubscribe = subscribeMergeWorldSnapshots((state) => {
      receivedLiveSnapshot = true;
      apply(state);
    });

    void loadMergeWorldState()
      .then((state) => {
        if (!receivedLiveSnapshot) apply(state);
      })
      .catch(() => {
        if (active && !receivedLiveSnapshot) setSnapshot({ ready: true, records: [] });
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return snapshot;
}
