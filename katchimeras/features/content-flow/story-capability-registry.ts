import type { ContentFlowNode } from '@/types/content-flow';

export type StoryCapabilityKind = ContentFlowNode['kind'];

export type StoryCapabilityDefinition = {
  id: string;
  kind: StoryCapabilityKind;
  /** Effects must accept the durable effect key and apply it idempotently. */
  idempotent?: boolean;
  validatePayload?: (payload: Readonly<Record<string, unknown>>) => string | null;
};

const capabilities = new Map<string, StoryCapabilityDefinition>();

function requiredString(key: string) {
  return (payload: Readonly<Record<string, unknown>>) => typeof payload[key] === 'string' && payload[key]
    ? null
    : `${key} must be a non-empty string`;
}

const BUILT_INS: readonly StoryCapabilityDefinition[] = [
  { id: 'legacy.ftue.scene', kind: 'scene' },
  { id: 'legacy.ftue.task', kind: 'task' },
  { id: 'story.conversation', kind: 'scene' },
  { id: 'story.questionnaire', kind: 'scene' },
  { id: 'merge.orders', kind: 'task', validatePayload: requiredString('objectiveId') },
  { id: 'resident.parcel', kind: 'task' },
  { id: 'resident.reveal', kind: 'task' },
  { id: 'resident.orders', kind: 'task' },
  { id: 'resident.dialogue', kind: 'presentation' },
  { id: 'resident.card_reward', kind: 'presentation' },
  { id: 'story.reward', kind: 'presentation' },
  { id: 'story.route', kind: 'route' },
  { id: 'resident.grant_parcel', kind: 'effect', idempotent: true },
  { id: 'optional_action.publish', kind: 'effect', idempotent: true },
  { id: 'relationship.complete_day_one_lesson', kind: 'effect', idempotent: true },
  { id: 'story.reward_effect', kind: 'effect', idempotent: true },
];

BUILT_INS.forEach((capability) => capabilities.set(capability.id, capability));

export function registerStoryCapability(definition: StoryCapabilityDefinition) {
  const existing = capabilities.get(definition.id);
  if (existing && existing !== definition) {
    if (existing.kind !== definition.kind) throw new Error(`Story capability ${definition.id} is already registered as ${existing.kind}`);
    return existing;
  }
  capabilities.set(definition.id, definition);
  return definition;
}

export function storyCapability(id: string) {
  return capabilities.get(id) ?? null;
}

export function registeredStoryCapabilities() {
  return [...capabilities.values()];
}

export function validateStoryNodeCapability(node: Exclude<ContentFlowNode, { kind: 'branch' | 'complete' }>): string | null {
  const capability = storyCapability(node.capability);
  if (!capability) return `Unknown capability ${node.capability}`;
  if (capability.kind !== node.kind) return `Capability ${node.capability} renders ${capability.kind}, not ${node.kind}`;
  if (node.kind === 'effect' && !capability.idempotent) return `Effect capability ${node.capability} must declare idempotent execution`;
  const payload = 'payload' in node ? node.payload ?? {} : {};
  return capability.validatePayload?.(payload) ?? null;
}
