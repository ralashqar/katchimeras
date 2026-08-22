import type { KatchimeraFamilyId } from '@/types/katchimera';
import type { JourneyDayActionRecord, JourneyDayRecord, KatchimeraActionCompletionRecord, KatchimeraActionSlotId, KatchimeraDayAction, KatchimeraStoryProgress, MossproutDailyActionDeck, RelationshipProgressState } from '@/types/relationship-progression';

export const MOSSPROUT_QUIET_PATCH_CHAPTER_ID = 'mossprout:chapter:quiet-patch';
export const MOSSPROUT_DRY_POND_CHAPTER_ID = 'mossprout:chapter:dry-pond';
export const MOSSPROUT_DRY_POND_BEATS = ['dry-pond:day-1', 'dry-pond:day-2', 'dry-pond:day-3', 'dry-pond:day-4'] as const;
export type MossproutDryPondBeatId = typeof MOSSPROUT_DRY_POND_BEATS[number];

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

const DRY_POND_ACTIVITY = {
  'dry-pond:day-2': {
    objectiveId: 'mossprout:objective:place-for-rain',
    mergeOrderId: 'merge-story:mossprout:dry-pond:place-for-rain',
    drops: ['nature:waterside:1', 'nature:waterside:1', 'nature:garden:1', 'nature:garden:1'],
  },
  'dry-pond:day-3': {
    objectiveId: 'mossprout:objective:bank-that-holds',
    mergeOrderId: 'merge-story:mossprout:dry-pond:bank-that-holds',
    drops: ['nature:garden:1', 'nature:garden:1', 'nature:garden:1', 'nature:garden:1', 'nature:waterside:1'],
  },
  'dry-pond:day-4': {
    objectiveId: 'mossprout:objective:little-rain-garden',
    mergeOrderId: 'merge-story:mossprout:dry-pond:little-rain-garden',
    drops: ['nature:garden:3', 'nature:waterside:2', 'nature:garden:1', 'nature:garden:1', 'nature:garden:1', 'nature:garden:1', 'nature:waterside:1', 'nature:waterside:1'],
  },
} as const;

export function emptyRelationshipProgressState(): RelationshipProgressState {
  return { schemaVersion: 2, journeyDays: [], stories: {}, acknowledgedActionOutroIds: [], skippedActionIds: [], completedActionOutros: [], mossproutDailyActionDecks: [] };
}

export function normalizeRelationshipProgressState(value: unknown): RelationshipProgressState {
  if (!value || typeof value !== 'object') return emptyRelationshipProgressState();
  const candidate = value as Partial<RelationshipProgressState>;
  const journeyDays = Array.isArray(candidate.journeyDays)
    ? candidate.journeyDays.filter(isJourneyDayRecord).map(normalizeJourneyDay)
    : [];
  const stories = candidate.stories && typeof candidate.stories === 'object'
    ? candidate.stories
    : {};
  const acknowledgedActionOutroIds = Array.isArray(candidate.acknowledgedActionOutroIds)
    ? candidate.acknowledgedActionOutroIds.filter((id): id is string => typeof id === 'string')
    : [];
  const normalizedCompletedActionOutros = Array.isArray(candidate.completedActionOutros)
    ? candidate.completedActionOutros.map(normalizeKatchimeraActionCompletionRecord).filter((record): record is KatchimeraActionCompletionRecord => Boolean(record))
    : [];
  const completedActionOutros = dedupeKatchimeraActionCompletions(
    normalizedCompletedActionOutros,
    new Set(acknowledgedActionOutroIds),
  ).slice(-80);
  const skippedActionIds = Array.isArray(candidate.skippedActionIds)
    ? candidate.skippedActionIds.filter((id): id is string => typeof id === 'string').slice(-160)
    : [];
  const mossproutDailyActionDecks = Array.isArray(candidate.mossproutDailyActionDecks)
    ? candidate.mossproutDailyActionDecks.map(normalizeMossproutDailyActionDeck).filter((deck): deck is MossproutDailyActionDeck => Boolean(deck)).slice(-14)
    : [];
  return { schemaVersion: 2, journeyDays, stories, acknowledgedActionOutroIds, skippedActionIds, completedActionOutros, mossproutDailyActionDecks };
}

