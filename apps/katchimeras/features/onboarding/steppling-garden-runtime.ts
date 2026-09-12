import { useEffect, useState } from 'react';
import { registerContentFlowDefinition } from '@/features/content-flow/content-flow-catalog';
import { startContentFlow, dispatchContentFlowCommand } from '@/features/content-flow/content-flow-director';
import { loadContentFlowRun, reduceContentFlowRunAtomically, subscribeContentFlowJournal } from '@/features/content-flow/content-flow-repository';
import type { ContentFlowRun } from '@/types/content-flow';
import type { MergeWorldState } from '@/types/merge-world';
import { STEPPLING_FINALE_NODE_IDS, STEPPLING_GARDEN_FLOW, STEPPLING_GARDEN_RUN_ID, stepplingGardenCheckpoint } from './steppling-garden-lesson';

function registerStepplingGardenFlows() {
  registerContentFlowDefinition(STEPPLING_GARDEN_FLOW);
}

const STEPPLING_GARDEN_NODE_IDS = new Set(STEPPLING_GARDEN_FLOW.nodes.map((node) => node.id));
/**
 * A save can hold a node this version no longer authors — an interim build put
 * the Kingdom goal inside this run. The director only migrates such a node on
 * its next command, and no surface can be drawn for an unknown node, so nothing
 * would ever dispatch: the lesson would stay active forever and keep the
 * Kingdom's camera locked. Repair it on read instead, at the authored fallback.
 */
async function repairUnknownStepplingNode(run: ContentFlowRun | null) {
  if (!run || run.status === 'completed' || STEPPLING_GARDEN_NODE_IDS.has(run.nodeId)) return run;
  const migrations: Readonly<Record<string, string>> = STEPPLING_GARDEN_FLOW.migrations ?? {};
  const nodeId = migrations[run.nodeId] ?? 'closing';
  const repaired = await reduceContentFlowRunAtomically({ runId: run.runId, reduce: (current) => (
    current.status === 'completed' || STEPPLING_GARDEN_NODE_IDS.has(current.nodeId) ? current : {
      ...current, definitionVersion: STEPPLING_GARDEN_FLOW.version, nodeId, phase: 'awaiting_input' as const,
      status: 'active' as const, error: null, updatedAt: Date.now(), revision: current.revision + 1,
    }) });
  return repaired.run ?? run;
}

async function readStepplingGardenRun() {
  return await repairUnknownStepplingNode(await loadContentFlowRun(STEPPLING_GARDEN_RUN_ID));
}

let starting: Promise<ContentFlowRun> | null = null;
export function ensureStepplingGardenLesson() {
  starting ??= (async () => {
    registerStepplingGardenFlows();
    return await readStepplingGardenRun() ?? await startContentFlow(STEPPLING_GARDEN_FLOW, { runId: STEPPLING_GARDEN_RUN_ID });
  })().finally(() => { starting = null; });
  return starting;
}
export function useStepplingGardenLesson() {
  const [state, setState] = useState<{ run: ContentFlowRun | null; ready: boolean }>({ run: null, ready: false });
  useEffect(() => {
    registerStepplingGardenFlows();
    let live = true; let revision = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      const request = ++revision;
      void readStepplingGardenRun().then((run) => { if (live && request === revision) setState({ run, ready: true }); }).catch(() => {
        if (live && request === revision) retry = setTimeout(refresh, 1000);
      });
    };
    refresh(); const unsubscribe = subscribeContentFlowJournal(refresh);
    return () => { live = false; clearTimeout(retry); unsubscribe(); };
  }, []);
  return { ...state, active: Boolean(state.run && state.run.status !== 'completed') };
}
export async function reconcileStepplingGarden(state: MergeWorldState) {
  const run = await readStepplingGardenRun();
  if (!run || run.status === 'completed' || STEPPLING_FINALE_NODE_IDS.includes(run.nodeId)) return;
  const nodeId = stepplingGardenCheckpoint(state);
  if (nodeId === run.nodeId) return;
  await reduceContentFlowRunAtomically({ runId: run.runId, reduce: (current) => current.status === 'completed' || STEPPLING_FINALE_NODE_IDS.includes(current.nodeId)
    || Number(current.variables.boardRevision ?? -1) > state.revision ? current : {
    ...current, nodeId, variables: { ...current.variables, boardRevision: state.revision }, phase: nodeId === 'closing' ? 'awaiting_input' : 'awaiting_event', updatedAt: Date.now(), revision: current.revision + 1,
  } });
}
export function advanceStepplingFinale(actionId: 'summary' | 'finish') {
  registerStepplingGardenFlows();
  return dispatchContentFlowCommand(STEPPLING_GARDEN_RUN_ID, { type: 'submit_scene', actionId });
}
