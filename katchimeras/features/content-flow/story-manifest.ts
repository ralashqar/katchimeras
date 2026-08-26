import type {
  ContentFlowAction,
  ContentFlowDefinition,
  ContentFlowNode,
  ContentFlowReadinessGate,
  ContentFlowRequirement,
  ContentFlowSurface,
  StoryRouteId,
} from '@/types/content-flow';

import { defineContentFlow } from './content-flow-compiler';
import { storyRoute } from './story-route-registry';

type Payload = Readonly<Record<string, unknown>>;

export type StoryManifest = ContentFlowDefinition & {
  metadata: Readonly<Record<string, unknown>> & { kind: 'ftue' | 'journey_day' | 'child_action' | 'story' };
};

export function defineStory<T extends StoryManifest>(manifest: T): T {
  return defineContentFlow(manifest) as T;
}

export const story = {
  conversation(input: { id: string; conversationId: string; next: string; payload?: Payload; actions?: readonly ContentFlowAction[] }): ContentFlowNode {
    return { id: input.id, kind: 'scene', capability: 'story.conversation', surface: 'companion', sceneId: input.conversationId, payload: input.payload, actions: input.actions ?? [{ id: 'conversation.completed', next: input.next }] };
  },
  questionnaire(input: { id: string; conversationId: string; next: string; payload?: Payload; actions?: readonly ContentFlowAction[] }): ContentFlowNode {
    return { id: input.id, kind: 'scene', capability: 'story.questionnaire', surface: 'companion', sceneId: input.conversationId, payload: input.payload, actions: input.actions ?? [{ id: 'questionnaire.completed', next: input.next }] };
  },
  task(input: { id: string; capability: string; surface: ContentFlowSurface; taskId: string; requirements: readonly ContentFlowRequirement[]; next: string; mode?: 'all' | 'any'; payload?: Payload }): ContentFlowNode {
    return { ...input, kind: 'task' };
  },
  effect(input: { id: string; capability: string; effectId?: string; effectType?: string; next: string; payload?: Payload }): ContentFlowNode {
    return { id: input.id, kind: 'effect', capability: input.capability, effectId: input.effectId ?? input.id, effectType: input.effectType ?? input.capability, payload: input.payload, next: input.next };
  },
  presentation(input: { id: string; capability: string; presentationId?: string; presentationType?: string; surface: ContentFlowSurface; next: string; payload?: Payload; replayPolicy?: 'replay' | 'continue' }): ContentFlowNode {
    return { id: input.id, kind: 'presentation', capability: input.capability, presentationId: input.presentationId ?? input.id, presentationType: input.presentationType ?? input.capability, surface: input.surface, next: input.next, payload: input.payload, replayPolicy: input.replayPolicy ?? 'replay' };
  },
  route(input: { id: string; route: StoryRouteId; next: string; params?: Readonly<Record<string, string>>; lock?: boolean; readiness?: readonly ContentFlowReadinessGate[] }): ContentFlowNode {
    const target = storyRoute(input.route, input.params);
    return { id: input.id, kind: 'route', capability: 'story.route', routeId: input.id, target, surface: target.surface, lock: input.lock ?? false, backPolicy: input.lock ? 'locked' : 'pause', readiness: input.readiness ?? ['route', 'data', 'layout', 'background', 'foreground'], next: input.next };
  },
  complete(id = 'complete'): ContentFlowNode {
    return { id, kind: 'complete' };
  },
};
