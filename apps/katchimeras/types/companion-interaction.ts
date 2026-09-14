import type { JournalNoteDraft } from '@/types/home';
import type { ConversationMode } from '@/types/companion-conversation';
import type { KatchimeraFamilyId } from '@/types/katchimera';

/** The side pages a companion still has: their forms, and the trophy room. */
export type CompanionThread = 'skins';
export type CompanionDestination = CompanionThread | 'achievements';

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

/** A daily card on Mossprout's stage that opens one of his conversations. */
export type CompanionChatStarter = {
  definitionId: string;
  mode: ConversationMode;
  questionCount: number;
  title: string;
  actionKind?: 'journal_prompt' | 'journey_focus';
  label?: string;
  description?: string;
};

export type CompanionNavigationIntent =
  | { kind: 'journal_flow'; flowId: 'food' | 'studio' | 'went_somewhere' | 'movement' | 'big_event' | 'general' }
  | { kind: 'journal_handoff'; handoffId: string }
  | { kind: 'quick_goals' }
  | { kind: 'memory_vault'; tab: 'photos' | 'notes' }
  | { kind: 'places' }
  | { kind: 'movement' }
  | { kind: 'rest' };

export type CompanionReflectionDraft = JournalNoteDraft & {
  promptId: string;
  promptText: string;
};

/**
 * Where the companion page is: the dashboard (the stage with its cards), a
 * conversation, a side page, the small-goal picker, or Mossprout's nature
 * direction questionnaire.
 */
export type CompanionRoute =
  | { kind: 'dashboard' }
  | { kind: 'conversation' }
  | { kind: 'destination'; destination: CompanionDestination }
  | { kind: 'quick_goal_picker' }
  | { kind: 'focus_questionnaire'; sessionId: string | null };

export type CompanionInteractionState = {
  destination: CompanionDestination | null;
  direction: 1 | -1;
  route: CompanionRoute;
};

export type CompanionInteractionAction =
  | { type: 'select_destination'; destination: CompanionDestination }
  | { type: 'show_dashboard' }
  | { type: 'show_conversation' }
  | { type: 'open_quick_goal_picker' }
  | { type: 'open_focus_questionnaire'; sessionId?: string | null }
  | { type: 'sync_journey_session'; sessionId: string }
  | { type: 'return_to_destination' }
  | { type: 'reset_companion'; initialDestination?: CompanionDestination | null; initialConversation?: boolean };
