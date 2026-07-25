import type {
  CompanionInteractionAction,
  CompanionInteractionState,
  CompanionInsight,
  CompanionQuestViewModel,
  CompanionThread,
  QuestCaptureFeedback,
} from '@/types/companion-interaction';
import type { QuestSubmissionItem } from '@/utils/quests/report-back-evidence';
import type { QuestRuntimeStatus } from '@/utils/quests/runtime';
import type { InteractiveQuestExecution } from '@/utils/quests/experiences/types';

export function createCompanionInteractionState(input: {
  initialThread: CompanionThread;
  reflectionDraft?: CompanionInteractionState['reflectionDraft'];
}): CompanionInteractionState {
  return {
    thread: input.initialThread,
    direction: 1,
    reviewItemId: null,
    reflectionDraft: input.reflectionDraft ?? null,
    reflectionReviewOpen: false,
    discardOpen: false,
  };
}

export function companionInteractionReducer(
  state: CompanionInteractionState,
  action: CompanionInteractionAction
): CompanionInteractionState {
  switch (action.type) {
    case 'select_thread': {
      const order: CompanionThread[] = ['quest', 'discovery', 'insight', 'skins', 'reflection'];
      return {
        ...state,
        thread: action.thread,
        direction: order.indexOf(action.thread) >= order.indexOf(state.thread) ? 1 : -1,
        reviewItemId: null,
        reflectionReviewOpen: false,
      };
    }
    case 'review_item':
      return { ...state, reviewItemId: action.itemId };
    case 'set_reflection_draft':
      return {
        ...state,
        reflectionDraft: action.draft,
        reflectionReviewOpen: action.draft ? state.reflectionReviewOpen : false,
      };
    case 'review_reflection':
      return companionReflectionIsDirty(state)
        ? { ...state, reflectionReviewOpen: true, discardOpen: false }
        : state;
    case 'edit_reflection':
      return { ...state, reflectionReviewOpen: false };
    case 'request_discard':
      return { ...state, discardOpen: true };
    case 'keep_editing':
      return { ...state, discardOpen: false };
  }
}

export function companionReflectionIsDirty(state: CompanionInteractionState): boolean {
  return Boolean(state.reflectionDraft?.text.trim() || state.reflectionDraft?.audioUri);
}

export function companionViewportResetKey(input: {
  creatureId: string;
  thread: CompanionThread;
  questMode: CompanionQuestViewModel['mode'];
  activeQuestTitle?: string | null;
  journeyNodeId?: string | null;
  reviewItemId?: string | null;
  reflectionReviewOpen?: boolean;
  activeAttemptId?: string | null;
  memorySaved?: boolean;
}): string {
  return [
    input.creatureId,
    input.thread,
    input.questMode,
    input.activeQuestTitle ?? '',
    input.journeyNodeId ?? '',
    input.reviewItemId ?? '',
    input.reflectionReviewOpen ? 'reflection-review' : '',
    input.activeAttemptId ? 'active-experience' : '',
    input.memorySaved ? 'memory-saved' : '',
  ].join('|');
}

export function companionQuestUsesFullBleed(execution: InteractiveQuestExecution | null): boolean {
  return Boolean(
    (execution?.kind === 'matching' && execution.packId === 'mossprout-garden') ||
    (execution?.kind === 'merge' && execution.packId === 'feastle-kitchen') ||
    (execution?.kind === 'block_jam' && execution.packId === 'tasklet-desk'),
  );
}

