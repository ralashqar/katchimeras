import type { ClassifiedMemory, ManualJournalSubmission } from '@/types/home';
import { applyManualJournalFacets } from '@/utils/intelligence/classification';
import type { PhotoJournalRouteProposal } from '@/utils/intelligence/photo-journal-routing';
import { manualJournalFlow } from '@/utils/manual-journal-registry';

const ROUTING_KEYS = new Set(['media_type', 'media_title', 'food_kind', 'food_item', 'place_category', 'movement_mode', 'movement_subtype', 'activity_kind', 'device_activity', 'relationship', 'work_kind', 'life_event']);

export function reviewPhotoJournalSubmission(input: {
  memory: ClassifiedMemory;
  route: PhotoJournalRouteProposal | null;
  submission: ManualJournalSubmission;
  createdAt: string;
}): { memory: ClassifiedMemory; specific: string; adapter: string; choiceLabel: string; mediaType: string | null; reactionLabel: string } | null {
  const flow = manualJournalFlow(input.submission.flowId);
  const choice = flow?.choices.find((item) => item.id === input.submission.categoryId);
  if (!flow || !choice) return null;
  const rawSpecific = input.submission.fields.specific;
  const specific = typeof rawSpecific === 'string' ? rawSpecific.trim() : '';
  const finalFacets = dedupe([
    ...(input.route?.confirmedFacets ?? []),
    ...(input.submission.confirmedFacets ?? []),
    ...(choice.mediaType ? [{ key: 'media_type', value: choice.mediaType }] : []),
    ...(choice.mediaType && specific ? [{ key: 'media_title', value: specific }] : []),
    ...(flow.projectionKind === 'food' ? [{ key: 'food_item', value: specific || choice.label }] : []),
    ...(input.submission.feeling ? [{ key: flow.projectionKind === 'studio' ? 'media_rating' : 'journal_feeling', value: input.submission.feeling }] : []),
  ]);
  const allowed = routingFacetsForProjection(flow.projectionKind);
  const cleaned = {
    ...input.memory,
    facets: input.memory.facets.filter((facet) => (!ROUTING_KEYS.has(facet.key) || allowed.has(facet.key)) && (facet.key !== 'media_title' || facet.confirmed)),
    confirmations: input.memory.confirmations.filter((confirmation) => !ROUTING_KEYS.has(confirmation.facetKey) || allowed.has(confirmation.facetKey)),
    dominantDomain: domainForProjection(flow.projectionKind),
  };
  return {
    memory: applyManualJournalFacets(cleaned, finalFacets, input.createdAt),
    specific,
    adapter: flow.projectionKind,
    choiceLabel: choice.label,
    mediaType: choice.mediaType ?? null,
    reactionLabel: flow.feelings.find((item) => item.id === input.submission.feeling)?.label ?? choice.label,
  };
}

function domainForProjection(kind: string): ClassifiedMemory['dominantDomain'] {
  return ({ food: 'food', studio: 'media', place: 'place', movement: 'movement', relationship: 'people', work: 'work', big_event: 'life_event' } as Record<string, ClassifiedMemory['dominantDomain']>)[kind] ?? 'other';
}
function routingFacetsForProjection(kind: string): Set<string> {
  return new Set(({
    studio: ['media_type', 'media_title', 'device_activity'], food: ['food_kind', 'food_item'], place: ['place_category'],
    movement: ['movement_mode', 'movement_subtype', 'activity_kind'], relationship: ['relationship'], work: ['work_kind', 'device_activity'],
    general: ['device_activity'], big_event: ['life_event'],
  } as Record<string, string[]>)[kind] ?? []);
}
function dedupe(values: { key: string; value: string; sensitive?: boolean }[]) {
  const byKey = new Map<string, { key: string; value: string; sensitive?: boolean }>();
  values.forEach((value) => byKey.set(value.key, value));
  return [...byKey.values()];
}
