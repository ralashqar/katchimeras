import { useGlobalSearchParams, usePathname, useRootNavigationState, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import type { FtueResumeTarget } from './ftue-types';
import { ftueNavigationYieldsToDevRecovery } from './ftue-dev-recovery';
import { activeFtueNavigationPolicy, ftueForegroundKeepsResidentMerge, ftueResumeTargetMatches } from './ftue-navigation-policy';
import { residentFtueCanonicalStep } from './merge-ftue';
import { loadFtueRun, repairFtueStep } from './ftue-runtime';
import { clearResidentFtuePause, isResidentFtuePauseAuthorized } from './resident-ftue-pause-session';
import { loadMergeWorldState } from '@/utils/merge-world/repository';

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
  const pathnameRef = useRef(pathname);
  const paramsRef = useRef(params);
  pathnameRef.current = pathname;
  paramsRef.current = params;

  const restoringRef = useRef(false);

  const restoreOwnedStep = useCallback(async () => {
    if (ftueNavigationYieldsToDevRecovery(pathnameRef.current)) return;
    if (restoringRef.current) return;
    restoringRef.current = true;
    let run = loadFtueRun();
    let residentCanonicalStep: string | null = null;
    const startingPathname = decodeURIComponent(pathnameRef.current).replace(/\/$/, '');
    const startingHandoffParam = paramsRef.current.residentHandoff;
    const startingHandoffRequested = (Array.isArray(startingHandoffParam)
      ? startingHandoffParam[0]
      : startingHandoffParam) === '1';
    // Normal companion -> Merge navigation owns this boundary. The global
    // launch/foreground reconciler must not read or repair the board while the
    // transition curtain is moving between those two mounted routes.
    if (
      startingHandoffRequested
      && run?.status === 'active'
      && run.stepId === 'companion.resident_parcel_ready'
      && startingPathname.endsWith('/activity')
    ) {
      restoringRef.current = false;
      return;
    }
    try {
      // A process kill can persist the board command before the graph event.
      // Repair that split write from the board's canonical resident lifecycle
      // before choosing the route, so launch never returns to a dead dialogue.
      if (run?.status === 'active'
        && (run.stepId === 'companion.resident_parcel_ready' || run.stepId.startsWith('merge.resident_'))) {
        const state = await loadMergeWorldState();
        residentCanonicalStep = residentFtueCanonicalStep(state);
        if (residentCanonicalStep && residentCanonicalStep !== run.stepId) {
          repairFtueStep(run.stepId, residentCanonicalStep);
        }
      }
    } catch (error) {
      console.warn('Could not reconcile the resident FTUE route', error);
    } finally {
      restoringRef.current = false;
    }
    // Never route from the snapshot captured before the asynchronous board
    // read. The player can press the parcel CTA while that read is in flight,
    // advancing companion.resident_parcel_ready to merge.resident_parcel.
    // Using the old snapshot here would replace the newly opened Merge route
    // with the companion route again, leaving the transition curtain waiting
    // forever for a Merge surface that is no longer focused.
    run = loadFtueRun();
    const currentPathname = pathnameRef.current;
    const currentParams = paramsRef.current;
    const policy = activeFtueNavigationPolicy(run);
    const residentResumeParam = currentParams.residentResume;
    const residentResumeRequested = (Array.isArray(residentResumeParam) ? residentResumeParam[0] : residentResumeParam) === '1';
    const residentHandoffParam = currentParams.residentHandoff;
    const residentHandoffRequested = (Array.isArray(residentHandoffParam) ? residentHandoffParam[0] : residentHandoffParam) === '1';
    const normalizedPathname = decodeURIComponent(currentPathname).replace(/\/$/, '');
    if (ftueForegroundKeepsResidentMerge(run, currentPathname, residentCanonicalStep)) {
      // Older saves can still carry the pre-handoff companion node. Being on
      // the resident board is sufficient evidence that the player accepted
      // the parcel CTA, even if the board read was temporarily unavailable.
      if (run?.status === 'active' && run.stepId === 'companion.resident_parcel_ready') {
        const repairTarget = residentCanonicalStep?.startsWith('merge.resident_')
          ? residentCanonicalStep
          : 'merge.resident_parcel';
        repairFtueStep(run.stepId, repairTarget);
      }
      clearResidentFtuePause();
      return;
    }
    // The parcel CTA deliberately navigates first and transfers graph
    // ownership only after Merge has loaded its durable board. Do not enforce
    // the still-companion-owned step during that one route boundary.
    if (residentHandoffRequested
      && run?.status === 'active'
      && run.stepId === 'companion.resident_parcel_ready'
      && normalizedPathname.endsWith('/activity')) return;
    // Back is an authored pause point only inside the current foreground
    // session. A stale query parameter restored by iOS must never outrank the
    // persisted Merge-owned graph step after foreground or process launch.
    if (residentResumeRequested
      && isResidentFtuePauseAuthorized()
      && run?.status === 'active'
      && run.stepId.startsWith('merge.resident_')
      && normalizedPathname.startsWith('/katchimera/')) return;
    if (!policy) {
      clearResidentFtuePause();
      return;
    }
    if (ftueResumeTargetMatches(policy.resume, currentPathname, currentParams)) {
      if (policy.resume.kind === 'merge') clearResidentFtuePause();
      return;
    }
    router.replace(hrefForResumeTarget(policy.resume));
  }, [router]);

  useEffect(() => {
    if (!rootNavigationState?.key || initialResumeHandledRef.current) return;
    initialResumeHandledRef.current = true;
    void restoreOwnedStep();
  }, [restoreOwnedStep, rootNavigationState?.key]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;
      if (nextState !== 'active') clearResidentFtuePause();
      if (nextState !== 'active' || previousState === 'active') return;
      requestAnimationFrame(() => void restoreOwnedStep());
    });
    return () => subscription.remove();
  }, [restoreOwnedStep]);

  return null;
}
