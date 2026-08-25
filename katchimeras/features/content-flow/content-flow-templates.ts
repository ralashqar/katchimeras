import { defineContentFlow } from './content-flow-compiler';
import type { ContentFlowNode, ContentFlowSurface } from '@/types/content-flow';

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
    { id: prefix, kind: 'effect', effectId: 'grant-parcel', effectType: 'resident.grant_parcel', payload, next: `${prefix}:open-garden` },
    { id: `${prefix}:open-garden`, kind: 'route', routeId: 'open-garden', route: '/game/merge-world', surface: 'merge', lock: true, next: `${prefix}:parcel` },
    { id: `${prefix}:parcel`, kind: 'task', surface: 'merge', taskId: 'claim-resident-parcel', payload, requirements: [{ id: 'parcel', event: { type: 'resident.parcel_claimed' } }], next: `${prefix}:revealed` },
    { id: `${prefix}:revealed`, kind: 'task', surface: 'merge', taskId: 'reveal-resident', payload, requirements: [{ id: 'reveal', event: { type: 'resident.revealed' } }], next: `${prefix}:dialogue` },
    { id: `${prefix}:dialogue`, kind: 'presentation', surface: 'merge', presentationId: 'resident-dialogue', presentationType: 'resident.dialogue', payload, next: `${prefix}:orders` },
    { id: `${prefix}:orders`, kind: 'task', surface: 'merge', taskId: 'resident-orders', payload, requirements: [{ id: 'orders', event: { type: 'resident.orders_completed' } }], next: `${prefix}:card-reward` },
    { id: `${prefix}:card-reward`, kind: 'presentation', surface: 'collection', presentationId: 'resident-card-reward', presentationType: 'resident.card_reward', payload, replayPolicy: 'continue', next: input.next },
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
  return defineContentFlow({
    id: input.id,
    version: input.version,
    entryNodeId: 'activity',
    nodes: [
      { id: 'activity', kind: 'scene', surface: input.surface ?? 'companion', sceneId: input.sceneId, actions: [{ id: 'activity.completed', next: 'reward' }] },
      { id: 'reward', kind: 'effect', effectId: 'reward', effectType: input.rewardEffectType, next: 'reward-presentation' },
      { id: 'reward-presentation', kind: 'presentation', surface: 'companion', presentationId: 'reward', presentationType: input.rewardPresentationType, replayPolicy: 'replay', next: 'complete' },
      { id: 'complete', kind: 'complete' },
    ],
    metadata: { kind: 'child_action' },
  });
}
