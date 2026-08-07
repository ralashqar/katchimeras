import type { StoredHomeDayRecord, StoredHomeState } from '@/types/home';
import type { StreakCaptureIntent, StreakCaptureType } from '@/types/streak';
import { resolvedTimezone } from '@/utils/streak-engine';

type QualifyingArtifact = {
  createdAt: string | null;
  sourceId: string;
  type: StreakCaptureType;
};

export function qualifyingArtifacts(day: StoredHomeDayRecord): QualifyingArtifact[] {
  const result: QualifyingArtifact[] = [];
  const push = (type: StreakCaptureType, sourceId: unknown, createdAt?: unknown) => {
    if (typeof sourceId !== 'string' || sourceId.length === 0) return;
    result.push({
      createdAt: typeof createdAt === 'string' ? createdAt : null,
      sourceId: `${type}:${sourceId}`,
      type,
    });
  };

  for (const record of day.journalRecords ?? []) {
    const sourceKind = record.source?.kind;
    const type: StreakCaptureType = sourceKind === 'photo'
      ? 'photo'
      : sourceKind === 'voice_note'
        ? 'voice'
        : 'journal';
    push(type, record.id, record.createdAt);
  }
  for (const entry of day.manualJournalEntries ?? []) push('journal', entry.id, entry.createdAt);
  for (const note of day.notes ?? []) push(note.kind === 'voice' ? 'voice' : 'journal', note.id, note.createdAt);
  for (const moment of day.moments ?? []) {
    if (moment.id.startsWith('seed-moment-')) continue;
    push(moment.source === 'photo_library' ? 'photo' : 'other_saved_artifact', moment.id, moment.createdAt);
  }
  for (const food of day.foodMoments ?? []) push('meal', food.id, food.createdAt);
  for (const studio of day.studioMoments ?? []) push('other_saved_artifact', studio.id, studio.createdAt);
  for (const place of day.confirmedPlaces ?? []) push('place_confirmed', place.id, place.confirmedAt);
  for (const answer of day.promptAnswers ?? []) {
    if (!answer.dismissed) push('reflection', answer.id, answer.createdAt);
  }
  if (day.hatchCheckIn?.moodId) push('mood', `check-in:${day.hatchCheckIn.moodId}`, day.hatchCheckIn.completedAt);
  if (day.sleep?.source === 'manual') push('sleep_manual', `sleep:${day.sleep.quality}`, day.stepsUpdatedAt);
  if (day.heroPhoto?.assetId) push('photo', `hero:${day.heroPhoto.assetId}`, day.heroPhoto.selectedAt);

  return dedupeArtifacts(result);
}

export function newQualifyingCaptureIntents(
  previous: StoredHomeState | null,
  next: StoredHomeState,
  now = new Date(),
): StreakCaptureIntent[] {
  const previousDays = new Map(allStoredDays(previous).map((day) => [day.isoDate, day]));
  const intents: StreakCaptureIntent[] = [];
  const today = localDateFor(now);
  for (const day of allStoredDays(next)) {
    if (day.isoDate > today) continue;
    const before = new Set(qualifyingArtifacts(previousDays.get(day.isoDate) ?? emptyDayLike(day)).map((item) => item.sourceId));
    for (const artifact of qualifyingArtifacts(day)) {
      if (before.has(artifact.sourceId)) continue;
      const occurredAt = artifact.createdAt ?? now.toISOString();
      const sourceIdHash = streakSourceHash(artifact.sourceId);
      intents.push({
        clientEventId: `streak:${day.isoDate}:${sourceIdHash}`,
        localDate: day.isoDate,
        occurredAt,
        sourceIdHash,
        timezone: resolvedTimezone(),
        type: artifact.type,
      });
    }
  }
  return intents;
}

export function historicalQualifyingCaptureIntents(
  state: StoredHomeState,
  now = new Date(),
): StreakCaptureIntent[] {
  return allStoredDays(state)
    .filter((day) => day.isoDate <= localDateFor(now))
    .flatMap((day) => qualifyingArtifacts(day).slice(0, 1).map((artifact) => {
      const sourceIdHash = streakSourceHash(artifact.sourceId);
      return {
        clientEventId: `streak-history:${day.isoDate}:${sourceIdHash}`,
        localDate: day.isoDate,
        occurredAt: artifact.createdAt ?? `${day.isoDate}T12:00:00.000Z`,
        sourceIdHash,
        timezone: resolvedTimezone(),
        type: artifact.type,
      };
    }));
}

export function streakSourceHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function allStoredDays(state: StoredHomeState | null): StoredHomeDayRecord[] {
  if (!state) return [];
  return [...state.archivedDays, state.today, ...(state.tomorrow ? [state.tomorrow] : [])];
}

function emptyDayLike(day: StoredHomeDayRecord): StoredHomeDayRecord {
  return {
    ...day,
    confirmedPlaces: [],
    foodMoments: [],
    hatchCheckIn: undefined,
    heroPhoto: null,
    journalRecords: [],
    manualJournalEntries: [],
    moments: [],
    notes: [],
    promptAnswers: [],
    sleep: undefined,
    studioMoments: [],
  };
}

function dedupeArtifacts(items: QualifyingArtifact[]): QualifyingArtifact[] {
  return [...new Map(items.map((item) => [item.sourceId, item])).values()];
}

function localDateFor(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
