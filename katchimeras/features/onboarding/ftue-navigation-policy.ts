import type { FtueNavigationDirective, FtueResumeTarget, FtueRunState, FtueSurface } from './ftue-types';
import { mossproutFtueStep } from './mossprout-ftue-script';

export type ActiveFtueNavigationPolicy = FtueNavigationDirective & {
  stepId: string;
  surface: FtueSurface;
};

const PRE_MOSSPROUT_CONVERSATION_STEPS = new Set([
  'egg.opening',
  'egg.context',
  'egg.mind',
  'egg.ready',
  'hatch.reveal',
]);

/** Keep the opening authored adventure focused until the player talks to Mossprout. */
export function ftueOwnsOpeningHome(run: Pick<FtueRunState, 'status' | 'stepId'> | null): boolean {
  return run?.status === 'active' && PRE_MOSSPROUT_CONVERSATION_STEPS.has(run.stepId);
}

export function ftueHidesBottomBar(
  run: Pick<FtueRunState, 'status' | 'stepId'> | null,
  activeTabRoute: string,
): boolean {
  if (run?.status !== 'active') return false;
  const surface = mossproutFtueStep(run.stepId)?.surface;
  // A persisted graph may point at Merge while the app cold-opens on Today.
  // Hide navigation only on the tab currently presenting that graph surface,
  // otherwise the player must retain a route to Dev reset and recovery.
  if (activeTabRoute === 'today') return surface === 'today' || surface === 'hatch';
  if (activeTabRoute === 'games') return surface === 'merge';
  if (activeTabRoute === 'katchimeras') return surface === 'haven';
  return false;
}

/** Resolve navigation behavior from the authored step instead of screen-specific IDs. */
export function activeFtueNavigationPolicy(
  run: Pick<FtueRunState, 'status' | 'stepId'> | null,
): ActiveFtueNavigationPolicy | null {
  if (run?.status !== 'active') return null;
  const step = mossproutFtueStep(run.stepId);
  if (!step?.navigation) return null;
  return { ...step.navigation, stepId: step.id, surface: step.surface };
}

export function ftueLocksSurfaceNavigation(
  run: Pick<FtueRunState, 'status' | 'stepId'> | null,
  surface: FtueSurface,
): boolean {
  const policy = activeFtueNavigationPolicy(run);
  return Boolean(policy?.lock && policy.surface === surface);
}

export function ftueResumePath(target: FtueResumeTarget): string {
  if (target.kind === 'today') return '/today';
  if (target.kind === 'haven') return '/katchimeras';
  if (target.kind === 'merge') return `/katchimera/${target.creatureId}/activity`;
  return `/katchimera/${target.creatureId}`;
}

export function ftueResumeTargetMatches(
  target: FtueResumeTarget,
  pathname: string,
  params: Readonly<Record<string, string | string[] | undefined>> = {},
): boolean {
  const normalizedPath = decodeURIComponent(pathname).replace(/\/$/, '') || '/';
  if (normalizedPath !== ftueResumePath(target)) return false;
  if (target.kind !== 'companion' || !target.ftue) return true;
  const ftueParam = params.ftue;
  return (Array.isArray(ftueParam) ? ftueParam[0] : ftueParam) === target.ftue;
}

/**
 * Foregrounding must never pop an already-visible resident Garden back to its
 * stale companion handoff. The mounted Merge route is authoritative while the
 * graph or durable board still identifies any resident-discovery step.
 */
export function ftueForegroundKeepsResidentMerge(
  run: Pick<FtueRunState, 'status' | 'stepId'> | null,
  pathname: string,
  canonicalBoardStep: string | null,
): boolean {
  const normalizedPath = decodeURIComponent(pathname).replace(/\/$/, '') || '/';
  if (!normalizedPath.endsWith('/activity')) return false;
  if (canonicalBoardStep?.startsWith('merge.resident_')) return true;
  return Boolean(
    run?.status === 'active'
    && (run.stepId === 'companion.resident_parcel_ready' || run.stepId.startsWith('merge.resident_'))
  );
}
