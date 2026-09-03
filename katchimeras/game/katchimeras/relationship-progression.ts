import type { KatchimeraFamilyId } from '@/types/katchimera';
import type { ConversationSession } from '@/types/companion-conversation';
import type { ActionCompletionRecord, ActionPresentationRecord, JourneyDayActionRecord, JourneyDayRecord, KatchimeraActionCompletionRecord, KatchimeraActionOrigin, KatchimeraActionRewardReceipt, KatchimeraActionSlotId, KatchimeraDayAction, KatchimeraMeditationRecord, KatchimeraStoryProgress, MossproutDailyActionDeck, MossproutStoryFactKey, RelationshipProgressState } from '@/types/relationship-progression';
import { MOSSPROUT_HEARTWOOD_CHAPTER_ID, mossproutExtendedBeatById } from '@/constants/mossprout-journey-chapters';
import {
  MOSSPROUT_CAMPAIGN_EPISODES,
  MOSSPROUT_RESIDENT_BY_OPTION_ID,
  MOSSPROUT_STORY_FACT_BY_OPTION_ID,
  mossproutCampaignEpisodeByBeatId,
  mossproutCampaignOrderDrops,
  nextMossproutCampaignEpisode,
  validMossproutCoStar,
} from '@/constants/mossprout-campaign';
import { MOSSPROUT_JOURNEY_CAMPAIGN } from '@/constants/mossprout-journey-campaign';
import { nextJourneyCampaignDay } from '@/game/katchimeras/journey-campaign';
import { actionCommandFromOrigin, attachActionRewardReceipt, commitActionCompletion, dismissActionPresentation, KATCHIMERA_MEDITATION_MAX_SETTLEMENT_MS } from '@/game/katchimeras/action-runtime';

export { KATCHIMERA_MEDITATION_MAX_SETTLEMENT_MS } from '@/game/katchimeras/action-runtime';

export const MOSSPROUT_QUIET_PATCH_CHAPTER_ID = 'mossprout:chapter:quiet-patch';
export const MOSSPROUT_DRY_POND_CHAPTER_ID = 'mossprout:chapter:dry-pond';
export const MOSSPROUT_DRY_POND_BEATS = ['returning-pond:place-for-rain', 'returning-pond:bank-that-holds', 'returning-pond:rain-garden'] as const;
export type MossproutDryPondBeatId = typeof MOSSPROUT_DRY_POND_BEATS[number];

const MOSSPROUT_FTUE_ROUTINE_ACTION_PREFIX = 'mossprout:conversation:mossprout:ftue:';

/** FTUE conversations are scripted system beats, never daily action-deck entries. */
export function isMossproutFtueRoutineActionId(actionId: string) {
  return actionId.startsWith(MOSSPROUT_FTUE_ROUTINE_ACTION_PREFIX);
}

const RELATIONSHIP_REFLECTION_MS = 4 * 60 * 60 * 1000;

const DRY_POND_ACTIVITY = {
  'returning-pond:place-for-rain': {
    objectiveId: 'mossprout:objective:place-for-rain',
    mergeOrderId: 'merge-story:mossprout:dry-pond:place-for-rain',
    drops: ['nature:waterside:1', 'nature:waterside:1', 'nature:garden:1', 'nature:garden:1'],
  },
  'returning-pond:bank-that-holds': {
    objectiveId: 'mossprout:objective:bank-that-holds',
    mergeOrderId: 'merge-story:mossprout:dry-pond:bank-that-holds',
    drops: ['nature:garden:1', 'nature:garden:1', 'nature:garden:1', 'nature:garden:1', 'nature:waterside:1'],
  },
  'returning-pond:rain-garden': {
    objectiveId: 'mossprout:objective:little-rain-garden',
    mergeOrderId: 'merge-story:mossprout:dry-pond:little-rain-garden',
    drops: ['nature:garden:3', 'nature:waterside:2', 'nature:garden:1', 'nature:garden:1', 'nature:garden:1', 'nature:garden:1', 'nature:waterside:1', 'nature:waterside:1'],
  },
} as const;

export function emptyRelationshipProgressState(): RelationshipProgressState {
  return {
    schemaVersion: 7,
    journeyDays: [],
    stories: {},
    milestones: { dayOneLessonCompletedAt: null, dayOneLessonFlowRunId: null },
    skippedActionIds: [],
    actionCompletions: [],
    actionPresentations: [],
    mossproutDailyActionDecks: [],
    meditations: [],
  };
}

export function normalizeRelationshipProgressState(value: unknown): RelationshipProgressState {
  if (!value || typeof value !== 'object') return emptyRelationshipProgressState();
  const candidate = value as Partial<RelationshipProgressState>;
  // This title is unreleased. Schema 7 deliberately starts from empty rather
  // than carrying the old animation-owned completion state across the cutover.
  if (candidate.schemaVersion !== 7) return emptyRelationshipProgressState();
  const journeyDays = Array.isArray(candidate.journeyDays)
    ? candidate.journeyDays.filter(isJourneyDayRecord).map(normalizeJourneyDay)
    : [];
  const stories = normalizeStories(candidate.stories);
  const actionCompletions = Array.isArray(candidate.actionCompletions)
    ? candidate.actionCompletions.filter(isActionCompletionRecord).slice(-160)
    : [];
  const actionPresentations = Array.isArray(candidate.actionPresentations)
    ? candidate.actionPresentations.filter(isActionPresentationRecord).map((item) => item.status === 'claimed'
      ? { ...item, status: 'dismissed' as const, dismissedAt: item.dismissedAt ?? Date.now() }
      : item).filter((item) => actionCompletions.some((completion) => completion.id === item.completionId)).slice(-80)
    : [];
  const milestones = {
    dayOneLessonCompletedAt: typeof candidate.milestones?.dayOneLessonCompletedAt === 'number' ? candidate.milestones.dayOneLessonCompletedAt : null,
    dayOneLessonFlowRunId: typeof candidate.milestones?.dayOneLessonFlowRunId === 'string' ? candidate.milestones.dayOneLessonFlowRunId : null,
  };
  const skippedActionIds = Array.isArray(candidate.skippedActionIds)
    ? candidate.skippedActionIds.filter((id): id is string => typeof id === 'string').slice(-160)
    : [];
  const normalizedDecks = Array.isArray(candidate.mossproutDailyActionDecks)
    ? candidate.mossproutDailyActionDecks.map(normalizeMossproutDailyActionDeck).filter((deck): deck is MossproutDailyActionDeck => Boolean(deck)).slice(-14)
    : [];
  const meditations = Array.isArray(candidate.meditations)
    ? candidate.meditations.filter(isKatchimeraMeditationRecord).map((record) => ({
        ...record,
        settlementReceiptIds: Array.isArray(record.settlementReceiptIds)
          ? [...new Set(record.settlementReceiptIds.filter((id): id is string => typeof id === 'string'))].slice(-20)
          : [],
        settledMs: Math.max(0, Number(record.settledMs) || 0),
      })).slice(-20)
    : [];
  return { schemaVersion: 7, journeyDays, stories, milestones, skippedActionIds, actionCompletions, actionPresentations, mossproutDailyActionDecks: normalizedDecks, meditations };
}

