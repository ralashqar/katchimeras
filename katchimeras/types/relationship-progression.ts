import type { KatchimeraFamilyId } from '@/types/katchimera';

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
  mergeOrderId: string;
  opportunityId: string;
  generatorId: string;
  dropDefinitionIds: string[];
};

export type JourneyDayActionKind = 'journey' | 'goal_plan' | 'playful_game';
export type JourneyDayActionStatus = 'ready' | 'active' | 'completed';

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
};

export type KatchimeraActionCompletionRecord = {
  id: string;
  dayId: string;
  familyId: KatchimeraFamilyId;
  actionId: string;
  instanceId: string;
  slotId: KatchimeraActionSlotId;
  sequence: number;
  kind: KatchimeraDayActionKind;
  title: string;
  subtitle: string;
  icon: import('@/components/ui/icon-symbol').IconSymbolName;
  artKey?: KatchimeraActionArtKey;
  artworkDefinitionIds: string[];
  reward: KatchimeraDayActionReward | null;
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
  activeChapterId: string;
  activeBeatId: string;
  completedChapterIds: string[];
  completedObjectiveIds: string[];
  habitatStage: 0 | 1 | 2 | 3 | 4;
  updatedAt: number;
};

export type RelationshipProgressState = {
  schemaVersion: 2;
  journeyDays: JourneyDayRecord[];
  stories: Partial<Record<KatchimeraFamilyId, KatchimeraStoryProgress>>;
  acknowledgedActionOutroIds: string[];
  skippedActionIds: string[];
  completedActionOutros: KatchimeraActionCompletionRecord[];
  mossproutDailyActionDecks: MossproutDailyActionDeck[];
};