export function mossproutDailyActionDeck(state: RelationshipProgressState, dayId: string): MossproutDailyActionDeck {
  const stored = state.mossproutDailyActionDecks.find((deck) => deck.dayId === dayId) ?? {
    dayId,
    slotSequences: { together: 0, field: 0, garden: 0 },
    consumedActionIds: { together: [], field: [], garden: [] },
  };
  const consumedActionIds = {
    together: [...stored.consumedActionIds.together],
    field: [...stored.consumedActionIds.field],
    garden: [...stored.consumedActionIds.garden],
  };
  for (const record of state.completedActionOutros) {
    if (record.dayId !== dayId || consumedActionIds[record.slotId].includes(record.actionId)) continue;
    consumedActionIds[record.slotId].push(record.actionId);
  }
  return { ...stored, consumedActionIds };
}

function advanceMossproutActionSlot(
  state: RelationshipProgressState,
  dayId: string,
  slotId: KatchimeraActionSlotId,
  consumedActionId: string,
) {
  const current = mossproutDailyActionDeck(state, dayId);
  const next = {
    ...current,
    slotSequences: { ...current.slotSequences, [slotId]: current.slotSequences[slotId] + 1 },
    consumedActionIds: {
      ...current.consumedActionIds,
      [slotId]: current.consumedActionIds[slotId].includes(consumedActionId)
        ? current.consumedActionIds[slotId]
        : [...current.consumedActionIds[slotId], consumedActionId],
    },
  };
  return {
    ...state,
    mossproutDailyActionDecks: [
      ...state.mossproutDailyActionDecks.filter((deck) => deck.dayId !== dayId),
      next,
    ].slice(-14),
  };
}

export function katchimeraActionOutroReceiptId(dayId: string, actionId: string) {
  return `${dayId}:${actionId}`;
}

export function skipKatchimeraDayAction(
  state: RelationshipProgressState,
  dayId: string,
  action: KatchimeraDayAction,
): RelationshipProgressState {
  if (action.required || action.disabled || action.status === 'completed') return state;
  const slotId = action.sourceSlotId ?? action.slotId ?? (action.kind === 'garden_request' ? 'garden' : action.kind === 'journal_prompt' || action.kind === 'photo_request' || action.kind === 'note_request' ? 'field' : 'together');
  const id = katchimeraActionOutroReceiptId(dayId, action.instanceId ?? action.id);
  if (state.skippedActionIds.includes(id)) return state;
  const sourceId = `${dayId}:source:${action.id}`;
  return advanceMossproutActionSlot({ ...state, skippedActionIds: [...state.skippedActionIds, id, sourceId].slice(-160) }, dayId, slotId, action.id);
}

export function acknowledgeKatchimeraExternalActionOutro(
  state: RelationshipProgressState,
  dayId: string,
  actionInstanceId: string,
): RelationshipProgressState {
  const receiptId = state.completedActionOutros.find((record) =>
    record.dayId === dayId && (record.instanceId === actionInstanceId || record.actionId === actionInstanceId)
  )?.id ?? katchimeraActionOutroReceiptId(dayId, actionInstanceId);
  if (state.acknowledgedActionOutroIds.includes(receiptId)) return state;
  return { ...state, acknowledgedActionOutroIds: [...state.acknowledgedActionOutroIds, receiptId] };
}

