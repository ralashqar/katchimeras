import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { COMPANION_ACHIEVEMENT_CATALOG } from '@/constants/companion-achievements';
import { useAllDays } from '@/hooks/use-all-days';
import type {
  CompanionAchievementDef,
  CompanionAchievementEntry,
  CompanionAchievementRecord,
  CompanionAchievementState,
} from '@/types/companion-achievements';
import { buildCompanionAchievementContexts } from '@/utils/companion-achievements-context';
import {
  companionAchievementEntries,
  evaluateCompanionAchievements,
} from '@/utils/companion-achievements-engine';
import {
  loadCompanionAchievementState,
  markCompanionAchievementSeen,
  recordCompanionAchievementUnlocks,
  saveCompanionAchievementState,
} from '@/utils/companion-achievements-storage';
import { loadCompanionBondState } from '@/utils/companion-bond-storage';
import { loadCompanionJourneyState } from '@/utils/companion-journey-storage';
import { loadCompanionQuickGoalState } from '@/utils/companion-quick-goal-storage';
import { loadCompanionQuests } from '@/utils/katchimera-quests';
import { loadDiscoveryState } from '@/utils/discoveries-storage';

const COMPANION_ACHIEVEMENT_CATALOG_VERSION = 2;

export function useCompanionAchievements() {
  const archive = useAllDays();
  const [state, setState] = useState<CompanionAchievementState>(loadCompanionAchievementState);
  const [backfillCount, setBackfillCount] = useState(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  const evaluate = useCallback(() => {
    const quests = loadCompanionQuests();
    const contexts = buildCompanionAchievementContexts({
      days: archive.days,
      quests,
      bond: loadCompanionBondState(quests),
      journey: loadCompanionJourneyState(),
      quickGoals: loadCompanionQuickGoalState(),
    });
    const previous = loadCompanionAchievementState();
    const catalogChanged = (previous.catalogVersion ?? 1) < COMPANION_ACHIEVEMENT_CATALOG_VERSION;
    const silent = !previous.baselined || previous.migratedFromV1 === true || catalogChanged;
    const legacyDiscoveries = loadDiscoveryState().unlocked;
    const now = Date.now();
    const records: CompanionAchievementRecord[] = [];
    for (const [familyId, context] of contexts) {
      const catalog = COMPANION_ACHIEVEMENT_CATALOG.filter((def) => def.familyId === familyId);
      for (const def of evaluateCompanionAchievements(context, previous.unlocked, catalog)) {
        const legacy = (def.legacyDiscoveryIds ?? [])
          .map((id) => legacyDiscoveries[id])
          .filter((record) => Boolean(record))
          .sort((a, b) => a.unlockedAt - b.unlockedAt)[0];
        records.push({
          id: def.id,
          earnedAt: legacy?.unlockedAt ?? now,
          sourceDayId: legacy?.sourcePatchId ?? context.sourceDayBySignal[def.metric.signal],
          seenCelebration: silent,
        });
      }
    }
    const next = {
      ...recordCompanionAchievementUnlocks(previous, records),
      version: 3 as const,
      baselined: true,
      migratedFromV1: false,
      catalogVersion: COMPANION_ACHIEVEMENT_CATALOG_VERSION,
    };
    if (records.length || !previous.baselined || catalogChanged) saveCompanionAchievementState(next);
    setState(next);
    if (silent && records.length) setBackfillCount(records.length);
  }, [archive.days]);

  useEffect(evaluate, [evaluate]);
  useFocusEffect(useCallback(() => {
    evaluate();
  }, [evaluate]));

  const contexts = useMemo(() => {
    const quests = loadCompanionQuests();
    return buildCompanionAchievementContexts({
      days: archive.days,
      quests,
      bond: loadCompanionBondState(quests),
      journey: loadCompanionJourneyState(),
      quickGoals: loadCompanionQuickGoalState(),
    });
  }, [archive.days, state]);

  const entriesForFamily = useCallback((familyId: string): CompanionAchievementEntry[] => {
    const context = contexts.get(familyId);
    if (!context) return [];
    return companionAchievementEntries(
      context,
      state.unlocked,
      COMPANION_ACHIEVEMENT_CATALOG.filter((def) => def.familyId === familyId)
    );
  }, [contexts, state.unlocked]);

  const pending = useMemo<CompanionAchievementDef[]>(() =>
    COMPANION_ACHIEVEMENT_CATALOG.filter((def) => {
      const record = state.unlocked[def.id];
      return record && !record.seenCelebration;
    }), [state.unlocked]);

  const markSeen = useCallback((ids: readonly string[]) => {
    setState((current) => {
      const next = markCompanionAchievementSeen(current, ids);
      if (next !== current) saveCompanionAchievementState(next);
      return next;
    });
  }, []);

  return {
    state,
    pending,
    backfillCount,
    dismissBackfill: () => setBackfillCount(0),
    entriesForFamily,
    markSeen,
    refresh: evaluate,
  };
}
