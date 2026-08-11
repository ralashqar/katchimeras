import { createContext, type PropsWithChildren, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useWisps } from '@/features/wisps/wisp-provider';
import type { HomeDayRecord } from '@/types/home';
import type { MergeWorldCommand, MergeWorldCommandResult, MergeWorldState } from '@/types/merge-world';
import type { MergeCharacterId } from '@/types/merge-world';
import { companionIdForFamily } from '@/constants/katchimera-skins';
import { mergeActivityRewards, mergeQuestActivityRewards } from '@/utils/merge-world/activity-rewards';
import { reduceMergeWorld } from '@/utils/merge-world/engine';
import { loadMergeWorldState, saveMergeWorldState } from '@/utils/merge-world/repository';
import { companionFriendshipProgress, recordCompanionBondEvent } from '@/utils/companion-bond';
import { loadCompanionBondState, saveCompanionBondState } from '@/utils/companion-bond-storage';
import type { CompanionQuestState } from '@/utils/katchimera-quests';

type MergeWorldContextValue = {
  state: MergeWorldState | null;
  loading: boolean;
  error: string | null;
  lastResult: MergeWorldCommandResult | null;
  friendshipLevels: Partial<Record<MergeCharacterId, number>>;
  send: (command: MergeWorldCommand) => Promise<MergeWorldCommandResult | null>;
};

const MergeWorldContext = createContext<MergeWorldContextValue | null>(null);

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
  stateRef.current = state;
  const queue = useRef(Promise.resolve());

  const refreshFriendshipLevels = useCallback(() => {
    const bond = loadCompanionBondState();
    const ids: MergeCharacterId[] = ['feastle', 'mossprout', 'steppling', 'shellio', 'voyagle'];
    setFriendshipLevels(Object.fromEntries(ids.map((id) => [id, companionFriendshipProgress(bond, companionIdForFamily(id)).level])));
  }, []);

  const applyExternalRewards = useCallback(async (input: MergeWorldState) => {
    let next = input;
    for (const receipt of input.externalRewardReceipts.filter((item) => item.appliedAt == null)) {
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
      } else if (receipt.wispId) {
        wisps.grant(receipt.wispId, receipt.id, 'game');
      }
      next = reduceMergeWorld(next, { type: 'ackExternalReward', receiptId: receipt.id, now: Date.now() }).state;
    }
    refreshFriendshipLevels();
    return next;
  }, [refreshFriendshipLevels, wisps]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        let next = await loadMergeWorldState();
        next = reduceMergeWorld(next, { type: 'reconcileCharacters', characterIds, now: Date.now() }).state;
        for (const reward of [...mergeActivityRewards(days), ...mergeQuestActivityRewards(questState)]) {
          next = reduceMergeWorld(next, {
            type: 'grantActivityEnergy', receiptId: reward.receiptId, amount: reward.amount, now: Date.now(),
          }).state;
        }
        // Persist the authoritative board and pending outbox before applying
        // any cross-system reward. A crash can then only leave replayable work,
        // never an awarded receipt paired with an unconsumed order.
        await saveMergeWorldState(next);
        next = await applyExternalRewards(next);
        await saveMergeWorldState(next);
        if (!cancelled) {
          stateRef.current = next;
          setState(next);
          setLoading(false);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Merge World could not be loaded.');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
    // Initial hydration intentionally owns the bulk activity projection. Later
    // focus changes are reconciled by the lightweight effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!stateRef.current) return;
    const now = Date.now();
    let next = reduceMergeWorld(stateRef.current, { type: 'reconcileCharacters', characterIds, now }).state;
    for (const reward of [...mergeActivityRewards(days), ...mergeQuestActivityRewards(questState)]) {
      next = reduceMergeWorld(next, { type: 'grantActivityEnergy', receiptId: reward.receiptId, amount: reward.amount, now }).state;
    }
    if (next === stateRef.current) return;
    stateRef.current = next;
    setState(next);
    void saveMergeWorldState(next).catch((caught) => setError(caught instanceof Error ? caught.message : 'Progress could not be saved.'));
  }, [characterIds, days, questState]);

  const send = useCallback((command: MergeWorldCommand) => new Promise<MergeWorldCommandResult | null>((resolve) => {
    queue.current = queue.current.then(async () => {
      const current = stateRef.current;
      if (!current) {
        resolve(null);
        return;
      }
      try {
        const result = reduceMergeWorld(current, command);
        let next = result.state;
        if (result.changed) {
          await saveMergeWorldState(next);
          next = await applyExternalRewards(next);
          await saveMergeWorldState(next);
          stateRef.current = next;
          setState(next);
        }
        const resolved = next === result.state ? result : { ...result, state: next };
        setLastResult(resolved);
        setError(null);
        resolve(resolved);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Progress could not be saved.');
        resolve(null);
      }
    });
  }), [applyExternalRewards]);

  const value = useMemo<MergeWorldContextValue>(() => ({ state, loading, error, lastResult, friendshipLevels, send }), [error, friendshipLevels, lastResult, loading, send, state]);
  return <MergeWorldContext value={value}>{children}</MergeWorldContext>;
}

export function useMergeWorld() {
  const value = use(MergeWorldContext);
  if (!value) throw new Error('useMergeWorld must be used inside MergeWorldProvider.');
  return value;
}
