import type { ContentFlowNode, ContentFlowSurface } from '@/types/content-flow';
import { defineStory, story } from './story-manifest';

export function conversationScene(input: {
  id: string;
  conversationId: string;
  next: string;
  questionnaire?: boolean;
  payload?: Readonly<Record<string, unknown>>;
}): ContentFlowNode {
  return {
    id: input.id,
    kind: 'scene',
    capability: input.questionnaire ? 'story.questionnaire' : 'story.conversation',
    surface: 'companion',
    sceneId: input.conversationId,
    payload: input.payload,
    actions: [{ id: input.questionnaire ? 'questionnaire.completed' : 'conversation.completed', next: input.next }],
  };
}

export function mergeOrderTask(input: {
  id: string;
  objectiveId: string;
  orderIds: readonly string[];
  orders?: unknown;
  next: string;
}): ContentFlowNode {
  return {
    id: input.id,
    kind: 'task',
    capability: 'merge.orders',
    surface: 'merge',
    taskId: input.objectiveId,
    payload: { objectiveId: input.objectiveId, orders: input.orders },
    requirements: input.orderIds.map((orderId) => ({ id: orderId, event: { type: 'merge.order_served', where: { objectiveId: input.objectiveId, orderId } } })),
    next: input.next,
  };
}

export function residentDiscoveryChapter(input: {
  id: string;
  selection: string;
  next: string;
}): ContentFlowNode[] {
  const prefix = input.id;
  const payload = {
    selection: input.selection,
    sealedCardDefinitionId: 'mossprout:resident-card:sealed',
    requestCount: 2,
  };
  return [
    story.effect({ id: prefix, capability: 'resident.grant_parcel', effectId: 'grant-parcel', payload, next: `${prefix}:open-garden` }),
    story.route({ id: `${prefix}:open-garden`, route: 'merge', lock: true, next: `${prefix}:parcel`, readiness: ['route', 'data', 'layout', 'background', 'foreground', 'interaction_target'] }),
    story.task({ id: `${prefix}:parcel`, capability: 'resident.parcel', surface: 'merge', taskId: 'claim-resident-parcel', payload, requirements: [{ id: 'parcel', event: { type: 'resident.parcel_claimed' } }], next: `${prefix}:revealed` }),
    story.task({ id: `${prefix}:revealed`, capability: 'resident.reveal', surface: 'merge', taskId: 'reveal-resident', payload, requirements: [{ id: 'reveal', event: { type: 'resident.revealed' } }], next: `${prefix}:dialogue` }),
    story.presentation({ id: `${prefix}:dialogue`, capability: 'resident.dialogue', surface: 'merge', presentationId: 'resident-dialogue', payload, next: `${prefix}:orders` }),
    story.task({ id: `${prefix}:orders`, capability: 'resident.orders', surface: 'merge', taskId: 'resident-orders', payload, requirements: [{ id: 'orders', event: { type: 'resident.orders_completed' } }], next: `${prefix}:card-reward` }),
    story.presentation({ id: `${prefix}:card-reward`, capability: 'resident.card_reward', surface: 'collection', presentationId: 'resident-card-reward', payload, replayPolicy: 'continue', next: input.next }),
  ];
}

export function rewardedChildActionFlow(input: {
  id: string;
  version: number;
  sceneId: string;
  rewardEffectType: string;
  rewardPresentationType: string;
  surface?: ContentFlowSurface;
}) {
  return defineStory({
    id: input.id,
    version: input.version,
    entryNodeId: 'activity',
    nodes: [
      { id: 'activity', kind: 'scene', capability: 'story.conversation', surface: input.surface ?? 'companion', sceneId: input.sceneId, actions: [{ id: 'activity.completed', next: 'reward' }] },
      { id: 'reward', kind: 'effect', capability: 'story.reward_effect', effectId: 'reward', effectType: input.rewardEffectType, next: 'reward-presentation' },
      { id: 'reward-presentation', kind: 'presentation', capability: 'story.reward', surface: 'companion', presentationId: 'reward', presentationType: input.rewardPresentationType, replayPolicy: 'replay', next: 'complete' },
      { id: 'complete', kind: 'complete' },
    ],
    metadata: { kind: 'child_action' as const },
  });
}