export function recordKatchimeraActionCompletion(
  state: RelationshipProgressState,
  input: Omit<KatchimeraActionCompletionRecord, 'id'>,
): RelationshipProgressState {
  const id = katchimeraActionOutroReceiptId(input.dayId, input.instanceId);
  // A slot's presentation instance can change after it advances or remounts.
  // Completion belongs to the logical action on this day, so never mint a
  // second reward/outro receipt merely because its presentation ID changed.
  if (state.completedActionOutros.some((record) => (
    record.dayId === input.dayId && record.actionId === input.actionId
  ))) return state;
  return advanceMossproutActionSlot({
    ...state,
    completedActionOutros: [...state.completedActionOutros, { ...input, id }].slice(-80),
  }, input.dayId, input.slotId, input.actionId);
}

export function resetRelationshipProgressForDayForDebug(
  state: RelationshipProgressState,
  dayId: string,
): RelationshipProgressState {
  const dayPrefix = `${dayId}:`;
  return {
    ...state,
    journeyDays: state.journeyDays.filter((journey) => journey.dayId !== dayId),
    acknowledgedActionOutroIds: state.acknowledgedActionOutroIds.filter((id) => !id.startsWith(dayPrefix)),
    skippedActionIds: state.skippedActionIds.filter((id) => !id.startsWith(dayPrefix)),
    completedActionOutros: state.completedActionOutros.filter((record) => record.dayId !== dayId),
    mossproutDailyActionDecks: state.mossproutDailyActionDecks.filter((deck) => deck.dayId !== dayId),
  };
}

function dedupeKatchimeraActionCompletions(
  records: readonly KatchimeraActionCompletionRecord[],
  acknowledgedIds: ReadonlySet<string>,
) {
  const recordsByLogicalAction = new Map<string, KatchimeraActionCompletionRecord>();
  for (const record of records) {
    const logicalId = `${record.dayId}:${record.actionId}`;
    const current = recordsByLogicalAction.get(logicalId);
    // Prefer the already-acknowledged legacy receipt so upgrading cannot
    // replay an outro that the player has previously seen.
    if (!current || (!acknowledgedIds.has(current.id) && acknowledgedIds.has(record.id))) {
      recordsByLogicalAction.set(logicalId, record);
    }
  }
  return [...recordsByLogicalAction.values()];
}

function normalizeKatchimeraActionCompletionRecord(value: unknown): KatchimeraActionCompletionRecord | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<KatchimeraActionCompletionRecord>;
  if (typeof record.id !== 'string'
    || typeof record.dayId !== 'string'
    || typeof record.familyId !== 'string'
    || typeof record.actionId !== 'string'
    || typeof record.kind !== 'string'
    || typeof record.title !== 'string'
    || typeof record.subtitle !== 'string'
    || typeof record.icon !== 'string'
    || !Array.isArray(record.artworkDefinitionIds)
    || !Number.isFinite(record.completedAt)) return null;
  const slotId = isKatchimeraActionSlotId(record.slotId)
    ? record.slotId
    : record.kind === 'garden_request'
      ? 'garden'
      : record.kind === 'journal_prompt' || record.kind === 'photo_request' || record.kind === 'note_request'
        ? 'field'
        : 'together';
  return {
    ...(record as KatchimeraActionCompletionRecord),
    instanceId: typeof record.instanceId === 'string' ? record.instanceId : record.actionId,
    slotId,
    sequence: Number.isInteger(record.sequence) ? record.sequence! : 0,
  };
}

function isKatchimeraActionSlotId(value: unknown): value is KatchimeraActionSlotId {
  return value === 'together' || value === 'field' || value === 'garden';
}

