import type {
  ClassifiedMemory,
  DayGrowthState,
  HealthPermissionState,
  LocationPermissionState,
  JournalRecord,
  StoredHomeDayRecord,
  StoredHomeState,
} from '@/types/home';
import { deriveMemoryQualities } from '@/utils/intelligence/quality-registry';
import { QUESTION_PLANNER_VERSION, questionIdForGraphNode } from '@/utils/intelligence/question-registry';
import { buildDailyCreatureCard, upgradeDailyCreatureCard } from '@/utils/daily-card';
import { reconcileDaySkySnapshot } from '@/utils/day-sky';
import { withKatchimeraIdentity } from '@/utils/katchimera-identity';
import { createFallbackLocationsForStoredDay } from './locations';

type LegacyStoredHomeDayRecord = Omit<
  StoredHomeDayRecord,
  | 'locations'
  | 'healthRouteImport'
  | 'exactRouteSegments'
  | 'stepsCount'
  | 'visitedPlaceCount'
  | 'newPlaceCount'
  | 'locationSampleCount'
  | 'shareReadyAt'
  | 'promptAnswers'
  | 'heroPhoto'
>;

type Version2StoredHomeDayRecord = Omit<
  StoredHomeDayRecord,
  | 'healthRouteImport'
  | 'exactRouteSegments'
  | 'stepsCount'
  | 'visitedPlaceCount'
  | 'newPlaceCount'
  | 'locationSampleCount'
  | 'shareReadyAt'
  | 'promptAnswers'
  | 'heroPhoto'
>;

type Version3StoredHomeDayRecord = Omit<
  StoredHomeDayRecord,
  'stepsCount' | 'visitedPlaceCount' | 'newPlaceCount' | 'locationSampleCount' | 'shareReadyAt' | 'promptAnswers' | 'heroPhoto'
>;

type Version2StoredHomeState = {
  version: 2;
  locationPermission: LocationPermissionState;
  archivedDays: Version2StoredHomeDayRecord[];
  today: Version2StoredHomeDayRecord;
};

type Version3StoredHomeState = {
  version: 3;
  locationPermission: LocationPermissionState;
  healthPermission: HealthPermissionState;
  archivedDays: Version3StoredHomeDayRecord[];
  today: Version3StoredHomeDayRecord;
};

type LegacyStoredHomeState = {
  version?: 1;
  archivedDays: LegacyStoredHomeDayRecord[];
  today: LegacyStoredHomeDayRecord;
};

type Version5StoredHomeDayRecord = Omit<StoredHomeDayRecord, 'promptAnswers' | 'heroPhoto'>;

type Version5StoredHomeState = Omit<StoredHomeState, 'version' | 'archivedDays' | 'today'> & {
  version: 5;
  archivedDays: Version5StoredHomeDayRecord[];
  today: Version5StoredHomeDayRecord;
};

type Version4StoredHomeState = Omit<StoredHomeState, 'version' | 'encounterHistory' | 'archivedDays' | 'today'> & {
  version: 4;
  archivedDays: Version5StoredHomeDayRecord[];
  today: Version5StoredHomeDayRecord;
};

