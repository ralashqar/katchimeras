import { useEffect, useMemo } from 'react';

import { useDiscoveries } from '@/hooks/use-discoveries';
import type { HomeDayRecord } from '@/types/home';

const DISCOVERY_RARITY_ORDER: Record<string, number> = { legendary: 3, epic: 2, rare: 1, common: 0 };

function formingDaySignature(formingDay: HomeDayRecord | null) {
  return formingDay
    ? [
        formingDay.id,
        formingDay.moments.length,
        formingDay.promptAnswers?.length ?? 0,
        formingDay.capturedMeanings?.length ?? 0,
        formingDay.notes?.length ?? 0,
        formingDay.foodMoments?.length ?? 0,
        formingDay.studioMoments?.length ?? 0,
        formingDay.bigMoments?.length ?? 0,
        formingDay.confirmedPlaces?.length ?? 0,
        formingDay.stepsCount,
        formingDay.sleep?.quality ?? '',
        formingDay.heroPhoto ? 1 : 0,
      ].join('|')
    : null;
}

export function useDiscoveryRevealController(formingDay: HomeDayRecord | null) {
  const { pending, markSeen, refresh, unlockedCount, totalCount, backfillCount, dismissBackfillNotice } = useDiscoveries();
  const formingSignature = useMemo(() => formingDaySignature(formingDay), [formingDay]);

  useEffect(() => {
    if (formingSignature) refresh();
  }, [formingSignature, refresh]);

  const celebrateDiscovery = useMemo(
    () =>
      [...pending].sort(
        (a, b) => (DISCOVERY_RARITY_ORDER[b.rarity] ?? 0) - (DISCOVERY_RARITY_ORDER[a.rarity] ?? 0)
      )[0] ?? null,
    [pending]
  );

  return {
    celebrateDiscovery,
    markDiscoverySeen: markSeen,
    discoveryProgress: { unlocked: unlockedCount, total: totalCount },
    discoveryBackfillCount: backfillCount,
    dismissDiscoveryBackfill: dismissBackfillNotice,
  };
}
