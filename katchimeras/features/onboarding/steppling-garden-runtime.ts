import { useEffect, useState } from 'react';
import { registerContentFlowDefinition } from '@/features/content-flow/content-flow-catalog';
import { startContentFlow, dispatchContentFlowCommand } from '@/features/content-flow/content-flow-director';
import { loadContentFlowRun, reduceContentFlowRunAtomically, subscribeContentFlowJournal } from '@/features/content-flow/content-flow-repository';
import type { ContentFlowRun } from '@/types/content-flow';
import type { MergeWorldState } from '@/types/merge-world';
import { STEPPLING_GARDEN_FLOW, STEPPLING_GARDEN_RUN_ID, stepplingGardenCheckpoint } from './steppling-garden-lesson';

let starting: Promise<ContentFlowRun> | null = null;
export function ensureStepplingGardenLesson() {
  starting ??= (async () => {
    registerContentFlowDefinition(STEPPLING_GARDEN_FLOW);
    return await loadContentFlowRun(STEPPLING_GARDEN_RUN_ID) ?? await startContentFlow(STEPPLING_GARDEN_FLOW, { runId: STEPPLING_GARDEN_RUN_ID });
  })().finally(() => { starting = null; });
  return starting;
}
export function useStepplingGardenLesson() {
  const [state, setState] = useState<{ run: ContentFlowRun | null; ready: boolean }>({ run: null, ready: false });
  useEffect(() => {
    registerContentFlowDefinition(STEPPLING_GARDEN_FLOW);
    let live = true; let revision = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      const request = ++revision;
      void loadContentFlowRun(STEPPLING_GARDEN_RUN_ID).then((run) => { if (live && request === revision) setState({ run, ready: true }); }).catch(() => {
        if (live && request === revision) retry = setTimeout(refresh, 1000);
      });
    };
    refresh(); const unsubscribe = subscribeContentFlowJournal(refresh);
    return () => { live = false; clearTimeout(retry); unsubscribe(); };
  }, []);
  return { ...state, active: Boolean(state.run && state.run.status !== 'completed') };
}
export async function reconcileStepplingGarden(state: MergeWorldState) {
  const run = await loadContentFlowRun(STEPPLING_GARDEN_RUN_ID);
  if (!run || run.status === 'completed' || ['closing', 'summary'].includes(run.nodeId)) return;
  const nodeId = stepplingGardenCheckpoint(state);
  if (nodeId === run.nodeId) return;
  await reduceContentFlowRunAtomically({ runId: run.runId, reduce: (current) => current.status === 'completed' || ['closing', 'summary'].includes(current.nodeId)
    || Number(current.variables.boardRevision ?? -1) > state.revision ? current : {
    ...current, nodeId, variables: { ...current.variables, boardRevision: state.revision }, phase: nodeId === 'closing' ? 'awaiting_input' : 'awaiting_event', updatedAt: Date.now(), revision: current.revision + 1,
  } });
}
export function advanceStepplingFinale(actionId: 'summary' | 'finish') {
  registerContentFlowDefinition(STEPPLING_GARDEN_FLOW);
  return dispatchContentFlowCommand(STEPPLING_GARDEN_RUN_ID, { type: 'submit_scene', actionId });
}
