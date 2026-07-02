import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';

import type { HomeDayRecord } from '@/types/home';
import { hydrateAllDays } from '@/utils/home-engine';
import { loadStoredHomeState } from '@/utils/home-storage';
import { loadOnboardingProfile } from '@/utils/onboarding-state';

// Every persisted day hydrated to a HomeDayRecord — the data source for the
// calendar and the per-day journal, which (unlike the Home timeline) must be able
// to resolve any day in the archive. Re-reads on focus so a freshly hatched day
// shows up without a manual refresh.
export function useAllDays() {
  const [version, setVersion] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setVersion((current) => current + 1);
    }, [])
  );

  // Manual re-read for consumers that mutate the day WITHOUT leaving the screen
  // (Today's inline adds) and need dependents (e.g. Discoveries) to see it now.
  const refresh = useCallback(() => setVersion((current) => current + 1), []);

  const days = useMemo(() => {
    const now = new Date();
    const profile = loadOnboardingProfile();
    return hydrateAllDays(loadStoredHomeState(), profile, now);
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
