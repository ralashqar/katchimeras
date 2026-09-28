import { useEffect, useState } from 'react';
import type { MergeWorldState } from '@/types/merge-world';
import { loadMergeWorldState, subscribeMergeWorldResets, subscribeMergeWorldSnapshots } from '@/utils/merge-world/repository';

/** Read saved rewards/event state without mounting the world's board writer and controllers. */
export function useActivityWorld() {
  const [state, setState] = useState<MergeWorldState | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true, received = false;
    const update = (world: MergeWorldState) => { received = true; if (active) { setState(world); setError(null); } };
    const snapshots = subscribeMergeWorldSnapshots(update);
    const resets = subscribeMergeWorldResets(update);
    void loadMergeWorldState().then(world => { if (active && !received) setState(world); })
      .catch(() => { if (active && !received) setError('Your activity could not load. Return to the world and try again.'); });
    return () => { active = false; snapshots(); resets(); };
  }, []);
  return { state, loading: !state && !error, error };
}
