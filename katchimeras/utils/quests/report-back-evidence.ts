import type { IconSymbolName } from '@/components/ui/icon-symbol';
import type { ClassifiedMemory, DayEvidence, HomeDayRecord } from '@/types/home';
import type { CompanionQuest, QuestSubmissionRecord } from '@/utils/katchimera-quests';
import type { QuestRuntimeStatus } from '@/utils/quests/runtime';
import { resolveFoodMomentDisplay, resolveStudioMomentDisplay } from '@/utils/memory-display';

import { questDefinition } from './definitions';

export type QuestReportBackItem = {
  id: string;
  kind: 'photo' | 'voice' | 'note' | 'place' | 'food' | 'studio' | 'movement' | 'sleep' | 'weather' | 'moment';
  sourceType: string;
  sourceId: string;
  evidenceId?: string | null;
  createdAt?: string | null;
  title: string;
  subtitle: string;
  body?: string | null;
  thumbnailUri?: string | null;
  icon: IconSymbolName;
  accentColor: string;
  matchStatus?: 'ready' | 'possible';
  qualityId?: string | null;
};

export type QuestSubmissionItem = QuestReportBackItem;

export function buildQuestSubmissionItems(
  day: HomeDayRecord | null | undefined,
  runtime: QuestRuntimeStatus | null | undefined,
  quest: CompanionQuest | null | undefined,
  submissions: QuestSubmissionRecord[] | undefined,
  limit = 3,
  preferredSourceId: string | null = null
): QuestSubmissionItem[] {
  if (!day || !runtime || !quest) return [];
  if (!runtime.readyToSubmit && !runtime.complete && (runtime.possibleEvidenceIds ?? []).length === 0) return [];

  const items: QuestSubmissionItem[] = [];
  for (const id of runtime.matchedEvidenceIds) {
    const item = itemForEvidenceId(day, id);
    if (item) items.push({ ...item, matchStatus: 'ready' });
  }
  const requestedQuality = questDefinition(runtime.questId)?.criteria.find(
    (criterion) => criterion.fact === 'memory.qualities' && typeof criterion.value === 'string'
  )?.value as string | undefined;
  for (const id of runtime.possibleEvidenceIds ?? []) {
    const item = itemForEvidenceId(day, id);
    if (item) items.push({ ...item, matchStatus: 'possible', qualityId: requestedQuality ?? null });
  }

  if (items.length === 0 && (runtime.readyToSubmit || runtime.complete)) {
    items.push(...fallbackItemsForQuest(day, runtime.questId));
  }

  return dedupeItems(items)
    .filter((item) => !isSubmittedForQuest(submissions, quest.questId, quest.creatureId, item.sourceType, item.sourceId))
    .sort((left, right) =>
      Number(right.sourceId === preferredSourceId) - Number(left.sourceId === preferredSourceId) ||
      Date.parse(right.createdAt ?? '') - Date.parse(left.createdAt ?? '')
    )
    .slice(0, limit);
}

export function buildQuestReportBackItems(
  day: HomeDayRecord | null | undefined,
  runtime: QuestRuntimeStatus | null | undefined,
  limit = 3
): QuestReportBackItem[] {
  if (!day || !runtime?.complete) return [];

  const items: QuestReportBackItem[] = [];
  for (const id of runtime.matchedEvidenceIds) {
    const item = itemForEvidenceId(day, id);
    if (item) items.push(item);
  }

  if (items.length === 0) {
    items.push(...fallbackItemsForQuest(day, runtime.questId));
  }

  return dedupeItems(items).slice(0, limit);
}

function itemForEvidenceId(day: HomeDayRecord, evidenceId: string): QuestReportBackItem | null {
  const evidence = (day.evidence ?? []).find((item) => item.id === evidenceId) ?? evidenceFromClassifiedMemory(day, evidenceId);
  if (!evidence) return null;

  if (evidence.sourceType === 'photo') {
    return photoEvidenceItem(day, evidence);
  }

  if (evidence.sourceType === 'voice_note' || evidence.sourceType === 'text_note') {
    return noteEvidenceItem(day, evidence);
  }

  return {
    id: evidence.id,
    kind: evidence.sourceType === 'place' ? 'place' : 'moment',
    sourceType: evidence.sourceType,
    sourceId: evidence.sourceId,
    evidenceId: evidence.id,
    createdAt: evidence.observedAt,
    title: titleForEvidence(evidence),
    subtitle: evidence.explanation ?? 'Matched evidence',
    thumbnailUri: evidence.thumbnailUri ?? null,
    icon: iconForEvidence(evidence),
    accentColor: '#A8E2C6',
  };
}

