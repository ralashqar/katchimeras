import { useEffect, useState } from 'react';

import type { MergeWorldState } from '@/types/merge-world';
import {
  loadMergeWorldState,
  subscribeMergeWorldSnapshots,
} from '@/utils/merge-world/repository';

type HavenTileStages = MergeWorldState['haven']['tileStages'];

/** Keeps non-Merge companion routes aligned with persisted Haven upgrades. */
export function useHavenTileStages(): HavenTileStages {
  const [stages, setStages] = useState<HavenTileStages>({});

  useEffect(() => {
    let active = true;
    let receivedLiveSnapshot = false;
    const apply = (state: MergeWorldState) => {
      if (active) setStages(state.haven.tileStages);
    };
    const unsubscribe = subscribeMergeWorldSnapshots((state) => {
      receivedLiveSnapshot = true;
      apply(state);
    });
    void loadMergeWorldState().then((state) => {
      if (!receivedLiveSnapshot) apply(state);
    }).catch(() => undefined);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return stages;
}
