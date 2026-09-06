import type { ContentFlowDefinition } from '@/types/content-flow';

export type StoryVariant = {
  id: string;
  label: string;
  definition: ContentFlowDefinition;
};

export type StoryVariantSet = {
  id: string;
  defaultVariantId: string;
  variants: readonly StoryVariant[];
};

const sets = new Map<string, StoryVariantSet>();
const localOverrides = new Map<string, string>();

export function defineStoryVariants(set: StoryVariantSet): StoryVariantSet {
  if (!set.id.trim()) throw new Error('Story variant set id is required');
  if (!set.variants.length) throw new Error(`Story variant set ${set.id} is empty`);
  const ids = new Set<string>();
  const definitionKeys = new Set<string>();
  for (const variant of set.variants) {
    if (!variant.id.trim() || ids.has(variant.id)) throw new Error(`Story variant set ${set.id} has a duplicate or empty variant id`);
    ids.add(variant.id);
    const definitionKey = `${variant.definition.id}@${variant.definition.version}`;
    if (definitionKeys.has(definitionKey)) throw new Error(`Story variants must use distinct definition versions: ${definitionKey}`);
    definitionKeys.add(definitionKey);
  }
  if (!ids.has(set.defaultVariantId)) throw new Error(`Default variant ${set.defaultVariantId} is not registered in ${set.id}`);
  return set;
}

export function registerStoryVariantSet(set: StoryVariantSet) {
  const existing = sets.get(set.id);
  if (existing && existing !== set) throw new Error(`Story variant set ${set.id} is already registered`);
  sets.set(set.id, set);
  return set;
}

export function selectedStoryVariant(setId: string): StoryVariant {
  const set = sets.get(setId);
  if (!set) throw new Error(`Unknown story variant set ${setId}`);
  const selectedId = localOverrides.get(setId) ?? set.defaultVariantId;
  return set.variants.find((variant) => variant.id === selectedId) ?? set.variants.find((variant) => variant.id === set.defaultVariantId)!;
}

/** Local developer override. It only affects runs started after selection. */
export function selectStoryVariantForDebug(setId: string, variantId: string | null) {
  const set = sets.get(setId);
  if (!set) throw new Error(`Unknown story variant set ${setId}`);
  if (variantId == null) localOverrides.delete(setId);
  else {
    if (!set.variants.some((variant) => variant.id === variantId)) throw new Error(`Unknown variant ${variantId} in ${setId}`);
    localOverrides.set(setId, variantId);
  }
}

export function registeredStoryVariantSets() {
  return [...sets.values()];
}

export function clearStoryVariantRegistryForTests() {
  sets.clear();
  localOverrides.clear();
}

