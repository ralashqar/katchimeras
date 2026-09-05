import { usePreventRemove } from '@react-navigation/native';
import { useCallback, useEffect } from 'react';
import { BackHandler } from 'react-native';

import type { FtueRunState, FtueSurface } from './ftue-types';
import { ftueLocksSurfaceNavigation } from './ftue-navigation-policy';

/** Locks native back, swipe-to-dismiss, and route removal for an owned FTUE surface. */
export function useFtueNavigationLock(
  run: Pick<FtueRunState, 'status' | 'stepId'> | null,
  surface: FtueSurface,
  active = true,
): boolean {
  const locked = active && ftueLocksSurfaceNavigation(run, surface);
  const ignoreRemoval = useCallback(() => {}, []);
  usePreventRemove(locked, ignoreRemoval);

  useEffect(() => {
    if (!locked) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [locked]);

  return locked;
}
