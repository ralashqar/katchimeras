import type { KatchimeraFamilyId, KatchimeraSkinId } from '@/types/katchimera';
import type { CompanionEvidenceRef } from '@/types/companion-interaction';

/** Every family with a complete authored V2 data pack. */
export const CONVERSATION_V2_FAMILIES = [
  'baristabbit', 'feastle', 'steppling', 'flexel', 'bedrotte', 'dawnle', 'mendle',
  'gatherglow', 'heartmote', 'kindling', 'snuglet', 'waglet', 'tasklet', 'errandimp',
  'pagelet', 'relicoon', 'museling', 'encora', 'flickerbun', 'pixooka', 'mossprout',
  'shellio', 'skylo', 'voyagle', 'cheerlet',
] as const;
export type ConversationV2FamilyId = typeof CONVERSATION_V2_FAMILIES[number];

/** Every authored family now uses the V2 chat lobby and conversation engine. */
export const CONVERSATION_V2_ENABLED_FAMILIES: readonly ConversationV2FamilyId[] = CONVERSATION_V2_FAMILIES;

/** Skin matching remains gated until every result in that family has approved art. */
export const CONVERSATION_V2_IDEAL_SKIN_FAMILIES: readonly ConversationV2FamilyId[] = [
  'baristabbit', 'steppling', 'flexel',
];
export type ConversationMode = 'talk' | 'play' | 'discover' | 'plan';

export type ConversationTriggerKind =
  | 'evergreen'
  | 'journal'
  | 'bond'
  | 'goal_debrief'
  | 'quest_debrief'
  | 'signature_game'
  | 'poll';

export type ConversationTransition =
  | { kind: 'definition'; definitionId: string }
  | { kind: 'pool'; poolId: string }
  | { kind: 'continuation'; destination?: 'menu' | 'memory' };

export type ConversationOption = {
  id: string;
  label: string;
  reply: string;
  nextNodeId: string | null;
  /** Profile games may branch to another question inside the same node. */
  nextQuestionId?: string | null;
  transition?: ConversationTransition;
  intentId?: string;
  affinity?: Partial<Record<KatchimeraSkinId, number>>;
  /** Short authored phrase used when this answer becomes part of an editable journal draft. */
  journalFragment?: string;
};

export type ConversationProfileQuestion = {
  id: string;
  prompt: string;
  /** Optional authored prompt variants keyed by the immediately preceding answer id. */
  promptByPriorOptionId?: Readonly<Record<string, string>>;
  helperText?: string;
  options: readonly ConversationOption[];
};

export type ConversationInsightResultDefinition = {
  id: string;
  title: string;
  reflection: string;
  summary: string;
  emblemId: string;
  /** Option ids which add one point to this result. Highest score wins deterministically. */
  matchOptionIds: readonly string[];
};

export type ConversationInsightResult = {
  insightKey: string;
  category: string;
  resultId: string;
  title: string;
  reflection: string;
  summary: string;
  emblemId: string;
  supportingTraits: readonly string[];
  secondaryResultId?: string;
  secondaryTitle?: string;
  confidence: 'clear' | 'mixed';
  scoreMargin: number;
};

export type ConversationPhase = 'opening' | 'explore' | 'deepen' | 'resolve';
export type ConversationFocusAction = 'create' | 'rename' | 'pause' | 'complete' | 'replace';

