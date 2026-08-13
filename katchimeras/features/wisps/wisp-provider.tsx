import { createContext, type PropsWithChildren, use, useCallback, useEffect, useMemo, useState } from 'react';

import { WISP_CATALOG_VERSION, wispDefinition } from '@/constants/wisps';
import type { HomeDayRecord } from '@/types/home';
import type { WispCollectionState, WispGrantSource, WispId } from '@/types/wisp';
import { earnedWispIds, wispProgress } from '@/utils/wisp-engine';
import { loadWispState, saveWispState } from '@/utils/wisp-storage';
import { useDevAllKatchimerasAvailable } from '@/hooks/use-dev-all-katchimeras-available';
import { loadCompanionAchievementState } from '@/utils/companion-achievements-storage';
import { useEconomy } from '@/features/economy/economy-provider';

type WispContextValue = {
  state: WispCollectionState;
  equippedWispId: WispId | null;
  isOwned: (id: WispId) => boolean;
  quantity: (id: WispId) => number;
  sources: (id: WispId) => readonly WispGrantSource[];
  isGiftable: (id: WispId) => boolean;
  equip: (id: WispId | null) => void;
  syncFromDays: (days: readonly HomeDayRecord[]) => WispId[];
  progressFor: (id: WispId, days: readonly HomeDayRecord[]) => ReturnType<typeof wispProgress>;
  pendingDiscoveryId: WispId | null;
  dismissDiscovery: (id: WispId) => void;
  grant: (id: WispId, receiptId: string, source?: WispGrantSource) => boolean;
};

const WispContext = createContext<WispContextValue | null>(null);

