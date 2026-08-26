import type { ContentFlowDefinition, ContentFlowEventMatcher, ContentFlowNode } from '@/types/content-flow';
import type { FtueEventMatcher, FtueScriptDefinition, FtueStepDefinition } from '@/features/onboarding/ftue-types';
import { defineStory } from './story-manifest';

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
      capability: 'legacy.ftue.task',
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
    capability: 'legacy.ftue.scene',
    surface: step.surface,
    sceneId: `ftue:${step.id}`,
    payload: { legacyFtueStepId: step.id },
    actions: step.actions.flatMap((action) => {
      const optionTargets = action.options?.map((option) => option.nextStepId ?? action.nextStepId ?? step.id) ?? [];
      const targets = [...new Set(optionTargets.length ? optionTargets : [action.nextStepId ?? step.id])];
      return targets.map((next, index) => ({
        id: index === 0 ? action.id : `${action.id}#branch-${index}`,
        next,
      }));
    }),
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
    stack.push(...step.actions.flatMap((action) => action.options?.flatMap((option) => option.nextStepId ? [option.nextStepId] : []) ?? []));
  }
  const nodes = script.steps.filter((step) => reachable.has(step.id)).map((step) => compileStep(step, script.terminalStepId));
  const dayOneEffectNodeId = 'effect.relationship.complete_day_one_lesson';
  const dayOneSceneIndex = nodes.findIndex((node) => node.kind === 'scene'
    && node.actions.some((action) => action.id === 'companion.complete_day_one_action'));
  if (dayOneSceneIndex >= 0) {
    const scene = nodes[dayOneSceneIndex]!;
    if (scene.kind === 'scene') {
      const dayOneAction = scene.actions.find((action) => action.id === 'companion.complete_day_one_action')!;
      nodes[dayOneSceneIndex] = {
        ...scene,
        actions: scene.actions.map((action) => action.id === dayOneAction.id
          ? { ...action, next: dayOneEffectNodeId }
          : action),
      };
      nodes.push({
        id: dayOneEffectNodeId,
        kind: 'effect',
        capability: 'relationship.complete_day_one_lesson',
        effectId: 'relationship.complete_day_one_lesson',
        effectType: 'relationship.complete_day_one_lesson',
        payload: {},
        next: dayOneAction.next,
      });
    }
  }
  return defineStory({
    id: script.id,
    version: script.version,
    entryNodeId: script.entryStepId,
    nodes,
    metadata: { kind: 'ftue' as const, legacyAdapter: true, retiredNodeIds: script.steps.filter((step) => !reachable.has(step.id)).map((step) => step.id) },
  });
}