function normalizeMossproutDailyActionDeck(value: unknown): MossproutDailyActionDeck | null {
  if (!value || typeof value !== 'object') return null;
  const deck = value as Partial<MossproutDailyActionDeck>;
  if (!(typeof deck.dayId === 'string'
    && Boolean(deck.slotSequences)
    && Number.isInteger(deck.slotSequences?.together)
    && Number.isInteger(deck.slotSequences?.field)
    && Number.isInteger(deck.slotSequences?.garden))) return null;
  const consumed = deck.consumedActionIds;
  return {
    dayId: deck.dayId,
    slotSequences: deck.slotSequences as Record<KatchimeraActionSlotId, number>,
    consumedActionIds: {
      together: Array.isArray(consumed?.together) ? consumed.together.filter((id): id is string => typeof id === 'string') : [],
      field: Array.isArray(consumed?.field) ? consumed.field.filter((id): id is string => typeof id === 'string') : [],
      garden: Array.isArray(consumed?.garden) ? consumed.garden.filter((id): id is string => typeof id === 'string') : [],
    },
  };
}

export function mossproutStory(state: RelationshipProgressState, now = Date.now()): KatchimeraStoryProgress {
  return state.stories.mossprout ?? {
    familyId: 'mossprout',
    activeChapterId: MOSSPROUT_QUIET_PATCH_CHAPTER_ID,
    activeBeatId: 'quiet-patch:first-flower',
    completedChapterIds: [],
    completedObjectiveIds: [],
    habitatStage: 0,
    updatedAt: now,
  };
}

export function journeyForDay(state: RelationshipProgressState, dayId: string) {
  return state.journeyDays.find((journey) => journey.dayId === dayId) ?? null;
}

export function mossproutJourneyForDay(state: RelationshipProgressState, dayId: string) {
  const journey = journeyForDay(state, dayId);
  return journey?.familyId === 'mossprout' ? journey : null;
}

export function startMossproutJourneyDay(
  state: RelationshipProgressState,
  dayId: string,
  now = Date.now(),
): { state: RelationshipProgressState; journey: JourneyDayRecord | null; reason: 'started' | 'existing' | 'another_companion' | 'resting' } {
  const existing = journeyForDay(state, dayId);
  if (existing) return { state, journey: existing.familyId === 'mossprout' ? existing : null, reason: existing.familyId === 'mossprout' ? 'existing' : 'another_companion' };
  const story = mossproutStory(state, now);
  if (story.habitatStage >= 2 && story.completedChapterIds.includes(MOSSPROUT_DRY_POND_CHAPTER_ID)) {
    return { state, journey: null, reason: 'resting' };
  }
  const chapterId = story.habitatStage === 0 ? MOSSPROUT_QUIET_PATCH_CHAPTER_ID : MOSSPROUT_DRY_POND_CHAPTER_ID;
  const beatId = story.habitatStage === 0 ? 'quiet-patch:first-flower' : story.activeBeatId;
  const openingConversationId = chapterId === MOSSPROUT_DRY_POND_CHAPTER_ID
    ? `mossprout:${beatId}:opening`
    : null;
  const journey: JourneyDayRecord = {
    id: `journey-day:${dayId}:mossprout`,
    dayId,
    familyId: 'mossprout',
    status: chapterId === MOSSPROUT_QUIET_PATCH_CHAPTER_ID ? 'activity_in_progress' : 'opening',
    chapterId,
    beatId,
    openingConversationId,
    profileConversationId: null,
    matchedCardId: null,
    returnConversationId: null,
    activity: null,
    resolutionAvailableAt: null,
    signalReceiptIds: [],
    activityReceiptIds: [],
    resolutionId: null,
    actions: journeyActions(beatId),
    startedAt: now,
    completedAt: null,
    completionReceipt: null,
  };
  return { state: { ...state, journeyDays: [...state.journeyDays, journey] }, journey, reason: 'started' };
}

