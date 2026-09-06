import { createContext, type PropsWithChildren, use, useCallback, useMemo, useState } from 'react';

import type { HomeDayRecord } from '@/types/home';
import type { SceneCollectionState, SceneVariantId } from '@/types/scene';
import { loadSceneState, saveSceneState } from '@/utils/scene-storage';

type SceneContextValue = {
  state: SceneCollectionState;
  equippedSceneId: SceneVariantId;
  isOwned: (id: SceneVariantId) => boolean;
  equip: (id: SceneVariantId) => void;
  syncFromDays: (days: readonly HomeDayRecord[]) => void;
  pendingDiscoveryId: SceneVariantId | null;
  dismissDiscovery: (id: SceneVariantId) => void;
};

const SceneContext = createContext<SceneContextValue | null>(null);

export function SceneProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState(loadSceneState);
  const isOwned = useCallback((id: SceneVariantId) => Boolean(state.unlocked[id]), [state.unlocked]);
  const equip = useCallback((id: SceneVariantId) => {
    setState((current) => current.unlocked[id]
      ? saveSceneState({ ...current, equippedSceneId: id })
      : current);
  }, []);
  const syncFromDays = useCallback((days: readonly HomeDayRecord[]) => {
    setState((current) => {
      const unlocked = { ...current.unlocked };
      const applied = new Set(current.appliedReceiptIds);
      let changed = false;
      for (const day of days) {
        const sceneId = day.dailyHatch?.sceneVariantId;
        if (!sceneId || !day.dailyHatch?.claimedAt) continue;
        const receiptId = `daily-scene:${day.id}:${sceneId}`;
        if (applied.has(receiptId)) continue;
        applied.add(receiptId);
        unlocked[sceneId] = unlocked[sceneId] ?? {
          sceneId,
          unlockedAt: Date.parse(day.dailyHatch?.sealedAt ?? '') || Date.now(),
          sourceDayId: day.id,
          seenReveal: day.dailyHatch?.provenance === 'legacy_conversion',
        };
        changed = true;
      }
      return changed ? saveSceneState({ ...current, unlocked, appliedReceiptIds: [...applied] }) : current;
    });
  }, []);
  const pendingDiscoveryId = (Object.values(state.unlocked).find((record) => record && !record.seenReveal)?.sceneId ?? null) as SceneVariantId | null;
  const dismissDiscovery = useCallback((id: SceneVariantId) => {
    setState((current) => {
      const record = current.unlocked[id];
      return record ? saveSceneState({
        ...current,
        unlocked: { ...current.unlocked, [id]: { ...record, seenReveal: true } },
      }) : current;
    });
  }, []);
  const value = useMemo<SceneContextValue>(() => ({
    state,
    equippedSceneId: state.equippedSceneId,
    isOwned,
    equip,
    syncFromDays,
    pendingDiscoveryId,
    dismissDiscovery,
  }), [dismissDiscovery, equip, isOwned, pendingDiscoveryId, state, syncFromDays]);
  return <SceneContext value={value}>{children}</SceneContext>;
}

export function useScenes() {
  const value = use(SceneContext);
  if (!value) throw new Error('useScenes must be used inside SceneProvider.');
  return value;
}