export function buildCompanionQuestViewModel(input: {
  activeQuest: { title: string; hint: string } | null;
  offer?: { id: string; title: string; hint: string };
  runtime: QuestRuntimeStatus | null;
  questComplete: boolean;
  captureFeedback: QuestCaptureFeedback | null;
  items: QuestSubmissionItem[];
  criteria: Array<{ label: string; done: boolean; reason?: string | null; progressRatio?: number | null; progressLabel?: string | null }>;
}): CompanionQuestViewModel {
  const { activeQuest, offer, runtime, questComplete, captureFeedback, items } = input;
  const criteria = input.criteria.map((criterion, index) => ({
    id: `${index}:${criterion.label}`,
    label: criterion.label,
    done: criterion.done,
    reason: criterion.reason,
    progressRatio: criterion.progressRatio,
    progressLabel: criterion.progressLabel,
  }));
  if (!activeQuest && offer) {
    return {
      mode: 'offer', eyebrow: 'A new quest', title: offer.title, message: offer.hint,
      rewardLabel: 'Grow your bond', statusTone: 'neutral', criteria: [], evidence: [],
      primaryAction: { kind: 'accept', label: 'Accept quest', icon: 'sparkles' },
    };
  }
  if (!activeQuest) {
    return { mode: 'empty', eyebrow: 'Quest', title: 'Nothing pressing', message: 'Come back after the day has changed a little.', statusTone: 'neutral', criteria: [], evidence: [] };
  }
  if (captureFeedback?.phase === 'analyzing') {
    return {
      mode: 'analysing', eyebrow: 'Checking your memory', title: activeQuest.title,
      message: 'Looking for the signals this quest needs.', statusLabel: 'Analysing', statusTone: 'neutral',
      criteria, evidence: items, captureFeedback,
    };
  }
  if (captureFeedback?.phase === 'matched') {
    return {
      mode: 'complete', eyebrow: 'Quest matched', title: activeQuest.title,
      message: 'That memory is a clear match. Making it count now.', statusLabel: 'Matched', statusTone: 'success',
      criteria, evidence: items, captureFeedback,
    };
  }
  const possible = items.find((item) => item.matchStatus === 'possible');
  if (possible) {
    return {
      mode: 'possible', eyebrow: 'A possible match', title: activeQuest.title,
      message: 'Check the memory before deciding whether it belongs to this quest.', statusLabel: 'Needs your review', statusTone: 'warning',
      criteria, evidence: items, captureFeedback,
      primaryAction: { kind: 'review_match', label: 'Review possible match', icon: 'checkmark.circle', item: possible },
    };
  }
  const ready = items.find((item) => item.matchStatus === 'ready') ?? items[0];
  if (runtime?.readyToSubmit && ready) {
    return {
      mode: 'ready', runtimeState: runtime.state, eyebrow: 'Ready to submit', title: activeQuest.title,
      message: 'This memory has the signals the quest needs.', statusLabel: 'Ready', statusTone: 'success',
      criteria, evidence: items,
      primaryAction: { kind: 'submit', label: 'Submit quest', icon: 'paperplane.fill', item: ready },
    };
  }
  if (questComplete || runtime?.complete) {
    return {
      mode: 'complete', runtimeState: runtime?.state, eyebrow: 'Quest complete', title: activeQuest.title,
      message: 'You found what this quest was looking for.', rewardLabel: 'Bond strengthened', statusLabel: 'Complete', statusTone: 'success',
      criteria, evidence: items,
      primaryAction: { kind: 'report', label: 'Report back', icon: 'sparkles' },
    };
  }
  const blocked = runtime?.state === 'blocked_permission' || runtime?.state === 'unavailable' || runtime?.state === 'impossible_today';
  return {
    mode: blocked ? 'blocked' : 'active', runtimeState: runtime?.state,
    eyebrow: blocked ? questStateEyebrow(runtime?.state) : 'Quest in progress', title: activeQuest.title,
    message: runtime?.userMessage || activeQuest.hint,
    statusLabel: runtime ? questStatusLabel(runtime) : 'In progress',
    statusTone: runtime?.state === 'impossible_today' ? 'danger' : blocked ? 'warning' : 'neutral',
    criteria, evidence: items, captureFeedback,
    primaryAction: runtime && runtime.nextAction !== 'none'
      ? { kind: 'quest_action', label: questActionLabel(runtime.nextAction), icon: questActionIcon(runtime.nextAction), nextAction: runtime.nextAction }
      : null,
  };
}

export function insightForArchetype(input: { archetype: string; text: string; count?: number | null }): CompanionInsight {
  const count = input.count ?? null;
  const evidenceLabel = count && count > 0 ? `Drawn from ${count} kept ${count === 1 ? 'memory' : 'memories'}` : null;
  switch (input.archetype) {
    case 'food': case 'savour': return { text: input.text, evidenceLabel, action: { label: 'Add food or drink', icon: 'fork.knife', intent: { kind: 'journal_flow', flowId: 'food' } } };
    case 'culture': return { text: input.text, evidenceLabel, action: { label: 'Open Studio', icon: 'books.vertical.fill', intent: { kind: 'journal_flow', flowId: 'studio' } } };
    case 'places': return { text: input.text, evidenceLabel, action: { label: 'Open Places', icon: 'mappin.and.ellipse', intent: { kind: 'places' } } };
    case 'journey': case 'active': return { text: input.text, evidenceLabel, action: { label: 'Open Movement', icon: 'figure.walk', intent: { kind: 'movement' } } };
    case 'craft': return { text: input.text, evidenceLabel, action: { label: 'Add a progress note', icon: 'square.and.pencil', intent: { kind: 'journal_flow', flowId: 'general' } } };
    case 'celebrate': return { text: input.text, evidenceLabel, action: { label: 'Keep a milestone', icon: 'sparkles', intent: { kind: 'journal_flow', flowId: 'big_event' } } };
    case 'memory': case 'tender': return { text: input.text, evidenceLabel, action: { label: 'Review notes', icon: 'note.text', intent: { kind: 'memory_vault', tab: 'notes' } } };
    case 'night': case 'sleep': return { text: input.text, evidenceLabel, action: { label: 'Open rest', icon: 'moon.stars.fill', intent: { kind: 'rest' } } };
    default: return { text: input.text, evidenceLabel: null, action: null };
  }
}

function questStatusLabel(runtime: QuestRuntimeStatus): string {
  if (runtime.state === 'blocked_permission') return 'Permission needed';
  if (runtime.state === 'unavailable') return 'Unavailable';
  if (runtime.state === 'impossible_today') return 'Finished for today';
  return runtime.matchedEvidenceIds.length > 0 ? 'Partly matched' : 'Looking for a match';
}
function questStateEyebrow(state?: QuestRuntimeStatus['state']): string {
  if (state === 'blocked_permission') return 'Permission needed';
  if (state === 'unavailable') return 'Not available';
  return 'Try again tomorrow';
}
export function questActionLabel(action: QuestRuntimeStatus['nextAction']): string {
  return ({ take_photo: 'Open camera', enable_camera: 'Enable camera', enable_photos: 'Open photos', enable_location: 'Enable location', enable_travel_memory: 'Open Travel Memory', record_voice: 'Record voice', add_note: 'Add note', open_health: 'Open movement', confirm_place: 'Confirm place', none: '' } as const)[action];
}
function questActionIcon(action: QuestRuntimeStatus['nextAction']): import('@/components/ui/icon-symbol').IconSymbolName {
  if (action === 'take_photo' || action === 'enable_camera') return 'camera.fill';
  if (action === 'record_voice') return 'mic.fill';
  if (action === 'add_note') return 'square.and.pencil';
  if (action === 'open_health') return 'figure.walk';
  if (action === 'enable_photos') return 'photo.fill';
  return 'arrow.right';
}
