import type { IconSymbolName } from '@/components/ui/icon-symbol';
import { dayPromptRegistry } from '@/constants/day-prompts';
import type { HomeDayRecord } from '@/types/home';
import { manualJournalFlow } from '@/utils/manual-journal-registry';
import { HATCH_CHECK_IN_FLOWS } from '@/utils/hatch-check-in';
import {
  resolveBigMomentDisplay,
  resolveFoodMomentDisplay,
  resolveMovementDisplay,
  resolveStudioMomentDisplay,
} from '@/utils/memory-display';

export type MomentTimelineEntry = {
  id: string;
  createdAt: string;
  time: number;
  categoryFlowId: MomentCategoryFlowId;
  icon: IconSymbolName;
  accent: string;
  label: string;
  category?: string;
  noteText?: string | null;
  thumbnailUri?: string | null;
  audioUri?: string | null;
  keyMoment?: boolean;
  selectedState?: MomentSelectedState | null;
};

export type MomentCategoryFlowId = 'went_somewhere' | 'food' | 'studio' | 'movement' | 'people' | 'work' | 'big_event' | 'general';
export type MomentSelectedState =
  | { kind: 'mood'; state: 'radiant' | 'light' | 'meh' | 'heavy' | 'stormy' }
  | { kind: 'sleep'; state: 'good' | 'normal' | 'low' };

const MOMENT_CATEGORY_FLOW_IDS = new Set<MomentCategoryFlowId>([
  'went_somewhere',
  'food',
  'studio',
  'movement',
  'people',
  'work',
  'big_event',
  'general',
]);

const PROMPT_CATEGORY_FLOW: Record<string, MomentCategoryFlowId> = {
  activity: 'movement',
  hobby: 'studio',
  people: 'people',
};

const MEANING_META: Record<string, { icon: IconSymbolName; accent: string }> = {
  calm: { icon: 'leaf.fill', accent: '#91D8C7' },
  energy: { icon: 'bolt.fill', accent: '#FFC36B' },
  together: { icon: 'person.2.fill', accent: '#F4BE8D' },
  meaningful: { icon: 'sparkles', accent: '#C77DFF' },
};

const PROMPT_ACCENTS: Record<string, string> = {
  feeling: '#F5AFC6',
  sleep: '#AAB2FF',
  activity: '#91D8C7',
  hobby: '#C77DFF',
  people: '#F4BE8D',
  day_word: '#A7D5FF',
};

const PROMPT_CATEGORY: Record<string, string> = {
  feeling: 'Mood',
  activity: 'Activity',
  hobby: 'Hobby',
  people: 'People',
  day_word: 'Day word',
  meaning: 'Photo',
};

const SLEEP_LABEL: Record<string, string> = {
  good: 'Good sleep',
  normal: 'Okay sleep',
  low: 'Low sleep',
};

