import type {
  ContentFlowCommand,
  ContentFlowDefinition,
  ContentFlowEvent,
  ContentFlowEventMatcher,
  ContentFlowNode,
  ContentFlowPendingWork,
  ContentFlowRun,
  ContentFlowTransition,
} from './types';

const MAX_AUTOMATIC_TRANSITIONS = 100;

export function contentFlowEffectKey(run: Pick<ContentFlowRun, 'runId' | 'nodeId'>, effectId: string) {
  return `${run.runId}:${run.nodeId}:effect:${effectId}`;
}

export function contentFlowPresentationKey(run: Pick<ContentFlowRun, 'runId' | 'nodeId'>, presentationId: string) {
  return `${run.runId}:${run.nodeId}:presentation:${presentationId}`;
}

export function contentFlowNavigationKey(run: Pick<ContentFlowRun, 'runId' | 'nodeId'>, routeId: string) {
  return `${run.runId}:${run.nodeId}:navigation:${routeId}`;
}

export function createContentFlowRun(
  definition: ContentFlowDefinition,
  input: { runId: string; parentRunId?: string | null; variables?: ContentFlowRun['variables']; now?: number },
): ContentFlowRun {
  const now = input.now ?? Date.now();
  return stabilizeContentFlow(definition, {
    schemaVersion: 1,
    executionMode: 'live',
    runId: input.runId,
    definitionId: definition.id,
    definitionVersion: definition.version,
    nodeId: definition.entryNodeId,
    phase: 'entering',
    status: 'active',
    parentRunId: input.parentRunId ?? null,
    variables: { ...input.variables },
    objectiveProgress: {},
    effectReceipts: {},
    presentationReceipts: {},
    navigationReceipts: {},
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    error: null,
    revision: 0,
  }, now).run;
}

export function contentFlowEventMatches(matcher: ContentFlowEventMatcher, event: ContentFlowEvent): boolean {
  if (matcher.type !== event.type) return false;
  return Object.entries(matcher.where ?? {}).every(([key, value]) => {
    if (key === 'objectiveId') return event.objectiveId === value;
    if (key === 'runId') return event.runId === value;
    if (key === 'nodeId') return event.nodeId === value;
    const actual = event.payload[key];
    return actual === value || (typeof actual === 'object' && actual != null && typeof value === 'object' && value != null && JSON.stringify(actual) === JSON.stringify(value));
  });
}

function nodeFor(definition: ContentFlowDefinition, id: string): ContentFlowNode {
  const node = definition.nodes.find((candidate) => candidate.id === id);
  if (!node) throw new Error(`Flow ${definition.id}@${definition.version} is missing node ${id}`);
  return node;
}

function pendingWorkFor(run: ContentFlowRun, node: ContentFlowNode): ContentFlowPendingWork {
  if (node.kind === 'effect') return { kind: 'effect', key: contentFlowEffectKey(run, node.effectId), effectType: node.effectType, payload: node.payload ?? {} };
  if (node.kind === 'presentation') return { kind: 'presentation', key: contentFlowPresentationKey(run, node.presentationId), presentationType: node.presentationType, payload: node.payload ?? {}, replayPolicy: node.replayPolicy ?? 'replay' };
  if (node.kind === 'route') return {
    kind: 'navigation',
    key: contentFlowNavigationKey(run, node.routeId),
    target: node.target,
    surface: node.surface,
    lock: node.lock ?? false,
    backPolicy: node.backPolicy ?? (node.lock ? 'locked' : 'pause'),
    readiness: node.readiness ?? ['route', 'data', 'layout', 'background', 'foreground'],
  };
  return { kind: 'none' };
}

export function stabilizeContentFlow(definition: ContentFlowDefinition, input: ContentFlowRun, now = Date.now()): ContentFlowTransition {
  let run = input;
  for (let index = 0; index < MAX_AUTOMATIC_TRANSITIONS; index += 1) {
    if (run.status !== 'active') return { run, pendingWork: { kind: 'none' }, consumedEvent: false };
    const node = nodeFor(definition, run.nodeId);
    if (node.kind === 'complete') {
      run = { ...run, phase: 'completed', status: 'completed', completedAt: now, updatedAt: now };
      return { run, pendingWork: { kind: 'none' }, consumedEvent: false };
    }
    if (node.kind === 'branch') {
      const match = node.branches.find((branch) => run.variables[branch.variable] === branch.equals);
      run = { ...run, nodeId: match?.next ?? node.fallback, phase: 'entering', updatedAt: now };
      continue;
    }
    if (node.kind === 'effect') {
      const key = contentFlowEffectKey(run, node.effectId);
      if (run.effectReceipts[key]) {
        run = { ...run, nodeId: node.next, phase: 'entering', updatedAt: now };
        continue;
      }
      if (run.phase !== 'awaiting_effect') run = { ...run, phase: 'awaiting_effect', updatedAt: now };
      return { run, pendingWork: pendingWorkFor(run, node), consumedEvent: false };
    }
    if (node.kind === 'presentation') {
      const key = contentFlowPresentationKey(run, node.presentationId);
      if (run.presentationReceipts[key]) {
        run = { ...run, nodeId: node.next, phase: 'entering', updatedAt: now };
        continue;
      }
      if (run.phase !== 'awaiting_presentation') run = { ...run, phase: 'awaiting_presentation', updatedAt: now };
      return { run, pendingWork: pendingWorkFor(run, node), consumedEvent: false };
    }
    if (node.kind === 'route') {
      const key = contentFlowNavigationKey(run, node.routeId);
      if (run.navigationReceipts[key]) {
        run = { ...run, nodeId: node.next, phase: 'entering', updatedAt: now };
        continue;
      }
      if (run.phase !== 'awaiting_navigation') run = { ...run, phase: 'awaiting_navigation', updatedAt: now };
      return { run, pendingWork: pendingWorkFor(run, node), consumedEvent: false };
    }
    const phase = node.kind === 'scene' ? 'awaiting_input' : 'awaiting_event';
    if (run.phase !== phase) run = { ...run, phase, updatedAt: now };
    return { run, pendingWork: { kind: 'none' }, consumedEvent: false };
  }
  return {
    run: { ...run, phase: 'failed_recoverable', status: 'failed_recoverable', error: 'Automatic transition limit exceeded', updatedAt: now },
    pendingWork: { kind: 'none' },
    consumedEvent: false,
  };
}

