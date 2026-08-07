import { useCallback, useEffect, useState } from 'react';

import {
  streakRepository,
  type StreakCelebrationEvent,
} from '@/storage/repositories/streak-repository';
import type { StreakSnapshot } from '@/types/streak';
import {
  flushStreakOutbox,
  syncRepair,
  syncRepairDecline,
  trackStreakEvent,
} from '@/utils/streak-sync';

export function useStreak(): {
  celebration: StreakCelebrationEvent | null;
  declineRepair: (localDate: string) => void;
  dismissCelebration: () => void;
  refresh: () => void;
  markMilestoneSeen: (days: number) => void;
  repair: (localDate: string) => boolean;
  snapshot: StreakSnapshot;
} {
  const [snapshot, setSnapshot] = useState(() => streakRepository.snapshot());
  const [celebration, setCelebration] = useState<StreakCelebrationEvent | null>(null);

  useEffect(() => streakRepository.subscribe(() => setSnapshot(streakRepository.snapshot())), []);
  useEffect(() => streakRepository.subscribeCelebrations(setCelebration), []);
  useEffect(() => {
    const date = snapshot.repairableDate;
    if (!date || streakRepository.load().offeredRepairDates.includes(date)) return;
    streakRepository.markRepairOffered(date);
    void trackStreakEvent('streak_repair_offered', { local_date: date });
  }, [snapshot.repairableDate]);

  const dismissCelebration = useCallback(() => {
    if (!celebration) return;
    streakRepository.markCelebrated(celebration.localDate);
    setCelebration(null);
  }, [celebration]);

  const repair = useCallback((localDate: string) => {
    const repaired = streakRepository.repair(localDate);
    if (repaired) {
      void syncRepair(localDate);
      void trackStreakEvent('streak_repair_used', { local_date: localDate });
    }
    return repaired;
  }, []);

  const declineRepair = useCallback((localDate: string) => {
    streakRepository.declineRepair(localDate);
    void syncRepairDecline(localDate);
    void trackStreakEvent('streak_repair_declined', { local_date: localDate });
    void trackStreakEvent('streak_broken', { missed_date: localDate });
  }, []);

  const refresh = useCallback(() => {
    setSnapshot(streakRepository.snapshot());
    void flushStreakOutbox();
  }, []);

  return { celebration, declineRepair, dismissCelebration, markMilestoneSeen: streakRepository.markMilestoneSeen, refresh, repair, snapshot };
}