type Version8ClassifiedMemory = Omit<ClassifiedMemory, 'qualities'> & { qualities?: ClassifiedMemory['qualities'] };
type Version8StoredHomeDayRecord = Omit<StoredHomeDayRecord, 'classifiedMemories'> & {
  classifiedMemories?: Version8ClassifiedMemory[];
};
type Version8StoredHomeState = Omit<StoredHomeState, 'version' | 'archivedDays' | 'today' | 'tomorrow'> & {
  version: 8;
  archivedDays: Version8StoredHomeDayRecord[];
  today: Version8StoredHomeDayRecord;
  tomorrow?: Version8StoredHomeDayRecord;
};
type Version9StoredHomeState = Omit<StoredHomeState, 'version'> & { version: 9 };
type Version10StoredHomeState = Omit<StoredHomeState, 'version'> & { version: 10 };
type Version11StoredHomeState = Omit<StoredHomeState, 'version'> & { version: 11 };
type Version12StoredHomeDayRecord = Omit<StoredHomeDayRecord, 'card'> & { card?: StoredHomeDayRecord['card'] };
type Version12StoredHomeState = Omit<StoredHomeState, 'version' | 'archivedDays' | 'today' | 'tomorrow'> & {
  version: 12;
  archivedDays: Version12StoredHomeDayRecord[];
  today: Version12StoredHomeDayRecord;
  tomorrow?: Version12StoredHomeDayRecord;
};
type Version13StoredHomeState = Omit<StoredHomeState, 'version'> & { version: 13 };
type Version14StoredHomeState = Omit<StoredHomeState, 'version'> & { version: 14 };
type Version15StoredHomeDayRecord = Omit<StoredHomeDayRecord, 'skyPolicy'> & {
  skyPolicy?: StoredHomeDayRecord['skyPolicy'];
};
type Version15StoredHomeState = Omit<StoredHomeState, 'version' | 'archivedDays' | 'today' | 'tomorrow'> & {
  version: 15;
  archivedDays: Version15StoredHomeDayRecord[];
  today: Version15StoredHomeDayRecord;
  tomorrow?: Version15StoredHomeDayRecord;
};
type Version16StoredHomeState = Omit<StoredHomeState, 'version'> & { version: 16 };
type Version17StoredHomeState = Omit<StoredHomeState, 'version'> & { version: 17 };
type Version18StoredHomeState = Omit<StoredHomeState, 'version'> & { version: 18 };
type Version19StoredHomeState = Omit<StoredHomeState, 'version'> & { version: 19 };
type Version7StoredHomeState = Omit<Version8StoredHomeState, 'version' | 'personalEntities' | 'cloudIntelligenceEnabled'> & {
  version: 7;
};
type Version6StoredHomeState = Omit<Version7StoredHomeState, 'version'> & { version: 6 };

export type UpgradeableStoredHomeState =
  | StoredHomeState
  | Version19StoredHomeState
  | Version18StoredHomeState
  | Version17StoredHomeState
  | Version16StoredHomeState
  | Version15StoredHomeState
  | Version14StoredHomeState
  | Version13StoredHomeState
  | Version12StoredHomeState
  | Version11StoredHomeState
  | Version10StoredHomeState
  | Version9StoredHomeState
  | Version8StoredHomeState
  | Version7StoredHomeState
  | Version6StoredHomeState
  | Version5StoredHomeState
  | Version4StoredHomeState
  | Version3StoredHomeState
  | Version2StoredHomeState
  | LegacyStoredHomeState;

