import type { IconSymbolName } from '@/components/ui/icon-symbol';
import type { JournalNoteDraft } from '@/types/home';
import type { QuestSubmissionItem } from '@/utils/quests/report-back-evidence';
import type { QuestNextAction, QuestRuntimeState } from '@/utils/quests/runtime';
import type { KatchimeraActivityLane, KatchimeraBondLevel } from '@/constants/katchimera-roles';
import type { KatchimeraFamilyId } from '@/types/katchimera';

export type CompanionThread = 'quest' | 'insight' | 'skins';
export type CompanionDestination = CompanionThread | 'goals' | 'achievements';

export type CompanionVisitSubject =
  | 'introduction'
  | 'celebration'
  | 'resume'
  | 'today'
  | 'memory_confirmation'
  | 'focus'
  | 'quest'
  | 'daily_pulse'
  | 'quiet';

export type CompanionEvidenceRef = {
  sourceType: 'day' | 'memory' | 'conversation' | 'journal' | 'quest' | 'goal' | 'achievement';
  sourceId: string;
  dayId?: string;
};

export type CompanionVisitResponse = {
  id: string;
  label: string;
  action: 'answer' | 'say_more' | 'open_focus' | 'accept_quest' | 'open_quest' | 'open_achievements' | 'defer' | 'stay';
  value?: string;
};

export type CompanionVisitPlan = {
  id: string;
  familyId: KatchimeraFamilyId;
  dayId: string;
  invitationId?: string;
  contentItemId?: string;
  questId?: string;
  subject: CompanionVisitSubject;
  eyebrow: string;
  opening: string;
  helperText?: string;
  responses: readonly CompanionVisitResponse[];
  evidenceRefs: readonly CompanionEvidenceRef[];
  createdAt: number;
};

export type CompanionConversationReceipt = {
  id: string;
  visitPlanId: string;
  familyId: KatchimeraFamilyId;
  dayId: string;
  responseIds: string[];
  offerOutcome?: 'accepted' | 'declined' | 'deferred';
  affectedMemoryIds: string[];
  completedAt: number;
};

export type CompanionQuestOfferViewModel = {
  id: string;
  title: string;
  hint: string;
  family?: 'photo' | 'moment' | 'place' | 'movement' | 'note' | 'voice' | 'food' | 'studio' | 'sleep' | 'weather' | 'calendar';
  categoryLabel: string;
  estimatedMinutes: number;
  bondReward: number;
  recommended: boolean;
  completedToday?: boolean;
  repeatable?: boolean;
  availableToday?: boolean;
  artworkKey?: string;
  lane: Exclude<KatchimeraActivityLane, 'discovery'>;
  minimumBondLevel: KatchimeraBondLevel;
};

export type CompanionNavigationIntent =
  | { kind: 'journal_flow'; flowId: 'food' | 'studio' | 'went_somewhere' | 'movement' | 'big_event' | 'general' }
  | { kind: 'journal_handoff'; handoffId: string }
  | { kind: 'quick_goals' }
  | { kind: 'memory_vault'; tab: 'photos' | 'notes' }
  | { kind: 'places' }
  | { kind: 'movement' }
  | { kind: 'rest' };

export type CompanionInsight = {
  text: string;
  evidenceLabel?: string | null;
  action?: { label: string; icon: IconSymbolName; intent: CompanionNavigationIntent } | null;
};

export type CompanionReflectionDraft = JournalNoteDraft & {
  promptId: string;
  promptText: string;
};

export type QuestCaptureFeedback = {
  phase: 'analyzing' | 'matched' | 'possible' | 'no_match';
  sourceId: string;
  questId?: string;
  creatureId?: string;
  evidenceId?: string | null;
  reason?: string | null;
  sourceType?: 'photo' | 'text_note' | 'voice_note' | null;
};

export type CompanionQuestCriterionViewModel = {
  id: string;
  label: string;
  done: boolean;
  reason?: string | null;
  progressRatio?: number | null;
  progressLabel?: string | null;
};

export type CompanionQuestPrimaryAction =
  | { kind: 'accept'; label: string; icon: IconSymbolName }
  | { kind: 'quest_action'; label: string; icon: IconSymbolName; nextAction: QuestNextAction }
  | { kind: 'review_match'; label: string; icon: IconSymbolName; item: QuestSubmissionItem }
  | { kind: 'submit'; label: string; icon: IconSymbolName; item: QuestSubmissionItem }
  | { kind: 'report'; label: string; icon: IconSymbolName };

export type CompanionQuestViewModel = {
  mode: 'empty' | 'offer' | 'active' | 'analysing' | 'possible' | 'ready' | 'complete' | 'blocked';
  runtimeState?: QuestRuntimeState | null;
  eyebrow: string;
  title: string;
  message: string;
  rewardLabel?: string | null;
  statusLabel?: string | null;
  statusTone: 'neutral' | 'warning' | 'success' | 'danger';
  criteria: CompanionQuestCriterionViewModel[];
  evidence: QuestSubmissionItem[];
  semanticInput?: boolean;
  journalInput?: boolean;
  journalFallback?: boolean;
  assistedJournalInput?: boolean;
  captureFeedback?: QuestCaptureFeedback | null;
  primaryAction?: CompanionQuestPrimaryAction | null;
};

export type CompanionInteractionState = {
  destination: CompanionDestination | null;
  direction: 1 | -1;
  reviewItemId: string | null;
  route: CompanionRoute;
  experienceInstance: number;
};

export type CompanionRoute =
  | { kind: 'dashboard' }
  | { kind: 'chat_lobby' }
  | { kind: 'conversation' }
  | { kind: 'visit' }
  | { kind: 'shared_history' }
  | { kind: 'introduction' }
  | { kind: 'destination'; destination: CompanionDestination }
  | { kind: 'quick_goal_picker'; destination: 'goals' }
  | { kind: 'journey_questionnaire'; destination: 'goals'; sessionId: string | null }
  | { kind: 'check_in'; destination: 'goals'; checkInId: string }
  | { kind: 'quest_experience'; destination: 'quest'; attemptId: string | null };

export type CompanionInteractionAction =
  | { type: 'select_destination'; destination: CompanionDestination }
  | { type: 'open_introduction' }
  | { type: 'show_dashboard' }
  | { type: 'show_chat_lobby' }
  | { type: 'show_conversation' }
  | { type: 'show_visit' }
  | { type: 'open_shared_history' }
  | { type: 'review_item'; itemId: string | null }
  | { type: 'open_quick_goal_picker' }
  | { type: 'open_journey_questionnaire'; sessionId?: string | null }
  | { type: 'sync_journey_session'; sessionId: string }
  | { type: 'open_check_in'; checkInId: string }
  | { type: 'open_quest_experience' }
  | { type: 'set_quest_attempt'; attemptId: string | null }
  | { type: 'return_to_destination' }
  | { type: 'reset_quest_experience' }
  | { type: 'reset_companion'; initialDestination?: CompanionDestination | null };