export function completeMossproutJourneyOpening(
  state: RelationshipProgressState,
  dayId: string,
  now = Date.now(),
): RelationshipProgressState {
  const journey = mossproutJourneyForDay(state, dayId);
  if (!journey || journey.status !== 'opening') return state;
  const activityDefinition = DRY_POND_ACTIVITY[journey.beatId as keyof typeof DRY_POND_ACTIVITY];
  const activity = activityDefinition ? {
    kind: 'merge' as const,
    objectiveId: activityDefinition.objectiveId,
    mergeOrderId: activityDefinition.mergeOrderId,
    opportunityId: `mossprout:${dayId}:${journey.beatId}:basket`,
    generatorId: 'wild-garden',
    dropDefinitionIds: [...activityDefinition.drops],
  } : null;
  const profileConversationId = journey.beatId === 'dry-pond:day-2' ? 'mossprout:game:form-finder' : null;
  return replaceJourney(state, journey.id, {
    ...journey,
    status: activity ? 'activity_available' : 'living',
    activity,
    profileConversationId,
    resolutionAvailableAt: activity ? null : lateNight(now) ? now : now + TWO_HOURS_MS,
  });
}

export function recordMossproutMatchedCard(
  state: RelationshipProgressState,
  dayId: string,
  cardId: string,
): RelationshipProgressState {
  const journey = mossproutJourneyForDay(state, dayId);
  if (!journey || journey.beatId !== 'dry-pond:day-2' || journey.matchedCardId === cardId) return state;
  return replaceJourney(state, journey.id, { ...journey, matchedCardId: cardId });
}

export function makeMossproutResolutionAvailable(
  state: RelationshipProgressState,
  dayId: string,
  input: { signalReceiptId?: string; force?: boolean } = {},
  now = Date.now(),
): RelationshipProgressState {
  const journey = mossproutJourneyForDay(state, dayId);
  if (!journey || journey.status !== 'living') return state;
  if (!input.force && !input.signalReceiptId && (journey.resolutionAvailableAt ?? Infinity) > now) return state;
  const signalReceiptIds = input.signalReceiptId
    ? unique([...journey.signalReceiptIds, input.signalReceiptId])
    : journey.signalReceiptIds;
  return replaceJourney(state, journey.id, {
    ...journey,
    status: 'resolution_ready',
    signalReceiptIds,
    returnConversationId: `mossprout:${journey.beatId}:resolution`,
  });
}

export function startMossproutJourneyActivity(state: RelationshipProgressState, dayId: string): RelationshipProgressState {
  const journey = mossproutJourneyForDay(state, dayId);
  if (!journey || journey.status !== 'activity_available' || !journey.activity) return state;
  return replaceJourney(state, journey.id, { ...journey, status: 'activity_in_progress' });
}

export function recordMossproutJourneyOrderServed(
  state: RelationshipProgressState,
  orderId: string,
  now = Date.now(),
): RelationshipProgressState {
  const journey = [...state.journeyDays].reverse().find((candidate) => (
    candidate.familyId === 'mossprout'
    && candidate.status === 'activity_in_progress'
    && candidate.activity?.mergeOrderId === orderId
  ));
  if (!journey) return state;
  return replaceJourney(state, journey.id, {
    ...journey,
    status: 'return_available',
    activityReceiptIds: unique([...journey.activityReceiptIds, `merge-order:${orderId}`]),
    returnConversationId: `mossprout:${journey.beatId}:resolution`,
    resolutionAvailableAt: now,
  });
}

export function beginMossproutJourneyReturn(state: RelationshipProgressState, dayId: string): RelationshipProgressState {
  const journey = mossproutJourneyForDay(state, dayId);
  if (!journey || journey.status !== 'return_available') return state;
  return replaceJourney(state, journey.id, { ...journey, status: 'resolution_ready' });
}

export function recordMossproutFirstGardenRestored(
  state: RelationshipProgressState,
  dayId: string,
  activityReceiptId: string,
  now = Date.now(),
): RelationshipProgressState {
  const journey = mossproutJourneyForDay(state, dayId);
  if (!journey || journey.beatId !== 'quiet-patch:first-flower' || journey.status === 'complete') return state;
  return replaceJourney(state, journey.id, {
    ...journey,
    status: 'resolution_ready',
    activityReceiptIds: unique([...journey.activityReceiptIds, activityReceiptId]),
    returnConversationId: 'mossprout:ftue:chapter-zero-return',
    resolutionAvailableAt: now,
  });
}