function isKatchimeraMeditationRecord(value: unknown): value is KatchimeraMeditationRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<KatchimeraMeditationRecord>;
  return typeof record.familyId === 'string'
    && typeof record.startedAt === 'number'
    && typeof record.availableAt === 'number'
    && record.availableAt > record.startedAt
    && record.reason === 'journey_rest';
}

function isActionCompletionRecord(value: unknown): value is ActionCompletionRecord {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ActionCompletionRecord>;
  return typeof item.id === 'string' && typeof item.commandId === 'string' && typeof item.actionInstanceId === 'string'
    && typeof item.actionId === 'string' && typeof item.dayId === 'string' && typeof item.familyId === 'string'
    && typeof item.kind === 'string' && isActionOwner(item.owner)
    && (item.sourceSlotId === 'together' || item.sourceSlotId === 'field' || item.sourceSlotId === 'garden')
    && (item.slotId === 'together' || item.slotId === 'field' || item.slotId === 'garden')
    && (item.outcome === 'completed' || item.outcome === 'skipped')
    && (item.rotationEffect === 'consume' || item.rotationEffect === 'preserve')
    && typeof item.completedAt === 'number';
}

function isActionOwner(value: unknown): value is ActionCompletionRecord['owner'] {
  if (!value || typeof value !== 'object') return false;
  const owner = value as Partial<ActionCompletionRecord['owner']> & { kind?: string };
  if (owner.kind === 'daily_action') return true;
  if (owner.kind === 'journey') return typeof owner.journeyId === 'string' && typeof owner.journeyActionId === 'string';
  if (owner.kind === 'goal') return typeof owner.goalId === 'string';
  if (owner.kind === 'quest') return typeof owner.questId === 'string';
  return owner.kind === 'garden' && (typeof owner.orderId === 'string' || owner.orderId === null);
}

function isActionPresentationRecord(value: unknown): value is ActionPresentationRecord {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ActionPresentationRecord>;
  return typeof item.id === 'string' && typeof item.completionId === 'string' && typeof item.dayId === 'string'
    && (item.status === 'pending' || item.status === 'claimed' || item.status === 'dismissed')
    && (item.slotId === 'together' || item.slotId === 'field' || item.slotId === 'garden')
    && Boolean(item.card && typeof item.card.kind === 'string' && typeof item.card.title === 'string'
      && typeof item.card.subtitle === 'string' && typeof item.card.icon === 'string'
      && Array.isArray(item.card.artworkDefinitionIds));
}

function normalizeStories(value: unknown): RelationshipProgressState['stories'] {
  if (!value || typeof value !== 'object') return {};
  const stories = value as RelationshipProgressState['stories'];
  const mossprout = stories.mossprout;
  if (!mossprout) return stories;
  const completedBeatIds = Array.isArray(mossprout.completedBeatIds)
    ? mossprout.completedBeatIds.filter((id): id is string => typeof id === 'string')
    : [];
  const storyFacts = mossprout.storyFacts && typeof mossprout.storyFacts === 'object' ? mossprout.storyFacts : {};
  return {
    ...stories,
    mossprout: {
      ...mossprout,
      campaignVersion: Number.isInteger(mossprout.campaignVersion) ? mossprout.campaignVersion : 1,
      completedBeatIds,
      storyFacts,
      coStarSkinId: validMossproutCoStar(mossprout.coStarSkinId) ? mossprout.coStarSkinId : null,
    },
  };
}

/** Applies newly authored Day 1 choices to an already-loaded repository cache. */
export function reconcileMossproutDayOneChoices(state: RelationshipProgressState): RelationshipProgressState {
  let changed = false;
  const journeyDays = state.journeyDays.map((journey) => {
    if (journey.familyId !== 'mossprout' || journey.beatId !== 'quiet-patch:first-flower') return journey;
    const authoredIds = journeyActions(journey.beatId).map((action) => action.id);
    const storedIds = new Set(journey.actions.map((action) => action.id));
    if (authoredIds.every((id) => storedIds.has(id))) return journey;
    changed = true;
    return { ...journey, actions: normalizeJourneyActions(journey) };
  });
  return changed ? { ...state, journeyDays } : state;
}

