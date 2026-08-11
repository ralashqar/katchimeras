import { createContext, type PropsWithChildren, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { companionIdForFamily } from '@/constants/katchimera-skins';
import { useWisps } from '@/features/wisps/wisp-provider';
import type { HomeDayRecord } from '@/types/home';
import type { MergeCharacterId, MergeExternalRewardReceipt, MergeWorldCommand, MergeWorldCommandResult, MergeWorldState } from '@/types/merge-world';
import { companionFriendshipProgress, recordCompanionBondEvent } from '@/utils/companion-bond';
import { loadCompanionBondState, saveCompanionBondState } from '@/utils/companion-bond-storage';
import type { CompanionQuestState } from '@/utils/katchimera-quests';
import { mergeActivityRewards, mergeQuestActivityRewards } from '@/utils/merge-world/activity-rewards';
import { reduceMergeWorld } from '@/utils/merge-world/engine';
import { mergeWorldPendingPersistence, type MergeWorldPendingPersistence } from '@/utils/merge-world/persistence-buffer';
import { loadMergeWorldState, saveMergeWorldState } from '@/utils/merge-world/repository';

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
  characterIds,
  days,
  questState,
  children,
}: PropsWithChildren<{ characterIds: string[]; days: readonly HomeDayRecord[]; questState: CompanionQuestState }>) {
  const wisps = useWisps();
  const [state, setState] = useState<MergeWorldState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<MergeWorldCommandResult | null>(null);
  const [friendshipLevels, setFriendshipLevels] = useState<Partial<Record<MergeCharacterId, number>>>({});
  const stateRef = useRef(state);
  const mountedRef = useRef(true);
  const pendingPersistenceRef = useRef<MergeWorldPendingPersistence | null>(null);
  const persistenceWorkerRef = useRef<Promise<void> | null>(null);
  const externalWorkerRef = useRef<Promise<void> | null>(null);
  stateRef.current = state;

  const refreshFriendshipLevels = useCallback(() => {
    const bond = loadCompanionBondState();
    const ids: MergeCharacterId[] = ['feastle', 'mossprout', 'steppling', 'shellio', 'voyagle'];
    if (mountedRef.current) setFriendshipLevels(Object.fromEntries(ids.map((id) => [id, companionFriendshipProgress(bond, companionIdForFamily(id)).level])));
  }, []);

  const applyReceiptSideEffect = useCallback((receipt: MergeExternalRewardReceipt) => {
    if (receipt.kind === 'friendship') {
      const currentBond = loadCompanionBondState();
      const awarded = recordCompanionBondEvent(currentBond, {
        id: receipt.id,
        creatureId: companionIdForFamily(receipt.characterId),
        kind: 'merge_order_completed',
        points: receipt.amount,
        occurredAt: receipt.createdAt,
      }, { queueCelebration: true });
      if (awarded.awarded) saveCompanionBondState(awarded.state);
      return;
    }
    if (receipt.wispId) wisps.grant(receipt.wispId, receipt.id, 'game');
  }, [wisps]);

  const drainPersistence = useCallback(async () => {
    while (pendingPersistenceRef.current) {
      const pending = pendingPersistenceRef.current;
      pendingPersistenceRef.current = null;
      let saved = false;
      let caughtError: unknown = null;
      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
        try {
          const startedAt = MERGE_PERF_ENABLED ? performance.now() : 0;
          await saveMergeWorldState(pending.state, [...pending.receiptIds]);
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
      const worker = drainPersistence();
      persistenceWorkerRef.current = worker;
      void worker.finally(() => {
        if (persistenceWorkerRef.current === worker) persistenceWorkerRef.current = null;
      });
    }
    return persistenceWorkerRef.current;
  }, [drainPersistence]);

  const enqueuePersistence = useCallback((next: MergeWorldState, receiptIds: readonly string[] = []) => {
    pendingPersistenceRef.current = mergeWorldPendingPersistence(pendingPersistenceRef.current, next, receiptIds);
    void startPersistenceWorker();
  }, [startPersistenceWorker]);

  const flush = useCallback(async () => {
    const worker = startPersistenceWorker();
    if (worker) await worker;
  }, [startPersistenceWorker]);

  const applyPendingExternalRewards = useCallback(() => {
    if (externalWorkerRef.current) return externalWorkerRef.current;
    const worker = (async () => {
      let appliedAny = false;
      while (true) {
        await flush();
        if (pendingPersistenceRef.current) break;
        const pending = stateRef.current?.externalRewardReceipts.filter((receipt) => receipt.appliedAt == null) ?? [];
        if (!pending.length) break;
        for (const receipt of pending) {
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
      if (appliedAny) refreshFriendshipLevels();
    })().catch((caught) => {
      if (mountedRef.current) setError(caught instanceof Error ? caught.message : 'Merge rewards could not be applied.');
    });
    externalWorkerRef.current = worker;
    void worker.finally(() => {
      if (externalWorkerRef.current === worker) externalWorkerRef.current = null;
    });
    return worker;
  }, [applyReceiptSideEffect, enqueuePersistence, flush, refreshFriendshipLevels]);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    void (async () => {
      try {
        let next = await loadMergeWorldState();
        next = reduceMergeWorld(next, { type: 'reconcileCharacters', characterIds, now: Date.now() }).state;
        const rewards = [...mergeActivityRewards(days), ...mergeQuestActivityRewards(questState)];
        next = reduceMergeWorld(next, { type: 'grantActivityEnergyBatch', rewards, now: Date.now() }).state;
        await saveMergeWorldState(next);
        const appliedIds: string[] = [];
        for (const receipt of next.externalRewardReceipts.filter((item) => item.appliedAt == null)) {
          applyReceiptSideEffect(receipt);
          next = reduceMergeWorld(next, { type: 'ackExternalReward', receiptId: receipt.id, now: Date.now() }).state;
          appliedIds.push(receipt.id);
        }
        if (appliedIds.length) await saveMergeWorldState(next, appliedIds);
        if (!cancelled) {
          stateRef.current = next;
          setState(next);
          refreshFriendshipLevels();
          setLoading(false);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Merge World could not be loaded.');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      mountedRef.current = false;
      void flush();
    };
    // Initial hydration owns the full activity projection. Later changes use
    // the lightweight batch reconciliation effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') void flush();
    });
    return () => subscription.remove();
  }, [flush]);

  useEffect(() => {
    const current = stateRef.current;
    if (!current) return;
    const now = Date.now();
    let next = reduceMergeWorld(current, { type: 'reconcileCharacters', characterIds, now }).state;
    const rewards = [...mergeActivityRewards(days), ...mergeQuestActivityRewards(questState)];
    next = reduceMergeWorld(next, { type: 'grantActivityEnergyBatch', rewards, now }).state;
    if (next === current) return;
    stateRef.current = next;
    setState(next);
    enqueuePersistence(next);
  }, [characterIds, days, enqueuePersistence, questState]);

  const dispatch = useCallback((command: MergeWorldCommand): MergeWorldCommandResult | null => {
    const current = stateRef.current;
    if (!current) return null;
    const result = reduceMergeWorld(current, command);
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
  }, [applyPendingExternalRewards, enqueuePersistence]);

  const value = useMemo<MergeWorldContextValue>(() => ({ state, loading, error, lastResult, friendshipLevels, dispatch, flush }), [dispatch, error, flush, friendshipLevels, lastResult, loading, state]);
  return <MergeWorldContext value={value}>{children}</MergeWorldContext>;
}

export function useMergeWorld() {
  const value = use(MergeWorldContext);
  if (!value) throw new Error('useMergeWorld must be used inside MergeWorldProvider.');
  return value;
}