function evidenceFromClassifiedMemory(day: HomeDayRecord, evidenceId: string): DayEvidence | null {
  const sourceId = evidenceId.startsWith('photo:') || evidenceId.startsWith('note:')
    ? evidenceId.slice(evidenceId.indexOf(':') + 1)
    : null;
  const memory = (day.classifiedMemories ?? []).find(
    (item) => item.id === evidenceId || (!!sourceId && item.sourceId === sourceId)
  );
  if (!memory) return null;
  return {
    id: evidenceId,
    sourceType: memory.sourceType === 'movement' ? 'steps' : memory.sourceType,
    sourceId: memory.sourceId,
    observedAt: memory.createdAt,
    thumbnailUri: thumbnailForMemory(day, memory),
    provider: 'deterministic',
    confidence: Math.max(0, ...(memory.qualities ?? []).map((quality) => quality.score)),
    signals: (memory.qualities ?? [])
      .filter((quality) => quality.status !== 'rejected')
      .map((quality) => ({
        key: quality.qualityId,
        confidence: quality.score,
        raw: quality.qualityId,
        provider: quality.status === 'confirmed' ? 'manual' : quality.sources[0]?.provider ?? 'deterministic',
        source: 'aggregate',
        centrality: quality.centrality,
        qualityStatus: quality.status,
      })),
    explanation: 'Possible match from the photo intelligence record.',
  };
}

function thumbnailForMemory(day: HomeDayRecord, memory: ClassifiedMemory): string | null {
  const meaning = (day.capturedMeanings ?? []).find((item) => item.sourceId === memory.sourceId);
  if (meaning?.thumbnailUri) return meaning.thumbnailUri;
  const moment = day.moments.find(
    (item) => item.type === 'photo' && (
      item.metadata?.assetId === memory.sourceId ||
      item.metadata?.localUri === memory.sourceId ||
      item.metadata?.thumbnailUri === memory.sourceId
    )
  );
  return moment?.metadata?.thumbnailUri ?? moment?.metadata?.localUri ?? null;
}

function photoEvidenceItem(day: HomeDayRecord, evidence: DayEvidence): QuestReportBackItem {
  const meaning = (day.capturedMeanings ?? []).find(
    (item) => item.sourceId === evidence.sourceId || (!!item.thumbnailUri && item.thumbnailUri === evidence.thumbnailUri)
  );
  const moment = day.moments.find(
    (item) =>
      item.type === 'photo' &&
      (item.metadata?.assetId === evidence.sourceId ||
        item.metadata?.thumbnailUri === evidence.thumbnailUri ||
        item.metadata?.localUri === evidence.sourceId)
  );
  const food = (day.foodMoments ?? []).find(
    (item) => item.source === 'photo' && (!!item.thumbnailUri ? item.thumbnailUri === evidence.thumbnailUri : true)
  );
  const studio = (day.studioMoments ?? []).find(
    (item) => item.source === 'photo' && (!!item.thumbnailUri ? item.thumbnailUri === evidence.thumbnailUri : true)
  );

  return {
    id: evidence.id,
    kind: 'photo',
    sourceType: 'photo',
    sourceId: evidence.sourceId,
    evidenceId: evidence.id,
    createdAt: evidence.observedAt,
    title: meaning?.label ?? food?.label ?? studio?.label ?? moment?.label ?? 'Photo',
    subtitle: evidence.explanation ?? 'Matched photo evidence',
    thumbnailUri: evidence.thumbnailUri ?? meaning?.thumbnailUri ?? moment?.metadata?.thumbnailUri ?? food?.thumbnailUri ?? studio?.thumbnailUri ?? null,
    icon: 'camera.fill',
    accentColor: '#92D7FF',
  };
}

