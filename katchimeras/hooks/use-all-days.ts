import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';

import type { HomeDayRecord } from '@/types/home';
import { hydrateAllDays } from '@/game/days';
import { homeRepository } from '@/storage/repositories/home-repository';
import { loadOnboardingProfile } from '@/utils/onboarding-state';

// Module-level hydration cache: focus events fire constantly but the persisted
// state rarely changes between them — same raw JSON (and same calendar day, so
// day-rollover still refreshes) means the previous derivation is still valid.
// This also keeps the returned array REFERENCE stable, so downstream useMemos
// (observations, step averages) skip too.
let hydrationCache: { state: ReturnType<typeof homeRepository.load>; dayKey: string; days: HomeDayRecord[] } | null = null;

// Every persisted day hydrated to a HomeDayRecord — the data source for the
// calendar and the per-day journal, which (unlike the Home timeline) must be able
// to resolve any day in the archive. Re-reads on focus so a freshly hatched day
// shows up without a manual refresh.
export function useAllDays({
  refreshOnFocus = true,
}: {
  refreshOnFocus?: boolean;
} = {}) {
  const [version, setVersion] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!refreshOnFocus) return;
      setVersion((current) => current + 1);
    }, [refreshOnFocus])
  );

  // Manual re-read for consumers that mutate the day WITHOUT leaving the screen
  // (Today's inline adds) and need dependents (e.g. Discoveries) to see it now.
  const refresh = useCallback(() => setVersion((current) => current + 1), []);

  const days = useMemo(() => {
    const now = new Date();
    const stored = homeRepository.load();
    const dayKey = now.toDateString();
    if (hydrationCache && hydrationCache.state === stored && hydrationCache.dayKey === dayKey) {
      return hydrationCache.days;
    }
    const profile = loadOnboardingProfile();
    const days = hydrateAllDays(stored, profile, now);
    hydrationCache = { state: stored, dayKey, days };
    return days;
    // version bumps on focus to force a re-hydrate from storage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const byIsoDate = useMemo(() => {
    const map = new Map<string, HomeDayRecord>();
    for (const day of days) {
      map.set(day.isoDate, day);
    }
    return map;
  }, [days]);

  const getDayById = useCallback(
    (id: string | undefined | null): HomeDayRecord | null =>
      id ? days.find((day) => day.id === id) ?? null : null,
    [days]
  );

  return { days, byIsoDate, getDayById, refresh };
}