export function mossproutDailyActionDeck(state: RelationshipProgressState, dayId: string): MossproutDailyActionDeck {
  const stored = state.mossproutDailyActionDecks.find((deck) => deck.dayId === dayId) ?? {
    dayId,
    slotSequences: { together: 0, field: 0, garden: 0 },
    consumedActionIds: { together: [], field: [], garden: [] },
  };
  return stored;
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

export function acknowledgeKatchimeraActionCompletion(
  state: RelationshipProgressState,
  completionId: string,
  acknowledgedAt = Date.now(),
): RelationshipProgressState {
  if (!state.actionCompletions.some((candidate) => candidate.id === completionId)) return state;
  return dismissActionPresentation(state, `presentation:${completionId}`, acknowledgedAt);
}

export function katchimeraActionCompletionEventId(source: Pick<KatchimeraActionOrigin, 'dayId' | 'instanceId'>) {
  return katchimeraActionOutroReceiptId(source.dayId, source.instanceId);
}

export function attachKatchimeraActionRewardReceipt(
  state: RelationshipProgressState,
  completionId: string,
  rewardReceipt: KatchimeraActionRewardReceipt,
): RelationshipProgressState {
  return attachActionRewardReceipt(state, completionId, rewardReceipt);
}

export function recordKatchimeraActionCompletion(
  state: RelationshipProgressState,
  input: Omit<KatchimeraActionCompletionRecord, 'id'>,
): RelationshipProgressState {
  return commitActionCompletion(state, actionCommandFromOrigin({
      dayId: input.dayId,
      familyId: input.familyId,
      actionId: input.actionId,
      instanceId: input.instanceId,
      sourceSlotId: input.slotId,
      slotId: input.slotId,
      sequence: input.sequence,
      kind: input.kind,
      title: input.title,
      subtitle: input.subtitle,
      icon: input.icon,
      ...(input.artKey ? { artKey: input.artKey } : {}),
      artworkDefinitionIds: input.artworkDefinitionIds,
      reward: input.reward,
      rotationEffect: 'consume',
      presentation: 'action_card',
    }, input.completedAt));
}

/** Records slot consumption while suppressing a second outro owned by the screen's active row. */
export function recordHandledKatchimeraActionCompletion(
  state: RelationshipProgressState,
  input: Omit<KatchimeraActionCompletionRecord, 'id'>,
): RelationshipProgressState {
  const recorded = recordKatchimeraActionCompletion(state, input);
  const completionId = katchimeraActionCompletionEventId({ dayId: input.dayId, instanceId: input.instanceId });
  return acknowledgeKatchimeraActionCompletion(recorded, completionId, input.completedAt);
}

export function resetRelationshipProgressForDayForDebug(
  state: RelationshipProgressState,
  dayId: string,
): RelationshipProgressState {
  const dayPrefix = `${dayId}:`;
  return {
    ...state,
    journeyDays: state.journeyDays.filter((journey) => journey.dayId !== dayId),
    skippedActionIds: state.skippedActionIds.filter((id) => !id.startsWith(dayPrefix)),
    actionCompletions: state.actionCompletions.filter((item) => item.dayId !== dayId),
    actionPresentations: state.actionPresentations.filter((item) => item.dayId !== dayId),
    mossproutDailyActionDecks: state.mossproutDailyActionDecks.filter((deck) => deck.dayId !== dayId),
  };
}

const STORY_FACT_KEYS_BY_BEAT: Readonly<Partial<Record<string, readonly MossproutStoryFactKey[]>>> = {
  'quiet-patch:first-flower': ['garden_promise'],
  'quiet-patch:pond-knock': ['pond_approach'],
  'returning-pond:bank-that-holds': ['pond_priority'],
  'returning-pond:rain-garden': ['welcome_style'],
  'memory-nursery:keepsake-root': ['memory_style'],
  'memory-nursery:lantern-bank': ['lantern_for'],
  'heartwood:place-that-holds': ['sanctuary_purpose'],
};

/** Rewinds only the most recently started Mossprout Journey episode. */
export function resetLastMossproutJourneyForDebug(
  state: RelationshipProgressState,
  now = Date.now(),
): RelationshipProgressState {
  const target = lastMossproutJourney(state);
  if (!target) return state;
  const targetEpisode = mossproutCampaignEpisodeByBeatId.get(target.beatId);
  const story = mossproutStory(state, now);
  const completedBeatIds = target.status === 'complete'
    ? (story.completedBeatIds ?? []).filter((beatId) => beatId !== target.beatId)
    : story.completedBeatIds ?? [];
  const completedBeatSet = new Set(completedBeatIds);
  const completedChapterIds = [...new Set(MOSSPROUT_CAMPAIGN_EPISODES
    .map((episode) => episode.chapterId)
    .filter((chapterId) => MOSSPROUT_CAMPAIGN_EPISODES
      .filter((episode) => episode.chapterId === chapterId)
      .every((episode) => completedBeatSet.has(episode.beatId))))];
  const furthestEpisode = Math.max(0, ...MOSSPROUT_CAMPAIGN_EPISODES
    .filter((episode) => completedBeatSet.has(episode.beatId))
    .map((episode) => episode.episodeNumber));
  const habitatStage = furthestEpisode >= 13 ? 4 : furthestEpisode >= 9 ? 3 : furthestEpisode >= 5 ? 2 : furthestEpisode >= 2 ? 1 : 0;
  const storyFacts = { ...(story.storyFacts ?? {}) };
  for (const key of STORY_FACT_KEYS_BY_BEAT[target.beatId] ?? []) delete storyFacts[key];
  const dayPrefix = `${target.dayId}:`;
  return {
    ...state,
    journeyDays: state.journeyDays.filter((journey) => journey.id !== target.id),
    skippedActionIds: state.skippedActionIds.filter((id) => !id.startsWith(dayPrefix)),
    actionCompletions: state.actionCompletions.filter((item) => item.dayId !== target.dayId),
    actionPresentations: state.actionPresentations.filter((item) => item.dayId !== target.dayId),
    mossproutDailyActionDecks: state.mossproutDailyActionDecks.filter((deck) => deck.dayId !== target.dayId),
    stories: {
      ...state.stories,
      mossprout: {
        ...story,
        activeChapterId: targetEpisode?.chapterId ?? target.chapterId,
        activeBeatId: target.beatId,
        completedBeatIds,
        completedChapterIds,
        completedObjectiveIds: targetEpisode?.objectiveId
          ? story.completedObjectiveIds.filter((objectiveId) => objectiveId !== targetEpisode.objectiveId)
          : story.completedObjectiveIds,
        storyFacts,
        coStarSkinId: targetEpisode?.episodeNumber === 1 ? null : story.coStarSkinId,
        habitatStage,
        updatedAt: now,
      },
    },
  };
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
    campaignVersion: MOSSPROUT_JOURNEY_CAMPAIGN.version,
    activeChapterId: MOSSPROUT_QUIET_PATCH_CHAPTER_ID,
    activeBeatId: 'quiet-patch:first-flower',
    completedChapterIds: [],
    completedObjectiveIds: [],
    completedBeatIds: [],
    storyFacts: {},
    coStarSkinId: null,
    habitatStage: 0,
    updatedAt: now,
  };
}