export function upgradeStoredHomeState(inputState: UpgradeableStoredHomeState): StoredHomeState {
  if ('version' in inputState && inputState.version === 20) {
    return {
      ...inputState,
      archivedDays: inputState.archivedDays.map(ensureStoredDayFields),
      today: ensureStoredDayFields(inputState.today),
      tomorrow: inputState.tomorrow ? ensureStoredDayFields(inputState.tomorrow) : undefined,
    };
  }

  if ('version' in inputState && inputState.version === 19) {
    return {
      ...inputState,
      version: 20,
      archivedDays: inputState.archivedDays.map(ensureStoredDayFields),
      today: ensureStoredDayFields(inputState.today),
      tomorrow: inputState.tomorrow ? ensureStoredDayFields(inputState.tomorrow) : undefined,
    };
  }

  if ('version' in inputState && inputState.version === 18) {
    return {
      ...inputState,
      version: 20,
      archivedDays: inputState.archivedDays.map(ensureStoredDayFields),
      today: ensureStoredDayFields(inputState.today),
      tomorrow: inputState.tomorrow ? ensureStoredDayFields(inputState.tomorrow) : undefined,
    };
  }

  if ('version' in inputState && inputState.version === 17) {
    return {
      ...inputState,
      version: 20,
      archivedDays: inputState.archivedDays.map(ensureStoredDayFields),
      today: ensureStoredDayFields(inputState.today),
      tomorrow: inputState.tomorrow ? ensureStoredDayFields(inputState.tomorrow) : undefined,
    };
  }

  if ('version' in inputState && inputState.version === 16) {
    return {
      ...inputState,
      version: 20,
      aspectHistory: inputState.aspectHistory ?? {},
      skinHistory: inputState.skinHistory ?? {},
      archivedDays: inputState.archivedDays.map(ensureStoredDayFields),
      today: ensureStoredDayFields(inputState.today),
      tomorrow: inputState.tomorrow ? ensureStoredDayFields(inputState.tomorrow) : undefined,
    };
  }

  if ('version' in inputState && inputState.version === 15) {
    return {
      ...inputState,
      version: 20,
      archivedDays: inputState.archivedDays.map(ensureStoredDayFields),
      today: ensureStoredDayFields(inputState.today),
      tomorrow: inputState.tomorrow ? ensureStoredDayFields(inputState.tomorrow) : undefined,
    };
  }

  if ('version' in inputState && inputState.version === 14) {
    return {
      ...inputState,
      version: 20,
      archivedDays: inputState.archivedDays.map(ensureStoredDayFields),
      today: ensureStoredDayFields(inputState.today),
      tomorrow: inputState.tomorrow ? ensureStoredDayFields(inputState.tomorrow) : undefined,
    };
  }

  if ('version' in inputState && inputState.version === 13) {
    return {
      ...inputState,
      version: 20,
      archivedDays: inputState.archivedDays.map(ensureStoredDayFields),
      today: ensureStoredDayFields(inputState.today),
      tomorrow: inputState.tomorrow ? ensureStoredDayFields(inputState.tomorrow) : undefined,
    };
  }

  if ('version' in inputState && inputState.version === 12) {
    return {
      ...inputState,
      version: 20,
      archivedDays: inputState.archivedDays.map(ensureStoredDayFields),
      today: ensureStoredDayFields(inputState.today),
      tomorrow: inputState.tomorrow ? ensureStoredDayFields(inputState.tomorrow) : undefined,
    };
  }

  if ('version' in inputState && inputState.version === 11) {
    return {
      ...inputState,
      version: 20,
      archivedDays: inputState.archivedDays.map(ensureStoredDayFields),
      today: ensureStoredDayFields(inputState.today),
      tomorrow: inputState.tomorrow ? ensureStoredDayFields(inputState.tomorrow) : undefined,
    };
  }

  if ('version' in inputState && inputState.version === 10) {
    return {
      ...inputState,
      version: 20,
      archivedDays: inputState.archivedDays.map(ensureStoredDayFields),
      today: ensureStoredDayFields(inputState.today),
      tomorrow: inputState.tomorrow ? ensureStoredDayFields(inputState.tomorrow) : undefined,
    };
  }

  if ('version' in inputState && inputState.version === 9) {
    return {
      ...inputState,
      version: 20,
      archivedDays: inputState.archivedDays.map(ensureStoredDayFields),
      today: ensureStoredDayFields(inputState.today),
      tomorrow: inputState.tomorrow ? ensureStoredDayFields(inputState.tomorrow) : undefined,
    };
  }

  if ('version' in inputState && inputState.version === 8) {
    return {
      ...inputState,
      version: 20,
      personalEntities: inputState.personalEntities ?? [],
      cloudIntelligenceEnabled: inputState.cloudIntelligenceEnabled === true,
      archivedDays: inputState.archivedDays.map(ensureStoredDayFields),
      today: ensureStoredDayFields(inputState.today),
      tomorrow: inputState.tomorrow ? ensureStoredDayFields(inputState.tomorrow) : undefined,
    };
  }

  if ('version' in inputState && (inputState.version === 7 || inputState.version === 6)) {
    return {
      ...inputState,
      version: 20,
      encounterHistory: inputState.encounterHistory ?? {},
      personalEntities: [],
      cloudIntelligenceEnabled: false,
      archivedDays: inputState.archivedDays.map(ensureStoredDayFields),
      today: ensureStoredDayFields(inputState.today),
      tomorrow: inputState.tomorrow ? ensureStoredDayFields(inputState.tomorrow) : undefined,
    };
  }

  if ('version' in inputState && inputState.version === 5) {
    return {
      ...inputState,
      version: 20,
      encounterHistory: inputState.encounterHistory ?? {},
      personalEntities: [],
      cloudIntelligenceEnabled: false,
      archivedDays: inputState.archivedDays.map(ensureStoredDayFields),
      today: ensureStoredDayFields(inputState.today),
    };
  }

  if ('version' in inputState && inputState.version === 4) {
    return {
      ...inputState,
      version: 20,
      encounterHistory: {},
      personalEntities: [],
      cloudIntelligenceEnabled: false,
      archivedDays: inputState.archivedDays.map(ensureStoredDayFields),
      today: ensureStoredDayFields(inputState.today),
    };
  }

  if ('version' in inputState && inputState.version === 3) {
    return {
      version: 20,
      locationPermission: inputState.locationPermission,
      activityPermission: 'unknown',
      healthPermission: inputState.healthPermission,
      encounterHistory: {},
      personalEntities: [],
      cloudIntelligenceEnabled: false,
      archivedDays: inputState.archivedDays.map(ensureStoredDayFields),
      today: ensureStoredDayFields(inputState.today),
    };
  }

  if ('version' in inputState && inputState.version === 2) {
    return {
      version: 20,
      locationPermission: inputState.locationPermission,
      activityPermission: 'unknown',
      healthPermission: 'unknown',
      encounterHistory: {},
      personalEntities: [],
      cloudIntelligenceEnabled: false,
      archivedDays: inputState.archivedDays.map(ensureStoredDayFields),
      today: ensureStoredDayFields(inputState.today),
    };
  }

  const legacy = inputState as LegacyStoredHomeState;

  return {
    version: 20,
    locationPermission: 'unknown',
    activityPermission: 'unknown',
    healthPermission: 'unknown',
    encounterHistory: {},
    personalEntities: [],
    cloudIntelligenceEnabled: false,
    archivedDays: legacy.archivedDays.map(ensureStoredDayFields),
    today: ensureStoredDayFields(legacy.today),
  };
}