export type ConversationNode =
  | {
      id: string;
      kind: 'choice';
      prompt: string;
      helperText?: string;
      options: readonly ConversationOption[];
      allowFreeResponse?: boolean;
      phase?: ConversationPhase;
    }
  | {
      id: string;
      kind: 'profile_game';
      title: string;
      entryQuestionId?: string;
      questions: readonly ConversationProfileQuestion[];
      revealNodeId: string;
    }
  | {
      id: string;
      kind: 'insight_game';
      title: string;
      questions: readonly ConversationProfileQuestion[];
      revealNodeId: string;
    }
  | {
      id: string;
      kind: 'poll';
      prompt: string;
      helperText?: string;
      options: readonly (ConversationOption & { villageWeight: number })[];
      nextNodeId: string | null;
    }
  | {
      id: string;
      kind: 'form_reveal';
      title: string;
      descriptions: Partial<Record<KatchimeraSkinId, string>>;
      memoryKey: string;
      nextNodeId: string | null;
    }
  | {
      id: string;
      kind: 'insight_reveal';
      title: string;
      insightKey: string;
      category: string;
      /** Lightweight results are shown as a conclusion without becoming a saved profile insight. */
      persistence?: 'offer_save' | 'display_only';
      /** Journey insights deliberately resolve to one clear authored observation. */
      allowSecondary?: boolean;
      results: readonly ConversationInsightResultDefinition[];
      nextNodeId: string | null;
    }
  | {
      id: string;
      kind: 'memory_proposal';
      prompt: string;
      summary: string;
      memoryKey: string;
      memoryKind?: 'preference' | 'pattern' | 'shared_moment' | 'milestone';
      sensitivity: 'ordinary' | 'personal';
      nextNodeId: string | null;
    }
  | {
      id: string;
      kind: 'goal_proposal';
      prompt: string;
      goalTypeId: string;
      goalTitle: string;
      summary?: string;
      suggestedQuickGoalIds: readonly string[];
      nextNodeId: string | null;
      action?: ConversationFocusAction;
    }
  | {
      id: string;
      kind: 'quick_goal_proposal';
      prompt: string;
      templateId: string;
      title: string;
      nextNodeId: string | null;
    }
  | {
      id: string;
      kind: 'journal_handoff';
      prompt: string;
      title: string;
      body: string;
      /** Placeholders use choice node ids, for example: "I noticed {{found}}." */
      draftTemplate?: string;
      flowId: string;
      allowedChoiceIds: readonly string[];
      saveLabel: string;
      rewardGrowth: number;
      nextNodeId: string | null;
    }
  | {
      id: string;
      kind: 'quest_handoff';
      prompt: string;
      suggestedQuestIds: readonly string[];
      fallbackNodeId: string;
      nextNodeId: string | null;
    }
  | {
      id: string;
      kind: 'end';
      message: string;
    };

export type ConversationDefinition = {
  id: string;
  version: number;
  familyId: ConversationV2FamilyId;
  title: string;
  /** Short, action-led copy used when this conversation appears as a daily card. */
  actionTitle?: string;
  trigger: ConversationTriggerKind;
  triggerRouteKeys?: readonly string[];
  minimumBondLevel: 1 | 2 | 3 | 4;
  minimumFriendshipLevel?: number;
  triggerSourceIds?: readonly string[];
  cooldownDays: number;
  entryNodeId: string;
  nodes: readonly ConversationNode[];
  tags?: readonly string[];
  isOpener?: boolean;
  contextualOnly?: boolean;
  weight?: number;
  format?: 'opener' | 'narrative' | 'poll' | 'profile_game' | 'insight_game' | 'outcome';
  requiresActiveFocus?: boolean;
  requiresNoActiveFocus?: boolean;
  requiresNoActiveQuest?: boolean;
  /** Editorial reason this conversation exists. Used to keep character content intentional. */
  purpose?: 'journey' | 'get_to_know' | 'reflection' | 'learned_insight' | 'planning' | 'card_discovery' | 'bond_milestone';
  /** Where the character experience should return after this conversation resolves. */
  returnTarget?: 'character_home' | 'chat_lobby' | 'garden' | 'goals' | 'quest';
  /** Whether the authored beat may be selected again after completion. */
  repeatPolicy?: 'once_ever' | 'once_per_journey_day' | 'after_cooldown';
  /** Stable editorial subject used to avoid serving near-duplicate prompts too close together. */
  topicKey?: string;
};

export type ConversationTurn = {
  id: string;
  nodeId: string;
  questionId?: string;
  optionId: string;
  intentId?: string;
  answeredAt: number;
};

export type ConversationFormResult = {
  topFormId: KatchimeraSkinId;
  runnerUpFormId: KatchimeraSkinId | null;
  scores: Partial<Record<KatchimeraSkinId, number>>;
};

