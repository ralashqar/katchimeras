import { useGlobalSearchParams, usePathname, useRootNavigationState, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import type { FtueResumeTarget } from './ftue-types';
import { ftueNavigationYieldsToDevRecovery } from './ftue-dev-recovery';
import { activeFtueNavigationPolicy, ftueForegroundKeepsResidentMerge, ftueResumeTargetMatches, residentJourneyReachedMatchResult } from './ftue-navigation-policy';
import { residentFtueCanonicalStep } from './merge-ftue';
import { loadFtueRun, repairFtueStep, updateFtueRun } from './ftue-runtime';
import {
  finishResidentMergeSession,
  getResidentMergeSession,
  isResidentMergePaused,
  markResidentMergeRecoveryPending,
  residentMergeLiveRouteDecision,
  residentMergeSessionBlocksReconciliation,
  residentMergeSessionOwnsRoute,
  subscribeResidentMergeSession,
} from './resident-ftue-navigation-session';
import { loadMergeWorldState } from '@/utils/merge-world/repository';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';

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
  const residentSession = useSyncExternalStore(
    subscribeResidentMergeSession,
    getResidentMergeSession,
    getResidentMergeSession,
  );
  const initialResumeHandledRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const pathnameRef = useRef(pathname);
  const paramsRef = useRef(params);
  pathnameRef.current = pathname;
  paramsRef.current = params;

  const restoringRef = useRef(false);

  const restoreLiveResidentRoute = useCallback(() => {
    const session = getResidentMergeSession();
    if (!residentMergeSessionOwnsRoute(session)) return false;
    const run = loadFtueRun();
    const currentPathname = pathnameRef.current;
    const decision = residentMergeLiveRouteDecision({
      pathname: currentPathname,
      runActive: run?.status === 'active',
      session,
      stepId: run?.stepId ?? null,
      yieldsToRecoveryRoute: ftueNavigationYieldsToDevRecovery(currentPathname),
    });
    if (decision === 'finish_session') {
      finishResidentMergeSession();
      return false;
    }
    if (decision === 'none') return true;
    const normalizedPathname = decodeURIComponent(currentPathname).replace(/\/$/, '');
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.info('[resident-ftue-navigation] Restoring presented Merge route', {
        pathname: normalizedPathname,
        phase: session.phase,
        stepId: run?.stepId ?? null,
      });
    }
    router.replace({
      pathname: '/katchimera/[creatureId]/activity',
      params: { creatureId: 'companion:mossprout' },
    });
    return true;
  }, [router]);

  const restoreOwnedStep = useCallback(async () => {
    if (ftueNavigationYieldsToDevRecovery(pathnameRef.current)) return;
    if (residentMergeSessionBlocksReconciliation() || residentMergeSessionOwnsRoute()) return;
    if (restoringRef.current) return;
    restoringRef.current = true;
    let run = loadFtueRun();
    if (residentJourneyReachedMatchResult(run, relationshipProgressionRepository.load().journeyDays)) {
      updateFtueRun({ stepId: 'companion.resident_match_result', status: 'active', completedAt: null });
      finishResidentMergeSession();
      run = loadFtueRun();
    }
    let residentCanonicalStep: string | null = null;
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
    // A player can accept the parcel while cold-start repair is awaiting the
    // board repository. The CTA now owns that boundary; never navigate from
    // the stale recovery operation after a live handoff has begun.
    if (residentMergeSessionBlocksReconciliation() || residentMergeSessionOwnsRoute()) return;
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
      return;
    }
    // Back is an authored pause point only inside the current foreground
    // session. A stale query parameter restored by iOS must never outrank the
    // persisted Merge-owned graph step after foreground or process launch.
    if (residentResumeRequested
      && isResidentMergePaused()
      && run?.status === 'active'
      && run.stepId.startsWith('merge.resident_')
      && normalizedPathname.startsWith('/katchimera/')) return;
    if (!policy) {
      finishResidentMergeSession();
      return;
    }
    if (ftueResumeTargetMatches(policy.resume, currentPathname, currentParams)) {
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
    if (appStateRef.current !== 'active') return;
    void restoreLiveResidentRoute();
  }, [pathname, residentSession, restoreLiveResidentRoute]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;
      if (nextState !== 'active') markResidentMergeRecoveryPending();
      if (nextState !== 'active' || previousState === 'active') return;
      if (restoreLiveResidentRoute()) return;
      if (residentMergeSessionBlocksReconciliation()) return;
      requestAnimationFrame(() => void restoreOwnedStep());
    });
    return () => subscription.remove();
  }, [restoreLiveResidentRoute, restoreOwnedStep]);

  return null;
}
