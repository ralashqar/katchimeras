import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { consumeDevProfileLaunchRoute, recoverInterruptedPlayerProfileRestore } from '@/utils/player-profile-snapshots';
import { reloadAfterProfileSnapshotChange } from '@/utils/player-profile-runtime';

export function DevProfileLaunchReconciler() {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    void recoverInterruptedPlayerProfileRestore().then((recovered) => {
      if (cancelled) return;
      if (recovered) {
        void reloadAfterProfileSnapshotChange();
        return;
      }
      const route = consumeDevProfileLaunchRoute();
      if (route) router.replace(route);
    });
    return () => { cancelled = true; };
  }, [router]);
  return null;
}