export function journeyForDay(state: RelationshipProgressState, dayId: string) {
  return state.journeyDays.find((journey) => journey.dayId === dayId) ?? null;
}

export function mossproutJourneyForDay(state: RelationshipProgressState, dayId: string) {
  const journey = [...state.journeyDays].reverse().find((candidate) => (
    candidate.dayId === dayId
    || candidate.dayId.startsWith(`${dayId}:mossprout-journey-`)
  )) ?? null;
  return journey?.familyId === 'mossprout' ? journey : null;
}

export const MOSSPROUT_FTUE_REST_MS = 8 * 60 * 60 * 1000;
export function beginKatchimeraMeditation(
  state: RelationshipProgressState,
  familyId: KatchimeraFamilyId,
  startedAt: number,
  durationMs: number,
  sourceId?: string,
): RelationshipProgressState {
  const existing = sourceId
    ? (state.meditations ?? []).find((item) => item.familyId === familyId && item.sourceId === sourceId)
    : null;
  if (existing) return state;
  const record: KatchimeraMeditationRecord = {
    familyId,
    startedAt,
    availableAt: startedAt + Math.max(1, durationMs),
    reason: 'journey_rest',
    settlementReceiptIds: [],
    settledMs: 0,
    ...(sourceId ? { sourceId } : {}),
  };
  return {
    ...state,
    meditations: [...(state.meditations ?? []).filter((item) => item.familyId !== familyId), record],
  };
}

export function settleKatchimeraMeditation(
  state: RelationshipProgressState,
  familyId: KatchimeraFamilyId,
  amountMs: number,
  receiptId: string,
  now = Date.now(),
): RelationshipProgressState {
  const amount = Math.max(0, Math.floor(amountMs));
  if (!amount || !receiptId) return state;
  let changed = false;
  const meditations = (state.meditations ?? []).map((record) => {
    if (record.familyId !== familyId || now >= record.availableAt || record.settlementReceiptIds?.includes(receiptId)) return record;
    const settledMs = Math.min(KATCHIMERA_MEDITATION_MAX_SETTLEMENT_MS, (record.settledMs ?? 0) + amount);
    const applied = settledMs - (record.settledMs ?? 0);
    if (applied <= 0) return record;
    changed = true;
    return {
      ...record,
      availableAt: Math.max(record.startedAt + 1, record.availableAt - applied),
      settledMs,
      settlementReceiptIds: [...(record.settlementReceiptIds ?? []), receiptId],
    };
  });
  return changed ? { ...state, meditations } : state;
}

export function companionInteractionAvailability(
  state: RelationshipProgressState,
  familyId: KatchimeraFamilyId,
  now = Date.now(),
): import('@/types/relationship-progression').CompanionInteractionAvailability {
  const meditation = activeKatchimeraMeditation(state, familyId, now);
  return meditation ? { kind: 'meditating', ...meditation } : { kind: 'available' };
}

export function katchimeraMeditationRecord(
  state: RelationshipProgressState,
  familyId: KatchimeraFamilyId,
): KatchimeraMeditationRecord | null {
  return [...(state.meditations ?? [])].reverse().find((record) => record.familyId === familyId) ?? null;
}

export function activeKatchimeraMeditation(
  state: RelationshipProgressState,
  familyId: KatchimeraFamilyId,
  now = Date.now(),
): KatchimeraMeditationRecord | null {
  const record = katchimeraMeditationRecord(state, familyId);
  return record && now < record.availableAt ? record : null;
}

export function lastMossproutJourney(state: RelationshipProgressState): JourneyDayRecord | null {
  return [...state.journeyDays]
    .filter((journey) => journey.familyId === 'mossprout')
    .sort((left, right) => right.startedAt - left.startedAt)[0] ?? null;
}

/** Gives quick mode a fresh logical day while normal play stays calendar-bound. */
export function mossproutJourneyRuntimeDayId(state: RelationshipProgressState, calendarDayId: string, quickMode = false): string {
  if (!quickMode) return calendarDayId;
  const active = [...state.journeyDays].reverse().find((journey) => journey.familyId === 'mossprout' && journey.status !== 'complete');
  if (active) return active.dayId;
  const nextDay = nextJourneyCampaignDay(MOSSPROUT_JOURNEY_CAMPAIGN, mossproutStory(state).completedBeatIds ?? []);
  return nextDay ? `${calendarDayId}:mossprout-journey-${String(nextDay.number).padStart(2, '0')}` : calendarDayId;
}

export function mossproutFirstResidentCardId(state: RelationshipProgressState): string | null {
  return mossproutStory(state).coStarSkinId ?? state.journeyDays.find((journey) => (
    journey.familyId === 'mossprout'
    && typeof journey.matchedCardId === 'string'
  ))?.matchedCardId ?? null;
}

