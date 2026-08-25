import type { KatchimeraFamilyId, KatchimeraSkinId } from '@/types/katchimera';

export type JourneyDayStatus =
  | 'opening'
  | 'profile_available'
  | 'living'
  | 'activity_available'
  | 'activity_in_progress'
  | 'return_available'
  | 'resolution_ready'
  | 'complete';

export type JourneyActivity = {
  kind: 'merge';
  objectiveId: string;
  /** First authored order, retained for save compatibility and deep links. */
  mergeOrderId: string;
  /** Complete authored sequence. Older saves safely fall back to mergeOrderId. */
  mergeOrderIds?: string[];
  servedOrderIds?: string[];
  opportunityId: string;
  generatorId: string;
  dropDefinitionIds: string[];
};

export type JourneyDayActionKind = 'journey' | 'goal_plan' | 'playful_game' | 'journal_prompt';
export type JourneyDayActionStatus = 'ready' | 'active' | 'completed' | 'skipped';

export type JourneyDayActionRecord = {
  id: string;
  kind: JourneyDayActionKind;
  required: boolean;
  definitionId: string | null;
  status: JourneyDayActionStatus;
  bondContribution: number;
  completedAt: number | null;
  outroAcknowledgedAt: number | null;
};

export type KatchimeraDayActionKind =
  | 'story_chat'
  | 'goal_plan'
  | 'fun_chat'
  | 'insight_chat'
  | 'journal_prompt'
  | 'quest'
  | 'photo_request'
  | 'note_request'
  | 'goal_checkoff'
  | 'garden_request';

export type KatchimeraActionArtKey =
  | 'today:movement'
  | 'today:photo'
  | 'today:place'
  | 'today:quest'
  | 'today:reflection'
  | 'mossprout:cloud-job'
  | 'mossprout:garden-guest'
  | 'mossprout:garden-rules'
  | 'mossprout:journey'
  | 'mossprout:nature-card'
  | 'mossprout:nature-insight'
  | 'mossprout:nature-light'
  | 'mossprout:nature-observation'
  | 'mossprout:nature-sound-map'
  | 'mossprout:nature-weather'
  | 'mossprout:nature-window'
  | 'mossprout:outdoor-luxury'
  | 'mossprout:plant-care'
  | 'mossprout:suspicious-path'
  | 'mossprout:tree-neighbour';

export type KatchimeraActionSlotId = 'together' | 'field' | 'garden';

export type MossproutDailyActionDeck = {
  dayId: string;
  slotSequences: Record<KatchimeraActionSlotId, number>;
  consumedActionIds: Record<KatchimeraActionSlotId, string[]>;
};

export type KatchimeraDayActionReward = {
  amount: number;
  kind: 'bond' | 'coins';
};

export type KatchimeraDayActionDestination =
  | { kind: 'journey' }
  | { kind: 'focus_questionnaire' }
  | { kind: 'conversation'; definitionId: string }
  | { kind: 'quest'; questId: string }
  | { kind: 'goal'; goalId: string }
  | { kind: 'garden'; orderId: string | null };

export type KatchimeraDayAction = {
  id: string;
  instanceId?: string;
  /** Logical queue lane; may differ when an empty presentation slot is borrowed. */
  sourceSlotId?: KatchimeraActionSlotId;
  slotId?: KatchimeraActionSlotId;
  sequence?: number;
  kind: KatchimeraDayActionKind;
  title: string;
  subtitle: string | null;
  icon: import('@/components/ui/icon-symbol').IconSymbolName;
  artKey?: KatchimeraActionArtKey;
  artworkDefinitionId?: string | null;
  artworkDefinitionIds?: string[];
  progressLabel?: string | null;
  required: boolean;
  disabled: boolean;
  status: 'ready' | 'active' | 'completed';
  reward: KatchimeraDayActionReward | null;
  destination: KatchimeraDayActionDestination;
  completedAt: number | null;
  outroAcknowledgedAt: number | null;
  /** Present only while replaying a durable completion ledger event. */
  completionEventId?: string;
  rewardReceipt?: KatchimeraActionRewardReceipt | null;
};

