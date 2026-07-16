import type { IconSymbolName } from '@/components/ui/icon-symbol';
import { dayPromptRegistry } from '@/constants/day-prompts';
import type { HomeDayRecord } from '@/types/home';
import { manualJournalFlow } from '@/utils/manual-journal-registry';
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
  icon: IconSymbolName;
  accent: string;
  label: string;
  category?: string;
  noteText?: string | null;
  thumbnailUri?: string | null;
  audioUri?: string | null;
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
    push({
      id: `prompt:${answer.id}`,
      createdAt: answer.createdAt,
      icon: meaning?.icon ?? option?.icon ?? prompt?.categoryIcon ?? 'sparkles',
      accent: meaning?.accent ?? PROMPT_ACCENTS[answer.kind] ?? '#C9C2E8',
      label: answer.labels.join(' · '),
      category: PROMPT_CATEGORY[answer.kind] ?? prompt?.title.replace(/[?]$/, ''),
      noteText: answer.noteText,
    });
  }

  const hero = day.heroPhoto;
  if (hero) {
    hero.meaningLabels.forEach((label, index) => {
      const meta = MEANING_META[hero.meaningChoiceIds[index]] ?? MEANING_META.meaningful;
      push({
        id: `hero:${hero.assetId}:${index}`,
        createdAt: hero.selectedAt,
        icon: meta.icon,
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
      icon: meta.icon,
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
    push({
      id: `manual:${entry.id}`,
      createdAt: entry.createdAt,
      icon: flow?.icon ?? 'plus.circle.fill',
      accent: '#FFC36B',
      label: specific || choice?.label || flow?.title || 'Journal entry',
      category: choice?.label ?? flow?.title ?? 'Journal',
      noteText: linkedNote?.text ?? entry.note,
      audioUri: linkedNote?.kind === 'voice' ? linkedNote.audioUri : null,
    });
  }

  for (const food of day.foodMoments ?? []) {
    if (food.source !== 'manual') continue;
    if (food.sourceId && manualSourceIds.has(food.sourceId)) continue;
    const display = resolveFoodMomentDisplay(food);
    push({
      id: `food:${food.id}`,
      createdAt: food.createdAt,
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
      icon: 'bed.double.fill',
      accent: '#AAB2FF',
      label: SLEEP_LABEL[day.sleep.quality] ?? 'Sleep noted',
      category: 'Sleep',
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
