import { contentFlowDefinition, registerContentFlowDefinition } from './content-flow-catalog';
import { dispatchContentFlowCommand } from './content-flow-director';
import { compileFtueFlow } from './ftue-flow-adapter';
import { loadContentFlowRun, saveContentFlowTransition } from './content-flow-repository';
import { migrateFtueRunToContentFlow } from './content-flow-legacy-mapping';
import { MOSSPROUT_FTUE_SCRIPT } from '@/features/onboarding/mossprout-ftue-script';
import type { FtueEvent, FtueRunState } from '@/features/onboarding/ftue-types';

async function ensureShadowRun(legacy: FtueRunState) {
  const definition = contentFlowDefinition(MOSSPROUT_FTUE_SCRIPT.id, MOSSPROUT_FTUE_SCRIPT.version)
    ?? registerContentFlowDefinition(compileFtueFlow(MOSSPROUT_FTUE_SCRIPT));
  const runId = `flow:${legacy.runId}`;
  const existing = await loadContentFlowRun(runId);
  if (existing) return existing;
  const migrated = migrateFtueRunToContentFlow(legacy);
  await saveContentFlowTransition(migrated);
  return migrated;
}

async function recordComparison(runId: string, expectedNodeId: string, source: string) {
  const run = await loadContentFlowRun(runId);
  if (!run || run.executionMode !== 'shadow') return;
  const matched = run.nodeId === expectedNodeId;
  await saveContentFlowTransition({
    ...run,
    variables: {
      ...run.variables,
      shadowLastComparison: matched ? `matched:${source}:${expectedNodeId}` : `mismatch:${source}:expected=${expectedNodeId}:actual=${run.nodeId}`,
    },
  });
}

export async function mirrorFtueActionInShadow(before: FtueRunState, actionId: string, expectedNodeId: string) {
  const run = await ensureShadowRun(before);
  if (run.executionMode !== 'shadow' || run.nodeId !== before.stepId) return;
  const definition = contentFlowDefinition(MOSSPROUT_FTUE_SCRIPT.id, MOSSPROUT_FTUE_SCRIPT.version);
  const node = definition?.nodes.find((candidate) => candidate.id === before.stepId);
  const shadowActionId = node?.kind === 'scene'
    ? node.actions.find((action) => (
      (action.id === actionId || action.id.startsWith(`${actionId}#branch-`))
      && action.next === expectedNodeId
    ))?.id ?? actionId
    : actionId;
  await dispatchContentFlowCommand(run.runId, { type: 'submit_scene', actionId: shadowActionId });
  await recordComparison(run.runId, expectedNodeId, `action:${actionId}`);
}

export async function mirrorFtueEventInShadow(before: FtueRunState, event: FtueEvent, expectedNodeId: string) {
  const run = await ensureShadowRun(before);
  if (run.executionMode !== 'shadow' || run.nodeId !== before.stepId) return;
  const { type, ...payload } = event;
  await dispatchContentFlowCommand(run.runId, {
    type: 'record_event',
    event: {
      eventId: `shadow-ftue:${before.runId}:${before.stepId}:${type}:${event.revision}`,
      type: `ftue.${type}`,
      runId: run.runId,
      nodeId: run.nodeId,
      payload,
      occurredAt: Date.now(),
    },
  });
  await recordComparison(run.runId, expectedNodeId, `event:${type}`);
}

export function ftueShadowDefinitionAvailable() {
  return Boolean(contentFlowDefinition(MOSSPROUT_FTUE_SCRIPT.id, MOSSPROUT_FTUE_SCRIPT.version));
}
