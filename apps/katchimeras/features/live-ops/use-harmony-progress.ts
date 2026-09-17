import { useEffect, useState } from 'react';
import { loadHarmonyProgress, subscribeMergeWorldSnapshots } from '@/utils/merge-world/repository';
import { emptyHarmony } from './rules';

export function useHarmonyProgress() {
  const [progress, setProgress] = useState(emptyHarmony);
  useEffect(() => {
    let alive = true;
    const update = () => { void loadHarmonyProgress().then(next => { if (alive) setProgress(next); }).catch(error => console.warn('Harmony could not be loaded', error)); };
    update();
    const unsubscribe = subscribeMergeWorldSnapshots(update);
    return () => { alive = false; unsubscribe(); };
  }, []);
  return progress;
}