function ensureStoredDayFields(
  day:
    | StoredHomeDayRecord
    | Version12StoredHomeDayRecord
    | Version15StoredHomeDayRecord
    | Version8StoredHomeDayRecord
    | Version5StoredHomeDayRecord
    | Version3StoredHomeDayRecord
    | Version2StoredHomeDayRecord
    | LegacyStoredHomeDayRecord
): StoredHomeDayRecord {
  const existingLocations = 'locations' in day ? day.locations ?? [] : [];
  const classifiedMemories = 'classifiedMemories' in day && Array.isArray(day.classifiedMemories)
    ? day.classifiedMemories.map((memory): ClassifiedMemory => ({
        ...memory,
        qualities:
          memory.schemaVersion >= 5 && Array.isArray(memory.qualities)
            ? memory.qualities
            : deriveMemoryQualities({
                observations: memory.observations ?? [],
                confirmations: memory.confirmations ?? [],
                primaryValues: memory.photoAnalysis?.subjects.filter((subject) => subject.role === 'primary').map((subject) => subject.canonicalValue),
                supportingValues: memory.photoAnalysis?.subjects.filter((subject) => subject.role === 'supporting').map((subject) => subject.canonicalValue),
                screenContent: memory.photoAnalysis?.representation.kind === 'screen_content',
              }),
        photoAnalysis: memory.sourceType === 'photo' ? memory.photoAnalysis ?? null : null,
        promptState: {
          ...memory.promptState,
          questionCount: memory.promptState.questionCount ?? memory.promptState.answeredNodeIds?.length ?? 0,
          maxQuestions: memory.promptState.maxQuestions ?? 3,
          skippedGoalIds: memory.promptState.skippedGoalIds ?? [],
          completedGoalIds: memory.promptState.completedGoalIds ?? [],
          plannerVersion: memory.promptState.plannerVersion ?? QUESTION_PLANNER_VERSION,
          currentQuestionId: memory.promptState.currentQuestionId ?? questionIdForGraphNode(memory.promptState.graphId, memory.promptState.currentNodeId),
          askedQuestionIds: memory.promptState.askedQuestionIds ?? [],
          resolvedGoalIds: memory.promptState.resolvedGoalIds ?? [],
          microQuestionCount: memory.promptState.microQuestionCount ?? 0,
          candidateTrace: memory.promptState.candidateTrace ?? [],
        },
        // Version 5 is the minimum shape guaranteed by this migration. Do not
        // downgrade newer memories: doing so makes state normalization run the
        // full classifier recalibration again on every mutation.
        schemaVersion: Math.max(memory.schemaVersion ?? 1, 5),
      }))
    : [];
  const journalRecords = 'journalRecords' in day && Array.isArray(day.journalRecords)
    ? day.journalRecords
    : migrateLegacyJournalRecords(day as StoredHomeDayRecord);
  const normalized: StoredHomeDayRecord = {
    ...day,
    journalRecords,
    keyJournalRecordId: 'keyJournalRecordId' in day && typeof day.keyJournalRecordId === 'string' && journalRecords.some((record) => record.id === day.keyJournalRecordId)
      ? day.keyJournalRecordId
      : null,
    growth: normalizeDayGrowthState('growth' in day ? day.growth : undefined),
    stepsCount: 'stepsCount' in day && typeof day.stepsCount === 'number' ? Math.max(0, Math.round(day.stepsCount)) : 0,
    visitedPlaceCount:
      'visitedPlaceCount' in day && typeof day.visitedPlaceCount === 'number'
        ? Math.max(0, Math.round(day.visitedPlaceCount))
        : 0,
    newPlaceCount:
      'newPlaceCount' in day && typeof day.newPlaceCount === 'number' ? Math.max(0, Math.round(day.newPlaceCount)) : 0,
    locationSampleCount:
      'locationSampleCount' in day && typeof day.locationSampleCount === 'number'
        ? Math.max(0, Math.round(day.locationSampleCount))
        : existingLocations.length,
    shareReadyAt: 'shareReadyAt' in day ? day.shareReadyAt ?? null : null,
    locations: existingLocations.length > 0 ? existingLocations : createFallbackLocationsForStoredDay(day),
    healthRouteImport: 'healthRouteImport' in day ? day.healthRouteImport ?? null : null,
    exactRouteSegments: 'exactRouteSegments' in day ? day.exactRouteSegments ?? [] : [],
    promptAnswers: 'promptAnswers' in day && Array.isArray(day.promptAnswers) ? day.promptAnswers : [],
    heroPhoto: 'heroPhoto' in day ? day.heroPhoto ?? null : null,
    classifiedMemories,
    creature: day.creature
      ? withKatchimeraIdentity({
          ...day.creature,
          encounterProfileId: day.creature.encounterProfileId ?? null,
          repeatDepth: day.creature.repeatDepth ?? 0,
        })
      : null,
    card: 'card' in day ? day.card ?? null : null,
  };
  if (!normalized.creature) {
    return normalized;
  }
  const withCard: StoredHomeDayRecord = normalized.card
    ? {
        ...normalized,
        card: upgradeDailyCreatureCard(normalized.card, normalized, normalized.creature),
      }
    : {
        ...normalized,
        card: buildDailyCreatureCard(normalized, normalized.creature, {
          mode: 'legacy_backfill',
          sealedAt: normalized.shareReadyAt ?? new Date(`${normalized.isoDate}T21:00:00`).toISOString(),
        }),
      };
  return reconcileDaySkySnapshot(withCard);
}

