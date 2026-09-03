import type { KatchimeraFamilyId, KatchimeraSkinId } from '@/types/katchimera';

export type JourneyDayStatus =
  | 'opening'
  | 'profile_available'
  | 'living'
  | 'activity_available'
  | 'activity_in_progress'
  | 'return_available'
  | 'resolution_ready'
  | 'resident_discovery'
  | 'resident_orders'
  | 'card_reward'
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

export type ActionOwner =
  | { kind: 'journey'; journeyId: string; journeyActionId: string }
  | { kind: 'daily_action' }
  | { kind: 'goal'; goalId: string }
  | { kind: 'quest'; questId: string }
  | { kind: 'garden'; orderId: string | null };

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
  /** Whether this completion advances the routine daily-action rotation. */
  rotationEffect: 'consume' | 'preserve';
  presentation: 'action_card' | 'none';
};

export type KatchimeraActionRewardReceipt = {
  id: string;
  eventId: string;
  creatureId: string;
  kind:
    | 'hatch'
    | 'friendship_started'
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

export type ActionCompletionCommand = {
  commandId: string;
  actionInstanceId: string;
  actionId: string;
  dayId: string;
  familyId: KatchimeraFamilyId;
  owner: ActionOwner;
  sourceSlotId: KatchimeraActionSlotId;
  slotId: KatchimeraActionSlotId;
  sequence: number;
  outcome: 'completed' | 'skipped';
  rotationEffect: 'consume' | 'preserve';
  rewardIntent: KatchimeraDayActionReward | null;
  presentation: 'action_card' | 'none';
  card: Pick<KatchimeraActionOrigin, 'kind' | 'title' | 'subtitle' | 'icon' | 'artKey' | 'artworkDefinitionIds'>;
  completedAt: number;
};

export type ActionCompletionRecord = {
  id: string;
  commandId: string;
  actionInstanceId: string;
  actionId: string;
  dayId: string;
  familyId: KatchimeraFamilyId;
  kind: KatchimeraDayActionKind;
  owner: ActionOwner;
  sourceSlotId: KatchimeraActionSlotId;
  slotId: KatchimeraActionSlotId;
  sequence: number;
  outcome: 'completed' | 'skipped';
  rotationEffect: 'consume' | 'preserve';
  rewardIntent: KatchimeraDayActionReward | null;
  rewardEventId: string | null;
  rewardReceipt: KatchimeraActionRewardReceipt | null;
  completedAt: number;
};

export type ActionPresentationRecord = {
  id: string;
  completionId: string;
  dayId: string;
  slotId: KatchimeraActionSlotId;
  status: 'pending' | 'claimed' | 'dismissed';
  card: Pick<KatchimeraActionOrigin, 'kind' | 'title' | 'subtitle' | 'icon' | 'artKey' | 'artworkDefinitionIds' | 'reward'>;
  createdAt: number;
  claimedAt: number | null;
  dismissedAt: number | null;
};

export type ActionBoardSlot = {
  slotId: KatchimeraActionSlotId;
  action: KatchimeraDayAction | null;
  enabled: boolean;
};

export type ActionBoardSnapshot = {
  dayId: string;
  slots: readonly [ActionBoardSlot, ActionBoardSlot, ActionBoardSlot];
  presentations: readonly ActionPresentationRecord[];
};

/** @deprecated Save-migration input only. */
export type KatchimeraActionCompletionRecord = Omit<KatchimeraActionOrigin, 'sourceSlotId' | 'rotationEffect' | 'presentation'> & {
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

/** A durable period in which a companion is present but unavailable to act. */
export type KatchimeraMeditationRecord = {
  familyId: KatchimeraFamilyId;
  startedAt: number;
  availableAt: number;
  reason: 'journey_rest';
  /** Idempotency identity for story-owned rest transitions. */
  sourceId?: string;
  /** Exactly-once tending/thought reductions applied while this rest is active. */
  settlementReceiptIds?: string[];
  settledMs?: number;
};

export type CompanionInteractionAvailability =
  | { kind: 'available' }
  | ({ kind: 'meditating' } & KatchimeraMeditationRecord);

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
  schemaVersion: 7;
  journeyDays: JourneyDayRecord[];
  stories: Partial<Record<KatchimeraFamilyId, KatchimeraStoryProgress>>;
  milestones: {
    dayOneLessonCompletedAt: number | null;
    dayOneLessonFlowRunId: string | null;
  };
  skippedActionIds: string[];
  actionCompletions: ActionCompletionRecord[];
  actionPresentations: ActionPresentationRecord[];
  mossproutDailyActionDecks: MossproutDailyActionDeck[];
  /** Optional for schema-7 save compatibility; normalization always supplies it. */
  meditations?: KatchimeraMeditationRecord[];
};