export function startMossproutJourneyDay(
  state: RelationshipProgressState,
  dayId: string,
  now = Date.now(),
  activeDayCount = 0,
  allowEarlyStart = false,
): { state: RelationshipProgressState; journey: JourneyDayRecord | null; reason: 'started' | 'existing' | 'another_companion' | 'resting' } {
  const existing = mossproutJourneyForDay(state, dayId) ?? journeyForDay(state, dayId);
  const firstBloomMeditation = katchimeraMeditationRecord(state, 'mossprout');
  const firstBloomRestComplete = existing?.familyId === 'mossprout'
    && existing.beatId === 'quiet-patch:first-flower'
    && existing.status === 'complete'
    && existing.completedAt != null
    && now >= (firstBloomMeditation?.availableAt ?? existing.completedAt + MOSSPROUT_FTUE_REST_MS);
  if (existing && !firstBloomRestComplete) return { state, journey: existing.familyId === 'mossprout' ? existing : null, reason: existing.familyId === 'mossprout' ? 'existing' : 'another_companion' };
  const story = mossproutStory(state, now);
  // Completion records are the durable source of truth. Include them when an
  // older or partially-written story summary has not caught up yet.
  const completedBeatIds = unique([
    ...(story.completedBeatIds ?? []),
    ...state.journeyDays.filter((journey) => journey.familyId === 'mossprout' && journey.status === 'complete').map((journey) => journey.beatId),
  ]);
  const campaignDay = nextJourneyCampaignDay(MOSSPROUT_JOURNEY_CAMPAIGN, completedBeatIds);
  const nextEpisode = campaignDay ? mossproutCampaignEpisodeByBeatId.get(campaignDay.id) ?? null : null;
  // activeDayCount counts days already played; this starts the day about to begin.
  if (!campaignDay || !nextEpisode || (!allowEarlyStart && activeDayCount + 1 < campaignDay.unlockActiveDay)) {
    return { state, journey: null, reason: 'resting' };
  }
  const chapterId = nextEpisode.chapterId;
  const beatId = nextEpisode.beatId;
  const openingConversationId = nextEpisode.openingConversationId;
  const journeyDayId = firstBloomRestComplete ? `${dayId}:mossprout-journey-${String(campaignDay.number).padStart(2, '0')}` : dayId;
  const journey: JourneyDayRecord = {
    id: `journey-day:${journeyDayId}:mossprout`,
    dayId: journeyDayId,
    familyId: 'mossprout',
    status: 'opening',
    chapterId,
    beatId,
    openingConversationId,
    profileConversationId: null,
    matchedCardId: story.coStarSkinId ?? null,
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
  const episodeDefinition = mossproutCampaignEpisodeByBeatId.get(journey.beatId);
  const activityDefinition = DRY_POND_ACTIVITY[journey.beatId as keyof typeof DRY_POND_ACTIVITY];
  const extendedDefinition = mossproutExtendedBeatById.get(journey.beatId);
  const activity = episodeDefinition?.completionMode === 'merge' && episodeDefinition.mergeOrderId && episodeDefinition.objectiveId ? {
    kind: 'merge' as const,
    objectiveId: episodeDefinition.objectiveId,
    mergeOrderId: episodeDefinition.mergeOrderId,
    mergeOrderIds: episodeDefinition.mergeOrders.map((order) => order.id),
    servedOrderIds: [],
    opportunityId: `mossprout:${dayId}:${journey.beatId}:campaign`,
    generatorId: 'wild-garden',
    dropDefinitionIds: mossproutCampaignOrderDrops(episodeDefinition),
  } : activityDefinition ? {
    kind: 'merge' as const,
    objectiveId: activityDefinition.objectiveId,
    mergeOrderId: activityDefinition.mergeOrderId,
    opportunityId: `mossprout:${dayId}:${journey.beatId}:basket`,
    generatorId: 'wild-garden',
    dropDefinitionIds: [...activityDefinition.drops],
  } : extendedDefinition ? {
    kind: 'merge' as const,
    objectiveId: extendedDefinition.objectiveId,
    mergeOrderId: extendedDefinition.mergeOrderId,
    opportunityId: `mossprout:${dayId}:${journey.beatId}:open-play`,
    generatorId: 'wild-garden',
    dropDefinitionIds: [],
  } : null;
  if (episodeDefinition?.completionMode === 'story') {
    return completeMossproutJourneyDay(state, dayId, {
      activityReceiptId: `story:${journey.beatId}`,
      resolutionId: journey.openingConversationId ?? episodeDefinition.openingConversationId,
    }, now);
  }
  if (episodeDefinition && episodeDefinition.episodeNumber >= 3 && episodeDefinition.episodeNumber <= 9) {
    return replaceJourney(state, journey.id, {
      ...journey,
      status: 'resident_discovery',
      activity: null,
      profileConversationId: null,
      resolutionAvailableAt: null,
    });
  }
  const profileConversationId = null;
  return replaceJourney(state, journey.id, {
    ...journey,
    status: activity ? 'activity_available' : 'living',
    activity,
    profileConversationId,
    resolutionAvailableAt: activity ? null : lateNight(now) ? now : now + RELATIONSHIP_REFLECTION_MS,
  });
}

export function recordMossproutMatchedCard(
  state: RelationshipProgressState,
  dayId: string,
  cardId: string,
): RelationshipProgressState {
  const journey = mossproutJourneyForDay(state, dayId);
  if (!journey || !validMossproutCoStar(cardId) || journey.matchedCardId === cardId) return state;
  const next = replaceJourney(state, journey.id, {
    ...journey,
    matchedCardId: cardId,
    status: journey.status === 'profile_available' ? 'resident_discovery' : journey.status,
    activity: journey.status === 'profile_available' ? null : journey.activity,
  });
  const story = mossproutStory(next);
  return { ...next, stories: { ...next.stories, mossprout: { ...story, coStarSkinId: cardId, updatedAt: Date.now() } } };
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
    returnConversationId: mossproutCampaignEpisodeByBeatId.get(journey.beatId)?.resolutionConversationId
      ?? `mossprout:${journey.beatId}:resolution`,
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
    && (candidate.activity?.mergeOrderIds ?? (candidate.activity ? [candidate.activity.mergeOrderId] : [])).includes(orderId)
  ));
  if (!journey) return state;
  const orderIds = journey.activity?.mergeOrderIds ?? (journey.activity ? [journey.activity.mergeOrderId] : []);
  const servedOrderIds = unique([...(journey.activity?.servedOrderIds ?? []), orderId]);
  const finished = orderIds.every((candidate) => servedOrderIds.includes(candidate));
  return replaceJourney(state, journey.id, {
    ...journey,
    status: finished ? 'return_available' : 'activity_in_progress',
    activity: journey.activity ? { ...journey.activity, servedOrderIds } : null,
    activityReceiptIds: unique([...journey.activityReceiptIds, `merge-order:${orderId}`]),
    returnConversationId: finished
      ? mossproutCampaignEpisodeByBeatId.get(journey.beatId)?.resolutionConversationId ?? `mossprout:${journey.beatId}:resolution`
      : journey.returnConversationId,
    resolutionAvailableAt: finished ? now : journey.resolutionAvailableAt,
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
  if (journey.beatId === 'quiet-patch:first-flower') {
    return completeMossproutJourneyDay(state, dayId, {
      objectiveId: 'mossprout:objective:first-sprout',
      activityReceiptId: journey.activityReceiptIds.at(-1) ?? 'merge-order:mossprout:chapter-0:first-sprout',
      resolutionId: journey.returnConversationId ?? 'mossprout:ftue:chapter-zero-return',
    }, now);
  }
  return completeMossproutJourneyDay(state, dayId, {
    objectiveId: journey.beatId === 'quiet-patch:first-flower' ? 'mossprout:objective:first-sprout' : journey.activity?.objectiveId,
    activityReceiptId: journey.activityReceiptIds.at(-1) ?? (journey.activity ? `merge-order:${journey.activity.mergeOrderId}` : `story:${journey.beatId}`),
    resolutionId: journey.returnConversationId
      ?? mossproutCampaignEpisodeByBeatId.get(journey.beatId)?.resolutionConversationId
      ?? `mossprout:${journey.beatId}:resolution`,
  }, now);
}

export function completeMossproutJourneyConversation(
  state: RelationshipProgressState,
  input: string | Pick<ConversationSession, 'definitionId' | 'turns' | 'formResult' | 'preview'>,
  now = Date.now(),
): RelationshipProgressState {
  const definitionId = typeof input === 'string' ? input : input.definitionId;
  const withFacts = typeof input === 'string' || input.preview
    ? state
    : recordMossproutCampaignSession(state, input, now);
  const journey = [...state.journeyDays].reverse().find((candidate) => (
    candidate.familyId === 'mossprout'
    && (candidate.openingConversationId === definitionId
      || candidate.profileConversationId === definitionId
      || candidate.returnConversationId === definitionId
      || candidate.actions.some((action) => action.definitionId === definitionId))
  ));
  if (!journey) return withFacts;
  if (journey.openingConversationId === definitionId && journey.status === 'opening') {
    return completeMossproutJourneyOpening(withFacts, journey.dayId, now);
  }
  if (journey.profileConversationId === definitionId && journey.status === 'profile_available') {
    const withAction = completeJourneyAction(withFacts, journey, definitionId, now);
    const updated = mossproutJourneyForDay(withAction, journey.dayId)!;
    const matchedCardId = typeof input === 'string' ? updated.matchedCardId : input.formResult?.topFormId ?? updated.matchedCardId;
    return replaceJourney(withAction, journey.id, { ...updated, status: 'resident_discovery', matchedCardId, activity: null });
  }
  if (journey.returnConversationId === definitionId && journey.status === 'resolution_ready') {
    return completeMossproutJourneyResolution(withFacts, journey.dayId, now);
  }
  if (journey.actions.some((action) => action.definitionId === definitionId && action.kind !== 'journey')) {
    return completeJourneyAction(withFacts, journey, definitionId, now);
  }
  return withFacts;
}

function recordMossproutCampaignSession(
  state: RelationshipProgressState,
  session: Pick<ConversationSession, 'turns' | 'formResult'>,
  now: number,
) {
  let story = mossproutStory(state, now);
  let changed = false;
  const storyFacts = { ...(story.storyFacts ?? {}) };
  for (const turn of session.turns) {
    const resident = MOSSPROUT_RESIDENT_BY_OPTION_ID[turn.optionId];
    if (resident && story.coStarSkinId !== resident) {
      story = { ...story, coStarSkinId: resident };
      changed = true;
    }
    const effect = MOSSPROUT_STORY_FACT_BY_OPTION_ID[turn.optionId];
    if (!effect || storyFacts[effect.key] === effect.value) continue;
    storyFacts[effect.key] = effect.value;
    changed = true;
  }
  const matched = session.formResult?.topFormId;
  if (validMossproutCoStar(matched) && story.coStarSkinId !== matched) {
    story = { ...story, coStarSkinId: matched };
    changed = true;
  }
  if (!changed) return state;
  return {
    ...state,
    stories: { ...state.stories, mossprout: { ...story, storyFacts, updatedAt: now } },
  };
}

export function completeMossproutJourneyGoalPlan(
  state: RelationshipProgressState,
  dayId: string,
  now = Date.now(),
): RelationshipProgressState {
  const journey = mossproutJourneyForDay(state, dayId);
  const action = journey?.actions.find((candidate) => candidate.kind === 'goal_plan' && (candidate.status === 'ready' || candidate.status === 'active'));
  if (!journey || !action?.definitionId) return state;
  return completeJourneyAction(state, journey, action.definitionId, now);
}

/**
 * Canonical Focus-questionnaire completion. The goal and its Action Board
 * presentation are committed together, so no questionnaire route can make a
 * card disappear without producing its durable reward/outro record.
 */
export function completeMossproutFocusAction(
  state: RelationshipProgressState,
  dayId: string,
  actionOrigin: KatchimeraActionOrigin,
  now = Date.now(),
): RelationshipProgressState {
  const progressed = completeMossproutJourneyGoalPlan(state, dayId, now);
  return commitActionCompletion(progressed, actionCommandFromOrigin(actionOrigin, now));
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
  const currentEpisode = mossproutCampaignEpisodeByBeatId.get(target.beatId);
  const completedBeatIds = unique([...(story.completedBeatIds ?? []), target.beatId]);
  const nextEpisode = nextMossproutCampaignEpisode(completedBeatIds);
  const completesChapter = Boolean(currentEpisode && (!nextEpisode || nextEpisode.chapterId !== currentEpisode.chapterId));
  const completedChapterIds = completesChapter && currentEpisode
    ? unique([...story.completedChapterIds, currentEpisode.chapterId])
    : story.completedChapterIds;
  const habitatStage = currentEpisode?.episodeNumber === 13 ? 4
    : currentEpisode?.episodeNumber === 9 ? 3
      : currentEpisode?.episodeNumber === 5 ? 2
        : currentEpisode?.episodeNumber === 2 ? 1
          : story.habitatStage;
  story = {
    ...story,
    campaignVersion: MOSSPROUT_JOURNEY_CAMPAIGN.version,
    activeChapterId: nextEpisode?.chapterId ?? MOSSPROUT_HEARTWOOD_CHAPTER_ID,
    activeBeatId: nextEpisode?.beatId ?? 'heartwood:complete',
    completedBeatIds,
    completedChapterIds,
    completedObjectiveIds,
    habitatStage,
    updatedAt: now,
  };
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
        offeredGoal: currentEpisode?.optionalAction === 'goal',
        cardId: target.matchedCardId,
        completedActionIds: completeMainAction(target.actions, now).filter((action) => action.status === 'completed').map((action) => action.id),
        createdAt: now,
      },
      actions: completeMainAction(journey.actions, now),
    } : journey),
    stories: { ...state.stories, mossprout: story },
  };
}

