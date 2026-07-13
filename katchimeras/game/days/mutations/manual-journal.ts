import type { BigMoment, CuisineFamily, DayMovementKind, FoodMeaning, FoodMoment, ManualJournalEntry, ManualJournalSubmission, MemoryDomain, StoredHomeDayRecord, StudioMoment, StudioRating } from '@/types/home';
import { buildNoteEvidence, upsertEvidence } from '@/utils/intelligence/evidence';
import { applyManualJournalFacets, buildManualJournalClassifiedMemory, upsertClassifiedMemory } from '@/utils/intelligence/classification';
import { manualJournalFlow } from '@/utils/manual-journal-registry';

const EMOJI: Record<string, string> = { meal: '🍽️', snack: '🥐', dessert: '🍰', coffee: '☕', tea: '🫖', drink: '🥤', cooking: '🍳', other_food: '🍎', book: '📖', film: '🎬', show: '📺', game: '🎮', music: '🎵', podcast: '🎙️', art: '🎨', other_media: '✨' };
const MOVEMENT_EMOJI: Record<string, string> = { walk: '🚶', run: '🏃', cycle: '🚲', workout: '🏋️', sport: '⚽', hike: '🥾', errands: '🛒', commute: '🚇', travel: '✈️', mixed: '⚡' };

export function withManualJournalEntry(day: StoredHomeDayRecord, submission: ManualJournalSubmission, now: Date): StoredHomeDayRecord {
  const flow = manualJournalFlow(submission.flowId);
  const choice = flow?.choices.find((item) => item.id === submission.categoryId);
  if (!flow || !choice) return day;
  if (submission.sourceType === 'photo' && submission.sourceId && day.manualJournalEntries?.some((item) => item.sourceType === 'photo' && item.sourceId === submission.sourceId)) return day;

  const createdAt = now.toISOString();
  const id = `manual-${now.getTime().toString(36)}-${submission.flowId}`;
  if (day.manualJournalEntries?.some((item) => item.id === id)) return day;
  const linkedNoteId = submission.linkedNote && (submission.linkedNote.text.trim() || submission.linkedNote.audioUri) ? `note-${id}` : null;
  const entry: ManualJournalEntry = {
    id, flowId: flow.id, flowVersion: flow.version, path: submission.path, categoryId: submission.categoryId,
    canonicalQualityIds: submission.canonicalQualityIds, fields: submission.fields, feeling: submission.feeling ?? null,
    note: submission.note?.trim() || null, sourceType: submission.sourceType ?? 'manual', sourceId: submission.sourceId ?? null,
    linkedNoteId, createdAt,
  };
  const specific = stringField(entry.fields.specific);
  const context = stringField(entry.fields.context);
  const text = [choice.label, specific, entry.feeling, entry.note].filter(Boolean).join(' · ');
  const primaryQuality = entry.canonicalQualityIds[0] ?? null;
  const food = flow.adapter === 'food' ? specific || choice.label : null;
  const mediaType = flow.adapter === 'studio' ? choice.mediaType ?? null : null;
  const photoMemory = submission.sourceType === 'photo' && submission.sourceId
    ? day.classifiedMemories?.find((memory) => memory.sourceType === 'photo' && memory.sourceId === submission.sourceId)
    : null;
  let classified = photoMemory ?? buildManualJournalClassifiedMemory({ entryId: id, observedAt: createdAt, text, semanticCategoryId: primaryQuality, mediaType, food, bigMomentType: choice.bigMomentType ?? null });
  const facets: Array<{ key: string; value: string; sensitive?: boolean }> = [];
  if (flow.adapter === 'place') facets.push({ key: 'place_category', value: choice.id });
  if (flow.adapter === 'movement') facets.push({ key: 'movement_mode', value: choice.id });
  if (flow.adapter === 'movement' && context) facets.push({ key: 'movement_subtype', value: context });
  if (flow.adapter === 'studio' && mediaType) facets.push({ key: 'media_type', value: mediaType });
  if (flow.adapter === 'studio' && specific) facets.push({ key: 'media_title', value: specific });
  if (flow.adapter === 'food') facets.push({ key: 'food_item', value: food ?? choice.label });
  if (flow.adapter === 'relationship') {
    const relationship = ({ partner: 'partner', my_child: 'my_child', family: 'family', friends: 'friends', group: 'friends', someone_new: 'someone_known', someone_else: 'someone_known', pet: 'my_pet' } as Record<string, string>)[choice.id];
    if (relationship) facets.push({ key: 'relationship', value: relationship, sensitive: true });
  }
  if (facets.length) classified = applyManualJournalFacets({ ...classified, dominantDomain: domainForAdapter(flow.adapter) }, facets, createdAt);
  const evidence = buildNoteEvidence({ noteId: id, kind: 'text', observedAt: createdAt, text, provider: 'manual', mediaType, food, bigMomentType: choice.bigMomentType ?? null, semanticCategoryId: primaryQuality, semanticConfidence: 1 });
  const linkedNote = linkedNoteId && submission.linkedNote ? {
    id: linkedNoteId, kind: submission.linkedNote.kind, text: submission.linkedNote.text.trim(), audioUri: submission.linkedNote.audioUri ?? null,
    durationMs: submission.linkedNote.durationMs ?? null, archetype: archetypeForFeeling(entry.feeling), label: specific || choice.label,
    parentSourceType: submission.sourceType === 'photo' ? 'photo' as const : undefined,
    parentSourceId: submission.sourceType === 'photo' ? submission.sourceId ?? null : null,
    createdAt,
  } : null;
  const next: StoredHomeDayRecord = {
    ...day,
    manualJournalEntries: [...(day.manualJournalEntries ?? []), entry].slice(-80),
    classifiedMemories: upsertClassifiedMemory(day.classifiedMemories, [classified]),
    evidence: submission.sourceType === 'photo' ? day.evidence : upsertEvidence(day.evidence, [{ ...evidence, id: `evidence:manual:${id}`, sourceType: 'manual_log', sourceId: id }]),
    notes: linkedNote ? [...(day.notes ?? []), linkedNote] : day.notes,
  };
  const sourceId = submission.sourceType === 'photo' ? submission.sourceId ?? id : id;
  const source = submission.sourceType === 'photo' ? 'photo' as const : 'manual' as const;
  if (flow.adapter === 'food') {
    const cuisine = context && context !== 'home_cooked' ? context as CuisineFamily : null;
    const moment: FoodMoment = { id: `food-${id}`, label: specific || choice.label, emoji: EMOJI[choice.id] ?? '🍽️', meaning: asFoodMeaning(entry.feeling), cuisine, homeCooked: context === 'home_cooked' || undefined, source, sourceId, thumbnailUri: submission.thumbnailUri ?? null, detail: entry.note, createdAt };
    next.foodMoments = [...(day.foodMoments ?? []), moment].slice(-12);
  }
  if (flow.adapter === 'studio') {
    const moment: StudioMoment = { id: `studio-${id}`, label: specific || choice.label, mediaType: choice.mediaType ?? 'other', emoji: EMOJI[choice.id] ?? '✨', rating: asStudioRating(entry.feeling), source, sourceId, thumbnailUri: submission.thumbnailUri ?? null, detail: entry.note, createdAt };
    next.studioMoments = [...(day.studioMoments ?? []), moment].slice(-12);
  }
  if (flow.adapter === 'place') next.confirmedPlaces = [...(day.confirmedPlaces ?? []), { id: `place-${id}`, category: choice.id, archetype: archetypeForFeeling(entry.feeling), label: specific || choice.label, meaningLabel: context ? humanize(context) : undefined, confirmedAt: createdAt }];
  if (flow.adapter === 'movement') next.stepsInterpretation = { movement: movementKind(choice.id), label: specific || choice.label, emoji: MOVEMENT_EMOJI[choice.id] ?? '⚡', subtype: context || undefined, createdAt };
  if (flow.adapter === 'big_event' && choice.bigMomentType) {
    const moment: BigMoment = { id: `bm-${id}`, type: choice.bigMomentType, label: specific || choice.label, subject: stringField(entry.fields.subject) || null, noteId: linkedNoteId, createdAt };
    next.bigMoments = [...(day.bigMoments ?? []), moment];
  }
  return next;
}