function noteEvidenceItem(day: HomeDayRecord, evidence: DayEvidence): QuestReportBackItem {
  const note = (day.notes ?? []).find((item) => item.id === evidence.sourceId);
  const food = (day.foodMoments ?? []).find((item) => item.noteId === evidence.sourceId);
  const studio = (day.studioMoments ?? []).find((item) => item.noteId === evidence.sourceId);
  const isVoice = evidence.sourceType === 'voice_note' || note?.kind === 'voice';

  return {
    id: evidence.id,
    kind: isVoice ? 'voice' : 'note',
    sourceType: isVoice ? 'voice_note' : 'text_note',
    sourceId: evidence.sourceId,
    evidenceId: evidence.id,
    createdAt: evidence.observedAt,
    title: studio?.label ?? food?.label ?? note?.label ?? (isVoice ? 'Voice note' : 'Written note'),
    subtitle: isVoice ? 'Voice note' : 'Written note',
    body: note?.text ?? food?.detail ?? studio?.detail ?? evidence.explanation ?? null,
    icon: isVoice ? 'mic.fill' : 'square.and.pencil',
    accentColor: isVoice ? '#A8E2C6' : '#C77DFF',
  };
}

function fallbackItemsForQuest(day: HomeDayRecord, questId: string): QuestReportBackItem[] {
  const def = questDefinition(questId);
  const facts = new Set(def?.criteria.map((criterion) => criterion.fact) ?? []);
  const items: QuestReportBackItem[] = [];

  if (facts.has('food.cuisines') || facts.has('food.moments')) {
    items.push(...latestFoodItems(day));
  }
  if (facts.has('studio.media')) {
    items.push(...latestStudioItems(day, def?.criteria.find((criterion) => criterion.fact === 'studio.media')?.value));
  }
  if (facts.has('notes.added')) {
    items.push(...latestNoteItems(day, questId));
  }
  if (facts.has('notes.voiceAdded')) {
    items.push(...latestNoteItems(day, questId));
  }
  if (facts.has('places.categories') || facts.has('places.confirmed') || facts.has('places.confirmedNew')) {
    items.push(...latestPlaceItems(day));
  }
  if (facts.has('moments.captured') || facts.has('capture.earliestHour') || facts.has('capture.latestHour')) {
    items.push(...latestCaptureItems(day));
  }
  if (facts.has('steps.count')) {
    items.push({
      id: `steps-${day.isoDate}`,
      kind: 'movement',
      sourceType: 'steps',
      sourceId: day.isoDate,
      evidenceId: null,
      createdAt: day.stepsUpdatedAt ?? `${day.isoDate}T12:00:00.000Z`,
      title: `${formatCompact(day.stepsCount)} steps`,
      subtitle: day.stepsInterpretation?.label ?? 'Movement today',
      icon: 'figure.walk',
      accentColor: '#A8E2C6',
    });
  }
  if (facts.has('sleep.quality') && day.sleep) {
    items.push({
      id: `sleep-${day.isoDate}`,
      kind: 'sleep',
      sourceType: 'sleep',
      sourceId: day.isoDate,
      evidenceId: null,
      createdAt: `${day.isoDate}T12:00:00.000Z`,
      title: sleepTitle(day.sleep.quality),
      subtitle: day.sleep.source === 'appleHealth' ? 'From Health' : 'Logged manually',
      icon: 'bed.double.fill',
      accentColor: '#AAB2FF',
    });
  }
  if (facts.has('weather.condition') && day.weather) {
    items.push({
      id: `weather-${day.isoDate}`,
      kind: 'weather',
      sourceType: 'weather',
      sourceId: day.isoDate,
      evidenceId: null,
      createdAt: `${day.isoDate}T12:00:00.000Z`,
      title: weatherTitle(day.weather.condition),
      subtitle: day.weather.source === 'forecast' ? 'From forecast' : 'From photo evidence',
      icon: weatherIcon(day.weather.condition),
      accentColor: '#92D7FF',
    });
  }

  return items.sort((left, right) => timestampFromId(right.id) - timestampFromId(left.id));
}