export function completeMossproutResidentCardDiscovery(
  state: RelationshipProgressState,
  journeyDayId: string,
  residentId: string,
  discoveryId: string,
  now = Date.now(),
): RelationshipProgressState {
  const journey = mossproutJourneyForDay(state, journeyDayId);
  if (!journey || journey.status === 'complete' || !validMossproutCoStar(residentId)) return state;
  const matched = recordMossproutMatchedCard(state, journeyDayId, residentId);
  return completeMossproutJourneyDay(matched, journeyDayId, {
    objectiveId: journey.activity?.objectiveId,
    activityReceiptId: `resident-card:${discoveryId}`,
    resolutionId: `resident-card-reveal:${discoveryId}`,
  }, now);
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
  const episodeDefinition = mossproutCampaignEpisodeByBeatId.get(journey.beatId);
  const authoredOrderIds = episodeDefinition?.mergeOrders.map((order) => order.id) ?? [];
  const storedActivity = journey.activity?.kind === 'merge' ? journey.activity : null;
  const servedFromReceipts = journey.activityReceiptIds
    .filter((receiptId) => receiptId.startsWith('merge-order:'))
    .map((receiptId) => receiptId.slice('merge-order:'.length))
    .filter((orderId) => authoredOrderIds.includes(orderId));
  const activity = storedActivity && journey.status !== 'complete' && authoredOrderIds.length
    ? {
        ...storedActivity,
        objectiveId: episodeDefinition?.objectiveId ?? storedActivity.objectiveId,
        mergeOrderId: authoredOrderIds[0]!,
        mergeOrderIds: authoredOrderIds,
        servedOrderIds: unique([...(storedActivity.servedOrderIds ?? []), ...servedFromReceipts]).filter((orderId) => authoredOrderIds.includes(orderId)),
        dropDefinitionIds: episodeDefinition ? mossproutCampaignOrderDrops(episodeDefinition) : storedActivity.dropDefinitionIds,
      }
    : storedActivity;
  return {
    ...journey,
    status: (journey.status as string) === 'active' ? 'activity_in_progress' : journey.status,
    openingConversationId: typeof journey.openingConversationId === 'string' ? journey.openingConversationId : null,
    profileConversationId: typeof journey.profileConversationId === 'string' ? journey.profileConversationId : null,
    matchedCardId: typeof journey.matchedCardId === 'string' ? journey.matchedCardId : null,
    returnConversationId: typeof journey.returnConversationId === 'string' ? journey.returnConversationId : null,
    activity,
    resolutionAvailableAt: Number.isFinite(journey.resolutionAvailableAt) ? journey.resolutionAvailableAt : null,
    completionReceipt: journey.completionReceipt ?? null,
    actions: normalizeJourneyActions(journey),
  };
}