export type ConversationPollResult = {
  selectedOptionId: string;
  percentages: Readonly<Record<string, number>>;
  label: 'Katchimera village poll - fictional';
};

export type ConversationOutcomeDestination = 'goals' | 'quest' | 'memory' | 'insight';

export type ConversationOutcomePresentation = {
  id: string;
  kind: 'task' | 'goal' | 'focus' | 'quest' | 'memory' | 'insight';
  eyebrow: string;
  title: string;
  message: string;
  items?: readonly string[];
  celebrate: boolean;
  destination?: ConversationOutcomeDestination;
  destinationLabel?: string;
  createdAt: number;
};

export type ConversationSessionStatus = 'active' | 'completed' | 'archived';

export type ConversationSession = {
  id: string;
  definitionId: string;
  definitionVersion: number;
  familyId: ConversationV2FamilyId;
  formId: KatchimeraSkinId;
  createdDayId: string;
  servedDayId: string;
  currentNodeId: string;
  gameQuestionIndex: number;
  gameQuestionId?: string;
  pendingReply?: string;
  lastReply?: string;
  pendingNextNodeId?: string | null;
  turns: ConversationTurn[];
  affinityScores: Partial<Record<KatchimeraSkinId, number>>;
  formResult?: ConversationFormResult;
  insightResult?: ConversationInsightResult;
  pollResult?: ConversationPollResult;
  outcomePresentation?: ConversationOutcomePresentation;
  evidenceRefs: CompanionEvidenceRef[];
  status: ConversationSessionStatus;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  archivedAt?: number;
  outcomeIds: string[];
  encounterId?: string;
  exitTransition?: ConversationTransition;
  encounterTargetTurns?: number;
  encounterTurns?: number;
  /** Development-only dialogue browser session. It cannot write player outcomes. */
  preview?: boolean;
  /** Exact home action that launched this session; never reconstructed at completion time. */
  actionOrigin?: import('@/types/relationship-progression').KatchimeraActionOrigin;
};

export type ConversationSignalKind = 'journal' | 'goal_debrief' | 'quest_debrief' | 'bond' | 'achievement';

export type QueuedConversationSignal = {
  id: string;
  kind: ConversationSignalKind;
  familyId: ConversationV2FamilyId;
  sourceId: string;
  dayId: string;
  routeKey?: string;
  feeling?: string | null;
  context?: string | null;
  createdAt: number;
  expiresAt: number;
  consumedAt?: number;
};

export type ConversationTelemetryKind =
  | 'conversation_started'
  | 'turn_answered'
  | 'game_completed'
  | 'memory_proposed'
  | 'memory_confirmed'
  | 'memory_rejected'
  | 'goal_proposed'
  | 'goal_accepted'
  | 'journal_handoff_opened'
  | 'journal_handoff_saved'
  | 'journal_handoff_skipped'
  | 'insight_revealed'
  | 'insight_confirmed'
  | 'insight_adjusted'
  | 'insight_dismissed'
  | 'insight_viewed'
  | 'conversation_completed'
  | 'conversation_archived'
  | 'conversation_fallback';

export type ConversationTelemetryEvent = {
  id: string;
  familyId: KatchimeraFamilyId;
  sessionId: string;
  definitionId: string;
  kind: ConversationTelemetryKind;
  nodeId?: string;
  optionId?: string;
  occurredAt: number;
};

export function isConversationV2Family(value: string | null | undefined): value is ConversationV2FamilyId {
  return CONVERSATION_V2_ENABLED_FAMILIES.includes(value as ConversationV2FamilyId);
}

export function isConversationV2AuthoredFamily(value: string | null | undefined): value is ConversationV2FamilyId {
  return CONVERSATION_V2_FAMILIES.includes(value as ConversationV2FamilyId);
}

export function isConversationV2IdealSkinFamily(value: string | null | undefined): value is ConversationV2FamilyId {
  return CONVERSATION_V2_IDEAL_SKIN_FAMILIES.includes(value as ConversationV2FamilyId);
}
