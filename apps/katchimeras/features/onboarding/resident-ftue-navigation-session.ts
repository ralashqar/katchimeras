import { DIAGNOSTICS_ENABLED } from '@/constants/diagnostics';
export type ResidentFtueNavigationPhase =
  | 'idle'
  | 'handoff'
  | 'merge_presented'
  | 'recovery_pending'
  | 'paused';

export type ResidentFtueNavigationSession = {
  generation: number;
  phase: ResidentFtueNavigationPhase;
};

export type ResidentFtueNavigationEvent =
  | { type: 'begin_handoff' }
  | { type: 'merge_presented' }
  | { type: 'app_backgrounded' }
  | { type: 'pause' }
  | { type: 'cancel_handoff' }
  | { type: 'finish' };

const INITIAL_SESSION: ResidentFtueNavigationSession = { generation: 0, phase: 'idle' };
const listeners = new Set<() => void>();
let snapshot = INITIAL_SESSION;

/** Pure transition table used by runtime code and lifecycle regression tests. */
export function reduceResidentFtueNavigationSession(
  current: ResidentFtueNavigationSession,
  event: ResidentFtueNavigationEvent,
): ResidentFtueNavigationSession {
  if (event.type === 'begin_handoff') {
    return { generation: current.generation + 1, phase: 'handoff' };
  }
  if (event.type === 'merge_presented') {
    if (current.phase !== 'handoff' && current.phase !== 'recovery_pending' && current.phase !== 'merge_presented') return current;
    return current.phase === 'merge_presented' ? current : { ...current, phase: 'merge_presented' };
  }
  if (event.type === 'app_backgrounded') {
    if (current.phase !== 'handoff' && current.phase !== 'merge_presented') return current;
    return { ...current, phase: 'recovery_pending' };
  }
  if (event.type === 'pause') {
    if (current.phase !== 'merge_presented' && current.phase !== 'recovery_pending') return current;
    return { ...current, phase: 'paused' };
  }
  if (event.type === 'cancel_handoff') {
    return current.phase === 'handoff' || current.phase === 'recovery_pending'
      ? { ...current, phase: 'idle' }
      : current;
  }
  return current.phase === 'idle' ? current : { ...current, phase: 'idle' };
}

function dispatchResidentFtueNavigationEvent(event: ResidentFtueNavigationEvent) {
  const previous = snapshot;
  const next = reduceResidentFtueNavigationSession(previous, event);
  if (next === previous) return next;
  snapshot = next;
  if (DIAGNOSTICS_ENABLED) {
    console.info('[resident-ftue-navigation] Session changed', {
      event: event.type,
      from: previous.phase,
      generation: next.generation,
      to: next.phase,
    });
  }
  listeners.forEach((listener) => listener());
  return next;
}

export function getResidentMergeSession() {
  return snapshot;
}

export function subscribeResidentMergeSession(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function beginResidentMergeHandoff() {
  return dispatchResidentFtueNavigationEvent({ type: 'begin_handoff' });
}

export function markResidentMergePresented() {
  return dispatchResidentFtueNavigationEvent({ type: 'merge_presented' });
}

export function markResidentMergeRecoveryPending() {
  return dispatchResidentFtueNavigationEvent({ type: 'app_backgrounded' });
}

export function pauseResidentMerge() {
  return dispatchResidentFtueNavigationEvent({ type: 'pause' });
}

export function cancelResidentMergeHandoff() {
  return dispatchResidentFtueNavigationEvent({ type: 'cancel_handoff' });
}

export function finishResidentMergeSession() {
  return dispatchResidentFtueNavigationEvent({ type: 'finish' });
}

export function residentMergeSessionOwnsRoute(session = snapshot) {
  return session.phase === 'merge_presented' || session.phase === 'recovery_pending';
}

export function residentMergeSessionBlocksReconciliation(session = snapshot) {
  return session.phase === 'handoff';
}

export function isResidentMergePaused(session = snapshot) {
  return session.phase === 'paused';
}

export type ResidentMergeLiveRouteDecision = 'none' | 'restore_merge' | 'finish_session';

export function residentMergeLiveRouteDecision(input: {
  session: ResidentFtueNavigationSession;
  stepId: string | null;
  runActive: boolean;
  pathname: string;
  yieldsToRecoveryRoute: boolean;
}): ResidentMergeLiveRouteDecision {
  if (!residentMergeSessionOwnsRoute(input.session)) return 'none';
  if (!input.runActive || !input.stepId?.startsWith('merge.resident_')) return 'finish_session';
  if (input.yieldsToRecoveryRoute) return 'none';
  const normalizedPathname = decodeURIComponent(input.pathname).replace(/\/$/, '');
  return normalizedPathname.endsWith('/activity') ? 'none' : 'restore_merge';
}
