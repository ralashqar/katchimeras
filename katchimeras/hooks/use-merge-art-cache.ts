import { Image, type ImageRef } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';

import { mergeWorldGeneratorArt, mergeWorldItemArt } from '@/constants/merge-world-art';
import type { MergeWorldState } from '@/types/merge-world';
import { mergeArtWarmupPlan } from '@/utils/merge-world/art-warmup';
import { waitForCriticalInteractionIdle } from '@/utils/critical-interaction';
import { acquireLifecycleResource } from '@/utils/lifecycle-performance';
import { measureMergeWork } from '@/utils/merge-world/performance';
import { createSerialWorkQueue } from '@/utils/merge-world/serial-work-queue';

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
  visibleItemDefinitionIds: readonly string[] = [],
): MergeArtCache {
  const plan = useMemo(() => mergeArtWarmupPlan({ board: state.board, generators: state.generators }), [state.board, state.generators]);
  const pinnedItems = useMemo(() => [...new Set([...plan.itemDefinitionIds, ...visibleItemDefinitionIds])].sort(), [plan.itemDefinitionIds, visibleItemDefinitionIds]);
  const signature = useMemo(() => `${MERGE_ART_CACHE_REVISION}|${mossproutOnboarding ? '1' : '0'}|${plan.generatorIds.join(',')}|${pinnedItems.join(',')}`, [mossproutOnboarding, pinnedItems, plan.generatorIds]);
  const retainedRef = useRef(new Map<string, ImageRef>());
  const generationRef = useRef(0);
  const [workQueue] = useState(createSerialWorkQueue);
  const [cache, setCache] = useState<MergeArtCache>(() => new Map());
  const retiredRef = useRef<ImageRef[]>([]);
  // Release only after consumers have committed replacement sources.
  useEffect(() => { retiredRef.current.splice(0).forEach((image) => image.release()); }, [cache]);
  const onInitialArtReadyRef = useRef(onInitialArtReady);
  onInitialArtReadyRef.current = onInitialArtReady;

  useEffect(() => {
    const generation = ++generationRef.current;
    let cancelled = false;
    const cancellation = new AbortController();
    const desired = new Map<string, number>();
    pinnedItems.forEach((definitionId) => {
      const source = mergeWorldItemArt(definitionId);
      if (source) desired.set(mergeItemArtCacheKey(definitionId), source);
    });
    plan.generatorIds.forEach((generatorId) => {
      const source = mergeWorldGeneratorArt(generatorId, { mossproutOnboarding });
      if (source) desired.set(mergeGeneratorArtCacheKey(generatorId, mossproutOnboarding), source);
    });

    const publishCache = () => {
      if (cancelled || generation !== generationRef.current) return;
      // Trim even on a cache hit: a previously larger pinned set can shrink.
      retainedRef.current.forEach((image, key) => {
        if (retainedRef.current.size <= Math.max(96, desired.size) || desired.has(key)) return;
        retiredRef.current.push(image);
        retainedRef.current.delete(key);
      });
      const nextCache = new Map(retainedRef.current);
      setCache((current) => current.size === nextCache.size && [...nextCache].every(([key, value]) => current.get(key) === value)
        ? current : nextCache);
      onInitialArtReadyRef.current?.();
    };
    const loadDesiredArt = () => {
      if (cancelled || generation !== generationRef.current) return;
      const missing = [...desired].filter(([key]) => !retainedRef.current.has(key));
      if (!missing.length) { publishCache(); return; }
      let cursor = 0;
      const loadWorker = async () => {
        while (cursor < missing.length) {
          if (cancelled || generation !== generationRef.current) return;
          await waitForCriticalInteractionIdle(cancellation.signal);
          if (cancelled || generation !== generationRef.current) return;
          const [key, source] = missing[cursor++];
          const finishDecode = measureMergeWork('image:decode');
          try {
            const imageRef = await Image.loadAsync(source, {
              maxHeight: MERGE_ART_CACHE_EDGE_PX,
              maxWidth: MERGE_ART_CACHE_EDGE_PX,
            });
            if (cancelled || generation !== generationRef.current || !desired.has(key)) {
              imageRef.release();
              return;
            }
            retainedRef.current.set(key, imageRef);
          } catch {
            // The ordinary static source remains the recovery path.
          } finally { finishDecode(); }
        }
      };
      // Decode serially after interactions. Parallel image decoding competes
      // with the JS/native input pipeline during the first FTUE tap burst.
      const workerCount = Math.min(1, missing.length);
      void workQueue.enqueue(async () => {
        if (cancelled || generation !== generationRef.current) return;
        const releaseWorker = acquireLifecycleResource('art_worker', 'merge:art-warmup');
        try { await Promise.all(Array.from({ length: workerCount }, loadWorker)); }
        finally { releaseWorker(); }
        publishCache();
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
      cancellation.abort();
      task?.cancel();
    };
    // The stable signature prevents a spawn revision from restarting identical work.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => () => {
    generationRef.current += 1;
    retainedRef.current.forEach((imageRef) => imageRef.release());
    retainedRef.current.clear();
    retiredRef.current.splice(0).forEach((image) => image.release());
  }, []);

  return cache;
}
