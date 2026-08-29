import { katchimeraSkins, type KatchimeraSkinDefinition } from '@/constants/katchimera-skins';
import { MERGE_ORDER_TEMPLATES, type MergeOrderTemplate } from '@/constants/merge-world-catalog';
import type { MergeCharacterId, MergeOrder } from '@/types/merge-world';

export const DEV_HAVEN_ORDER_FILLER_PREFIX = 'dev-haven-order-filler:';

export function isDevHavenOrderFiller(order: MergeOrder): boolean {
  return order.id.startsWith(DEV_HAVEN_ORDER_FILLER_PREFIX);
}

export function devHavenOrderFillerSlot(order: MergeOrder): number | null {
  if (!isDevHavenOrderFiller(order)) return null;
  const slotIndex = Number.parseInt(order.id.slice(DEV_HAVEN_ORDER_FILLER_PREFIX.length).split(':')[0] ?? '', 10);
  return Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex < 3 ? slotIndex : null;
}

export function devHavenOrderFillersForSlots(
  existingOrders: readonly MergeOrder[],
  slotSeeds: readonly [number, number, number],
  templates: readonly MergeOrderTemplate[] = MERGE_ORDER_TEMPLATES,
  skins: readonly KatchimeraSkinDefinition[] = katchimeraSkins,
): MergeOrder[] {
  return devHavenOrderFillersForFamilySlots('mossprout', existingOrders, slotSeeds, templates, skins);
}

export function devHavenOrderFillersForFamilySlots(
  characterId: MergeCharacterId,
  existingOrders: readonly MergeOrder[],
  slotSeeds: readonly [number, number, number],
  templates: readonly MergeOrderTemplate[] = MERGE_ORDER_TEMPLATES,
  skins: readonly KatchimeraSkinDefinition[] = katchimeraSkins,
): MergeOrder[] {
  const eligibleSkins = eligibleFamilySkins(characterId, skins);
  const familyTemplates = templates.filter((template) => template.characterId === characterId);
  if (eligibleSkins.length === 0 || familyTemplates.length === 0) return [];

  const existingRecipientSkinIds = new Set(existingOrders.flatMap((order) => (
    order.recipientSkinId ? [order.recipientSkinId] : []
  )));
  return slotSeeds.slice(existingOrders.length).map((seed, fillerIndex) => {
    const slotIndex = existingOrders.length + fillerIndex;
    const skin = [...eligibleSkins]
      .filter((candidate) => !existingRecipientSkinIds.has(candidate.id))
      .sort((left, right) => (
        seededRank(`${slotIndex}:${left.id}`, seed) - seededRank(`${slotIndex}:${right.id}`, seed)
        || left.id.localeCompare(right.id)
      ))[0] ?? eligibleSkins[0]!;
    existingRecipientSkinIds.add(skin.id);
    const template = [...familyTemplates].sort((left, right) => (
      seededRank(`${slotIndex}:${left.key}`, seed) - seededRank(`${slotIndex}:${right.key}`, seed)
      || left.key.localeCompare(right.key)
    ))[0]!;
    return fillerOrder(characterId, skin, template, seed, slotIndex);
  });
}

export function devHavenOrderFillers(
  existingOrders: readonly MergeOrder[],
  count: number,
  seed: number,
  templates: readonly MergeOrderTemplate[] = MERGE_ORDER_TEMPLATES,
  skins: readonly KatchimeraSkinDefinition[] = katchimeraSkins,
): MergeOrder[] {
  return devHavenOrderFillersForFamily('mossprout', existingOrders, count, seed, templates, skins);
}

export function devHavenOrderFillersForFamily(
  characterId: MergeCharacterId,
  existingOrders: readonly MergeOrder[],
  count: number,
  seed: number,
  templates: readonly MergeOrderTemplate[] = MERGE_ORDER_TEMPLATES,
  skins: readonly KatchimeraSkinDefinition[] = katchimeraSkins,
): MergeOrder[] {
  if (count <= 0) return [];

  // This is deliberately sourced from the complete authored catalog rather than
  // player ownership. The dev preview needs to exercise locked family forms.
  const eligibleSkins = eligibleFamilySkins(characterId, skins);
  const familyTemplates = templates.filter((template) => template.characterId === characterId);
  if (eligibleSkins.length === 0 || familyTemplates.length === 0) return [];

  const existingRecipientSkinIds = new Set(existingOrders.flatMap((order) => (
    order.recipientSkinId ? [order.recipientSkinId] : []
  )));
  const rankedSkins = [...eligibleSkins].sort((left, right) => (
    seededRank(left.id, seed) - seededRank(right.id, seed)
    || left.id.localeCompare(right.id)
  ));
  const rankedTemplates = [...familyTemplates].sort((left, right) => (
    seededRank(left.key, seed) - seededRank(right.key, seed)
    || left.key.localeCompare(right.key)
  ));

  return rankedSkins
    .filter((skin) => !existingRecipientSkinIds.has(skin.id))
    .slice(0, count)
    .map((skin, index) => {
      const template = rankedTemplates[index % rankedTemplates.length]!;
      return fillerOrder(characterId, skin, template, seed, index);
    });
}

function eligibleFamilySkins(
  characterId: MergeCharacterId,
  skins: readonly KatchimeraSkinDefinition[],
): KatchimeraSkinDefinition[] {
  return skins.filter((skin) => skin.familyId === characterId && skin.id !== characterId);
}

function fillerOrder(
  characterId: MergeCharacterId,
  skin: KatchimeraSkinDefinition,
  template: MergeOrderTemplate,
  seed: number,
  slotIndex: number,
): MergeOrder {
  return {
    id: `${DEV_HAVEN_ORDER_FILLER_PREFIX}${slotIndex}:${seed}:${characterId}:${skin.id}:${template.key}`,
    characterId,
    recipientSkinId: skin.id,
    title: `${skin.displayName}'s preview request`,
    difficulty: template.difficulty,
    requirements: template.requirements.map((requirement) => ({ ...requirement })),
    reward: { ...template.reward },
    createdAt: seed,
    signature: false,
    purpose: 'normal',
  };
}

function seededRank(value: string, seed: number): number {
  let hash = seed | 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}