export function completeMossproutJourneyResolution(
  state: RelationshipProgressState,
  dayId: string,
  now = Date.now(),
): RelationshipProgressState {
  const journey = mossproutJourneyForDay(state, dayId);
  if (!journey || journey.status !== 'resolution_ready') return state;
  return completeMossproutJourneyDay(state, dayId, {
    objectiveId: journey.beatId === 'quiet-patch:first-flower' ? 'mossprout:objective:first-sprout' : journey.activity?.objectiveId,
    activityReceiptId: journey.activityReceiptIds.at(-1) ?? (journey.activity ? `merge-order:${journey.activity.mergeOrderId}` : `story:${journey.beatId}`),
    resolutionId: journey.returnConversationId ?? `mossprout:${journey.beatId}:resolution`,
  }, now);
}

export function completeMossproutJourneyConversation(
  state: RelationshipProgressState,
  definitionId: string,
  now = Date.now(),
): RelationshipProgressState {
  const journey = [...state.journeyDays].reverse().find((candidate) => (
    candidate.familyId === 'mossprout'
    && (candidate.openingConversationId === definitionId
      || candidate.profileConversationId === definitionId
      || candidate.returnConversationId === definitionId
      || candidate.actions.some((action) => action.definitionId === definitionId))
  ));
  if (!journey) return state;
  if (journey.openingConversationId === definitionId && journey.status === 'opening') {
    return completeMossproutJourneyOpening(state, journey.dayId, now);
  }
  if (journey.profileConversationId === definitionId && journey.status === 'profile_available' && journey.activity) {
    const withAction = completeJourneyAction(state, journey, definitionId, now);
    const updated = mossproutJourneyForDay(withAction, journey.dayId)!;
    return replaceJourney(withAction, journey.id, { ...updated, status: 'activity_available' });
  }
  if (journey.returnConversationId === definitionId && journey.status === 'resolution_ready') {
    return completeMossproutJourneyResolution(state, journey.dayId, now);
  }
  if (journey.actions.some((action) => action.definitionId === definitionId && action.kind !== 'journey')) {
    return completeJourneyAction(state, journey, definitionId, now);
  }
  return state;
}

export function acknowledgeMossproutJourneyActionOutro(
  state: RelationshipProgressState,
  dayId: string,
  actionId: string,
  now = Date.now(),
): RelationshipProgressState {
  const journey = mossproutJourneyForDay(state, dayId);
  if (!journey) return state;
  const action = journey.actions.find((candidate) => candidate.id === actionId);
  if (!action || action.status !== 'completed' || action.outroAcknowledgedAt) return state;
  return replaceJourney(state, journey.id, {
    ...journey,
    actions: journey.actions.map((candidate) => candidate.id === actionId
      ? { ...candidate, outroAcknowledgedAt: now }
      : candidate),
  });
}

