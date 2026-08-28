import { Image, type ImageRef } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';

import { mergeWorldGeneratorArt, mergeWorldItemArt } from '@/constants/merge-world-art';
import type { MergeWorldState } from '@/types/merge-world';
import { mergeArtWarmupPlan } from '@/utils/merge-world/art-warmup';
import { waitForCriticalInteractionIdle } from '@/utils/critical-interaction';

export type MergeArtCache = ReadonlyMap<string, ImageRef>;

// Merge sprites animate above their resting size and the whole Haven can be
// camera-scaled. Keep the authored 256 px texture in memory so those transforms
// sample real source pixels instead of enlarging the old 96 px warmup decode.
const MERGE_ART_CACHE_EDGE_PX = 256;
const MERGE_ART_CACHE_REVISION = `toy-diorama-v1-${MERGE_ART_CACHE_EDGE_PX}`;

export function mergeItemArtCacheKey(definitionId: string) {
  return `${MERGE_ART_CACHE_REVISION}:item:${definitionId}`;
}

export function mergeGeneratorArtCacheKey(generatorId: string, mossproutOnboarding: boolean) {
  return `${MERGE_ART_CACHE_REVISION}:generator:${generatorId}:${mossproutOnboarding ? 'mossprout' : 'default'}`;
}

export function useMergeArtCache(
  state: MergeWorldState,
  mossproutOnboarding: boolean,
  onInitialArtReady?: () => void,
): MergeArtCache {
  const plan = useMemo(() => mergeArtWarmupPlan(state), [state]);
  const signature = `${MERGE_ART_CACHE_REVISION}|${mossproutOnboarding ? '1' : '0'}|${plan.generatorIds.join(',')}|${plan.itemDefinitionIds.join(',')}`;
  const retainedRef = useRef(new Map<string, ImageRef>());
  const generationRef = useRef(0);
  const [cache, setCache] = useState<MergeArtCache>(() => new Map());
  const onInitialArtReadyRef = useRef(onInitialArtReady);
  onInitialArtReadyRef.current = onInitialArtReady;

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

    const loadDesiredArt = () => {
      const missing = [...desired].filter(([key]) => !retainedRef.current.has(key));
      let cursor = 0;
      const loadWorker = async () => {
        while (cursor < missing.length) {
          await waitForCriticalInteractionIdle();
          const [key, source] = missing[cursor++];
          try {
            const imageRef = await Image.loadAsync(source, {
              maxHeight: MERGE_ART_CACHE_EDGE_PX,
              maxWidth: MERGE_ART_CACHE_EDGE_PX,
            });
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
      // Decode serially after interactions. Parallel image decoding competes
      // with the JS/native input pipeline during the first FTUE tap burst.
      const workerCount = Math.min(1, missing.length);
      void Promise.all(Array.from({ length: workerCount }, loadWorker)).then(() => {
        if (!cancelled && generation === generationRef.current) {
          setCache(new Map(retainedRef.current));
          onInitialArtReadyRef.current?.();
        }
      });
    };
    // A transition curtain is already shielding this initial decode. Waiting
    // for InteractionManager here can create a circular dependency: the art
    // waits for navigation interactions while navigation waits for the art.
    const task = onInitialArtReadyRef.current
      ? null
      : InteractionManager.runAfterInteractions(loadDesiredArt);
    if (onInitialArtReadyRef.current) queueMicrotask(loadDesiredArt);

    return () => {
      cancelled = true;
      task?.cancel();
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
