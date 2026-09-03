import { useEffect, useRef } from 'react';

import type { ContentFlowPendingWork, ContentFlowRun, ContentFlowSurface } from '@/types/content-flow';

import { dispatchContentFlowCommand } from './content-flow-director';
import { useContentFlowSurface } from './use-content-flow-surface';

type PresentationWork = Extract<ContentFlowPendingWork, { kind: 'presentation' }>;

/**
 * Executes one surface-owned presentation and durably acknowledges its exact
 * key. Unacknowledged work replays after remount; stale completions are ignored
 * by the director because their key no longer matches the active node.
 */
export function useStoryPresentationOperation(
  surface: ContentFlowSurface,
  presentationType: string,
  execute: (work: PresentationWork, run: ContentFlowRun) => void | (() => void) | Promise<void>,
  enabled = true,
) {
  const model = useContentFlowSurface(surface);
  const executeRef = useRef(execute);
  executeRef.current = execute;
  const work = enabled && model.pendingWork.kind === 'presentation' && model.pendingWork.presentationType === presentationType
    ? model.pendingWork
    : null;
  const runId = model.run?.runId ?? null;
  const workKey = work?.key ?? null;
  const workRef = useRef(work);
  const runRef = useRef(model.run);
  workRef.current = work;
  runRef.current = model.run;

  useEffect(() => {
    const activeWork = workRef.current;
    const activeRun = runRef.current;
    if (!activeWork || !activeRun || !runId) return;
    let live = true;
    let cleanup: void | (() => void);
    Promise.resolve(executeRef.current(activeWork, activeRun)).then((result) => {
      cleanup = result;
      if (!live) return;
      return dispatchContentFlowCommand(runId, { type: 'presentation_acknowledged', presentationKey: activeWork.key });
    }).catch((caught) => {
      if (!live) return;
      void dispatchContentFlowCommand(runId, {
        type: 'fail',
        message: caught instanceof Error ? caught.message : `Presentation ${presentationType} failed`,
      });
    });
    return () => {
      live = false;
      cleanup?.();
    };
  // The stable operation key is the execution boundary. Journal refreshes can
  // replace run/work objects while the same animation is still in flight.
  }, [enabled, presentationType, runId, workKey]);

  return { active: Boolean(work), model, work };
}
