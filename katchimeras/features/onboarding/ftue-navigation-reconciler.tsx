import { useGlobalSearchParams, usePathname, useRootNavigationState, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import type { FtueResumeTarget } from './ftue-types';
import { activeFtueNavigationPolicy, ftueResumeTargetMatches } from './ftue-navigation-policy';
import { loadFtueRun } from './ftue-runtime';

function hrefForResumeTarget(target: FtueResumeTarget): Href {
  if (target.kind === 'today') return '/(tabs)/today';
  if (target.kind === 'haven') return '/katchimeras';
  if (target.kind === 'merge') {
    return {
      pathname: '/katchimera/[creatureId]/activity',
      params: { creatureId: target.creatureId },
    };
  }
  return {
    pathname: '/katchimera/[creatureId]',
    params: { creatureId: target.creatureId, ...(target.ftue ? { ftue: target.ftue } : {}) },
  };
}

/** Restores an authored, route-owning FTUE beat after launch or foreground. */
export function FtueNavigationReconciler() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams() as Record<string, string | string[] | undefined>;
  const rootNavigationState = useRootNavigationState();
  const initialResumeHandledRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const restoreOwnedStep = useCallback(() => {
    const run = loadFtueRun();
    const policy = activeFtueNavigationPolicy(run);
    if (!policy || ftueResumeTargetMatches(policy.resume, pathname, params)) return;
    router.replace(hrefForResumeTarget(policy.resume));
  }, [params, pathname, router]);

  useEffect(() => {
    if (!rootNavigationState?.key || initialResumeHandledRef.current) return;
    initialResumeHandledRef.current = true;
    restoreOwnedStep();
  }, [restoreOwnedStep, rootNavigationState?.key]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;
      if (nextState !== 'active' || previousState === 'active') return;
      requestAnimationFrame(restoreOwnedStep);
    });
    return () => subscription.remove();
  }, [restoreOwnedStep]);

  return null;
}
