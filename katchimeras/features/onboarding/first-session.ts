import { beginFtueRun, commitFtueAction, loadFtueRun, updateFtueRun, useFtueRun } from './ftue-runtime';

export type FirstSessionStage = 'today' | 'merge' | 'complete';

export type FirstSessionState = {
  version: 3;
  stage: FirstSessionStage;
  startedAt: string;
  mergeInstalled: boolean;
};

export function loadFirstSession(): FirstSessionState | null {
  const run = loadFtueRun();
  if (!run) return null;
  const stage: FirstSessionStage = run.status === 'complete' ? 'complete'
    : run.stepId.startsWith('merge.') ? 'merge'
      : 'today';
  return { version: 3, stage, startedAt: run.startedAt, mergeInstalled: run.mergeInstalled };
}

export function beginFirstSession(options: { restart?: boolean } = {}): FirstSessionState {
  beginFtueRun(options);
  return loadFirstSession()!;
}

export function updateFirstSession(patch: Partial<Pick<FirstSessionState, 'stage' | 'mergeInstalled'>>) {
  const run = loadFtueRun();
  if (!run || run.status === 'complete') return loadFirstSession();
  const stepId = patch.stage === 'merge' ? 'merge.seed_drag' : patch.stage === 'complete' ? 'complete' : undefined;
  updateFtueRun({ ...(stepId ? { stepId } : {}), ...(patch.mergeInstalled == null ? {} : { mergeInstalled: patch.mergeInstalled }) });
  return loadFirstSession();
}

export function completeFirstSession() {
  updateFtueRun({ stepId: 'complete', status: 'complete', completedAt: new Date().toISOString() });
  return loadFirstSession();
}

export function useFirstSession() {
  useFtueRun();
  return loadFirstSession();
}