export function buildMomentTimeline(day: HomeDayRecord): MomentTimelineEntry[] {
  const entries: MomentTimelineEntry[] = [];
  const seen = new Set<string>();
  const manualSourceIds = new Set((day.manualJournalEntries ?? []).map((entry) => entry.id));
  const journalPlaceProjectionIds = new Set(
    (day.manualJournalEntries ?? [])
      .filter((entry) => entry.flowId === 'went_somewhere')
      .map((entry) => `place-${entry.id}`)
  );
  const linkedJournalNoteIds = new Set((day.manualJournalEntries ?? []).map((entry) => entry.linkedNoteId).filter((id): id is string => !!id));
  const push = (entry: Omit<MomentTimelineEntry, 'time'>) => {
    const time = Date.parse(entry.createdAt);
    if (!entry.label.trim() || Number.isNaN(time) || seen.has(entry.id)) return;
    seen.add(entry.id);
    entries.push({ ...entry, time });
  };

  for (const moment of day.moments ?? []) {
    push({
      id: `legacy:${moment.id}`,
      createdAt: moment.createdAt,
      categoryFlowId: 'general',
      icon: moment.icon,
      accent: moment.accentColor,
      label: moment.label,
      category: 'Moment',
    });
  }

  for (const answer of day.promptAnswers ?? []) {
    if (answer.dismissed || answer.labels.length === 0 || answer.kind === 'meaningful_photo') continue;
    // A selected hero photo owns its meaning entry; the stored prompt answer is
    // the same event and would otherwise render twice.
    if (answer.kind === 'meaning' && day.heroPhoto) continue;
    const prompt = dayPromptRegistry[answer.kind];
    const option = prompt?.options.find((candidate) => answer.choiceIds.includes(candidate.id));
    const meaning = answer.kind === 'meaning' ? MEANING_META[answer.choiceIds[0]] : null;
    const photoIcon = answer.relatedAssetId ? photoSubjectIcon(day, answer.relatedAssetId) : null;
    const photoFlowId = answer.relatedAssetId ? photoSubjectFlowId(day, answer.relatedAssetId) : null;
    const selectedState = answer.kind === 'feeling'
      ? moodSelectedState(answer.choiceIds[0])
      : answer.kind === 'sleep'
        ? sleepSelectedState(answer.choiceIds[0])
        : null;
    push({
      id: `prompt:${answer.id}`,
      createdAt: answer.createdAt,
      categoryFlowId: photoFlowId ?? PROMPT_CATEGORY_FLOW[answer.kind] ?? 'general',
      icon: photoIcon ?? meaning?.icon ?? option?.icon ?? prompt?.categoryIcon ?? 'sparkles',
      accent: meaning?.accent ?? PROMPT_ACCENTS[answer.kind] ?? '#C9C2E8',
      label: answer.labels.join(' · '),
      category: PROMPT_CATEGORY[answer.kind] ?? prompt?.title.replace(/[?]$/, ''),
      noteText: answer.noteText,
      selectedState,
    });
  }

  const checkIn = day.hatchCheckIn;
  const checkInLabels = checkIn
    ? checkIn.meaningLabel
      ? [checkIn.anchorLabel ?? checkIn.categoryLabel ?? checkIn.flowLabel, checkIn.meaningLabel].filter((label): label is string => Boolean(label))
      : [checkIn.moodLabel, checkIn.flowLabel, checkIn.categoryLabel].filter((label): label is string => Boolean(label))
    : [];
  if (checkIn && checkIn.status !== 'skipped' && checkInLabels.length > 0) {
    const flow = HATCH_CHECK_IN_FLOWS.find((item) => item.id === checkIn.flowId);
    push({
      id: `hatch-check-in:${day.id}`,
      createdAt: checkIn.completedAt ?? checkIn.updatedAt,
      categoryFlowId: toMomentCategoryFlowId(checkIn.flowId),
      icon: flow?.icon ?? 'sparkles',
      accent: flow?.accent ?? '#FFC36B',
      label: checkInLabels.join(' · '),
      category: checkIn.planVersion === 2 ? 'Daily reflection' : 'Hatch check-in',
    });
  }

  const hero = day.heroPhoto;
  if (hero) {
    hero.meaningLabels.forEach((label, index) => {
      const meta = MEANING_META[hero.meaningChoiceIds[index]] ?? MEANING_META.meaningful;
      push({
        id: `hero:${hero.assetId}:${index}`,
        createdAt: hero.selectedAt,
        categoryFlowId: photoSubjectFlowId(day, hero.assetId) ?? 'general',
        icon: photoSubjectIcon(day, hero.assetId) ?? meta.icon,
        accent: meta.accent,
        label,
        category: 'Photo',
        noteText: hero.noteText,
        thumbnailUri: hero.thumbnailUri,
      });
    });
  }

  (day.capturedMeanings ?? []).forEach((captured, index) => {
    const meta = MEANING_META[captured.archetype] ?? MEANING_META.meaningful;
    const linkedNote = (day.notes ?? []).find((note) => note.parentSourceType === 'photo' && note.parentSourceId === captured.sourceId);
    push({
      id: `capture:${captured.sourceId ?? `${captured.createdAt}:${index}`}`,
      createdAt: captured.createdAt,
      categoryFlowId: photoSubjectFlowId(day, captured.sourceId) ?? 'general',
      icon: photoSubjectIcon(day, captured.sourceId) ?? meta.icon,
      accent: meta.accent,
      label: captured.label,
      category: 'Photo',
      thumbnailUri: captured.thumbnailUri,
      noteText: linkedNote?.text,
      audioUri: linkedNote?.kind === 'voice' ? linkedNote.audioUri : null,
    });
  });

  for (const note of day.notes ?? []) {
    if ((note.parentSourceType === 'photo' && note.parentSourceId) || linkedJournalNoteIds.has(note.id)) continue;
    const meta = MEANING_META[note.archetype] ?? MEANING_META.meaningful;
    push({
      id: `note:${note.id}`,
      createdAt: note.createdAt,
      categoryFlowId: 'general',
      icon: note.kind === 'voice' ? 'mic.fill' : 'square.and.pencil',
      accent: meta.accent,
      label: note.label,
      category: note.kind === 'voice' ? 'Voice note' : 'Written note',
      noteText: note.text,
      audioUri: note.kind === 'voice' ? note.audioUri : null,
    });
  }

  for (const entry of day.manualJournalEntries ?? []) {
    if (entry.sourceType === 'photo') continue;
    const flow = manualJournalFlow(entry.flowId);
    const choice = flow?.choices.find((item) => item.id === entry.categoryId);
    const specific = typeof entry.fields.specific === 'string' ? entry.fields.specific.trim() : '';
    const linkedNote = entry.linkedNoteId ? (day.notes ?? []).find((note) => note.id === entry.linkedNoteId) : null;
    const keyMoment = entry.id === `manual-${day.keyJournalRecordId}`;
    push({
      id: `manual:${entry.id}`,
      createdAt: entry.createdAt,
      categoryFlowId: toMomentCategoryFlowId(entry.flowId),
      icon: keyMoment ? 'star.fill' : choice?.icon ?? flow?.icon ?? 'plus.circle.fill',
      accent: '#FFC36B',
      label: specific || choice?.label || flow?.title || 'Journal entry',
      category: keyMoment ? `Key moment Â· ${choice?.label ?? flow?.title ?? 'Journal'}` : choice?.label ?? flow?.title ?? 'Journal',
      noteText: linkedNote?.text ?? entry.note,
      audioUri: linkedNote?.kind === 'voice' ? linkedNote.audioUri : null,
      keyMoment,
    });
  }

  for (const food of day.foodMoments ?? []) {
    if (food.source !== 'manual') continue;
    if (food.sourceId && manualSourceIds.has(food.sourceId)) continue;
    const display = resolveFoodMomentDisplay(food);
    push({
      id: `food:${food.id}`,
      createdAt: food.createdAt,
      categoryFlowId: 'food',
      icon: 'fork.knife',
      accent: foodMeaningAccent(food.meaning ?? 'discovery'),
      label: display.label,
      category: 'Food & drink',
      thumbnailUri: food.thumbnailUri,
    });
  }

  for (const studio of day.studioMoments ?? []) {
    if (studio.source !== 'manual') continue;
    if (studio.sourceId && manualSourceIds.has(studio.sourceId)) continue;
    const display = resolveStudioMomentDisplay(studio);
    push({
      id: `studio:${studio.id}`,
      createdAt: studio.createdAt,
      categoryFlowId: 'studio',
      icon: studioMediaIcon(studio.mediaType),
      accent: studioRatingAccent(studio.rating ?? 'liked'),
      label: display.label,
      category: 'Watch, read, listen',
      thumbnailUri: studio.thumbnailUri,
    });
  }

  for (const place of day.confirmedPlaces ?? []) {
    // Manual place journals are also projected into confirmedPlaces for maps,
    // discoveries, and legacy readers. The canonical journal row owns the
    // Moments timeline so the compatibility projection must not render twice.
    if (journalPlaceProjectionIds.has(place.id)) continue;
    push({
      id: `place:${place.id}`,
      createdAt: place.confirmedAt,
      categoryFlowId: 'went_somewhere',
      icon: 'mappin.and.ellipse',
      accent: '#F49AC1',
      label: place.meaningLabel ? `${place.label} · ${place.meaningLabel}` : place.label,
      category: 'Place',
    });
  }

  if (day.stepsInterpretation) {
    const display = resolveMovementDisplay(day.stepsInterpretation);
    push({
      id: `movement:${day.isoDate}`,
      createdAt: day.stepsInterpretation.createdAt,
      categoryFlowId: 'movement',
      icon: 'figure.walk',
      accent: '#A8C99A',
      label: display.label,
      category: 'Movement',
    });
  }

  for (const moment of day.bigMoments ?? []) {
    if (moment.id.startsWith('bm-manual-')) continue;
    const display = resolveBigMomentDisplay(moment);
    push({
      id: `life-event:${moment.id}`,
      createdAt: moment.createdAt,
      categoryFlowId: 'big_event',
      icon: 'sparkles',
      accent: '#D5B8FF',
      label: display.label,
      category: 'Life event',
    });
  }

  if (day.sleep?.source === 'manual') {
    push({
      id: `sleep:${day.isoDate}`,
      createdAt: day.sleep.recordedAt ?? localDayTime(day.isoDate, 8),
      categoryFlowId: 'general',
      icon: 'bed.double.fill',
      accent: '#AAB2FF',
      label: SLEEP_LABEL[day.sleep.quality] ?? 'Sleep noted',
      category: 'Sleep',
      selectedState: sleepSelectedState(day.sleep.quality),
    });
  }

  return entries.sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
}