export function reduceContentFlow(definition: ContentFlowDefinition, input: ContentFlowRun, command: ContentFlowCommand): ContentFlowTransition {
  const now = command.now ?? Date.now();
  if (input.definitionId !== definition.id || input.definitionVersion !== definition.version) {
    return { run: { ...input, phase: 'failed_recoverable', status: 'failed_recoverable', error: 'Definition version mismatch', updatedAt: now }, pendingWork: { kind: 'none' }, consumedEvent: false };
  }
  if (command.type === 'retry') return stabilizeContentFlow(definition, { ...input, status: 'active', phase: 'entering', error: null, updatedAt: now }, now);
  if (command.type === 'fail') return { run: { ...input, phase: 'failed_recoverable', status: 'failed_recoverable', error: command.message, updatedAt: now }, pendingWork: { kind: 'none' }, consumedEvent: false };
  if (input.status !== 'active') return { run: input, pendingWork: { kind: 'none' }, consumedEvent: false };

  const node = nodeFor(definition, input.nodeId);
  if (command.type === 'submit_scene') {
    if (node.kind !== 'scene' || input.phase !== 'awaiting_input') return stabilizeContentFlow(definition, input, now);
    const action = node.actions.find((candidate) => candidate.id === command.actionId);
    if (!action) return stabilizeContentFlow(definition, input, now);
    return stabilizeContentFlow(definition, {
      ...input,
      nodeId: action.next,
      phase: 'entering',
      variables: { ...input.variables, ...action.set, ...command.values },
      updatedAt: now,
    }, now);
  }
  if (command.type === 'record_event') {
    if (node.kind !== 'task' || input.phase !== 'awaiting_event') return stabilizeContentFlow(definition, input, now);
    if (command.event.runId !== input.runId || command.event.nodeId !== input.nodeId) return stabilizeContentFlow(definition, input, now);
    const requirement = node.requirements.find((candidate) => contentFlowEventMatches(candidate.event, command.event));
    if (!requirement) return stabilizeContentFlow(definition, input, now);
    const key = `${node.id}:${requirement.id}`;
    const progress = { ...input.objectiveProgress, [key]: Math.min((input.objectiveProgress[key] ?? 0) + 1, requirement.count ?? 1) };
    const satisfied = (candidate: ContentFlowRequirement) => (progress[`${node.id}:${candidate.id}`] ?? 0) >= (candidate.count ?? 1);
    const complete = (node.mode ?? 'all') === 'all' ? node.requirements.every(satisfied) : node.requirements.some(satisfied);
    const nextNodeId = complete ? requirement.next ?? node.next : input.nodeId;
    return {
      ...stabilizeContentFlow(definition, { ...input, nodeId: nextNodeId, phase: complete ? 'entering' : 'awaiting_event', objectiveProgress: progress, updatedAt: now }, now),
      consumedEvent: true,
    };
  }
  if (command.type === 'effect_completed') {
    if (node.kind !== 'effect' || command.effectKey !== contentFlowEffectKey(input, node.effectId)) return stabilizeContentFlow(definition, input, now);
    return stabilizeContentFlow(definition, { ...input, effectReceipts: { ...input.effectReceipts, [command.effectKey]: { completedAt: now, result: command.result } }, updatedAt: now }, now);
  }
  if (command.type === 'presentation_acknowledged') {
    if (node.kind !== 'presentation' || command.presentationKey !== contentFlowPresentationKey(input, node.presentationId)) return stabilizeContentFlow(definition, input, now);
    return stabilizeContentFlow(definition, { ...input, presentationReceipts: { ...input.presentationReceipts, [command.presentationKey]: { acknowledgedAt: now } }, updatedAt: now }, now);
  }
  if (command.type === 'navigation_acknowledged') {
    if (node.kind !== 'route' || command.navigationKey !== contentFlowNavigationKey(input, node.routeId)) return stabilizeContentFlow(definition, input, now);
    return stabilizeContentFlow(definition, { ...input, navigationReceipts: { ...input.navigationReceipts, [command.navigationKey]: { acknowledgedAt: now } }, updatedAt: now }, now);
  }
  return stabilizeContentFlow(definition, input, now);
}

type ContentFlowRequirement = Extract<ContentFlowNode, { kind: 'task' }>['requirements'][number];
