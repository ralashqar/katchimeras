import type {
  ClassifiedMemory,
  FoodMoment,
  StoredHomeDayRecord,
  StudioMoment,
  UserConfirmation,
} from '@/types/home';
import { detectFoodInText, detectFoodInVision, type FoodDetection } from '@/utils/food-detect';
import {
  detectStudioInVision,
  studioDetectionFromMedia,
  type StudioDetection,
} from '@/utils/studio-detect';
import { canonicalizeSignal, seedIdForCanonicalSignal } from '@/utils/intelligence/taxonomy';

export type RejectableMemoryDomain = 'food' | 'media' | 'animal';

export function confirmationsRejectDomain(
  confirmations: UserConfirmation[] | undefined,
  domain: RejectableMemoryDomain
): boolean {
  return (confirmations ?? []).some((confirmation) => confirmationRejectsDomain(confirmation, domain));
}

export function memoryRejectsDomain(memory: ClassifiedMemory, domain: RejectableMemoryDomain): boolean {
  const relevantConfirmations = memory.confirmations.filter((confirmation) => confirmationBelongsToDomain(confirmation, domain));
  if (relevantConfirmations.length > 0) return confirmationsRejectDomain(relevantConfirmations, domain);
  return memory.facets.some((facet) => {
    if (!facet.confirmed) return false;
    if (domain === 'food') return facet.key === 'food_kind' && facet.value === 'incidental';
    if (domain === 'media') return facet.key === 'media_type' && facet.value === 'other';
    return facet.key === 'relationship' && facet.value === 'incidental';
  });
}

export function dayRejectsDomain(
  day: Pick<StoredHomeDayRecord, 'classifiedMemories'>,
  domain: RejectableMemoryDomain
): boolean {
  const relevant = (day.classifiedMemories ?? []).filter((memory) => memoryContainsDomain(memory, domain));
  return relevant.length > 0 && relevant.every((memory) => memoryRejectsDomain(memory, domain));
}

export function visionSignalIsRejected(
  day: Pick<StoredHomeDayRecord, 'classifiedMemories'>,
  value: string
): boolean {
  const canonical = canonicalizeSignal(value) ?? value;
  const seedId = seedIdForCanonicalSignal(canonical);
  if (seedId && FOOD_SEEDS.has(seedId)) return dayRejectsDomain(day, 'food');
  if (seedId && MEDIA_SEEDS.has(seedId)) return dayRejectsDomain(day, 'media');
  if (seedId && ANIMAL_SEEDS.has(seedId)) return dayRejectsDomain(day, 'animal');
  return false;
}

export function acceptedFoodDetection(day: Pick<StoredHomeDayRecord, 'classifiedMemories' | 'vision'>): FoodDetection {
  const memories = day.classifiedMemories ?? [];
  if (memories.length === 0) return detectFoodInVision(day.vision);
  const relevant = memories.filter((memory) => memoryContainsDomain(memory, 'food'));
  if (relevant.length === 0) {
    return memories.some((memory) => memory.sourceType === 'photo') ? { detected: false } : detectFoodInVision(day.vision);
  }
  const memory = [...relevant].reverse()[0];
  if (!memory || memoryRejectsDomain(memory, 'food')) return { detected: false };
  const text = [
    ...memory.facets.filter((facet) => facet.key === 'food_item' || facet.key === 'food_kind').map((facet) => facet.value),
    ...memory.observations.map((observation) => observation.value),
  ].join(' ');
  const detected = detectFoodInText(text);
  return detected.detected ? detected : { detected: true, label: 'Food', emoji: '🍽️' };
}

export function acceptedStudioDetection(day: Pick<StoredHomeDayRecord, 'classifiedMemories' | 'vision'>): StudioDetection {
  const memories = day.classifiedMemories ?? [];
  if (memories.length === 0) return detectStudioInVision(day.vision);
  const relevant = memories.filter((memory) => memoryContainsDomain(memory, 'media'));
  if (relevant.length === 0) {
    return memories.some((memory) => memory.sourceType === 'photo') ? { detected: false } : detectStudioInVision(day.vision);
  }
  const memory = [...relevant].reverse()[0];
  if (!memory || memoryRejectsDomain(memory, 'media')) return { detected: false };
  const mediaType = memory.facets.find((facet) => facet.key === 'media_type')?.value;
  const title = memory.facets.find((facet) => facet.key === 'media_title')?.value ?? null;
  if (!mediaType || !['book', 'film', 'show', 'game', 'music', 'art', 'other'].includes(mediaType)) return { detected: false };
  return studioDetectionFromMedia(mediaType as 'book' | 'film' | 'show' | 'game' | 'music' | 'art' | 'other', title);
}

export function pruneRejectedDerivedMoments(
  day: StoredHomeDayRecord,
  memory: ClassifiedMemory
): StoredHomeDayRecord {
  const shouldRemove = (moment: FoodMoment | StudioMoment, domain: 'food' | 'media') =>
    (memoryRejectsDomain(memory, domain) && derivedMomentMatchesMemory(moment, memory)) ||
    (!memorySupportsDerivedDomain(memory, domain) && derivedMomentStrictlyMatchesMemory(moment, memory));
  return {
    ...day,
    foodMoments: (day.foodMoments ?? []).filter((moment) => !shouldRemove(moment, 'food')),
    studioMoments: (day.studioMoments ?? []).filter((moment) => !shouldRemove(moment, 'media')),
  };
}