/**
 * Day 1's optional choice set was expanded after some FTUE journeys had
 * already been persisted. Reconcile that one authored set by stable action ID
 * so an in-progress save gains the missing choices without losing lifecycle
 * state from choices it already knows about.
 */
function normalizeJourneyActions(journey: JourneyDayRecord): JourneyDayActionRecord[] {
  const stored = Array.isArray(journey.actions)
    ? journey.actions.map((action) => ({ ...action, outroAcknowledgedAt: action.outroAcknowledgedAt ?? null }))
    : [];
  if (journey.beatId !== 'quiet-patch:first-flower') {
    return stored.length ? stored : journeyActions(journey.beatId);
  }

  const authored = journeyActions(journey.beatId);
  const storedById = new Map(stored.map((action) => [action.id, action]));
  const completedChoice = stored.find((action) => action.kind !== 'journey' && action.status === 'completed');
  const choiceClosedAt = completedChoice?.completedAt ?? journey.completedAt;
  const authoredIds = new Set(authored.map((action) => action.id));
  const reconciled = authored.map((action): JourneyDayActionRecord => {
    const existing = storedById.get(action.id);
    if (existing) return {
      ...action,
      status: existing.status,
      completedAt: existing.completedAt ?? null,
      outroAcknowledgedAt: existing.outroAcknowledgedAt ?? null,
    };
    if (action.kind === 'journey' && journey.status === 'complete') return {
      ...action,
      status: 'completed',
      completedAt: journey.completedAt,
      outroAcknowledgedAt: journey.completedAt,
    };
    if (action.kind !== 'journey' && completedChoice) return {
      ...action,
      status: 'skipped',
      completedAt: null,
      outroAcknowledgedAt: choiceClosedAt,
    };
    return action;
  });

  // Preserve any historical action that is no longer in the authored set.
  return [...reconciled, ...stored.filter((action) => !authoredIds.has(action.id))];
}

