import type { BigMoment, CuisineFamily, FoodMeaning, FoodMoment, ManualJournalEntry, ManualJournalSubmission, StoredHomeDayRecord, StudioMoment, StudioRating } from '@/types/home';
import { buildNoteEvidence, upsertEvidence } from '@/utils/intelligence/evidence';
import { applyManualJournalFacets, buildManualJournalClassifiedMemory, upsertClassifiedMemory } from '@/utils/intelligence/classification';
import { manualJournalFlow } from '@/utils/manual-journal-registry';

const EMOJI: Record<string, string> = {
  meal: '🍽️', snack: '🥐', dessert: '🍰', coffee: '☕', tea: '🫖', drink: '🥤', cooking: '🍳', other_food: '🍎',
  book: '📖', film: '🎬', show: '📺', game: '🎮', music: '🎵', podcast: '🎙️', art: '🎨', other_media: '✨',
};

export function withManualJournalEntry(day: StoredHomeDayRecord, submission: ManualJournalSubmission, now: Date): StoredHomeDayRecord {
  const flow = manualJournalFlow(submission.flowId);
  const choice = flow?.choices.find((item) => item.id === submission.categoryId);
  if (!flow || !choice) return day;
  const createdAt = now.toISOString();
  const id = `manual-${now.getTime().toString(36)}-${submission.flowId}`;
  if (day.manualJournalEntries?.some((item) => item.id === id)) return day;
  const entry: ManualJournalEntry = {
    id, flowId: flow.id, flowVersion: flow.version, path: submission.path,
    categoryId: submission.categoryId, canonicalQualityIds: submission.canonicalQualityIds,
    fields: submission.fields, feeling: submission.feeling ?? null, note: submission.note?.trim() || null, createdAt,
  };
  const specific = stringField(entry.fields.specific);
  const context = stringField(entry.fields.context);
  const text = [choice.label, specific, entry.feeling, entry.note].filter(Boolean).join(' · ');
  const primaryQuality = entry.canonicalQualityIds[0] ?? null;
  const food = flow.adapter === 'food' ? specific || choice.label : null;
  const mediaType = flow.adapter === 'studio' ? choice.mediaType ?? null : null;
  let classified = buildManualJournalClassifiedMemory({
    entryId: id, observedAt: createdAt, text, semanticCategoryId: primaryQuality,
    mediaType, food, bigMomentType: choice.bigMomentType ?? null,
  });
  const manualFacets: Array<{ key: string; value: string; sensitive?: boolean }> = [];
  if (flow.adapter === 'place') manualFacets.push({ key: 'place_category', value: choice.id });
  if (flow.adapter === 'movement') manualFacets.push({ key: 'movement_mode', value: choice.id });
  if (flow.adapter === 'movement' && context) manualFacets.push({ key: 'movement_subtype', value: context });
  if (flow.adapter === 'studio' && mediaType) manualFacets.push({ key: 'media_type', value: mediaType });
  if (flow.adapter === 'food') manualFacets.push({ key: 'food_item', value: food ?? choice.label });
  if (flow.adapter === 'relationship') {
    const relationship = ({ partner: 'partner', my_child: 'my_child', family: 'family', friends: 'friends', group: 'friends', someone_new: 'someone_known', someone_else: 'someone_known', pet: 'my_pet' } as Record<string, string>)[choice.id];
    if (relationship) manualFacets.push({ key: 'relationship', value: relationship, sensitive: true });
  }
  if (manualFacets.length) classified = applyManualJournalFacets(classified, manualFacets, createdAt);
  const evidence = buildNoteEvidence({
    noteId: id, kind: 'text', observedAt: createdAt, text, provider: 'manual', mediaType, food,
    bigMomentType: choice.bigMomentType ?? null, semanticCategoryId: primaryQuality, semanticConfidence: 1,
  });
  const next: StoredHomeDayRecord = {
    ...day,
    manualJournalEntries: [...(day.manualJournalEntries ?? []), entry].slice(-80),
    classifiedMemories: upsertClassifiedMemory(day.classifiedMemories, [classified]),
    evidence: upsertEvidence(day.evidence, [{ ...evidence, id: `evidence:manual:${id}`, sourceType: 'manual_log', sourceId: id }]),
  };
  if (flow.adapter === 'food') {
    const cuisine = context && context !== 'home_cooked' ? context as CuisineFamily : null;
    const moment: FoodMoment = { id: `food-${id}`, label: specific || choice.label, emoji: EMOJI[choice.id] ?? '🍽️', meaning: asFoodMeaning(entry.feeling), cuisine, homeCooked: context === 'home_cooked' || undefined, source: 'manual', sourceId: id, detail: entry.note, createdAt };
    next.foodMoments = [...(day.foodMoments ?? []), moment].slice(-12);
  }
  if (flow.adapter === 'studio') {
    const moment: StudioMoment = { id: `studio-${id}`, label: specific || choice.label, mediaType: choice.mediaType ?? 'other', emoji: EMOJI[choice.id] ?? '✨', rating: asStudioRating(entry.feeling), source: 'manual', sourceId: id, detail: entry.note, createdAt };
    next.studioMoments = [...(day.studioMoments ?? []), moment].slice(-12);
  }
  if (flow.adapter === 'big_event' && choice.bigMomentType) {
    const moment: BigMoment = { id: `bm-${id}`, type: choice.bigMomentType, label: specific || choice.label, subject: stringField(entry.fields.subject) || null, noteId: null, createdAt };
    next.bigMoments = [...(day.bigMoments ?? []), moment];
  }
  return next;
}

function stringField(value: string | string[] | boolean | null | undefined): string { return typeof value === 'string' ? value.trim() : ''; }
function asFoodMeaning(value?: string | null): FoodMeaning | null { return value && ['treat', 'sharedMeal', 'comfort', 'fuel', 'discovery'].includes(value) ? value as FoodMeaning : null; }
function asStudioRating(value?: string | null): StudioRating | null { return value && ['loved', 'inspired', 'liked', 'meh'].includes(value) ? value as StudioRating : null; }
