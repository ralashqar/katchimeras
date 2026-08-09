import { createContext, type PropsWithChildren, use, useCallback, useEffect, useMemo, useState } from 'react';

import { FALLBACK_ECONOMY_CONFIG, emptyEconomySnapshot, normalizeEconomyConfig } from '@/utils/economy-config';
import { useEssence } from '@/hooks/use-essence';
import type { AvatarAccessState, AvatarPurchaseInput, EconomyConfig, EconomyMutationResult, EconomySnapshot, RevenueCatPackageSummary } from '@/types/economy';
import type { WispId } from '@/types/wisp';
import type { EggAvatarAccess, EggAvatarCategory } from '@/types/egg-avatar';
import { ensureStreakIdentity } from '@/utils/streak-sync';
import { supabase } from '@/utils/supabase';
import { isSubscriptionSimulatorEnabled, subscriptionApi } from '@/utils/subscription-api';
import { migrateLegacyEconomy } from '@/utils/economy-migration';
import { avatarEssencePrice } from '@/utils/economy-config';
import { useAllDays } from '@/hooks/use-all-days';
import { syncEconomyEvents } from '@/utils/economy-sync';
import { useDevSubscriptionSimulator } from '@/hooks/use-dev-subscription-simulator';
import { claimDevMonthlyWisp, getDevSubscriptionSimulatorState, isDevSubscriptionActive } from '@/utils/dev-subscription-simulator';

type EconomyContextValue = {
  config: EconomyConfig;
  snapshot: EconomySnapshot;
  refresh: () => Promise<void>;
  purchaseWithEssence: (offerId: string) => Promise<EconomyMutationResult>;
  chooseVisitor: (wispId: WispId) => Promise<EconomyMutationResult>;
  claimMonthlyPlus: () => Promise<EconomyMutationResult>;
  reconcilePurchases: (restore?: boolean) => Promise<EconomyMutationResult>;
  packages: RevenueCatPackageSummary[];
  loadPackages: () => Promise<void>;
  purchasePlus: (packageId: string) => Promise<EconomyMutationResult>;
  avatarAccess: (input: AvatarPurchaseInput) => AvatarAccessState;
  purchaseAvatar: (input: AvatarPurchaseInput) => Promise<EconomyMutationResult>;
  isAvatarOwned: (category: EggAvatarCategory, itemId: string, access: EggAvatarAccess) => boolean;
};

const EconomyContext = createContext<EconomyContextValue | null>(null);