export function journeyBondPoints(journey: Pick<JourneyDayRecord, 'actions'>) {
  // Each Journey action renders its own Bond amount. The aggregate receipt must
  // equal those visible contributions so every completed card creates a delta
  // receipt and a reward flight.
  return journey.actions.reduce(
    (total, action) => total + (action.status === 'completed' ? action.bondContribution : 0),
    0,
  );
}

function journeyActions(beatId: string): JourneyDayActionRecord[] {
  if (beatId === 'quiet-patch:first-flower') return [
    {
      id: 'mossprout:quiet-patch:first-flower:journey', kind: 'journey', required: true,
      definitionId: 'mossprout:ftue:chapter-zero-return', status: 'ready', bondContribution: 0, completedAt: null,
      outroAcknowledgedAt: null,
    },
    {
      id: 'mossprout:quiet-patch:first-flower:goal-plan', kind: 'goal_plan', required: false,
      definitionId: 'mossprout:quiet-patch:first-flower:goal-plan', status: 'ready', bondContribution: 20, completedAt: null,
      outroAcknowledgedAt: null,
    },
    {
      id: 'mossprout:quiet-patch:first-flower:playful', kind: 'playful_game', required: false,
      definitionId: 'mossprout:quiet-patch:first-flower:playful', status: 'ready', bondContribution: 20, completedAt: null,
      outroAcknowledgedAt: null,
    },
    {
      id: 'mossprout:quiet-patch:first-flower:field-note', kind: 'journal_prompt', required: false,
      definitionId: 'mossprout:conversation:nature-journal:one-growing-thing', status: 'ready', bondContribution: 20, completedAt: null,
      outroAcknowledgedAt: null,
    },
  ];
  const episodeDefinition = mossproutCampaignEpisodeByBeatId.get(beatId);
  if (!episodeDefinition) return [];
  const prefix = `mossprout:campaign-v2:${beatId}`;
  const actions: JourneyDayActionRecord[] = [{
    id: `${prefix}:journey`, kind: 'journey', required: true,
    definitionId: episodeDefinition.openingConversationId, status: 'ready', bondContribution: 12,
    completedAt: null, outroAcknowledgedAt: null,
  }];
  if (episodeDefinition.optionalAction === 'goal') actions.push({
    id: `${prefix}:goal-plan`, kind: 'goal_plan', required: false, definitionId: `${prefix}:goal-plan`,
    status: 'ready', bondContribution: 4, completedAt: null, outroAcknowledgedAt: null,
  });
  if (episodeDefinition.optionalAction === 'playful') actions.push({
    id: `${prefix}:playful`, kind: 'playful_game', required: false, definitionId: `${prefix}:playful`,
    status: 'ready', bondContribution: 4, completedAt: null, outroAcknowledgedAt: null,
  });
  if (episodeDefinition.optionalAction === 'reflection') actions.push({
    id: `${prefix}:field-note`, kind: 'journal_prompt', required: false,
    definitionId: 'mossprout:conversation:nature-journal:one-growing-thing',
    status: 'ready', bondContribution: 4, completedAt: null, outroAcknowledgedAt: null,
  });
  return actions;
}

function completeMainAction(actions: JourneyDayActionRecord[], now: number) {
  return actions.map((action) => action.kind === 'journey'
    ? { ...action, status: 'completed' as const, completedAt: action.completedAt ?? now, outroAcknowledgedAt: action.outroAcknowledgedAt ?? null }
    : action);
}

function completeJourneyAction(state: RelationshipProgressState, journey: JourneyDayRecord, definitionId: string, now: number) {
  if (journey.actions.some((action) => action.definitionId === definitionId && action.status === 'completed')) return state;
  const selectedAction = journey.actions.find((action) => action.definitionId === definitionId);
  if (!selectedAction || selectedAction.status === 'skipped') return state;
  const chooseOneDay = journey.beatId === 'quiet-patch:first-flower' && selectedAction.kind !== 'journey';
  const actions = journey.actions.map((action) => {
    if (action.definitionId === definitionId) {
      return { ...action, status: 'completed' as const, completedAt: now, outroAcknowledgedAt: null };
    }
    if (chooseOneDay && action.kind !== 'journey' && action.status !== 'completed') {
      return { ...action, status: 'skipped' as const, completedAt: null, outroAcknowledgedAt: now };
    }
    return action;
  });
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
    && ['opening', 'profile_available', 'living', 'activity_available', 'activity_in_progress', 'return_available', 'resolution_ready', 'resident_discovery', 'resident_orders', 'card_reward', 'complete', 'active'].includes(record.status)
    && typeof record.chapterId === 'string'
    && typeof record.beatId === 'string'
    && Array.isArray(record.signalReceiptIds)
    && Array.isArray(record.activityReceiptIds)
    && Number.isFinite(record.startedAt);
}
