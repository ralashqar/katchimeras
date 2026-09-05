import { createClientId } from '@/utils/client-id';
import type { ContentFlowCommand, ContentFlowDefinition, ContentFlowEvent, ContentFlowPendingWork, ContentFlowRun } from '@/types/content-flow';

import { contentFlowEffectHandler, validatePendingContentFlowWork } from './content-flow-capabilities';
import { contentFlowDefinition, latestContentFlowDefinition, registerContentFlowDefinition } from './content-flow-catalog';
import { contentFlowEventMatches, createContentFlowRun, reduceContentFlow, stabilizeContentFlow } from './content-flow-interpreter';
import { listContentFlowRuns, loadContentFlowRun, reduceContentFlowRunAtomically, saveContentFlowTransition } from './content-flow-repository';

const workInFlight = new Set<string>();

async function runPendingEffects(definition: ContentFlowDefinition, run: ContentFlowRun, pendingWork: ContentFlowPendingWork): Promise<ContentFlowRun> {
  if (pendingWork.kind !== 'effect') return run;
  if (workInFlight.has(pendingWork.key)) return run;
  const error = validatePendingContentFlowWork(pendingWork);
  if (error) {
    return await dispatchContentFlowCommand(run.runId, { type: 'fail', message: error }) ?? run;
  }
  workInFlight.add(pendingWork.key);
  try {
    const result = await contentFlowEffectHandler(pendingWork.effectType)!({ run, effectKey: pendingWork.key, payload: pendingWork.payload });
    return await dispatchContentFlowCommand(run.runId, { type: 'effect_completed', effectKey: pendingWork.key, result }) ?? run;
  } catch (caught) {
    return await dispatchContentFlowCommand(run.runId, { type: 'fail', message: caught instanceof Error ? caught.message : 'Content flow effect failed' }) ?? run;
  } finally {
    workInFlight.delete(pendingWork.key);
  }
}

export async function startContentFlow(
  definition: ContentFlowDefinition,
  input: { runId?: string; parentRunId?: string | null; variables?: ContentFlowRun['variables']; now?: number } = {},
) {
  registerContentFlowDefinition(definition);
  const run = createContentFlowRun(definition, { runId: input.runId ?? createClientId('flow'), parentRunId: input.parentRunId, variables: input.variables, now: input.now });
  await saveContentFlowTransition(run);
  return runPendingEffects(definition, run, stabilizeContentFlow(definition, run, input.now).pendingWork);
}

export async function dispatchContentFlowCommand(runId: string, command: ContentFlowCommand): Promise<ContentFlowRun | null> {
  const run = await loadContentFlowRun(runId);
  if (!run) return null;
  let definition = contentFlowDefinition(run.definitionId, run.definitionVersion);
  if (!definition) {
    const latest = latestContentFlowDefinition(run.definitionId);
    const migratedNode = latest?.migrations?.[run.nodeId] ?? (latest?.nodes.some((node) => node.id === run.nodeId) ? run.nodeId : null);
    if (latest && migratedNode) {
      const migrated = { ...run, definitionVersion: latest.version, nodeId: migratedNode, phase: 'entering' as const, error: null, updatedAt: Date.now(), revision: run.revision + 1 };
      await saveContentFlowTransition(migrated);
      definition = latest;
    } else {
      const failed = { ...run, phase: 'failed_recoverable' as const, status: 'failed_recoverable' as const, error: `Missing definition ${run.definitionId}@${run.definitionVersion} and no migration for ${run.nodeId}`, updatedAt: Date.now(), revision: run.revision + 1 };
      await saveContentFlowTransition(failed);
      return failed;
    }
  }
  const reduced = await reduceContentFlowRunAtomically({
    runId,
    event: command.type === 'record_event' ? command.event : undefined,
    reduce: (current) => reduceContentFlow(definition, current, command).run,
  });
  if (!reduced.run) return null;
  const pendingWork = stabilizeContentFlow(definition, reduced.run, command.now).pendingWork;
  const finalRun = await runPendingEffects(definition, reduced.run, pendingWork);
  if (finalRun.status === 'completed' && finalRun.parentRunId) await completeChildAndResumeParent(finalRun.runId);
  return finalRun;
}

