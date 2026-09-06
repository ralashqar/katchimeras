import { useEffect, useState } from 'react';
import { loadMergeWorldState, subscribeMergeWorldSnapshots } from '@/utils/merge-world/repository';
import type { MergeWorldState } from '@/types/merge-world';
import type { KatchimeraSkinId } from '@/types/katchimera';

export function useUpgradeSkinGrants() {
  const [skins, setSkins] = useState<KatchimeraSkinId[]>([]);
  useEffect(() => {
    let active = true; let live = false;
    const apply = (world: MergeWorldState) => {
      if (!active) return;
      const next = Object.values(world.upgradeSkinGrants ?? {}).map((grant) => grant.skinId).sort();
      setSkins((previous) => previous.length === next.length && previous.every((id, index) => id === next[index]) ? previous : next);
    };
    const unsubscribe = subscribeMergeWorldSnapshots((world) => { live = true; apply(world); });
    void loadMergeWorldState().then((world) => { if (!live) apply(world); }).catch(() => {});
    return () => { active = false; unsubscribe(); };
  }, []);
  return skins;
}