function localDayTime(isoDate: string, hour: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, Math.max(0, month - 1), day, hour, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function foodMeaningAccent(meaning: string): string {
  if (meaning === 'sharedMeal') return '#F4BE8D';
  if (meaning === 'comfort') return '#91D8C7';
  if (meaning === 'discovery') return '#C77DFF';
  if (meaning === 'fuel') return '#92D7FF';
  return '#FFC36B';
}

function studioRatingAccent(rating: string): string {
  if (rating === 'loved') return '#F49AC1';
  if (rating === 'inspired') return '#C77DFF';
  if (rating === 'meh') return '#A7D5FF';
  return '#E8C272';
}

function studioMediaIcon(mediaType: string): IconSymbolName {
  if (mediaType === 'book') return 'book.fill';
  if (mediaType === 'film' || mediaType === 'show') return 'film.fill';
  if (mediaType === 'game') return 'gamecontroller.fill';
  if (mediaType === 'music') return 'music.note';
  if (mediaType === 'art') return 'paintbrush.fill';
  return 'sparkles';
}

/**
 * Photo rows describe what the memory was about; the emotional archetype only
 * supplies its accent. Capture review already commits the same flow/category
 * chosen by manual journaling, so use that canonical choice icon first.
 */
function photoSubjectFlowId(day: HomeDayRecord, sourceId?: string | null): MomentCategoryFlowId | null {
  if (!sourceId) return null;

  const compatibilityEntry = (day.manualJournalEntries ?? []).find(
    (entry) => entry.sourceType === 'photo' && entry.sourceId === sourceId
  );
  if (compatibilityEntry) return toMomentCategoryFlowId(compatibilityEntry.flowId);

  const record = (day.journalRecords ?? []).find(
    (entry) => entry.source.kind === 'photo' && entry.source.sourceId === sourceId
  );
  if (record) return toMomentCategoryFlowId(record.flowId);

  const studio = (day.studioMoments ?? []).find((entry) => entry.source === 'photo' && entry.sourceId === sourceId);
  if (studio) return 'studio';

  const memory = (day.classifiedMemories ?? []).find(
    (entry) => entry.sourceType === 'photo' && entry.sourceId === sourceId
  );
  if (!memory) return null;
  const facets = [...memory.facets].sort(
    (left, right) => Number(!!right.confirmed) - Number(!!left.confirmed) || right.confidence - left.confidence
  );
  for (const facet of facets) {
    const selection = journalSelectionForFacet(facet.key, facet.value);
    if (selection) return toMomentCategoryFlowId(selection.flowId);
  }
  return null;
}

function moodSelectedState(choiceId: string | null | undefined): MomentSelectedState | null {
  if (choiceId === 'energized') return { kind: 'mood', state: 'radiant' };
  if (choiceId === 'good' || choiceId === 'calm' || choiceId === 'loved') return { kind: 'mood', state: 'light' };
  if (choiceId === 'meh') return { kind: 'mood', state: 'meh' };
  if (choiceId === 'drained' || choiceId === 'low') return { kind: 'mood', state: 'heavy' };
  if (choiceId === 'stressed') return { kind: 'mood', state: 'stormy' };
  return null;
}

function sleepSelectedState(choiceId: string | null | undefined): MomentSelectedState | null {
  if (choiceId === 'great' || choiceId === 'good') return { kind: 'sleep', state: 'good' };
  if (choiceId === 'ok' || choiceId === 'normal') return { kind: 'sleep', state: 'normal' };
  if (choiceId === 'poor' || choiceId === 'barely' || choiceId === 'low') return { kind: 'sleep', state: 'low' };
  return null;
}

function photoSubjectIcon(day: HomeDayRecord, sourceId?: string | null): IconSymbolName | null {
  if (!sourceId) return null;

  const compatibilityEntry = (day.manualJournalEntries ?? []).find(
    (entry) => entry.sourceType === 'photo' && entry.sourceId === sourceId
  );
  const compatibilityIcon = compatibilityEntry
    ? journalChoiceIcon(compatibilityEntry.flowId, compatibilityEntry.categoryId)
    : null;
  if (compatibilityIcon) return compatibilityIcon;

  const record = (day.journalRecords ?? []).find(
    (entry) => entry.source.kind === 'photo' && entry.source.sourceId === sourceId
  );
  const recordIcon = record ? journalChoiceIcon(record.flowId, record.categoryId) : null;
  if (recordIcon) return recordIcon;

  const studio = (day.studioMoments ?? []).find((entry) => entry.source === 'photo' && entry.sourceId === sourceId);
  if (studio) return studioMediaIcon(studio.mediaType);

  const memory = (day.classifiedMemories ?? []).find(
    (entry) => entry.sourceType === 'photo' && entry.sourceId === sourceId
  );
  if (!memory) return null;
  const facets = [...memory.facets].sort(
    (left, right) => Number(!!right.confirmed) - Number(!!left.confirmed) || right.confidence - left.confidence
  );
  for (const facet of facets) {
    const selection = journalSelectionForFacet(facet.key, facet.value);
    if (!selection) continue;
    const icon = journalChoiceIcon(selection.flowId, selection.categoryId);
    if (icon) return icon;
  }
  return null;
}

function journalChoiceIcon(flowId: string, categoryId: string): IconSymbolName | null {
  const flow = manualJournalFlow(flowId);
  return flow?.choices.find((choice) => choice.id === categoryId)?.icon ?? flow?.icon ?? null;
}

function toMomentCategoryFlowId(flowId: string | null | undefined): MomentCategoryFlowId {
  return MOMENT_CATEGORY_FLOW_IDS.has(flowId as MomentCategoryFlowId)
    ? flowId as MomentCategoryFlowId
    : 'general';
}

function journalSelectionForFacet(key: string, value: string): { flowId: string; categoryId: string } | null {
  if (key === 'media_type') {
    const categoryId = ['book', 'film', 'show', 'game', 'music', 'art'].includes(value) ? value : 'other_media';
    return { flowId: 'studio', categoryId };
  }
  if (key === 'device_activity') {
    const categoryId = ({ gaming: 'game', working: 'focus', studying: 'learning', creating: 'creative' } as Record<string, string>)[value];
    return categoryId ? { flowId: value === 'gaming' ? 'studio' : 'work', categoryId } : null;
  }
  if (key === 'food_kind' || key === 'food_item') {
    const categoryId = ({ coffee: 'coffee', tea: 'tea', drink: 'drink', dessert: 'dessert', snack: 'snack', cooking: 'cooking' } as Record<string, string>)[value] ?? 'meal';
    return { flowId: 'food', categoryId };
  }
  if (key === 'place_category') return { flowId: 'went_somewhere', categoryId: value === 'other' ? 'other_place' : value };
  if (key === 'movement_mode' || key === 'activity_kind') return { flowId: 'movement', categoryId: value === 'sport' ? 'sport' : value };
  return null;
}
