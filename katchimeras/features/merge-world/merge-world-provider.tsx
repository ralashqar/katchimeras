import { createContext, type PropsWithChildren, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { companionIdForFamily } from '@/constants/katchimera-skins';
import { KATCHIMERA_MERGE_PROFILES } from '@/constants/merge-world-catalog';
import { useWisps } from '@/features/wisps/wisp-provider';
import type { HomeDayRecord } from '@/types/home';
import type { MergeCharacterId, MergeExternalRewardReceipt, MergeWorldCommand, MergeWorldCommandResult, MergeWorldState } from '@/types/merge-world';
import type { AuthoredCohortFamilyId } from '@/utils/companion-story';
import { companionFriendshipProgress, recordCompanionBondEvent } from '@/utils/companion-bond';
import { loadCompanionBondState, saveCompanionBondState, subscribeCompanionBondState } from '@/utils/companion-bond-storage';
import { enqueueConversationSignal } from '@/utils/companion-content';
import { loadCompanionContentState, saveCompanionContentState } from '@/utils/companion-content-storage';
import type { CompanionQuestState } from '@/utils/katchimera-quests';
import { mergeActivityRewards, mergeQuestActivityRewards } from '@/utils/merge-world/activity-rewards';
import { reduceMergeWorld } from '@/utils/merge-world/engine';
import { mergeWorldPendingPersistence, type MergeWorldPendingPersistence } from '@/utils/merge-world/persistence-buffer';
import { loadFirstSession } from '@/features/onboarding/first-session';
import { isMossproutChapterZeroActive } from '@/utils/merge-world/chapter-zero-policy';
import { loadMergeWorldState, saveMergeWorldState, subscribeMergeWorldResets, subscribeMergeWorldSnapshots } from '@/utils/merge-world/repository';
import { isAuthoredCohortFamily, loadAuthoredCohortStory, loadFeastleStory, loadMossproutStory, markAuthoredCohortOrderActive, markAuthoredCohortOrderServed, markFeastleOrderActive, markFeastleOrderServed, markMossproutOrderActive, markMossproutOrderServed, recordAuthoredCohortQuietBond, recordFeastleQuietBond, recordMossproutQuietBond, subscribeCompanionStories } from '@/utils/companion-story-storage';
import { acquireLifecycleResource } from '@/utils/lifecycle-performance';
import { loadCompanionQuickGoalState, subscribeCompanionQuickGoals } from '@/utils/companion-quick-goal-storage';

type MergeWorldContextValue = {
  state: MergeWorldState | null;
  loading: boolean;
  error: string | null;
  lastResult: MergeWorldCommandResult | null;
  friendshipLevels: Partial<Record<MergeCharacterId, number>>;
  dispatch: (command: MergeWorldCommand) => MergeWorldCommandResult | null;
  flush: () => Promise<void>;
};

const RETRY_DELAYS_MS = [250, 1_000, 4_000] as const;
const MERGE_PERF_ENABLED = __DEV__ && process.env.EXPO_PUBLIC_MERGE_PERF === '1';
const MergeWorldContext = createContext<MergeWorldContextValue | null>(null);
const SIGNATURE_LEVELS = new Set([4, 8, 12, 16, 20]);
const AUTHORED_COHORT_FAMILIES: readonly AuthoredCohortFamilyId[] = [
  'baristabbit', 'steppling', 'voyagle', 'flexel', 'bedrotte',
];

function changedReceiptIds(before: MergeWorldState, after: MergeWorldState) {
  const previous = new Map(before.externalRewardReceipts.map((receipt) => [receipt.id, receipt.appliedAt]));
  return after.externalRewardReceipts
    .filter((receipt) => previous.get(receipt.id) !== receipt.appliedAt || !previous.has(receipt.id))
    .map((receipt) => receipt.id);
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function MergeWorldProvider({
  active = true,
  characterIds,
  days,
  featuredCharacterId,
  questState,
  children,
}: PropsWithChildren<{ active?: boolean; characterIds: string[]; days: readonly HomeDayRecord[]; featuredCharacterId?: MergeCharacterId | null; questState: CompanionQuestState }>) {
  const wisps = useWisps();
  const [state, setState] = useState<MergeWorldState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<MergeWorldCommandResult | null>(null);
  const [friendshipLevels, setFriendshipLevels] = useState<Partial<Record<MergeCharacterId, number>>>({});
  const [quickGoalRevision, setQuickGoalRevision] = useState(0);
  const stateRef = useRef(state);
  const activeRef = useRef(active);
  const mountedRef = useRef(true);
  const pendingPersistenceRef = useRef<MergeWorldPendingPersistence | null>(null);
  const persistenceWorkerRef = useRef<Promise<void> | null>(null);
  const persistenceGenerationRef = useRef(0);
  const externalWorkerRef = useRef<Promise<void> | null>(null);
  const externalGenerationRef = useRef(0);
  const applyingStoryReceiptDepthRef = useRef(0);
  stateRef.current = state;
  activeRef.current = active;

  useEffect(() => acquireLifecycleResource('merge_provider', 'merge-world-provider'), []);
  useEffect(() => {
    if (!active) return;
    const release = acquireLifecycleResource('store_subscription', 'merge:quick-goals');
    const unsubscribe = subscribeCompanionQuickGoals(() => {
      if (activeRef.current) setQuickGoalRevision((value) => value + 1);
    });
    return () => {
      unsubscribe();
      release();
    };
  }, [active]);

  const currentFriendshipLevels = useCallback(() => {
    const bond = loadCompanionBondState();
    const ids = Object.keys(KATCHIMERA_MERGE_PROFILES) as MergeCharacterId[];
    return Object.fromEntries(ids.map((id) => [id, companionFriendshipProgress(bond, companionIdForFamily(id)).level])) as Partial<Record<MergeCharacterId, number>>;
  }, []);

  const refreshFriendshipLevels = useCallback(() => {
    const levels = currentFriendshipLevels();
    if (mountedRef.current) setFriendshipLevels(levels);
    return levels;
  }, [currentFriendshipLevels]);

  const enqueueFriendshipInvitation = useCallback((characterId: MergeCharacterId, sourceId: string, createdAt: number) => {
    const content = loadCompanionContentState();
    const next = enqueueConversationSignal(content, {
      id: `conversation-signal:merge:${characterId}:${sourceId}`,
      kind: 'bond',
      familyId: characterId,
      sourceId,
      dayId: new Date(createdAt).toISOString().slice(0, 10),
      createdAt,
      expiresAt: createdAt + 365 * 86_400_000,
    });
    if (next !== content) saveCompanionContentState(next);
  }, []);

  const guardStoryReceiptMutation = useCallback((mutate: () => void) => {
    applyingStoryReceiptDepthRef.current += 1;
    try {
      mutate();
    } finally {
      // Story storage notifies in a microtask. A depth counter keeps every
      // notification in the same external-reward batch guarded, even when a
      // Friendship receipt and its served-order receipt are applied together.
      queueMicrotask(() => {
        applyingStoryReceiptDepthRef.current = Math.max(0, applyingStoryReceiptDepthRef.current - 1);
      });
    }
  }, []);

  const applyReceiptSideEffect = useCallback((receipt: MergeExternalRewardReceipt) => {
    if (receipt.kind === 'story_order_served') {
      if (receipt.characterId === 'feastle') {
        guardStoryReceiptMutation(() => {
          markFeastleOrderServed(
            receipt.id.replace('merge-story-served:', ''),
            receipt.amount,
            receipt.createdAt,
            receipt.storyStepCount,
          );
        });
      } else if (receipt.characterId === 'mossprout') {
        guardStoryReceiptMutation(() => markMossproutOrderServed(
          receipt.id.replace('merge-story-served:', ''), receipt.amount, receipt.createdAt,
        ));
      } else if (isAuthoredCohortFamily(receipt.characterId)) {
        const familyId = receipt.characterId;
        guardStoryReceiptMutation(() => markAuthoredCohortOrderServed(
          familyId,
          receipt.id.replace('merge-story-served:', ''),
          receipt.createdAt,
        ));
      }
      return;
    }
    if (receipt.kind === 'friendship') {
      const currentBond = loadCompanionBondState();
      const beforeLevel = companionFriendshipProgress(currentBond, companionIdForFamily(receipt.characterId)).level;
      const awarded = recordCompanionBondEvent(currentBond, {
        id: receipt.id,
        creatureId: companionIdForFamily(receipt.characterId),
        kind: 'merge_order_completed',
        points: receipt.amount,
        occurredAt: receipt.createdAt,
      }, { queueCelebration: receipt.presentation !== 'quiet_summary' });
      if (awarded.awarded) {
        saveCompanionBondState(awarded.state);
        if (receipt.presentation === 'quiet_summary' && receipt.characterId === 'feastle') {
          guardStoryReceiptMutation(() => recordFeastleQuietBond(receipt.id, receipt.amount, receipt.createdAt));
        } else if (receipt.presentation === 'quiet_summary' && receipt.characterId === 'mossprout') {
          guardStoryReceiptMutation(() => recordMossproutQuietBond(receipt.id, receipt.amount, receipt.createdAt));
        } else if (receipt.presentation === 'quiet_summary' && isAuthoredCohortFamily(receipt.characterId)) {
          const familyId = receipt.characterId;
          guardStoryReceiptMutation(() => recordAuthoredCohortQuietBond(familyId, receipt.id, receipt.amount, receipt.createdAt));
        }
        const afterLevel = companionFriendshipProgress(awarded.state, companionIdForFamily(receipt.characterId)).level;
        for (let level = beforeLevel + 1; level <= afterLevel; level += 1) {
          if (!SIGNATURE_LEVELS.has(level)) enqueueFriendshipInvitation(receipt.characterId, `friendship-level:${level}`, receipt.createdAt);
        }
      }
      return;
    }
    if (receipt.kind === 'conversation' && receipt.sourceId) {
      enqueueFriendshipInvitation(receipt.characterId, receipt.sourceId, receipt.createdAt);
      return;
    }
    if (receipt.wispId) wisps.grant(receipt.wispId, receipt.id, 'game');
  }, [enqueueFriendshipInvitation, guardStoryReceiptMutation, wisps]);

  const reconcileFeastleStory = useCallback((current: MergeWorldState, now = Date.now()) => {
    const story = loadFeastleStory();
    const result = reduceMergeWorld(current, {
      type: 'reconcileStory', familyId: 'feastle', status: story.status,
      targetLevel: story.targetLevel, actPhase: story.actPhase,
      orderTemplateKeys: story.orderDeck?.templateKeys,
      servedOrderIds: story.orderDeck?.servedOrderIds,
      now,
    });
    const storyOrder = result.state.activeOrders.find((order) => order.storyArcId === story.id);
    const activeStoryOrderStillExists = result.state.activeOrders.some((order) => order.id === story.activeOrderId);
    if (storyOrder && !activeStoryOrderStillExists) markFeastleOrderActive(storyOrder.id, now);
    return result.state;
  }, []);

  const reconcileMossproutStory = useCallback((current: MergeWorldState, now = Date.now()) => {
    const story = loadMossproutStory();
    const result = reduceMergeWorld(current, {
      type: 'reconcileStory', familyId: 'mossprout', status: story.status,
      targetLevel: story.targetLevel, actPhase: story.actPhase, now,
    });
    const storyOrder = result.state.activeOrders.find((order) => order.storyArcId === 'mossprout:merge-story');
    const activeStoryOrderStillExists = result.state.activeOrders.some((order) => order.id === story.activeOrderId);
    if (storyOrder && !activeStoryOrderStillExists) markMossproutOrderActive(storyOrder.id, now);
    return result.state;
  }, []);

  const reconcileAuthoredCohortStory = useCallback((current: MergeWorldState, familyId: AuthoredCohortFamilyId, now = Date.now()) => {
    const story = loadAuthoredCohortStory(familyId);
    const result = reduceMergeWorld(current, {
      type: 'reconcileStory', familyId, status: story.status,
      targetLevel: story.targetLevel, actPhase: story.actPhase,
      orderTemplateKeys: story.orderDeck?.templateKeys,
      servedOrderIds: story.orderDeck?.servedOrderIds,
      now,
    });
    const storyOrder = result.state.activeOrders.find((order) => order.storyArcId === story.id);
    const activeStoryOrderStillExists = result.state.activeOrders.some((order) => order.id === story.activeOrderId);
    if (storyOrder && !activeStoryOrderStillExists) markAuthoredCohortOrderActive(familyId, storyOrder.id, now);
    return result.state;
  }, []);

  const resolveFeaturedCharacter = useCallback((current: MergeWorldState) => {
    if (featuredCharacterId && current.unlockedCharacters.includes(featuredCharacterId)) return featuredCharacterId;
    if (current.unlockedCharacters.includes('feastle')) return 'feastle';
    return current.unlockedCharacters[0] ?? null;
  }, [featuredCharacterId]);

  const reconcileFeaturedStory = useCallback((current: MergeWorldState, characterId: MergeCharacterId, now = Date.now()) => {
    if (
      characterId === 'mossprout'
      && loadFirstSession()?.stage !== 'complete'
      && (isMossproutChapterZeroActive(current)
        || current.characterProgress.mossprout?.completedChapterIds.includes('mossprout-chapter-0'))
    ) return current;
    if (characterId === 'feastle') return reconcileFeastleStory(current, now);
    if (characterId === 'mossprout') return reconcileMossproutStory(current, now);
    if (isAuthoredCohortFamily(characterId)) return reconcileAuthoredCohortStory(current, characterId, now);
    const served = new Set(current.externalRewardReceipts
      .filter((receipt) => receipt.kind === 'story_order_served' && receipt.characterId === characterId)
      .map((receipt) => receipt.id.replace('merge-story-served:', '')));
    const regularKeys = Array.from({ length: 5 }, (_, index) => `chapter-1-${index + 1}`);
    const regularIds = regularKeys.map((key) => `merge-story:${characterId}:regular:${key}`);
    const signatureId = `merge-story:${characterId}:level-8:signature`;
    const command: Extract<MergeWorldCommand, { type: 'reconcileStory' }> = served.has(signatureId)
      ? { type: 'reconcileStory', familyId: characterId, status: 'complete', targetLevel: 8, now }
      : regularIds.every((id) => served.has(id))
        ? { type: 'reconcileStory', familyId: characterId, status: 'order_active', targetLevel: 8, actPhase: 'signature_order', servedOrderIds: [...served], now }
        : { type: 'reconcileStory', familyId: characterId, status: 'order_active', targetLevel: 6, actPhase: 'regular_orders', orderTemplateKeys: regularKeys, servedOrderIds: [...served], now };
    return reduceMergeWorld(current, command).state;
  }, [reconcileAuthoredCohortStory, reconcileFeastleStory, reconcileMossproutStory]);

  const featureAndReconcile = useCallback((current: MergeWorldState, now = Date.now()) => {
    if (loadFirstSession()?.stage !== 'complete' && isMossproutChapterZeroActive(current)) {
      const featured = reduceMergeWorld(current, { type: 'featureCharacter', characterId: 'mossprout', now }).state;
      const chapterZeroOrders = featured.activeOrders.filter((order) => order.id.startsWith('mossprout:chapter-0:'));
      return chapterZeroOrders.length === featured.activeOrders.length
        ? featured
        : { ...featured, activeOrders: chapterZeroOrders };
    }
    const characterId = resolveFeaturedCharacter(current);
    if (!characterId) return current;
    let next = reduceMergeWorld(current, { type: 'featureCharacter', characterId, now }).state;

    // Rebuild every persisted authored slice, not only the deeplink target.
    // This also repairs saves from older builds where featureCharacter removed
    // the other companions' requests.
    if (next.unlockedCharacters.includes('feastle')) next = reconcileFeastleStory(next, now);
    if (next.unlockedCharacters.includes('mossprout')) next = reconcileMossproutStory(next, now);
    for (const familyId of AUTHORED_COHORT_FAMILIES) {
      if (next.unlockedCharacters.includes(familyId)) next = reconcileAuthoredCohortStory(next, familyId, now);
    }
    if (characterId !== 'feastle' && characterId !== 'mossprout' && !isAuthoredCohortFamily(characterId)) {
      next = reconcileFeaturedStory(next, characterId, now);
    }
    return next;
  }, [reconcileAuthoredCohortStory, reconcileFeastleStory, reconcileFeaturedStory, reconcileMossproutStory, resolveFeaturedCharacter]);

  useEffect(() => {
    // Tab routes are retained while unfocused. Keep this authoritative reset
    // subscription alive for the lifetime of the provider so a debug reset or
    // FTUE board install cannot be missed while Games is hidden. Otherwise the
    // retained stateRef prevents initial hydration when the tab is reopened.
    const release = acquireLifecycleResource('store_subscription', 'merge:world-resets');
    const unsubscribe = subscribeMergeWorldResets((freshState) => {
      if (!mountedRef.current) return;
      persistenceGenerationRef.current += 1;
      externalGenerationRef.current += 1;
      pendingPersistenceRef.current = null;
      persistenceWorkerRef.current = null;
      externalWorkerRef.current = null;
      const reconciledState = featureAndReconcile(freshState);
      stateRef.current = reconciledState;
      setState(reconciledState);
      setLastResult(null);
      setError(null);
      setLoading(false);
      refreshFriendshipLevels();
    });
    return () => {
      unsubscribe();
      release();
    };
  }, [featureAndReconcile, refreshFriendshipLevels]);

  useEffect(() => {
    // Today can award Merge Energy while this retained tab is unfocused. Adopt
    // newer repository snapshots immediately and invalidate any stale buffered
    // write so reopening Games cannot overwrite or hide that reward.
    const release = acquireLifecycleResource('store_subscription', 'merge:world-snapshots');
    const unsubscribe = subscribeMergeWorldSnapshots((freshState) => {
      if (!mountedRef.current || freshState.revision <= (stateRef.current?.revision ?? -1)) return;
      persistenceGenerationRef.current += 1;
      pendingPersistenceRef.current = null;
      persistenceWorkerRef.current = null;
      stateRef.current = freshState;
      setState(freshState);
      setLastResult(null);
      setError(null);
      setLoading(false);
    });
    return () => {
      unsubscribe();
      release();
    };
  }, []);

  const drainPersistence = useCallback(async () => {
    const workerGeneration = persistenceGenerationRef.current;
    while (pendingPersistenceRef.current) {
      if (workerGeneration !== persistenceGenerationRef.current) return;
      const pending = pendingPersistenceRef.current;
      pendingPersistenceRef.current = null;
      let saved = false;
      let caughtError: unknown = null;
      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
        if (workerGeneration !== persistenceGenerationRef.current) return;
        try {
          const startedAt = MERGE_PERF_ENABLED ? performance.now() : 0;
          await saveMergeWorldState(pending.state, [...pending.receiptIds]);
          if (workerGeneration !== persistenceGenerationRef.current) return;
          if (MERGE_PERF_ENABLED) console.info('[merge-persistence]', {
            coalescedCommands: pending.coalescedCommands,
            durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
            receiptCount: pending.receiptIds.size,
            revision: pending.state.revision,
          });
          saved = true;
          break;
        } catch (caught) {
          caughtError = caught;
          if (attempt < RETRY_DELAYS_MS.length) await delay(RETRY_DELAYS_MS[attempt]);
        }
      }
      if (saved) {
        if (mountedRef.current) setError(null);
        continue;
      }
      pendingPersistenceRef.current = mergeWorldPendingPersistence(
        pendingPersistenceRef.current,
        pending.state,
        [...pending.receiptIds],
      );
      if (mountedRef.current) setError(caughtError instanceof Error ? caughtError.message : 'Progress could not be saved.');
      break;
    }
  }, []);

  const startPersistenceWorker = useCallback(() => {
    if (!persistenceWorkerRef.current) {
      const release = acquireLifecycleResource('repository_worker', 'merge:persistence');
      const worker = drainPersistence();
      persistenceWorkerRef.current = worker;
      void worker.finally(() => {
        release();
        if (persistenceWorkerRef.current === worker) persistenceWorkerRef.current = null;
      });
    }
    return persistenceWorkerRef.current;
  }, [drainPersistence]);

  const enqueuePersistence = useCallback((next: MergeWorldState, receiptIds: readonly string[] = []) => {
    pendingPersistenceRef.current = mergeWorldPendingPersistence(pendingPersistenceRef.current, next, receiptIds);
    void startPersistenceWorker();
  }, [startPersistenceWorker]);

  useEffect(() => {
    if (!active) return;
    const release = acquireLifecycleResource('store_subscription', 'merge:companion-bond');
    const unsubscribe = subscribeCompanionBondState(() => {
      if (!activeRef.current) return;
      const current = stateRef.current;
      if (!current) return;
      const levels = refreshFriendshipLevels();
      const result = reduceMergeWorld(current, { type: 'reconcileFriendship', levels, now: Date.now() });
      if (!result.changed) return;
      stateRef.current = result.state;
      if (mountedRef.current) setState(result.state);
      enqueuePersistence(result.state);
    });
    return () => {
      unsubscribe();
      release();
    };
  }, [active, enqueuePersistence, refreshFriendshipLevels]);

  useEffect(() => {
    if (!active) return;
    const release = acquireLifecycleResource('store_subscription', 'merge:companion-stories');
    const unsubscribe = subscribeCompanionStories(() => {
      if (!activeRef.current || applyingStoryReceiptDepthRef.current > 0) return;
      const current = stateRef.current;
      if (!current) return;
      const featured = current.favouriteCharacterId;
      if (!featured || (featured !== 'feastle' && featured !== 'mossprout' && !isAuthoredCohortFamily(featured))) return;
      const next = featured === 'feastle'
        ? reconcileFeastleStory(current)
        : featured === 'mossprout'
          ? reconcileMossproutStory(current)
          : reconcileAuthoredCohortStory(current, featured);
      if (next === current) return;
      stateRef.current = next;
      if (mountedRef.current) setState(next);
      enqueuePersistence(next);
    });
    return () => {
      unsubscribe();
      release();
    };
  }, [active, enqueuePersistence, reconcileAuthoredCohortStory, reconcileFeastleStory, reconcileMossproutStory]);

  const flush = useCallback(async () => {
    const worker = startPersistenceWorker();
    if (worker) await worker;
  }, [startPersistenceWorker]);

  useEffect(() => {
    if (active) return;
    // Stop reward-side-effect work immediately. Persistence is allowed to
    // finish the current coalesced flush, then the retained provider is inert.
    externalGenerationRef.current += 1;
    void flush();
  }, [active, flush]);

  const applyPendingExternalRewards = useCallback(() => {
    if (externalWorkerRef.current) return externalWorkerRef.current;
    const worker = (async () => {
      const workerGeneration = externalGenerationRef.current;
      let appliedAny = false;
      while (true) {
        if (workerGeneration !== externalGenerationRef.current) return;
        await flush();
        if (workerGeneration !== externalGenerationRef.current) return;
        if (pendingPersistenceRef.current) break;
        const pending = stateRef.current?.externalRewardReceipts.filter((receipt) => receipt.appliedAt == null) ?? [];
        if (!pending.length) break;
        for (const receipt of pending) {
          if (workerGeneration !== externalGenerationRef.current) return;
          applyReceiptSideEffect(receipt);
          const current = stateRef.current;
          if (!current) continue;
          const result = reduceMergeWorld(current, { type: 'ackExternalReward', receiptId: receipt.id, now: Date.now() });
          if (!result.changed) continue;
          stateRef.current = result.state;
          if (mountedRef.current) setState(result.state);
          enqueuePersistence(result.state, [receipt.id]);
          appliedAny = true;
        }
      }
      if (appliedAny) {
        const levels = refreshFriendshipLevels();
        const current = stateRef.current;
        if (current) {
          const friendshipState = reduceMergeWorld(current, { type: 'reconcileFriendship', levels, now: Date.now() }).state;
          // Story storage notifications are guarded while receipt side effects
          // are applied. Reconcile explicitly after the whole batch so a
          // midpoint note and every unserved request appear atomically.
          const reconciled = featureAndReconcile(friendshipState);
          if (reconciled !== current) {
            stateRef.current = reconciled;
            if (mountedRef.current) setState(reconciled);
            enqueuePersistence(reconciled);
          }
        }
      }
    })().catch((caught) => {
      if (mountedRef.current && activeRef.current) setError(caught instanceof Error ? caught.message : 'Merge rewards could not be applied.');
    });
    const release = acquireLifecycleResource('repository_worker', 'merge:external-rewards');
    externalWorkerRef.current = worker;
    void worker.finally(() => {
      release();
      if (externalWorkerRef.current === worker) externalWorkerRef.current = null;
    });
    return worker;
  }, [applyReceiptSideEffect, enqueuePersistence, featureAndReconcile, flush, refreshFriendshipLevels]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      void flush();
    };
  }, [flush]);

  useEffect(() => {
    if (!active || stateRef.current) return;
    let cancelled = false;
    const release = acquireLifecycleResource('repository_worker', 'merge:initial-hydration');
    const worker = (async () => {
      try {
        let next = await loadMergeWorldState();
        if (cancelled || !activeRef.current) return;
        next = reduceMergeWorld(next, { type: 'reconcileCharacters', characterIds, now: Date.now() }).state;
        next = featureAndReconcile(next);
        const rewards = [...mergeActivityRewards(days, new Date(), { state: next, quickGoals: loadCompanionQuickGoalState() }), ...mergeQuestActivityRewards(questState)];
        const activityResult = reduceMergeWorld(next, { type: 'grantActivityRewardsBatch', rewards, now: Date.now() });
        next = activityResult.state;
        await saveMergeWorldState(next);
        if (cancelled || !activeRef.current) return;
        const appliedIds: string[] = [];
        for (const receipt of next.externalRewardReceipts.filter((item) => item.appliedAt == null)) {
          applyReceiptSideEffect(receipt);
          next = reduceMergeWorld(next, { type: 'ackExternalReward', receiptId: receipt.id, now: Date.now() }).state;
          appliedIds.push(receipt.id);
        }
        const levels = currentFriendshipLevels();
        const beforeFriendshipReconcile = next;
        next = reduceMergeWorld(next, { type: 'reconcileFriendship', levels, now: Date.now() }).state;
        // Applying a pending served-order receipt may have advanced Feastle to
        // a midpoint return. Repair the Merge projection before first paint.
        next = featureAndReconcile(next);
        if (appliedIds.length || next !== beforeFriendshipReconcile) await saveMergeWorldState(next, appliedIds);
        if (!cancelled && activeRef.current) {
          stateRef.current = next;
          setState(next);
          setFriendshipLevels(levels);
          if (activityResult.changed) setLastResult({ ...activityResult, state: next });
          setLoading(false);
        }
      } catch (caught) {
        if (!cancelled && activeRef.current) {
          setError(caught instanceof Error ? caught.message : 'Merge World could not be loaded.');
          setLoading(false);
        }
      }
    })();
    void worker.finally(release);
    return () => {
      cancelled = true;
    };
    // Initial hydration owns the full activity projection. Later changes use
    // the lightweight batch reconciliation effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const release = acquireLifecycleResource('app_state_listener', 'merge:app-state');
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') void flush();
    });
    return () => {
      subscription.remove();
      release();
    };
  }, [active, flush]);

  useEffect(() => {
    if (!active || loading) return;
    const current = stateRef.current;
    if (!current) return;
    const now = Date.now();
    let next = reduceMergeWorld(current, { type: 'reconcileCharacters', characterIds, now }).state;
    const levels = refreshFriendshipLevels();
    next = reduceMergeWorld(next, { type: 'reconcileFriendship', levels, now }).state;
    next = featureAndReconcile(next, now);
    const rewards = [...mergeActivityRewards(days, new Date(now), { state: next, quickGoals: loadCompanionQuickGoalState() }), ...mergeQuestActivityRewards(questState)];
    const activityResult = reduceMergeWorld(next, { type: 'grantActivityRewardsBatch', rewards, now });
    next = activityResult.state;
    if (next === current) return;
    stateRef.current = next;
    setState(next);
    if (activityResult.changed) setLastResult(activityResult);
    enqueuePersistence(next);
  }, [active, characterIds, days, enqueuePersistence, featureAndReconcile, loading, questState, quickGoalRevision, refreshFriendshipLevels]);

  const dispatch = useCallback((command: MergeWorldCommand): MergeWorldCommandResult | null => {
    if (!activeRef.current) return null;
    const current = stateRef.current;
    if (!current) return null;
    const servedCharacterId = command.type === 'serveOrder'
      ? current.activeOrders.find((order) => order.id === command.orderId)?.characterId ?? null
      : null;
    const reduced = reduceMergeWorld(current, command);
    const nextState = reduced.changed && servedCharacterId
      ? reconcileFeaturedStory(reduced.state, servedCharacterId, command.now)
      : reduced.state;
    const result = nextState === reduced.state ? reduced : { ...reduced, state: nextState };
    setLastResult(result);
    if (!result.changed) return result;
    const receiptIds = changedReceiptIds(current, result.state);
    stateRef.current = result.state;
    setState(result.state);
    setError(null);
    enqueuePersistence(result.state, receiptIds);
    if (result.state.externalRewardReceipts.some((receipt) => receipt.appliedAt == null)) {
      void applyPendingExternalRewards();
    }
    return result;
  }, [applyPendingExternalRewards, enqueuePersistence, reconcileFeaturedStory]);

  const value = useMemo<MergeWorldContextValue>(() => ({ state, loading, error, lastResult, friendshipLevels, dispatch, flush }), [dispatch, error, flush, friendshipLevels, lastResult, loading, state]);
  return <MergeWorldContext value={value}>{children}</MergeWorldContext>;
}

export function useMergeWorld() {
  const value = use(MergeWorldContext);
  if (!value) throw new Error('useMergeWorld must be used inside MergeWorldProvider.');
  return value;
}
