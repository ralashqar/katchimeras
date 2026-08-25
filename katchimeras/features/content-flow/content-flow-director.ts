import { createClientId } from '@/utils/client-id';
import type { ContentFlowCommand, ContentFlowDefinition, ContentFlowEvent, ContentFlowPendingWork, ContentFlowRun } from '@/types/content-flow';

import { contentFlowEffectHandler, validatePendingContentFlowWork } from './content-flow-capabilities';
import { contentFlowDefinition, registerContentFlowDefinition } from './content-flow-catalog';
import { contentFlowEventMatches, createContentFlowRun, reduceContentFlow, stabilizeContentFlow } from './content-flow-interpreter';
import { listContentFlowRuns, loadContentFlowRun, saveContentFlowTransition } from './content-flow-repository';

const workInFlight = new Set<string>();

async function persistAndRunEffects(definition: ContentFlowDefinition, run: ContentFlowRun, pendingWork: ContentFlowPendingWork): Promise<ContentFlowRun> {
  await saveContentFlowTransition(run);
  if (pendingWork.kind !== 'effect') return run;
  if (workInFlight.has(pendingWork.key)) return run;
  const error = validatePendingContentFlowWork(pendingWork);
  if (error) {
    const failed = reduceContentFlow(definition, run, { type: 'fail', message: error }).run;
    await saveContentFlowTransition(failed);
    return failed;
  }
  workInFlight.add(pendingWork.key);
  try {
    const result = await contentFlowEffectHandler(pendingWork.effectType)!({ run, effectKey: pendingWork.key, payload: pendingWork.payload });
    const transition = reduceContentFlow(definition, run, { type: 'effect_completed', effectKey: pendingWork.key, result });
    return persistAndRunEffects(definition, transition.run, transition.pendingWork);
  } catch (caught) {
    const failed = reduceContentFlow(definition, run, { type: 'fail', message: caught instanceof Error ? caught.message : 'Content flow effect failed' }).run;
    await saveContentFlowTransition(failed);
    return failed;
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
  return persistAndRunEffects(definition, run, stabilizeContentFlow(definition, run, input.now).pendingWork);
}

export async function dispatchContentFlowCommand(runId: string, command: ContentFlowCommand): Promise<ContentFlowRun | null> {
  const run = await loadContentFlowRun(runId);
  if (!run) return null;
  const definition = contentFlowDefinition(run.definitionId, run.definitionVersion);
  if (!definition) {
    const failed = { ...run, phase: 'failed_recoverable' as const, status: 'failed_recoverable' as const, error: `Missing definition ${run.definitionId}@${run.definitionVersion}`, updatedAt: Date.now() };
    await saveContentFlowTransition(failed);
    return failed;
  }
  if (command.type === 'record_event' && await import('./content-flow-repository').then(({ contentFlowEventWasRecorded }) => contentFlowEventWasRecorded(command.event.eventId))) return run;
  const transition = reduceContentFlow(definition, run, command);
  await saveContentFlowTransition(transition.run, command.type === 'record_event' ? command.event : undefined);
  return persistAndRunEffects(definition, transition.run, transition.pendingWork);
}

export async function startChildContentFlow(parentRunId: string, definition: ContentFlowDefinition, variables?: ContentFlowRun['variables']) {
  const parent = await loadContentFlowRun(parentRunId);
  if (!parent || parent.status !== 'active') throw new Error(`Cannot suspend inactive parent flow ${parentRunId}`);
  await saveContentFlowTransition({ ...parent, phase: 'suspended', updatedAt: Date.now() });
  return startContentFlow(definition, { parentRunId, variables });
}

export async function completeChildAndResumeParent(childRunId: string): Promise<ContentFlowRun | null> {
  const child = await loadContentFlowRun(childRunId);
  if (!child || child.status !== 'completed' || !child.parentRunId) return null;
  const parent = await loadContentFlowRun(child.parentRunId);
  if (!parent || parent.status !== 'active' || parent.phase !== 'suspended') return parent;
  const definition = contentFlowDefinition(parent.definitionId, parent.definitionVersion);
  if (!definition) return parent;
  const resumed = stabilizeContentFlow(definition, { ...parent, phase: 'entering', updatedAt: Date.now() });
  return persistAndRunEffects(definition, resumed.run, resumed.pendingWork);
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