function normalizeDayGrowthState(value: unknown): DayGrowthState {
  if (!value || typeof value !== 'object') return { schemaVersion: 1, events: [], careActions: [] };
  const candidate = value as Partial<DayGrowthState>;
  const events = Array.isArray(candidate.events)
    ? candidate.events.filter((event) => (
        event != null
        && typeof event === 'object'
        && typeof event.id === 'string'
        && typeof event.sourceId === 'string'
        && typeof event.source === 'string'
        && typeof event.amount === 'number'
        && Number.isFinite(event.amount)
        && typeof event.awardedAt === 'string'
      )).map((event) => ({ ...event, amount: Math.max(0, Math.round(event.amount)) }))
    : [];
  const careActions = Array.isArray(candidate.careActions)
    ? candidate.careActions.filter((action) => (
        action != null
        && typeof action === 'object'
        && typeof action.instanceId === 'string'
        && typeof action.definitionId === 'string'
        && ['active', 'completed', 'not_today'].includes(action.status)
        && typeof action.updatedAt === 'string'
      ))
    : [];
  return {
    schemaVersion: 1,
    events: [...new Map(events.map((event) => [event.id, event])).values()],
    careActions: [...new Map(careActions.map((action) => [action.instanceId, action])).values()],
  };
}

function migrateLegacyJournalRecords(day: StoredHomeDayRecord): JournalRecord[] {
  const records: JournalRecord[] = [];
  const linkedNoteIds = new Set<string>();
  for (const entry of day.manualJournalEntries ?? []) {
    const linked = entry.linkedNoteId ? day.notes?.find((note) => note.id === entry.linkedNoteId) : null;
    if (linked) linkedNoteIds.add(linked.id);
    const source = entry.sourceType === 'photo' && entry.sourceId
      ? { kind: 'photo' as const, sourceId: entry.sourceId }
      : { kind: 'manual' as const, sourceId: entry.sourceId ?? entry.id };
    records.push({
      id: `journal:legacy:${entry.id}`,
      schemaVersion: 1,
      idempotencyKey: entry.sourceType === 'photo' && entry.sourceId ? `photo:${entry.sourceId}` : `legacy:${entry.id}`,
      source,
      flowId: entry.flowId,
      flowVersion: entry.flowVersion,
      categoryId: entry.categoryId,
      canonicalQualityIds: entry.canonicalQualityIds,
      fields: entry.fields,
      feeling: entry.feeling ?? null,
      note: entry.note ?? null,
      attachments: linked ? [{ id: `attachment:${linked.id}`, kind: linked.kind, text: linked.text, uri: linked.audioUri, durationMs: linked.durationMs }] : [],
      confirmedFacets: [],
      createdAt: entry.createdAt,
    });
  }
  for (const note of day.notes ?? []) {
    if (linkedNoteIds.has(note.id)) continue;
    const studio = day.studioMoments?.find((item) => item.noteId === note.id);
    const food = day.foodMoments?.find((item) => item.noteId === note.id);
    const event = day.bigMoments?.find((item) => item.noteId === note.id);
    const flowId = studio ? 'studio' : food ? 'food' : event ? 'big_event' : 'general';
    const categoryId = studio ? studio.mediaType === 'other' ? 'other_media' : studio.mediaType : food ? 'meal' : event ? event.type : 'other';
    records.push({
      id: `journal:legacy:${note.id}`,
      schemaVersion: 1,
      idempotencyKey: `legacy:${note.id}`,
      source: note.kind === 'voice'
        ? { kind: 'voice_note', sourceId: note.id, audioUri: note.audioUri, durationMs: note.durationMs }
        : { kind: 'text_note', sourceId: note.id },
      flowId,
      flowVersion: 1,
      categoryId,
      canonicalQualityIds: [],
      fields: { specific: studio?.label ?? food?.label ?? event?.label ?? note.label },
      feeling: null,
      note: note.text,
      attachments: [{ id: `attachment:${note.id}`, kind: note.kind, text: note.text, uri: note.audioUri, durationMs: note.durationMs }],
      confirmedFacets: [],
      createdAt: note.createdAt,
    });
  }
  return records;
}