export function completeMossproutJourneyDay(
  state: RelationshipProgressState,
  dayId: string,
  input: { objectiveId?: string; activityReceiptId: string; resolutionId: string },
  now = Date.now(),
): RelationshipProgressState {
  const target = mossproutJourneyForDay(state, dayId);
  if (!target || target.status === 'complete') return state;
  let story = mossproutStory(state, now);
  const completedObjectiveIds = input.objectiveId && !story.completedObjectiveIds.includes(input.objectiveId)
    ? [...story.completedObjectiveIds, input.objectiveId]
    : story.completedObjectiveIds;
  if (target.beatId === 'quiet-patch:first-flower') {
    story = {
      ...story,
      activeChapterId: MOSSPROUT_DRY_POND_CHAPTER_ID,
      activeBeatId: 'dry-pond:day-1',
      completedChapterIds: unique([...story.completedChapterIds, MOSSPROUT_QUIET_PATCH_CHAPTER_ID]),
      completedObjectiveIds,
      habitatStage: 1,
      updatedAt: now,
    };
  } else if (target.beatId === 'dry-pond:day-1') {
    story = { ...story, activeBeatId: 'dry-pond:day-2', completedObjectiveIds, updatedAt: now };
  } else if (target.beatId === 'dry-pond:day-2') {
    story = { ...story, activeBeatId: 'dry-pond:day-3', completedObjectiveIds, updatedAt: now };
  } else if (target.beatId === 'dry-pond:day-3') {
    story = { ...story, activeBeatId: 'dry-pond:day-4', completedObjectiveIds, updatedAt: now };
  } else if (target.beatId === 'dry-pond:day-4') {
    story = {
      ...story,
      activeBeatId: 'dry-pond:complete',
      completedChapterIds: unique([...story.completedChapterIds, MOSSPROUT_DRY_POND_CHAPTER_ID]),
      completedObjectiveIds,
      habitatStage: 2,
      updatedAt: now,
    };
  }
  return {
    ...state,
    journeyDays: state.journeyDays.map((journey) => journey.id === target.id ? {
      ...journey,
      status: 'complete',
      activityReceiptIds: unique([...journey.activityReceiptIds, input.activityReceiptId]),
      resolutionId: input.resolutionId,
      completedAt: now,
      completionReceipt: {
        id: `journey-completion:${target.id}`,
        journeyId: target.id,
        familyId: target.familyId,
        dayId: target.dayId,
        beatId: target.beatId,
        bondPoints: journeyBondPoints({ ...journey, actions: completeMainAction(journey.actions, now) }),
        completedActivity: Boolean(target.activity),
        offeredGoal: target.beatId === 'dry-pond:day-3',
        cardId: target.matchedCardId,
        completedActionIds: completeMainAction(target.actions, now).filter((action) => action.status === 'completed').map((action) => action.id),
        createdAt: now,
      },
      actions: completeMainAction(journey.actions, now),
    } : journey),
    stories: { ...state.stories, mossprout: story },
  };
}

export function havenTileStagesFromRelationships(state: RelationshipProgressState) {
  return Object.fromEntries(Object.entries(state.stories).map(([familyId, story]) => [familyId, story?.habitatStage ?? 0])) as Partial<Record<KatchimeraFamilyId, 0 | 1 | 2 | 3 | 4>>;
}

function unique(values: readonly string[]) {
  return [...new Set(values)];
}

function replaceJourney(state: RelationshipProgressState, id: string, journey: JourneyDayRecord): RelationshipProgressState {
  return { ...state, journeyDays: state.journeyDays.map((candidate) => candidate.id === id ? journey : candidate) };
}

function lateNight(now: number) {
  return new Date(now).getHours() >= 21;
}

function normalizeJourneyDay(journey: JourneyDayRecord): JourneyDayRecord {
  return {
    ...journey,
    status: (journey.status as string) === 'active' ? 'activity_in_progress' : journey.status,
    openingConversationId: typeof journey.openingConversationId === 'string' ? journey.openingConversationId : null,
    profileConversationId: typeof journey.profileConversationId === 'string' ? journey.profileConversationId : null,
    matchedCardId: typeof journey.matchedCardId === 'string' ? journey.matchedCardId : null,
    returnConversationId: typeof journey.returnConversationId === 'string' ? journey.returnConversationId : null,
    activity: journey.activity?.kind === 'merge' ? journey.activity : null,
    resolutionAvailableAt: Number.isFinite(journey.resolutionAvailableAt) ? journey.resolutionAvailableAt : null,
    completionReceipt: journey.completionReceipt ?? null,
    actions: Array.isArray(journey.actions)
      ? journey.actions.map((action) => ({ ...action, outroAcknowledgedAt: action.outroAcknowledgedAt ?? null }))
      : journeyActions(journey.beatId),
  };
}

