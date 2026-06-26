import { useEffect, useMemo, useRef, useState } from 'react';

import type { HomeDayRecord } from '@/types/home';
import type { DiscoveryCategory, DiscoveryDef, DiscoveryRecord, DiscoveryState } from '@/types/discoveries';
import { DISCOVERY_CATALOG } from '@/utils/discoveries-catalog';
import { buildDiscoveryContext } from '@/utils/discoveries-context';
import { evaluateDiscoveries } from '@/utils/discoveries-engine';
import { loadDiscoveryState, markAnimationSeen, recordUnlocks, saveDiscoveryState } from '@/utils/discoveries-storage';
import { useAllDays } from '@/hooks/use-all-days';

export type DiscoveryEntry = { def: DiscoveryDef; record: DiscoveryRecord | null };
export type DiscoveryCategoryCount = { category: DiscoveryCategory; unlocked: number; total: number };

// Best-effort "which day earned this" for the Hall deep-link — the most recent day
// carrying the category's signal. Not exact (a threshold spans many days) but a
// sensible anchor. Days are scanned newest-first by isoDate.
function hasSignal(category: DiscoveryCategory, day: HomeDayRecord): boolean {
  switch (category) {
    case 'exploration':
      return (day.confirmedPlaces?.length ?? 0) > 0;
    case 'memory':
      return (day.capturedMeanings?.length ?? 0) > 0 || !!day.heroPhoto || (day.notes?.length ?? 0) > 0 || (day.foodMoments?.length ?? 0) > 0;
    case 'life':
      return (day.bigMoments?.length ?? 0) > 0;
    case 'journey':
      return (day.stepsCount ?? 0) > 0 || (day.moments ?? []).some((m) => m.type === 'walk');
    case 'reflection':
      return (day.promptAnswers ?? []).some((a) => !a.dismissed);
    case 'world':
      return day.state === 'hatched';
    default:
      return false;
  }
}

function resolveSourceDayId(category: DiscoveryCategory, days: HomeDayRecord[]): string | undefined {
  for (let i = days.length - 1; i >= 0; i -= 1) {
    if (hasSignal(category, days[i])) return days[i].id;
  }
  return undefined;
}

// The Discoveries hook: evaluates the catalog against all of history whenever the
// archive changes, persists newly-unlocked records, and exposes the merged
// collection + the celebration queue.
//
// Baseline rule: the FIRST evaluation on an install silently backfills everything
// already earned (seenAnimation:true) + surfaces ONE quiet summary; only unlocks
// AFTER baseline celebrate (seenAnimation:false → `pending`).
export function useDiscoveries() {
  const { days, getDayById } = useAllDays();
  const [state, setState] = useState<DiscoveryState>(() => loadDiscoveryState());
  // The one-time "N discoveries from your past" notice count (transient; 0 = none).
  const [backfillCount, setBackfillCount] = useState(0);
  // Mirror so the eval effect reads the freshest state without re-running on every
  // state change (it should only run when the day archive changes).
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const now = new Date();
    const ctx = buildDiscoveryContext(days, now);
    const prev = stateRef.current;
    const { newlyUnlocked } = evaluateDiscoveries(ctx, prev.unlocked);
    if (newlyUnlocked.length === 0 && prev.baselined) return;

    const silent = !prev.baselined; // baseline pass → no celebrations
    const records: DiscoveryRecord[] = newlyUnlocked.map((def) => ({
      id: def.id,
      unlockedAt: now.getTime(),
      sourcePatchId: resolveSourceDayId(def.category, days),
      sourceMomentIds: [],
      seenAnimation: silent,
    }));
    const next: DiscoveryState = { ...recordUnlocks(prev, records), version: 1, baselined: true };
    saveDiscoveryState(next);
    setState(next);
    if (silent && records.length > 0) setBackfillCount(records.length);
  }, [days]);

  const entries = useMemo<DiscoveryEntry[]>(
    () => DISCOVERY_CATALOG.map((def) => ({ def, record: state.unlocked[def.id] ?? null })),
    [state]
  );

  const unlockedCount = useMemo(() => Object.keys(state.unlocked).length, [state]);
  const totalCount = DISCOVERY_CATALOG.length;

  const countsByCategory = useMemo<DiscoveryCategoryCount[]>(() => {
    const order: DiscoveryCategory[] = ['exploration', 'memory', 'life', 'journey', 'reflection', 'world'];
    return order.map((category) => {
      const defs = entries.filter((entry) => entry.def.category === category);
      return { category, unlocked: defs.filter((entry) => entry.record).length, total: defs.length };
    });
  }, [entries]);

  // Unlocked-but-not-yet-celebrated (drives the Phase 2 reveal; empty in Phase 1).
  const pending = useMemo<DiscoveryDef[]>(
    () => entries.filter((entry) => entry.record && !entry.record.seenAnimation).map((entry) => entry.def),
    [entries]
  );

  const markSeen = (id: string) =>
    setState((prev) => {
      const next = markAnimationSeen(prev, id);
      if (next !== prev) saveDiscoveryState(next);
      return next;
    });

  const dismissBackfillNotice = () => setBackfillCount(0);

  return {
    entries,
    unlockedCount,
    totalCount,
    countsByCategory,
    pending,
    backfillCount,
    dismissBackfillNotice,
    markSeen,
    getDayById,
  };
}
