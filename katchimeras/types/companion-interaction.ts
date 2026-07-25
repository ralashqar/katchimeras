import type { IconSymbolName } from '@/components/ui/icon-symbol';
import type { JournalNoteDraft } from '@/types/home';
import type { QuestSubmissionItem } from '@/utils/quests/report-back-evidence';
import type { QuestNextAction, QuestRuntimeState } from '@/utils/quests/runtime';
import type { KatchimeraActivityLane, KatchimeraBondLevel } from '@/constants/katchimera-roles';

export type CompanionThread = 'quest' | 'discovery' | 'insight' | 'skins' | 'reflection';

export type CompanionQuestOfferViewModel = {
  id: string;
  title: string;
  hint: string;
  family?: 'photo' | 'moment' | 'place' | 'movement' | 'note' | 'voice' | 'food' | 'studio' | 'sleep' | 'weather' | 'calendar';
  categoryLabel: string;
  estimatedMinutes: number;
  bondReward: number;
  recommended: boolean;
  artworkKey?: string;
  lane: Exclude<KatchimeraActivityLane, 'discovery'>;
  minimumBondLevel: KatchimeraBondLevel;
};

export type CompanionNavigationIntent =
  | { kind: 'journal_flow'; flowId: 'food' | 'studio' | 'went_somewhere' | 'movement' | 'big_event' | 'general' }
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
  captureFeedback?: QuestCaptureFeedback | null;
  primaryAction?: CompanionQuestPrimaryAction | null;
};

export type CompanionInteractionState = {
  thread: CompanionThread;
  direction: 1 | -1;
  reviewItemId: string | null;
  reflectionDraft: CompanionReflectionDraft | null;
  reflectionReviewOpen: boolean;
  discardOpen: boolean;
};

export type CompanionInteractionAction =
  | { type: 'select_thread'; thread: CompanionThread }
  | { type: 'review_item'; itemId: string | null }
  | { type: 'set_reflection_draft'; draft: CompanionReflectionDraft | null }
  | { type: 'review_reflection' }
  | { type: 'edit_reflection' }
  | { type: 'request_discard' }
  | { type: 'keep_editing' };