export type KatchimeraActionOrigin = {
  dayId: string;
  familyId: KatchimeraFamilyId;
  actionId: string;
  instanceId: string;
  /** Logical queue lane that owns rotation/consumption. */
  sourceSlotId: KatchimeraActionSlotId;
  /** Visible lane used for the row. It may be borrowed from another queue. */
  slotId: KatchimeraActionSlotId;
  sequence: number;
  kind: KatchimeraDayActionKind;
  title: string;
  subtitle: string;
  icon: import('@/components/ui/icon-symbol').IconSymbolName;
  artKey?: KatchimeraActionArtKey;
  artworkDefinitionIds: string[];
  reward: KatchimeraDayActionReward | null;
  journeyId?: string;
  journeyActionId?: string;
  presentation: 'action_card' | 'none';
};

export type KatchimeraActionRewardReceipt = {
  id: string;
  eventId: string;
  creatureId: string;
  kind:
    | 'hatch'
    | 'ideal_skin_questionnaire_completed'
    | 'goal_created'
    | 'goal_completed'
    | 'real_life_quest_completed'
    | 'mini_game_completed'
    | 'quick_goal_completed'
    | 'discovery_answered'
    | 'quest_completed'
    | 'reflection_saved'
    | 'check_in_completed'
    | 'insight_saved'
    | 'insight_engaged'
    | 'conversation_completed'
    | 'journey_day_completed'
    | 'merge_order_completed';
  points: number;
  occurredAt: number;
  beforeTotal: number;
  afterTotal: number;
  beforeLevel: 1 | 2 | 3 | 4;
  afterLevel: 1 | 2 | 3 | 4;
};

/**
 * Durable presentation ledger entry. Domain completion and its reward are
 * committed once; the home screen only acknowledges this event after the
 * reward flight and row outro have both finished.
 */
export type KatchimeraActionCompletionEvent = {
  id: string;
  source: KatchimeraActionOrigin;
  completedAt: number;
  rewardEventId: string | null;
  rewardReceipt: KatchimeraActionRewardReceipt | null;
  acknowledgedAt: number | null;
};

/** @deprecated Save-migration input only. */
export type KatchimeraActionCompletionRecord = Omit<KatchimeraActionOrigin, 'sourceSlotId' | 'presentation'> & {
  id: string;
  completedAt: number;
};

export type JourneyDayRecord = {
  id: string;
  dayId: string;
  familyId: KatchimeraFamilyId;
  status: JourneyDayStatus;
  chapterId: string;
  beatId: string;
  openingConversationId: string | null;
  profileConversationId: string | null;
  matchedCardId: string | null;
  returnConversationId: string | null;
  activity: JourneyActivity | null;
  resolutionAvailableAt: number | null;
  signalReceiptIds: string[];
  activityReceiptIds: string[];
  resolutionId: string | null;
  actions: JourneyDayActionRecord[];
  startedAt: number;
  completedAt: number | null;
  completionReceipt: JourneyDayCompletionReceipt | null;
};

export type JourneyDayCompletionReceipt = {
  id: string;
  journeyId: string;
  familyId: KatchimeraFamilyId;
  dayId: string;
  beatId: string;
  bondPoints: number;
  completedActivity: boolean;
  offeredGoal: boolean;
  cardId: string | null;
  completedActionIds: string[];
  createdAt: number;
};

export type KatchimeraStoryProgress = {
  familyId: KatchimeraFamilyId;
  campaignVersion?: number;
  activeChapterId: string;
  activeBeatId: string;
  completedChapterIds: string[];
  completedObjectiveIds: string[];
  completedBeatIds?: string[];
  storyFacts?: MossproutStoryFacts;
  coStarSkinId?: KatchimeraSkinId | null;
  habitatStage: 0 | 1 | 2 | 3 | 4;
  updatedAt: number;
};

export type MossproutStoryFactKey =
  | 'garden_promise'
  | 'pond_approach'
  | 'pond_priority'
  | 'welcome_style'
  | 'memory_style'
  | 'lantern_for'
  | 'sanctuary_purpose';

export type MossproutStoryFacts = Partial<Record<MossproutStoryFactKey, string>>;

export type RelationshipProgressState = {
  schemaVersion: 4;
  journeyDays: JourneyDayRecord[];
  stories: Partial<Record<KatchimeraFamilyId, KatchimeraStoryProgress>>;
  skippedActionIds: string[];
  actionCompletionEvents: KatchimeraActionCompletionEvent[];
  mossproutDailyActionDecks: MossproutDailyActionDeck[];
};
