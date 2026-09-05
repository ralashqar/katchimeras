import { MOSSPROUT_FTUE_VARIANTS } from '@/features/onboarding/mossprout-ftue-flow';
import type { FtueEvent, FtueRunState } from '@/features/onboarding/ftue-types';

import { contentFlowDefinition, registerContentFlowDefinition } from './content-flow-catalog';
import { dispatchContentFlowCommand, startContentFlow } from './content-flow-director';
import { createContentFlowRun, stabilizeContentFlow } from './content-flow-interpreter';
import { loadContentFlowRun, reduceContentFlowRunAtomically, saveContentFlowTransition } from './content-flow-repository';
import { registerStoryVariantSet, selectedStoryVariant } from './story-variant-registry';

async function ensureLiveFtueRun(ftue: FtueRunState) {
  registerStoryVariantSet(MOSSPROUT_FTUE_VARIANTS);
  const selected = selectedStoryVariant(MOSSPROUT_FTUE_VARIANTS.id).definition;
  if (!contentFlowDefinition(selected.id, selected.version)) registerContentFlowDefinition(selected);
  const runId = `flow:${ftue.runId}`;
  let existing = await loadContentFlowRun(runId);
  // Older completed observations already continued into rest. Do not replay the
  // newly inserted coaching step when repairing their lagging journal.
  const oldNoticeNodes = ['companion.water_together', 'companion.first_grow', 'companion.first_notice'];
  if (existing && existing.definitionVersion < 49 && oldNoticeNodes.includes(existing.nodeId)
    && ['companion.first_rest', 'companion.meditating', 'complete'].includes(ftue.stepId)
    && ftue.receipts.some((receipt) => receipt.stepId === 'companion.first_notice'
      && receipt.actionId === 'companion.complete_first_notice' && receipt.status !== 'pending')) {
    const result = await reduceContentFlowRunAtomically({ runId, reduce: (current) => current.definitionVersion < 49 && oldNoticeNodes.includes(current.nodeId)
      ? { ...current, definitionVersion: selected.version, nodeId: 'companion.first_rest', phase: 'entering', error: null } : current });
    existing = result.run;
  }
  if (existing?.definitionVersion && existing.definitionVersion < 48 && existing.nodeId === 'companion.water_together'
    && ftue.answers['companion.choose_water_together']) {
    const result = await reduceContentFlowRunAtomically({ runId, reduce: (current) => current.definitionVersion < 48 && current.nodeId === 'companion.water_together'
      ? { ...current, definitionVersion: selected.version, nodeId: 'companion.first_rest', phase: 'entering', error: null } : current });
    existing = result.run;
  }
  if (existing) {
    if (!contentFlowDefinition(existing.definitionId, existing.definitionVersion)) {
      return await dispatchContentFlowCommand(existing.runId, { type: 'retry' }) ?? existing;
    }
    return existing;
  }
  const definition = contentFlowDefinition(selected.id, selected.version)!;
  // Older installations can have a durable FTUE checkpoint but no flow journal.
  // Reconstruct that checkpoint rather than silently restarting at the Egg.
  if (ftue.stepId !== definition.entryNodeId && definition.nodes.some((node) => node.id === ftue.stepId)) {
    const recovered = stabilizeContentFlow(definition, {
      ...createContentFlowRun(definition, { runId, variables: { ftueRunId: ftue.runId }, now: Date.parse(ftue.startedAt) || Date.now() }),
      nodeId: ftue.stepId === 'companion.garden_intro' ? 'effect.relationship.complete_day_one_lesson' : ftue.stepId,
      objectiveProgress: { ...ftue.objectiveProgress },
      phase: 'entering',
    }).run;
    await saveContentFlowTransition(recovered);
    return await dispatchContentFlowCommand(runId, { type: 'retry' }) ?? recovered;
  }
  return startContentFlow(definition, {
    runId,
    variables: { ftueRunId: ftue.runId },
    now: Date.parse(ftue.startedAt) || Date.now(),
  });
}

/** Dismiss coaching without fabricating task events or granting completion rewards. */
export async function dismissFtueContentFlow(ftueRunId: string) {
  return reduceContentFlowRunAtomically({
    runId: `flow:${ftueRunId}`,
    reduce: (run) => run.status === 'completed' ? run : {
      ...run, nodeId: 'complete', status: 'completed', phase: 'completed',
      completedAt: Date.now(), updatedAt: Date.now(), error: null,
    },
  });
}

export async function dispatchFtueActionToContentFlow(before: FtueRunState, actionId: string, expectedNodeId: string) {
  const run = await reconcileFtueCheckpoint(before);
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
  const run = await reconcileFtueCheckpoint(before);
  if (run.executionMode !== 'live' || run.nodeId !== before.stepId) return run;
  const { type, ...payload } = event;
  return dispatchContentFlowCommand(run.runId, {
    type: 'record_event',
    event: {
      eventId: `ftue:${before.runId}:${before.stepId}:${type}:${event.revision}${event.type === 'item_spawned' ? `:${event.instanceId}` : ''}`,
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

/** Replay committed scene edges when the checkpoint outlived its journal write. */
export async function reconcileFtueCheckpoint(ftue: FtueRunState) {
  let run = await ensureLiveFtueRun(ftue);
  if (run.status === 'failed_recoverable' || run.phase === 'entering') run = await dispatchContentFlowCommand(run.runId, { type: 'retry' }) ?? run;
  for (let attempts = 0; attempts < 20 && run.nodeId !== ftue.stepId && run.status !== 'completed'; attempts++) {
    if (run.status === 'failed_recoverable' || run.phase === 'entering' || run.phase === 'awaiting_effect') {
      const retried = await dispatchContentFlowCommand(run.runId, { type: 'retry' });
      if (!retried || retried.status === 'failed_recoverable') break;
      run = retried;
      if (run.nodeId === ftue.stepId) break;
    }
    const node = contentFlowDefinition(run.definitionId, run.definitionVersion)?.nodes.find((node) => node.id === run.nodeId);
    if (node?.kind !== 'scene') break;
    const receipt = ftue.receipts.find((receipt) => receipt.stepId === run.nodeId && receipt.status !== 'pending'
      && node.actions.some((action) => action.id === receipt.actionId));
    if (!receipt) break;
    const next = await dispatchContentFlowCommand(run.runId, { type: 'submit_scene', actionId: receipt.actionId });
    if (!next || next.nodeId === run.nodeId) break;
    run = next;
  }
  return run;
}