export function memorySupportsDerivedDomain(
  memory: ClassifiedMemory,
  domain: 'food' | 'media'
): boolean {
  if (memoryRejectsDomain(memory, domain)) return false;
  if (memory.dominantDomain === domain) return true;
  const confirmationKey = domain === 'food' ? 'food_kind' : 'media_type';
  return memory.facets.some(
    (facet) => facet.key === confirmationKey && facet.confirmed && facet.value !== 'incidental' && facet.value !== 'other'
  );
}

export function studioDetectionForClassifiedMemory(memory: ClassifiedMemory): StudioDetection {
  if (!memorySupportsDerivedDomain(memory, 'media')) return { detected: false };
  const mediaType = memory.facets.find((facet) => facet.key === 'media_type')?.value;
  if (!mediaType || !['book', 'film', 'show', 'game', 'music', 'art', 'other'].includes(mediaType)) return { detected: false };
  const title = memory.facets.find((facet) => facet.key === 'media_title')?.value ?? null;
  return studioDetectionFromMedia(mediaType as 'book' | 'film' | 'show' | 'game' | 'music' | 'art' | 'other', title);
}

export function derivedMomentIsRejected(
  moment: FoodMoment | StudioMoment,
  memories: ClassifiedMemory[] | undefined,
  domain: 'food' | 'media'
): boolean {
  return (memories ?? []).some((memory) => {
    if (memoryRejectsDomain(memory, domain) && derivedMomentMatchesMemory(moment, memory)) return true;
    return !memorySupportsDerivedDomain(memory, domain) && derivedMomentStrictlyMatchesMemory(moment, memory);
  });
}

/**
 * Prevent the post-save Food/Studio controller from repeating a question that
 * the user already answered inside the photo clarification flow. Both records
 * are derived from the same capture, so source identity is the authority here;
 * a similarly titled moment from another photo must remain eligible.
 */
export function derivedMomentHasConfirmedFacet(
  moment: FoodMoment | StudioMoment,
  memories: ClassifiedMemory[] | undefined,
  facetKey: string
): boolean {
  return (memories ?? []).some((memory) => {
    if (!derivedMomentStrictlyMatchesMemory(moment, memory)) return false;
    return (
      memory.facets.some((facet) => facet.key === facetKey && facet.confirmed) ||
      memory.confirmations.some((confirmation) => confirmation.facetKey === facetKey)
    );
  });
}

function confirmationRejectsDomain(confirmation: UserConfirmation, domain: RejectableMemoryDomain): boolean {
  if (domain === 'food') return confirmation.facetKey === 'food_kind' && confirmation.facetValue === 'incidental';
  if (domain === 'media') return confirmation.facetKey === 'media_type' && confirmation.optionId === 'not_media';
  return confirmation.facetKey === 'relationship' && confirmation.facetValue === 'incidental';
}

function confirmationBelongsToDomain(confirmation: UserConfirmation, domain: RejectableMemoryDomain): boolean {
  if (domain === 'food') return confirmation.facetKey === 'food_kind';
  if (domain === 'media') return confirmation.facetKey === 'media_type';
  return confirmation.facetKey === 'relationship';
}

function memoryContainsDomain(memory: ClassifiedMemory, domain: RejectableMemoryDomain): boolean {
  if (memory.dominantDomain === domain) return true;
  if (domain === 'food') {
    return memory.facets.some((facet) => facet.key === 'food_item' || facet.key === 'food_kind');
  }
  if (domain === 'media') return memory.facets.some((facet) => facet.key === 'media_type' || facet.key === 'media_title');
  return memory.facets.some((facet) => facet.key === 'animal_kind');
}

function derivedMomentMatchesMemory(moment: FoodMoment | StudioMoment, memory: ClassifiedMemory): boolean {
  if (moment.source === 'manual') return false;
  if (moment.sourceId && moment.sourceId === memory.sourceId) return true;
  if (moment.noteId && moment.noteId === memory.sourceId) return true;
  if (moment.thumbnailUri && moment.thumbnailUri === memory.sourceId) return true;
  const momentTime = Date.parse(moment.createdAt);
  const memoryTime = Date.parse(memory.createdAt);
  const sourceMatches =
    (memory.sourceType === 'photo' && moment.source === 'photo') ||
    ((memory.sourceType === 'text_note' || memory.sourceType === 'voice_note') && moment.source === 'note');
  return sourceMatches && Number.isFinite(momentTime) && Number.isFinite(memoryTime) && Math.abs(momentTime - memoryTime) <= 5_000;
}

function derivedMomentStrictlyMatchesMemory(moment: FoodMoment | StudioMoment, memory: ClassifiedMemory): boolean {
  const explicitSourceIds = [moment.sourceId, moment.noteId, moment.thumbnailUri].filter(
    (value): value is string => Boolean(value)
  );
  // Support/answer propagation is stricter than legacy rejection cleanup:
  // never let a nearby timestamp make one capture inherit another's domain.
  return explicitSourceIds.length > 0
    ? explicitSourceIds.includes(memory.sourceId)
    : derivedMomentMatchesMemory(moment, memory);
}

const FOOD_SEEDS = new Set(['feast', 'coffee_shop', 'bakery', 'pizza_place', 'sushi_place', 'ramen_place', 'dessert_shop', 'bubble_tea_shop']);
const MEDIA_SEEDS = new Set(['cinema', 'gaming_session', 'live_music', 'bookstore']);
const ANIMAL_SEEDS = new Set(['dog_companion', 'cat_companion']);
