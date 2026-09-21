import { useEffect } from 'react';
import { AppState } from 'react-native';
import { reconcileFriendWispRewards } from '@/features/wisps/friend-wisp-runtime';
import { subscribeCompanionBondState } from '@/utils/companion-bond-storage';
import { subscribeCompanionLifeActivities } from '@/utils/companion-life-activity-storage';

/**
 * Keeps friends' Wisp rewards in step with play. Every source of them (a daily task, a Bond award, an episode) already
 * writes the Bond ledger or the day's activities, so watching those two, plus launch and a return to the app (a new
 * day may have started), is enough. The reconcile itself decides what is owed; this only says "look again", once per
 * burst of changes, and after the writes that triggered it have finished.
 */
export function useFriendWispRewards() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const look = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        try { reconcileFriendWispRewards(); } catch { /* A gift that could not be given now is still owed, and is given on the next look. */ }
      }, 0);
    };
    look();
    const stops = [subscribeCompanionBondState(look), subscribeCompanionLifeActivities(look)];
    const app = AppState.addEventListener('change', (status) => { if (status === 'active') look(); });
    return () => { if (timer) clearTimeout(timer); stops.forEach((stop) => stop()); app.remove(); };
  }, []);
}