export function WispProvider({ children }: PropsWithChildren) {
  const allKatchimerasAvailable = useDevAllKatchimerasAvailable();
  const economy = useEconomy();
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
      equippedWispId: id && (current.inventory[id]?.quantity || serverQuantity(economy.snapshot.inventory, id)) ? id : null,
    }));
  }, [allKatchimerasAvailable, economy.snapshot.inventory]);
  const isOwned = useCallback(
    (id: WispId) => allKatchimerasAvailable || Boolean((state.inventory[id]?.quantity ?? 0) + serverQuantity(economy.snapshot.inventory, id)),
    [allKatchimerasAvailable, economy.snapshot.inventory, state.inventory],
  );
  const quantity = useCallback((id: WispId) => allKatchimerasAvailable ? 1 : (state.inventory[id]?.quantity ?? 0) + serverQuantity(economy.snapshot.inventory, id), [allKatchimerasAvailable, economy.snapshot.inventory, state.inventory]);
  const sources = useCallback((id: WispId) => [...new Set([
    ...(state.inventory[id]?.sources ?? []),
    ...economy.snapshot.inventory.filter((grant) => grant.collectibleType === 'wisp' && grant.collectibleId === id).map((grant) => grant.source as WispGrantSource),
  ])], [economy.snapshot.inventory, state.inventory]);
  const isGiftable = useCallback((id: WispId) => economy.config.flags.gifting
    && wispDefinition(id).giftPolicy === 'duplicate_only'
    && ((state.inventory[id]?.giftableQuantity ?? 0) > 0 || ((state.inventory[id]?.quantity ?? 0) + serverQuantity(economy.snapshot.inventory, id)) > 1), [economy.config.flags.gifting, economy.snapshot.inventory, state.inventory]);
  const syncFromDays = useCallback((days: readonly HomeDayRecord[]) => {
    const achievementIds = new Set(Object.keys(loadCompanionAchievementState().unlocked));
    const earned = earnedWispIds(days, { unlockedAchievementIds: achievementIds });
    const hatchGrants = days.flatMap((day) => day.state === 'hatched'
      ? (day.card?.featuredWisps ?? []).map((featured) => ({
          dayId: day.id,
          id: featured.wispId,
          receiptId: `daily-hatch:${day.id}:${featured.wispId}`,
        }))
      : []);
    setState((current) => {
      const baselining = current.baselinedCatalogVersion === 0;
      const sourceDayId = days[days.length - 1]?.id ?? null;
      const now = Date.now();
      const unlocked = { ...current.unlocked };
      const inventory = { ...current.inventory };
      const applied = new Set(current.appliedGrantReceiptIds ?? []);
      for (const id of earned) {
        if (inventory[id]?.quantity) continue;
        unlocked[id] = { wispId: id, unlockedAt: now, sourceDayId, seenReveal: baselining };
        inventory[id] = { wispId: id, quantity: 1, sources: [localGrantSource(id)], firstGrantedAt: now, giftableQuantity: 0 };
      }
      for (const grant of hatchGrants) {
        if (applied.has(grant.receiptId)) continue;
        applied.add(grant.receiptId);
        const existing = inventory[grant.id];
        const quantity = (existing?.quantity ?? 0) + 1;
        unlocked[grant.id] = unlocked[grant.id] ?? {
          wispId: grant.id,
          unlockedAt: now,
          sourceDayId: grant.dayId,
          seenReveal: baselining,
        };
        inventory[grant.id] = {
          wispId: grant.id,
          quantity,
          sources: [...new Set([...(existing?.sources ?? []), 'experience' as const])],
          firstGrantedAt: existing?.firstGrantedAt ?? now,
          giftableQuantity: Math.max(existing?.giftableQuantity ?? 0, quantity - 1),
        };
      }
      const unchanged = Object.keys(inventory).length === Object.keys(current.inventory).length
        && applied.size === (current.appliedGrantReceiptIds ?? []).length
        && current.baselinedCatalogVersion === WISP_CATALOG_VERSION;
      return unchanged ? current : saveWispState({
        ...current,
        unlocked,
        inventory,
        baselinedCatalogVersion: WISP_CATALOG_VERSION,
        appliedGrantReceiptIds: [...applied],
      });
    });
    // Discovery presentation is read from the persisted pending record. The
    // return value remains for legacy callers and is intentionally not used as
    // a second state channel.
    return [];
  }, []);
  const progressFor = useCallback((id: WispId, days: readonly HomeDayRecord[]) => wispProgress(id, days, {
    unlockedAchievementIds: new Set(Object.keys(loadCompanionAchievementState().unlocked)),
  }), []);
  const pendingDiscoveryId = (Object.values(state.unlocked).find((record) => record && !record.seenReveal)?.wispId ?? null) as WispId | null;
  const dismissDiscovery = useCallback((id: WispId) => {
    setState((current) => {
      const record = current.unlocked[id];
      return record ? saveWispState({ ...current, unlocked: { ...current.unlocked, [id]: { ...record, seenReveal: true } } }) : current;
    });
  }, []);
  const grant = useCallback((id: WispId, receiptId: string, source: WispGrantSource = 'game') => {
    if (!receiptId) return false;
    let granted = false;
    setState((current) => {
      if ((current.appliedGrantReceiptIds ?? []).includes(receiptId)) return current;
      granted = true;
      const now = Date.now();
      const existing = current.inventory[id];
      const quantity = (existing?.quantity ?? 0) + 1;
      return saveWispState({
        ...current,
        unlocked: {
          ...current.unlocked,
          [id]: current.unlocked[id] ?? { wispId: id, unlockedAt: now, sourceDayId: null, seenReveal: false },
        },
        inventory: {
          ...current.inventory,
          [id]: {
            wispId: id,
            quantity,
            sources: [...new Set([...(existing?.sources ?? []), source])],
            firstGrantedAt: existing?.firstGrantedAt ?? now,
            giftableQuantity: Math.max(existing?.giftableQuantity ?? 0, quantity - 1),
          },
        },
        appliedGrantReceiptIds: [...(current.appliedGrantReceiptIds ?? []), receiptId],
      });
    });
    return granted;
  }, []);
  const value = useMemo<WispContextValue>(() => ({ state, equippedWispId, isOwned, quantity, sources, isGiftable, equip, syncFromDays, progressFor, pendingDiscoveryId, dismissDiscovery, grant }), [dismissDiscovery, equip, equippedWispId, grant, isGiftable, isOwned, pendingDiscoveryId, progressFor, quantity, sources, state, syncFromDays]);
  return <WispContext value={value}>{children}</WispContext>;
}

function serverQuantity(grants: ReturnType<typeof useEconomy>['snapshot']['inventory'], id: WispId) {
  return grants.filter((grant) => grant.collectibleType === 'wisp' && grant.collectibleId === id).reduce((sum, grant) => sum + grant.quantity, 0);
}

function localGrantSource(id: WispId): WispGrantSource {
  const definition = wispDefinition(id);
  if (definition.semanticClass === 'family_signature') return 'family_achievement';
  if (definition.acquisition === 'achievement') return 'achievement';
  if (definition.acquisition === 'game') return 'game';
  return 'experience';
}

export function useWisps() {
  const value = use(WispContext);
  if (!value) throw new Error('useWisps must be used inside WispProvider.');
  return value;
}