export function journeyBondPoints(journey: Pick<JourneyDayRecord, 'actions'>) {
  return Math.min(20, journey.actions.reduce((total, action) => total + (action.status === 'completed' ? action.bondContribution : 0), 0));
}

function journeyActions(beatId: string): JourneyDayActionRecord[] {
  if (beatId === 'quiet-patch:first-flower') return [
    {
      id: 'mossprout:quiet-patch:first-flower:journey', kind: 'journey', required: true,
      definitionId: 'mossprout:ftue:chapter-zero-return', status: 'ready', bondContribution: 16, completedAt: null,
      outroAcknowledgedAt: null,
    },
    {
      id: 'mossprout:quiet-patch:first-flower:goal-plan', kind: 'goal_plan', required: false,
      definitionId: 'mossprout:quiet-patch:first-flower:goal-plan', status: 'ready', bondContribution: 4, completedAt: null,
      outroAcknowledgedAt: null,
    },
    {
      id: 'mossprout:quiet-patch:first-flower:playful', kind: 'playful_game', required: false,
      definitionId: 'mossprout:quiet-patch:first-flower:playful', status: 'ready', bondContribution: 4, completedAt: null,
      outroAcknowledgedAt: null,
    },
  ];
  const prefix = `mossprout:${beatId}`;
  return [
    { id: `${prefix}:journey`, kind: 'journey', required: true, definitionId: `${prefix}:opening`, status: 'ready', bondContribution: 12, completedAt: null, outroAcknowledgedAt: null },
    { id: `${prefix}:goal-plan`, kind: 'goal_plan', required: false, definitionId: `${prefix}:goal-plan`, status: 'ready', bondContribution: 4, completedAt: null, outroAcknowledgedAt: null },
    { id: `${prefix}:playful`, kind: 'playful_game', required: false, definitionId: beatId === 'dry-pond:day-2' ? 'mossprout:game:form-finder' : `${prefix}:playful`, status: 'ready', bondContribution: 4, completedAt: null, outroAcknowledgedAt: null },
  ];
}

function completeMainAction(actions: JourneyDayActionRecord[], now: number) {
  return actions.map((action) => action.kind === 'journey'
    ? { ...action, status: 'completed' as const, completedAt: action.completedAt ?? now, outroAcknowledgedAt: action.outroAcknowledgedAt ?? null }
    : action);
}

function completeJourneyAction(state: RelationshipProgressState, journey: JourneyDayRecord, definitionId: string, now: number) {
  if (journey.actions.some((action) => action.definitionId === definitionId && action.status === 'completed')) return state;
  const actions = journey.actions.map((action) => action.definitionId === definitionId
    ? { ...action, status: 'completed' as const, completedAt: now, outroAcknowledgedAt: null }
    : action);
  const bondPoints = journeyBondPoints({ actions });
  return replaceJourney(state, journey.id, {
    ...journey,
    actions,
    completionReceipt: journey.completionReceipt ? {
      ...journey.completionReceipt,
      bondPoints,
      completedActionIds: actions.filter((action) => action.status === 'completed').map((action) => action.id),
    } : null,
  });
}

function isJourneyDayRecord(value: unknown): value is JourneyDayRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as JourneyDayRecord;
  return typeof record.id === 'string'
    && typeof record.dayId === 'string'
    && typeof record.familyId === 'string'
    && ['opening', 'profile_available', 'living', 'activity_available', 'activity_in_progress', 'return_available', 'resolution_ready', 'complete', 'active'].includes(record.status)
    && typeof record.chapterId === 'string'
    && typeof record.beatId === 'string'
    && Array.isArray(record.signalReceiptIds)
    && Array.isArray(record.activityReceiptIds)
    && Number.isFinite(record.startedAt);
}