export async function startChildContentFlow(parentRunId: string, definition: ContentFlowDefinition, variables?: ContentFlowRun['variables']) {
  const parent = await loadContentFlowRun(parentRunId);
  if (!parent || parent.status !== 'active') throw new Error(`Cannot suspend inactive parent flow ${parentRunId}`);
  let didSuspend = false;
  const suspended = await reduceContentFlowRunAtomically({
    runId: parentRunId,
    reduce: (current) => {
      if (current.status !== 'active' || current.phase === 'suspended' || current.revision !== parent.revision) return current;
      didSuspend = true;
      return { ...current, phase: 'suspended', updatedAt: Date.now() };
    },
  });
  if (!didSuspend || !suspended.run || suspended.run.phase !== 'suspended') throw new Error(`Could not suspend parent flow ${parentRunId}`);
  return startContentFlow(definition, { parentRunId, variables });
}

export async function completeChildAndResumeParent(childRunId: string): Promise<ContentFlowRun | null> {
  const child = await loadContentFlowRun(childRunId);
  if (!child || child.status !== 'completed' || !child.parentRunId) return null;
  const parent = await loadContentFlowRun(child.parentRunId);
  if (!parent || parent.status !== 'active' || parent.phase !== 'suspended') return parent;
  const definition = contentFlowDefinition(parent.definitionId, parent.definitionVersion);
  if (!definition) return parent;
  const resumed = await reduceContentFlowRunAtomically({
    runId: parent.runId,
    reduce: (current) => current.status === 'active' && current.phase === 'suspended'
      ? stabilizeContentFlow(definition, { ...current, phase: 'entering', updatedAt: Date.now() }).run
      : current,
  });
  if (!resumed.run) return null;
  return runPendingEffects(definition, resumed.run, stabilizeContentFlow(definition, resumed.run).pendingWork);
}

export function contentFlowDomainEvent(input: Omit<ContentFlowEvent, 'eventId' | 'occurredAt'> & { eventId?: string; occurredAt?: number }): ContentFlowEvent {
  return { ...input, eventId: input.eventId ?? createClientId('flow-event'), occurredAt: input.occurredAt ?? Date.now() };
}

/** Domain systems publish facts; the director adds run/node correlation. */
export async function publishContentFlowDomainEvent(input: {
  eventId: string;
  type: string;
  objectiveId?: string;
  payload?: Readonly<Record<string, unknown>>;
  occurredAt?: number;
}): Promise<ContentFlowRun[]> {
  const results: ContentFlowRun[] = [];
  const runs = await listContentFlowRuns({ activeOnly: true });
  for (const run of runs) {
    if (run.executionMode !== 'live' || run.phase !== 'awaiting_event') continue;
    const definition = contentFlowDefinition(run.definitionId, run.definitionVersion);
    const node = definition?.nodes.find((candidate) => candidate.id === run.nodeId);
    if (!definition || node?.kind !== 'task') continue;
    const candidate = contentFlowDomainEvent({
      eventId: `${input.eventId}:${run.runId}`,
      type: input.type,
      runId: run.runId,
      nodeId: run.nodeId,
      objectiveId: input.objectiveId,
      payload: { ...input.payload, ...(input.objectiveId ? { objectiveId: input.objectiveId } : {}) },
      occurredAt: input.occurredAt,
    });
    if (!node.requirements.some((requirement) => contentFlowEventMatches(requirement.event, candidate))) continue;
    const updated = await dispatchContentFlowCommand(run.runId, { type: 'record_event', event: candidate });
    if (updated) results.push(updated);
  }
  return results;
}

export async function submitActiveContentFlowScene(
  sceneId: string,
  actionId: string,
  values?: ContentFlowRun['variables'],
): Promise<ContentFlowRun[]> {
  const results: ContentFlowRun[] = [];
  const runs = await listContentFlowRuns({ activeOnly: true });
  for (const run of runs) {
    if (run.executionMode !== 'live' || run.phase !== 'awaiting_input') continue;
    const definition = contentFlowDefinition(run.definitionId, run.definitionVersion);
    const node = definition?.nodes.find((candidate) => candidate.id === run.nodeId);
    if (node?.kind !== 'scene' || node.sceneId !== sceneId || !node.actions.some((action) => action.id === actionId)) continue;
    const updated = await dispatchContentFlowCommand(run.runId, { type: 'submit_scene', actionId, values });
    if (updated) results.push(updated);
  }
  return results;
}

