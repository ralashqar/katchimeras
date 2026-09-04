import type { ContentFlowNode } from '@/types/content-flow';
import { MERGE_GENERATORS_BY_ID, MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { sharedWorldPurchase } from '@/constants/shared-world';
import { validateStoryTarget } from './story-targets';
import { STORY_CAMERA_PRESENTATION, STORY_WORLD_UPGRADE_EFFECT, STORY_WORLD_UPGRADE_PRESENTATION } from './story-world-operations';

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

function validateCameraPayload(payload: Readonly<Record<string, unknown>>) {
  if (payload.operation !== 'focus' && payload.operation !== 'fit' && payload.operation !== 'preserve' && payload.operation !== 'restore') return 'operation must be focus, fit, preserve, or restore';
  if (payload.operation === 'focus') return validateStoryTarget(payload.target);
  if (payload.operation === 'preserve') return null;
  if (payload.operation === 'fit') {
    if (!Array.isArray(payload.targets) || payload.targets.length === 0) return 'fit camera requires at least one target';
    return payload.targets.map(validateStoryTarget).find(Boolean) ?? null;
  }
  return typeof payload.snapshotId === 'string' && payload.snapshotId ? null : 'restore camera requires snapshotId';
}

function validateUpgradeEffect(payload: Readonly<Record<string, unknown>>) {
  const targetError = validateStoryTarget(payload.target);
  if (targetError) return targetError;
  const target = payload.target as { kind?: unknown; structureId?: unknown };
  if (target.kind === 'haven_structure' && (typeof target.structureId !== 'string' || !sharedWorldPurchase(target.structureId) || payload.toLevel !== 1 || (payload.economy as { mode?: string })?.mode !== 'normal')) return 'Unknown shared-world purchase';
  if (target.kind !== 'haven_tile' && target.kind !== 'haven_nature_island' && target.kind !== 'haven_structure') return 'world.upgrade target must be a Haven tile, shared-world tile, or nature island';
  if (!Number.isInteger(payload.toLevel) || Number(payload.toLevel) < 1) return 'toLevel must be a positive integer';
  if (!payload.economy || typeof payload.economy !== 'object') return 'economy policy is required';
  const economy = payload.economy as { mode?: unknown; amount?: unknown; reason?: unknown };
  if (economy.mode === 'normal') return null;
  if (economy.mode === 'free') return typeof economy.reason === 'string' && economy.reason ? null : 'free upgrades require a reason';
  if (economy.mode === 'grant') {
    if (!Number.isFinite(economy.amount) || Number(economy.amount) <= 0) return 'grant upgrades require a positive amount';
    return typeof economy.reason === 'string' && economy.reason ? null : 'grant upgrades require a reason';
  }
  return 'economy.mode must be normal, free, or grant';
}

function validateUpgradePresentation(payload: Readonly<Record<string, unknown>>) {
  return requiredString('sourceEffectNodeId')(payload)
    ?? requiredString('sourceEffectId')(payload)
    ?? requiredString('preset')(payload);
}

function validateMeditationEffect(payload: Readonly<Record<string, unknown>>) {
  if (typeof payload.familyId !== 'string' || !payload.familyId) return 'familyId must be a non-empty string';
  if (!Number.isFinite(payload.durationMs) || Number(payload.durationMs) <= 0) return 'durationMs must be positive';
  return payload.reason === 'journey_rest' ? null : 'reason must be journey_rest';
}

const BUILT_INS: readonly StoryCapabilityDefinition[] = [
  { id: 'journey.reflection', kind: 'scene', validatePayload: requiredString('text') },
  { id: 'journey.grant_generator_parcel', kind: 'effect', idempotent: true, validatePayload: (payload) =>
    typeof payload.generatorId === 'string' && MERGE_GENERATORS_BY_ID.has(payload.generatorId) ? requiredString('rewardId')(payload) : 'A known generator is required' },
  { id: 'world.action', kind: 'scene', validatePayload: (payload) => {
    const view = payload.worldAction as { kind?: string; actionLabel?: string; guide?: { title?: string; body?: string } } | undefined;
    return view && ['goal', 'garden', 'return', 'purchase', 'discovery'].includes(view.kind ?? '') && view.actionLabel && view.guide?.title && view.guide.body ? null : 'World action needs a view, guide and action label';
  } },
  { id: 'merge.lesson', kind: 'task', validatePayload: (payload) => {
    const beat = payload.beat as Record<string, unknown> | undefined;
    if (!beat || typeof beat.id !== 'string' || !beat.guide) return 'Lesson needs an id and guide';
    if (beat.kind === 'spawn') return typeof beat.generatorId === 'string' && MERGE_GENERATORS_BY_ID.has(beat.generatorId) ? null : 'Lesson needs a known generator';
    if (beat.kind === 'match') return typeof beat.definitionId === 'string' && MERGE_ITEMS_BY_ID.has(beat.definitionId) && typeof beat.echoId === 'string' && beat.echoId ? null : 'Lesson needs a known item and bound target';
    if (beat.kind === 'serve' || beat.kind === 'practice') return typeof beat.orderId === 'string' && beat.orderId ? null : 'Lesson needs a request';
    return 'Unknown lesson kind';
  } },
  { id: 'glow.discovery.scene', kind: 'scene' },
  { id: 'glow.discovery.task', kind: 'task' },
  ...['haven.start_glow_discovery', 'glow.lesson.prepare'].map((id) => ({ id, kind: 'effect' as const, idempotent: true })),
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
  { id: STORY_CAMERA_PRESENTATION, kind: 'presentation', validatePayload: validateCameraPayload },
  { id: STORY_WORLD_UPGRADE_PRESENTATION, kind: 'presentation', validatePayload: validateUpgradePresentation },
  { id: 'story.route', kind: 'route' },
  { id: 'resident.grant_parcel', kind: 'effect', idempotent: true },
  { id: 'optional_action.publish', kind: 'effect', idempotent: true },
  { id: 'relationship.complete_day_one_lesson', kind: 'effect', idempotent: true },
  { id: 'relationship.first_bloom_bond', kind: 'effect', idempotent: true },
  { id: 'relationship.begin_meditation', kind: 'effect', idempotent: true, validatePayload: validateMeditationEffect },
  { id: 'haven.grant_first_memory', kind: 'effect', idempotent: true },
  { id: 'haven.prepare_merge_handoff', kind: 'effect', idempotent: true },
  { id: 'haven.place_first_memory', kind: 'effect', idempotent: true },
  { id: 'haven.grow_first_memory', kind: 'effect', idempotent: true },
  { id: 'haven.feature.upgrade', kind: 'effect', idempotent: true },
  { id: 'haven.movement_egg.reveal', kind: 'effect', idempotent: true },
  { id: 'haven.reveal', kind: 'effect', idempotent: true },
  { id: 'story.reward_effect', kind: 'effect', idempotent: true },
  { id: STORY_WORLD_UPGRADE_EFFECT, kind: 'effect', idempotent: true, validatePayload: validateUpgradeEffect },
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
