import { Image, type ImageRef } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';

import { mergeWorldGeneratorArt, mergeWorldItemArt } from '@/constants/merge-world-art';
import type { MergeWorldState } from '@/types/merge-world';
import { mergeArtWarmupPlan } from '@/utils/merge-world/art-warmup';

export type MergeArtCache = ReadonlyMap<string, ImageRef>;

export function mergeItemArtCacheKey(definitionId: string) {
  return `item:${definitionId}`;
}

export function mergeGeneratorArtCacheKey(generatorId: string, mossproutOnboarding: boolean) {
  return `generator:${generatorId}:${mossproutOnboarding ? 'mossprout' : 'default'}`;
}

export function useMergeArtCache(state: MergeWorldState, mossproutOnboarding: boolean): MergeArtCache {
  const plan = useMemo(() => mergeArtWarmupPlan(state), [state]);
  const signature = `${mossproutOnboarding ? '1' : '0'}|${plan.generatorIds.join(',')}|${plan.itemDefinitionIds.join(',')}`;
  const retainedRef = useRef(new Map<string, ImageRef>());
  const generationRef = useRef(0);
  const [cache, setCache] = useState<MergeArtCache>(() => new Map());

  useEffect(() => {
    const generation = ++generationRef.current;
    let cancelled = false;
    const desired = new Map<string, number>();
    plan.itemDefinitionIds.forEach((definitionId) => {
      const source = mergeWorldItemArt(definitionId);
      if (source) desired.set(mergeItemArtCacheKey(definitionId), source);
    });
    plan.generatorIds.forEach((generatorId) => {
      const source = mergeWorldGeneratorArt(generatorId, { mossproutOnboarding });
      if (source) desired.set(mergeGeneratorArtCacheKey(generatorId, mossproutOnboarding), source);
    });

    retainedRef.current.forEach((imageRef, key) => {
      if (desired.has(key)) return;
      imageRef.release();
      retainedRef.current.delete(key);
    });
    setCache(new Map(retainedRef.current));

    const task = InteractionManager.runAfterInteractions(() => {
      const missing = [...desired].filter(([key]) => !retainedRef.current.has(key));
      let cursor = 0;
      const loadWorker = async () => {
        while (cursor < missing.length) {
          const [key, source] = missing[cursor++];
          try {
            const imageRef = await Image.loadAsync(source, { maxHeight: 96, maxWidth: 96 });
            if (cancelled || generation !== generationRef.current || !desired.has(key)) {
              imageRef.release();
              continue;
            }
            retainedRef.current.set(key, imageRef);
          } catch {
            // The ordinary static source remains the recovery path.
          }
        }
      };
      const workerCount = Math.min(3, missing.length);
      void Promise.all(Array.from({ length: workerCount }, loadWorker)).then(() => {
        if (!cancelled && generation === generationRef.current) setCache(new Map(retainedRef.current));
      });
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
    // The stable signature prevents a spawn revision from restarting identical work.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => () => {
    generationRef.current += 1;
    retainedRef.current.forEach((imageRef) => imageRef.release());
    retainedRef.current.clear();
  }, []);

  return cache;
}