function latestFoodItems(day: HomeDayRecord): QuestReportBackItem[] {
  return [...(day.foodMoments ?? [])].reverse().map((item) => {
    const display = resolveFoodMomentDisplay(item);
    return ({
    id: item.id,
    kind: 'food' as const,
    sourceType: 'food',
    sourceId: item.id,
    evidenceId: null,
    createdAt: item.createdAt,
    title: display.label,
    subtitle: [display.detail, foodMeaningTitle(item.meaning)]
      .filter(Boolean)
      .join(' - '),
    body: item.detail ?? null,
    thumbnailUri: item.thumbnailUri ?? null,
    icon: 'fork.knife',
    accentColor: '#FFC36B',
    });
  });
}

function latestStudioItems(day: HomeDayRecord, requestedMedia?: unknown): QuestReportBackItem[] {
  const requested = typeof requestedMedia === 'string' ? requestedMedia : null;
  return [...(day.studioMoments ?? [])]
    .filter((item) => !requested || item.mediaType === requested)
    .reverse()
    .map((item) => {
      const display = resolveStudioMomentDisplay(item);
      return ({
      id: item.id,
      kind: 'studio' as const,
      sourceType: 'studio',
      sourceId: item.id,
      evidenceId: null,
      createdAt: item.createdAt,
      title: display.label,
      subtitle: `${studioMediaTitle(item.mediaType)} - ${studioRatingTitle(item.rating)}`,
      body: display.detail,
      thumbnailUri: item.thumbnailUri ?? null,
      icon: studioIcon(item.mediaType),
      accentColor: '#E8C272',
      });
    });
}

function latestNoteItems(day: HomeDayRecord, questId: string): QuestReportBackItem[] {
  const bigMomentNoteIds = new Set((day.bigMoments ?? []).map((moment) => moment.noteId).filter(Boolean));
  const notes = [...(day.notes ?? [])].reverse();
  if (questId === 'quest-celebrate-note') {
    notes.sort((left, right) => noteCelebrationRank(right, bigMomentNoteIds) - noteCelebrationRank(left, bigMomentNoteIds));
  }
  return notes.map((item) => {
    const bigMoment = (day.bigMoments ?? []).find((moment) => moment.noteId === item.id);
    const isVoice = item.kind === 'voice';
    return {
      id: item.id,
      kind: isVoice ? 'voice' as const : 'note' as const,
      sourceType: isVoice ? 'voice_note' as const : 'text_note' as const,
      sourceId: item.id,
      evidenceId: null,
      createdAt: item.createdAt,
      title: item.label,
      subtitle: bigMoment ? `${isVoice ? 'Voice note' : 'Written note'} - Big Moment` : isVoice ? durationSubtitle(item.durationMs) : 'Written note',
      body: item.text,
      icon: isVoice ? 'mic.fill' as const : 'square.and.pencil' as const,
      accentColor: isVoice ? '#A8E2C6' : '#C77DFF',
    };
  });
}

function noteCelebrationRank(note: NonNullable<HomeDayRecord['notes']>[number], bigMomentNoteIds: Set<string | null>): number {
  let rank = 0;
  if (note.kind === 'voice') rank += 2;
  if (bigMomentNoteIds.has(note.id)) rank += 4;
  if (note.archetype === 'meaningful' || note.archetype === 'together') rank += 1;
  return rank;
}

function latestPlaceItems(day: HomeDayRecord): QuestReportBackItem[] {
  return [...(day.confirmedPlaces ?? [])].reverse().map((item) => ({
    id: `place-${item.id}`,
    kind: 'place' as const,
    sourceType: 'place',
    sourceId: item.id,
    evidenceId: null,
    createdAt: item.confirmedAt,
    title: item.label,
    subtitle: item.meaningLabel ?? 'Confirmed place',
    icon: 'mappin.and.ellipse',
    accentColor: '#A8E2C6',
  }));
}

function latestCaptureItems(day: HomeDayRecord): QuestReportBackItem[] {
  return [...(day.capturedMeanings ?? [])].reverse().map((item, index) => ({
    id: `capture-${item.sourceId ?? item.createdAt ?? index}`,
    kind: 'photo' as const,
    sourceType: 'photo',
    sourceId: item.sourceId ?? item.thumbnailUri ?? item.createdAt,
    evidenceId: null,
    createdAt: item.createdAt,
    title: item.label,
    subtitle: 'Captured moment',
    thumbnailUri: item.thumbnailUri ?? null,
    icon: 'camera.fill',
    accentColor: '#92D7FF',
  }));
}