export function EconomyProvider({ children }: PropsWithChildren) {
  const essence = useEssence();
  const { days } = useAllDays();
  const simulator = useDevSubscriptionSimulator();
  const [serverConfig, setServerConfig] = useState(FALLBACK_ECONOMY_CONFIG);
  const [snapshot, setSnapshot] = useState(() => emptyEconomySnapshot(0));
  const [legacyMigrationAttempted, setLegacyMigrationAttempted] = useState(false);
  const [packages, setPackages] = useState<RevenueCatPackageSummary[]>([]);

  const config = useMemo(
    () => simulator.enabled ? devSubscriptionConfig(serverConfig) : serverConfig,
    [serverConfig, simulator.enabled],
  );

  const refresh = useCallback(async () => {
    const userId = await ensureStreakIdentity();
    if (!userId) { setSnapshot(emptyEconomySnapshot(essence.balance)); return; }
    await subscriptionApi.configure(userId);
    const sdkPlus = await subscriptionApi.isEntitled(serverConfig.plus.entitlementId);
    const { data, error } = await supabase.rpc('get_economy_snapshot_v1');
    if (error || !data || typeof data !== 'object') {
      setSnapshot(withDevSubscriptionSnapshot({ ...emptyEconomySnapshot(essence.balance), activePlus: sdkPlus }));
      return;
    }
    const payload = data as { config?: unknown; snapshot?: Partial<EconomySnapshot> };
    const nextConfig = normalizeEconomyConfig(payload.config);
    setServerConfig(nextConfig);
    const activePlus = isSubscriptionSimulatorEnabled() ? sdkPlus : Boolean(payload.snapshot?.activePlus || sdkPlus);
    setSnapshot(withDevSubscriptionSnapshot({ ...emptyEconomySnapshot(essence.balance), ...payload.snapshot, activePlus, synced: true }));
  }, [essence.balance, serverConfig.plus.entitlementId]);

  useEffect(() => { void refresh(); }, [refresh, simulator.revision]);
  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};
    void subscriptionApi.addEntitlementListener(config.plus.entitlementId, (activePlus) => {
      setSnapshot((current) => ({ ...current, activePlus }));
      void refresh();
    }).then((next) => {
      if (cancelled) next();
      else unsubscribe = next;
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [config.plus.entitlementId, refresh, simulator.enabled]);
  useEffect(() => {
    if (!config.flags.legacyMigration || legacyMigrationAttempted) return;
    setLegacyMigrationAttempted(true);
    void migrateLegacyEconomy(essence.balance, essence.purchases).then((migrated) => { if (migrated) void refresh(); });
  }, [config.flags.legacyMigration, essence.balance, essence.purchases, legacyMigrationAttempted, refresh]);
  useEffect(() => {
    if (!config.flags.economySync) return;
    let cancelled = false;
    void ensureStreakIdentity().then(async (userId) => {
      if (!userId || cancelled) return;
      await syncEconomyEvents(days, userId);
      if (!cancelled) await refresh();
    });
    return () => { cancelled = true; };
  }, [config.flags.economySync, days, refresh]);

  const mutate = useCallback(async (rpc: string, payload: Record<string, unknown>): Promise<EconomyMutationResult> => {
    const { error } = await supabase.rpc(rpc, payload);
    if (error) return { ok: false, reason: /insufficient/i.test(error.message) ? 'insufficient_essence' : 'server_error' };
    await refresh();
    return { ok: true };
  }, [refresh]);

  const purchaseWithEssence = useCallback((offerId: string) => config.flags.wispShop
    ? mutate('purchase_economy_offer_v1', { offer_id: offerId })
    : Promise.resolve({ ok: false, reason: 'disabled' } as const), [config.flags.wispShop, mutate]);
  const chooseVisitor = useCallback((wispId: WispId) => config.flags.visitorChoice
    ? mutate('choose_visitor_wisp_v1', { chosen_wisp_id: wispId })
    : Promise.resolve({ ok: false, reason: 'disabled' } as const), [config.flags.visitorChoice, mutate]);
  const claimMonthlyPlus = useCallback(async (): Promise<EconomyMutationResult> => {
    if (!config.flags.plus) return { ok: false, reason: 'disabled' };
    if (isSubscriptionSimulatorEnabled()) {
      const claimed = claimDevMonthlyWisp();
      await refresh();
      return claimed ? { ok: true } : { ok: false, reason: 'not_eligible' };
    }
    return mutate('claim_monthly_plus_wisp_v1', {});
  }, [config.flags.plus, mutate, refresh]);
  const reconcilePurchases = useCallback(async (restore = false): Promise<EconomyMutationResult> => {
    if (!config.flags.plus) return { ok: false, reason: 'disabled' };
    try {
      if (restore) await subscriptionApi.restore(config.plus.entitlementId);
    } catch {
      return { ok: false, reason: 'server_error' };
    }
    if (isSubscriptionSimulatorEnabled()) {
      await refresh();
      return { ok: true };
    }
    const { error } = await supabase.functions.invoke('reconcile-revenuecat', { body: {} });
    if (error) return { ok: false, reason: 'server_error' };
    await refresh();
    return { ok: true };
  }, [config.flags.plus, config.plus.entitlementId, refresh]);
  const loadPackages = useCallback(async () => setPackages(config.flags.plus ? await subscriptionApi.getPackages(config.plus.offeringId) : []), [config.flags.plus, config.plus.offeringId]);
  const purchasePlus = useCallback(async (packageId: string): Promise<EconomyMutationResult> => {
    if (!config.flags.plus) return { ok: false, reason: 'disabled' };
    try {
      if (!await subscriptionApi.purchasePackage(packageId, config.plus.entitlementId)) return { ok: false, reason: 'server_error' };
      if (isSubscriptionSimulatorEnabled()) {
        await refresh();
        return { ok: true };
      }
      return reconcilePurchases();
    } catch {
      return { ok: false, reason: 'server_error' };
    }
  }, [config.flags.plus, config.plus.entitlementId, reconcilePurchases, refresh]);
  const avatarAccess = useCallback((input: AvatarPurchaseInput): AvatarAccessState => {
    if (input.access.mode === 'free') return { hasAccess: true, permanentlyOwned: true, source: 'free', price: null };
    const collectibleId = `${input.category}:${input.itemId}`;
    const permanent = snapshot.inventory.some((grant) => grant.collectibleType === 'avatar' && grant.collectibleId === collectibleId)
      || (!snapshot.synced && essence.purchases.includes(input.itemId));
    if (permanent) return { hasAccess: true, permanentlyOwned: true, source: 'permanent', price: null };
    if (input.access.mode === 'premium') {
      return snapshot.activePlus
        ? { hasAccess: true, permanentlyOwned: false, source: 'plus-rental', price: null }
        : { hasAccess: false, permanentlyOwned: false, source: 'locked-plus', price: null };
    }
    return { hasAccess: false, permanentlyOwned: false, source: 'locked-essence', price: avatarEssencePrice(input.category, input.rarity, config) };
  }, [config, essence.purchases, snapshot.activePlus, snapshot.inventory, snapshot.synced]);
  const purchaseAvatar = useCallback(async (input: AvatarPurchaseInput): Promise<EconomyMutationResult> => {
    const access = avatarAccess(input);
    if (access.hasAccess) return { ok: true };
    if (input.access.mode !== 'essence' || access.price == null) return { ok: false, reason: 'invalid_offer' };
    if (!snapshot.synced || !config.flags.economySync) {
      return essence.spend(input.itemId, access.price) ? { ok: true } : { ok: false, reason: 'insufficient_essence' };
    }
    return mutate('purchase_avatar_collectible_v1', { category: input.category, item_id: input.itemId });
  }, [avatarAccess, config.flags.economySync, essence, mutate, snapshot.synced]);
  const isAvatarOwned = useCallback((category: EggAvatarCategory, itemId: string, access: EggAvatarAccess) => {
    const fallbackRarity = 'common' as const;
    return avatarAccess({ category, itemId, access, rarity: fallbackRarity }).hasAccess;
  }, [avatarAccess]);

  const value = useMemo(() => ({ config, snapshot, refresh, purchaseWithEssence, chooseVisitor, claimMonthlyPlus, reconcilePurchases, packages, loadPackages, purchasePlus, avatarAccess, purchaseAvatar, isAvatarOwned }), [avatarAccess, chooseVisitor, claimMonthlyPlus, config, isAvatarOwned, loadPackages, packages, purchaseAvatar, purchasePlus, purchaseWithEssence, reconcilePurchases, refresh, snapshot]);
  return <EconomyContext value={value}>{children}</EconomyContext>;
}

export function useEconomy() {
  const value = use(EconomyContext);
  if (!value) throw new Error('useEconomy must be used inside EconomyProvider.');
  return value;
}

function devSubscriptionConfig(config: EconomyConfig): EconomyConfig {
  return {
    ...config,
    flags: { ...config.flags, plus: true },
    plus: { ...config.plus, enabled: true },
  };
}

function withDevSubscriptionSnapshot(snapshot: EconomySnapshot): EconomySnapshot {
  const simulator = getDevSubscriptionSimulatorState();
  if (!simulator.enabled) return snapshot;
  const opalGrant = simulator.monthlyClaimedAt && !snapshot.inventory.some((grant) => grant.collectibleType === 'wisp' && grant.collectibleId === 'opal')
    ? [{ collectibleType: 'wisp' as const, collectibleId: 'opal', quantity: 1, source: 'plus_claim' as const, grantedAt: simulator.monthlyClaimedAt }]
    : [];
  return {
    ...snapshot,
    activePlus: isDevSubscriptionActive(simulator),
    inventory: [...snapshot.inventory, ...opalGrant],
    monthlyPlusClaimed: Boolean(simulator.monthlyClaimedAt),
  };
}
