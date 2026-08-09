import { createContext, type PropsWithChildren, use, useCallback, useEffect, useMemo, useState } from 'react';

import { WISP_CATALOG_VERSION } from '@/constants/wisps';
import type { HomeDayRecord } from '@/types/home';
import type { WispCollectionState, WispId } from '@/types/wisp';
import { earnedWispIds, wispProgress } from '@/utils/wisp-engine';
import { loadWispState, saveWispState } from '@/utils/wisp-storage';
import { useDevAllKatchimerasAvailable } from '@/hooks/use-dev-all-katchimeras-available';

type WispContextValue = {
  state: WispCollectionState;
  equippedWispId: WispId | null;
  isOwned: (id: WispId) => boolean;
  equip: (id: WispId | null) => void;
  syncFromDays: (days: readonly HomeDayRecord[]) => WispId[];
  progressFor: (id: WispId, days: readonly HomeDayRecord[]) => ReturnType<typeof wispProgress>;
  pendingDiscoveryId: WispId | null;
  dismissDiscovery: (id: WispId) => void;
};

const WispContext = createContext<WispContextValue | null>(null);

export function WispProvider({ children }: PropsWithChildren) {
  const allKatchimerasAvailable = useDevAllKatchimerasAvailable();
  const [state, setState] = useState(loadWispState);
  const [debugEquippedWispId, setDebugEquippedWispId] = useState<WispId | null | undefined>(undefined);
  useEffect(() => {
    if (!allKatchimerasAvailable) setDebugEquippedWispId(undefined);
  }, [allKatchimerasAvailable]);
  const equippedWispId = allKatchimerasAvailable && debugEquippedWispId !== undefined
    ? debugEquippedWispId
    : state.equippedWispId;
  const equip = useCallback((id: WispId | null) => {
    if (allKatchimerasAvailable) {
      setDebugEquippedWispId(id);
      return;
    }
    setState((current) => saveWispState({
      ...current,
      equippedWispId: id && current.unlocked[id] ? id : null,
    }));
  }, [allKatchimerasAvailable]);
  const isOwned = useCallback(
    (id: WispId) => allKatchimerasAvailable || Boolean(state.unlocked[id]),
    [allKatchimerasAvailable, state.unlocked],
  );
  const syncFromDays = useCallback((days: readonly HomeDayRecord[]) => {
    const earned = earnedWispIds(days);
    const newIds = earned.filter((id) => !state.unlocked[id]);
    if (!newIds.length && state.baselinedCatalogVersion === WISP_CATALOG_VERSION) return [];
    const baselining = state.baselinedCatalogVersion === 0;
    const sourceDayId = days[days.length - 1]?.id ?? null;
    const now = Date.now();
    const unlocked = { ...state.unlocked };
    for (const id of newIds) {
      unlocked[id] = { wispId: id, unlockedAt: now, sourceDayId, seenReveal: baselining };
    }
    setState(saveWispState({ ...state, unlocked, baselinedCatalogVersion: WISP_CATALOG_VERSION }));
    return baselining ? [] : newIds;
  }, [state]);
  const progressFor = useCallback((id: WispId, days: readonly HomeDayRecord[]) => wispProgress(id, days), []);
  const pendingDiscoveryId = (Object.values(state.unlocked).find((record) => record && !record.seenReveal)?.wispId ?? null) as WispId | null;
  const dismissDiscovery = useCallback((id: WispId) => {
    setState((current) => {
      const record = current.unlocked[id];
      return record ? saveWispState({ ...current, unlocked: { ...current.unlocked, [id]: { ...record, seenReveal: true } } }) : current;
    });
  }, []);
  const value = useMemo<WispContextValue>(() => ({ state, equippedWispId, isOwned, equip, syncFromDays, progressFor, pendingDiscoveryId, dismissDiscovery }), [dismissDiscovery, equip, equippedWispId, isOwned, pendingDiscoveryId, progressFor, state, syncFromDays]);
  return <WispContext value={value}>{children}</WispContext>;
}

export function useWisps() {
  const value = use(WispContext);
  if (!value) throw new Error('useWisps must be used inside WispProvider.');
  return value;
}
