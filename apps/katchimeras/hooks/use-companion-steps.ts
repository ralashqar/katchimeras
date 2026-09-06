import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { homeRepository } from '@/storage/repositories/home-repository';
import { localDayId } from '@/utils/world-identity';

function savedSteps(dayId: string) {
  const home = homeRepository.load();
  const day = home && [home.today, ...home.archivedDays].find((item) => (item.stepsCountDayId ?? item.isoDate) === dayId);
  return Math.max(0, day?.stepsCount ?? 0);
}

/** Read existing permission only: displaying a companion never prompts for access. */
export function useCompanionSteps() {
  const [reading, setReading] = useState(() => ({ dayId: localDayId(), steps: savedSteps(localDayId()), available: false }));
  const mounted = useRef(false);
  const syncing = useRef(false);
  const refresh = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    const dayId = localDayId();
    let steps = savedSteps(dayId);
    let available = false;
    try {
      if (await Pedometer.isAvailableAsync()) {
        const permission = await Pedometer.getPermissionsAsync();
        if (permission.granted) {
          const start = new Date(); start.setHours(0, 0, 0, 0);
          const result = await Pedometer.getStepCountAsync(start, new Date());
          if (Number.isFinite(result.steps)) {
            steps = Math.max(steps, result.steps);
            available = true;
          }
        }
      }
    } catch { /* Retain saved progress; hide live counters when tracking cannot be read. */ }
    finally {
      if (mounted.current) {
        const currentDay = localDayId();
        setReading((old) => currentDay === dayId
          ? { dayId, steps: Math.max(steps, old.dayId === dayId ? old.steps : 0), available }
          : { dayId: currentDay, steps: savedSteps(currentDay), available: false });
      }
      syncing.current = false;
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const home = homeRepository.subscribe(() => { void refresh(); });
    const app = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 30000);
    return () => { mounted.current = false; home(); app.remove(); clearInterval(timer); };
  }, [refresh]);
  return { ...reading, refresh };
}
