import { defineContentFlow } from '@/features/content-flow/content-flow-compiler';
import type { ContentFlowDefinition, ContentFlowEventMatcher, ContentFlowNode } from '@/types/content-flow';
import type { FtueEventMatcher, FtueScriptDefinition, FtueStepDefinition } from '@/features/onboarding/ftue-types';

function matcher(input: FtueEventMatcher): ContentFlowEventMatcher {
  const { type, ...where } = input;
  return { type: `ftue.${type}`, where: where as ContentFlowEventMatcher['where'] };
}

function compileStep(step: FtueStepDefinition, terminalStepId: string): ContentFlowNode {
  if (step.id === terminalStepId) return { id: step.id, kind: 'complete' };
  if (step.edges?.length) {
    return {
      id: step.id,
      kind: 'task',
      surface: step.surface,
      taskId: `ftue:${step.id}`,
      payload: { legacyFtueStepId: step.id },
      mode: 'any',
      requirements: step.edges.map((edge) => ({ id: edge.commitActionId, event: matcher(edge.event), count: edge.requiredCount, next: edge.nextStepId })),
      next: step.edges[0]!.nextStepId,
    };
  }
  return {
    id: step.id,
    kind: 'scene',
    surface: step.surface,
    sceneId: `ftue:${step.id}`,
    payload: { legacyFtueStepId: step.id },
    actions: step.actions.map((action) => ({ id: action.id, next: action.nextStepId ?? step.id })),
  };
}

export function compileFtueFlow(script: FtueScriptDefinition): ContentFlowDefinition {
  // Released scripts retain retired nodes so old save migrations and targeted
  // debug fixtures can still name them. The executable manifest contains only
  // the graph reachable from this version's entry; retired content cannot
  // accidentally become a second runtime path.
  const byId = new Map(script.steps.map((step) => [step.id, step]));
  const reachable = new Set<string>();
  const stack = [script.entryStepId];
  while (stack.length) {
    const id = stack.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    const step = byId.get(id);
    if (!step) continue;
    stack.push(...(step.edges?.map((edge) => edge.nextStepId) ?? []));
    stack.push(...step.actions.flatMap((action) => action.nextStepId ? [action.nextStepId] : []));
  }
  return defineContentFlow({
    id: script.id,
    version: script.version,
    entryNodeId: script.entryStepId,
    nodes: script.steps.filter((step) => reachable.has(step.id)).map((step) => compileStep(step, script.terminalStepId)),
    metadata: { kind: 'ftue', legacyAdapter: true, retiredNodeIds: script.steps.filter((step) => !reachable.has(step.id)).map((step) => step.id) },
  });
}