export async function acknowledgeActiveContentFlowPresentation(presentationType: string): Promise<ContentFlowRun[]> {
  const results: ContentFlowRun[] = [];
  const runs = await listContentFlowRuns({ activeOnly: true });
  for (const run of runs) {
    if (run.executionMode !== 'live' || run.phase !== 'awaiting_presentation') continue;
    const definition = contentFlowDefinition(run.definitionId, run.definitionVersion);
    const node = definition?.nodes.find((candidate) => candidate.id === run.nodeId);
    if (node?.kind !== 'presentation' || node.presentationType !== presentationType) continue;
    const key = `${run.runId}:${run.nodeId}:presentation:${node.presentationId}`;
    const updated = await dispatchContentFlowCommand(run.runId, { type: 'presentation_acknowledged', presentationKey: key });
    if (updated) results.push(updated);
  }
  return results;
}

export async function acknowledgeActiveContentFlowNavigation(surface: string): Promise<ContentFlowRun[]> {
  const results: ContentFlowRun[] = [];
  const runs = await listContentFlowRuns({ activeOnly: true });
  for (const run of runs) {
    if (run.executionMode !== 'live' || run.phase !== 'awaiting_navigation') continue;
    const definition = contentFlowDefinition(run.definitionId, run.definitionVersion);
    const node = definition?.nodes.find((candidate) => candidate.id === run.nodeId);
    if (node?.kind !== 'route' || node.surface !== surface) continue;
    const key = `${run.runId}:${run.nodeId}:navigation:${node.routeId}`;
    const updated = await dispatchContentFlowCommand(run.runId, { type: 'navigation_acknowledged', navigationKey: key });
    if (updated) results.push(updated);
  }
  return results;
}

/** Re-drives durable automatic work after a cold launch or foreground. */
export async function resumeActiveContentFlows(isActive: () => boolean = () => true): Promise<ContentFlowRun[]> {
  const results: ContentFlowRun[] = [];
  const runs = await listContentFlowRuns({ activeOnly: true });
  for (const run of runs) {
    if (!isActive()) break;
    if (run.executionMode !== 'live' || run.phase === 'suspended') continue;
    if (!contentFlowDefinition(run.definitionId, run.definitionVersion)) {
      const migrated = await dispatchContentFlowCommand(run.runId, { type: 'retry' });
      if (migrated) results.push(migrated);
      continue;
    }
    const definition = contentFlowDefinition(run.definitionId, run.definitionVersion) ?? latestContentFlowDefinition(run.definitionId);
    if (!definition) continue;
    const stabilized = await reduceContentFlowRunAtomically({ runId: run.runId, reduce: (current) => stabilizeContentFlow(definition, current).run });
    if (!stabilized.run) continue;
    if (!isActive()) break;
    const resumed = await runPendingEffects(definition, stabilized.run, stabilizeContentFlow(definition, stabilized.run).pendingWork);
    results.push(resumed);
  }
  return results;
}

/**
 * Developer preview only: moves an existing journaled run to an authored node.
 * Durable effect receipts are deliberately retained, so previewing can never
 * charge or grant twice. Presentation/navigation receipts for the destination
 * are cleared so visual operations can be replayed.
 */
export async function previewContentFlowNodeForDebug(runId: string, nodeId: string): Promise<ContentFlowRun | null> {
  const current = await loadContentFlowRun(runId);
  if (!current) return null;
  const definition = contentFlowDefinition(current.definitionId, current.definitionVersion);
  const node = definition?.nodes.find((candidate) => candidate.id === nodeId);
  if (!definition || !node) throw new Error(`Unknown preview node ${nodeId}`);
  const now = Date.now();
  const result = await reduceContentFlowRunAtomically({
    runId,
    reduce: (run) => {
      const presentationReceipts = { ...run.presentationReceipts };
      const navigationReceipts = { ...run.navigationReceipts };
      const objectiveProgress = Object.fromEntries(Object.entries(run.objectiveProgress).filter(([key]) => !key.startsWith(`${nodeId}:`)));
      if (node.kind === 'presentation') delete presentationReceipts[`${run.runId}:${node.id}:presentation:${node.presentationId}`];
      if (node.kind === 'route') delete navigationReceipts[`${run.runId}:${node.id}:navigation:${node.routeId}`];
      return stabilizeContentFlow(definition, {
        ...run,
        completedAt: null,
        error: null,
        navigationReceipts,
        nodeId,
        objectiveProgress,
        phase: 'entering',
        presentationReceipts,
        status: 'active',
        updatedAt: now,
      }, now).run;
    },
  });
  if (!result.run) return null;
  return runPendingEffects(definition, result.run, stabilizeContentFlow(definition, result.run, now).pendingWork);
}