function isSubmittedForQuest(
  submissions: QuestSubmissionRecord[] | undefined,
  questId: string,
  creatureId: string,
  sourceType: string,
  sourceId: string
): boolean {
  return (submissions ?? []).some(
    (record) =>
      record.questId === questId &&
      record.creatureId === creatureId &&
      record.sourceType === sourceType &&
      record.sourceId === sourceId
  );
}

function dedupeItems(items: QuestReportBackItem[]): QuestReportBackItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.kind}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function titleForEvidence(evidence: DayEvidence): string {
  switch (evidence.sourceType) {
    case 'food':
      return 'Food evidence';
    case 'studio':
      return 'Studio evidence';
    case 'place':
      return 'Place evidence';
    case 'steps':
      return 'Movement evidence';
    case 'sleep':
      return 'Sleep evidence';
    case 'weather':
      return 'Weather evidence';
    default:
      return 'Matched evidence';
  }
}

function iconForEvidence(evidence: DayEvidence): IconSymbolName {
  switch (evidence.sourceType) {
    case 'food':
      return 'fork.knife';
    case 'studio':
      return 'sparkles';
    case 'place':
      return 'mappin.and.ellipse';
    case 'steps':
      return 'figure.walk';
    case 'sleep':
      return 'bed.double.fill';
    case 'weather':
      return 'cloud.fill';
    default:
      return 'sparkles';
  }
}

function studioIcon(mediaType: string): IconSymbolName {
  switch (mediaType) {
    case 'book':
      return 'book.fill';
    case 'film':
    case 'show':
      return 'film.fill';
    case 'game':
      return 'gamecontroller.fill';
    case 'music':
      return 'music.note';
    case 'art':
      return 'paintbrush.fill';
    default:
      return 'sparkles';
  }
}

function weatherIcon(condition: string): IconSymbolName {
  switch (condition) {
    case 'clear':
      return 'sun.max.fill';
    case 'partly_cloudy':
      return 'cloud.sun.fill';
    case 'fog':
      return 'cloud.fog.fill';
    case 'rain':
      return 'cloud.rain.fill';
    case 'snow':
      return 'cloud.snow.fill';
    case 'storm':
      return 'cloud.bolt.rain.fill';
    default:
      return 'cloud.fill';
  }
}

function studioMediaTitle(mediaType: string): string {
  switch (mediaType) {
    case 'book':
      return 'Book';
    case 'film':
      return 'Film';
    case 'show':
      return 'Show';
    case 'game':
      return 'Game';
    case 'music':
      return 'Music';
    case 'art':
      return 'Art';
    default:
      return 'Inspiration';
  }
}

function studioRatingTitle(rating: string): string {
  switch (rating) {
    case 'loved':
      return 'Loved';
    case 'inspired':
      return 'Inspired';
    case 'liked':
      return 'Liked';
    case 'meh':
      return 'Logged';
    default:
      return 'Logged';
  }
}

function foodMeaningTitle(meaning: string): string {
  switch (meaning) {
    case 'sharedMeal':
      return 'Shared meal';
    case 'comfort':
      return 'Comfort';
    case 'fuel':
      return 'Fuel';
    case 'discovery':
      return 'Discovery';
    default:
      return 'Treat';
  }
}

function sleepTitle(quality: string): string {
  if (quality === 'good') return 'Good sleep';
  if (quality === 'low') return 'Low sleep';
  return 'Sleep logged';
}

function weatherTitle(condition: string): string {
  return condition
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function durationSubtitle(durationMs: number | null): string {
  if (!durationMs) return 'Voice note';
  const seconds = Math.max(1, Math.round(durationMs / 1000));
  return `Voice note - ${seconds}s`;
}

function formatCompact(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return `${value}`;
}

function timestampFromId(id: string): number {
  const match = id.match(/(\d{10,})/);
  return match ? Number(match[1]) : 0;
}
