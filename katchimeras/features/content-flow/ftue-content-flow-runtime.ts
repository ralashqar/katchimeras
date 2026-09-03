import { MOSSPROUT_FTUE_VARIANTS } from '@/features/onboarding/mossprout-ftue-flow';
import type { FtueEvent, FtueRunState } from '@/features/onboarding/ftue-types';

import { contentFlowDefinition, registerContentFlowDefinition } from './content-flow-catalog';
import { dispatchContentFlowCommand, startContentFlow } from './content-flow-director';
import { loadContentFlowRun } from './content-flow-repository';
import { registerStoryVariantSet, selectedStoryVariant } from './story-variant-registry';

async function ensureLiveFtueRun(ftue: FtueRunState) {
  registerStoryVariantSet(MOSSPROUT_FTUE_VARIANTS);
  const selected = selectedStoryVariant(MOSSPROUT_FTUE_VARIANTS.id).definition;
  if (!contentFlowDefinition(selected.id, selected.version)) registerContentFlowDefinition(selected);
  const runId = `flow:${ftue.runId}`;
  const existing = await loadContentFlowRun(runId);
  if (existing) return existing;
  const definition = contentFlowDefinition(selected.id, selected.version)!;
  return startContentFlow(definition, {
    runId,
    variables: { ftueRunId: ftue.runId },
    now: Date.parse(ftue.startedAt) || Date.now(),
  });
}

export async function dispatchFtueActionToContentFlow(before: FtueRunState, actionId: string, expectedNodeId: string) {
  const run = await ensureLiveFtueRun(before);
  if (run.executionMode !== 'live' || run.nodeId !== before.stepId) return run;
  const definition = contentFlowDefinition(run.definitionId, run.definitionVersion);
  const node = definition?.nodes.find((candidate) => candidate.id === before.stepId);
  const contentFlowActionId = node?.kind === 'scene'
    ? node.actions.find((action) => (
      (action.id === actionId || action.id.startsWith(`${actionId}#branch-`))
      && (action.next === expectedNodeId || actionId === 'companion.complete_day_one_action')
    ))?.id ?? actionId
    : actionId;
  return dispatchContentFlowCommand(run.runId, { type: 'submit_scene', actionId: contentFlowActionId });
}

export async function dispatchFtueEventToContentFlow(before: FtueRunState, event: FtueEvent, _expectedNodeId: string) {
  const run = await ensureLiveFtueRun(before);
  if (run.executionMode !== 'live' || run.nodeId !== before.stepId) return run;
  const { type, ...payload } = event;
  return dispatchContentFlowCommand(run.runId, {
    type: 'record_event',
    event: {
      eventId: `ftue:${before.runId}:${before.stepId}:${type}:${event.revision}`,
      type: `ftue.${type}`,
      runId: run.runId,
      nodeId: run.nodeId,
      payload,
      occurredAt: Date.now(),
    },
  });
}

export function ftueContentFlowDefinitionAvailable() {
  return MOSSPROUT_FTUE_VARIANTS.variants.some((variant) => Boolean(contentFlowDefinition(variant.definition.id, variant.definition.version)));
}