function stringField(value: string | string[] | boolean | null | undefined): string { return typeof value === 'string' ? value.trim() : ''; }
function asFoodMeaning(value?: string | null): FoodMeaning | null { return value && ['treat', 'sharedMeal', 'comfort', 'fuel', 'discovery'].includes(value) ? value as FoodMeaning : null; }
function asStudioRating(value?: string | null): StudioRating | null { return value && ['loved', 'inspired', 'liked', 'meh'].includes(value) ? value as StudioRating : null; }
function movementKind(value: string): DayMovementKind { if (value === 'sport') return 'workout'; return ['walk', 'run', 'cycle', 'workout', 'hike', 'errands', 'commute', 'travel', 'mixed'].includes(value) ? value as DayMovementKind : 'mixed'; }
function archetypeForFeeling(value?: string | null): string { if (value === 'exciting') return 'energy'; if (value === 'loved' || value === 'liked') return 'together'; if (value === 'difficult') return 'meaningful'; return 'calm'; }
function humanize(value: string): string { return value.replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase()); }
function domainForAdapter(adapter: string): MemoryDomain { return ({ food: 'food', studio: 'media', place: 'place', movement: 'movement', relationship: 'people', work: 'work', big_event: 'life_event' } as Record<string, MemoryDomain>)[adapter] ?? 'other'; }
