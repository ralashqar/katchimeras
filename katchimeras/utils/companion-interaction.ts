import type {
  CompanionInteractionAction,
  CompanionInteractionState,
  CompanionInsight,
  CompanionQuestViewModel,
  CompanionDestination,
  QuestCaptureFeedback,
} from '@/types/companion-interaction';
import type { QuestSubmissionItem } from '@/utils/quests/report-back-evidence';
import type { QuestRuntimeStatus } from '@/utils/quests/runtime';
import type { InteractiveQuestExecution } from '@/utils/quests/experiences/types';

export function createCompanionInteractionState(input: {
  initialDestination?: CompanionDestination | null;
}): CompanionInteractionState {
  const destination = input.initialDestination ?? null;
  return {
    destination,
    direction: 1,
    reviewItemId: null,
    route: destination ? { kind: 'destination', destination } : { kind: 'home' },
    experienceInstance: 0,
  };
}

export function companionInteractionReducer(
  state: CompanionInteractionState,
  action: CompanionInteractionAction
): CompanionInteractionState {
  switch (action.type) {
    case 'select_destination': {
      const order: CompanionDestination[] = ['quest', 'discovery', 'goals', 'achievements', 'insight', 'skins'];
      return {
        ...state,
        destination: action.destination,
        direction: state.destination === null ||
          order.indexOf(action.destination) >= order.indexOf(state.destination) ? 1 : -1,
        reviewItemId: null,
        route: { kind: 'destination', destination: action.destination },
      };
    }
    case 'show_home':
      return {
        ...state,
        destination: null,
        direction: -1,
        reviewItemId: null,
        route: { kind: 'home' },
      };
    case 'open_introduction':
      return {
        ...state,
        destination: null,
        reviewItemId: null,
        route: { kind: 'introduction' },
      };
    case 'review_item':
      return { ...state, reviewItemId: action.itemId };
    case 'open_quick_goal_picker':
      return {
        ...state,
        destination: 'goals',
        reviewItemId: null,
        route: { kind: 'quick_goal_picker', destination: 'goals' },
      };
    case 'open_journey_questionnaire':
      return {
        ...state,
        destination: 'discovery',
        reviewItemId: null,
        route: {
          kind: 'journey_questionnaire',
          destination: 'discovery',
          sessionId: action.sessionId ?? null,
        },
      };
    case 'sync_journey_session':
      return state.route.kind === 'journey_questionnaire'
        ? { ...state, route: { ...state.route, sessionId: action.sessionId } }
        : state;
    case 'open_check_in':
      return {
        ...state,
        destination: 'discovery',
        reviewItemId: null,
        route: { kind: 'check_in', destination: 'discovery', checkInId: action.checkInId },
      };
    case 'open_quest_experience':
      return {
        ...state,
        destination: 'quest',
        reviewItemId: null,
        route: { kind: 'quest_experience', destination: 'quest', attemptId: null },
      };
    case 'set_quest_attempt':
      return state.route.kind === 'quest_experience'
        ? { ...state, route: { ...state.route, attemptId: action.attemptId } }
        : state;
    case 'return_to_destination': {
      if (state.route.kind === 'introduction') {
        return {
          ...state,
          destination: null,
          reviewItemId: null,
          route: { kind: 'home' },
        };
      }
      const destination: CompanionDestination =
        state.route.kind === 'quick_goal_picker'
          ? 'goals'
          : state.route.kind === 'journey_questionnaire' || state.route.kind === 'check_in'
            ? 'discovery'
            : state.route.kind === 'quest_experience'
              ? 'quest'
              : state.destination ?? 'quest';
      return {
        ...state,
        destination,
        reviewItemId: null,
        route: { kind: 'destination', destination },
        experienceInstance: state.route.kind === 'quest_experience'
          ? state.experienceInstance + 1
          : state.experienceInstance,
      };
    }
    case 'reset_quest_experience':
      return state.route.kind === 'quest_experience'
        ? {
            ...state,
            route: { kind: 'destination', destination: 'quest' },
            destination: 'quest',
            experienceInstance: state.experienceInstance + 1,
          }
        : state;
    case 'reset_companion':
      return createCompanionInteractionState({ initialDestination: action.initialDestination });
  }
}

export type CompanionBackAction =
  | 'confirm_attempt_exit'
  | 'return_to_destination'
  | 'return_to_home'
  | 'close_experience';

/**
 * One source of truth for companion back navigation. Focused experiences
 * always unwind to their owning destination before the experience can close.
 */
export function companionRouteBackAction(
  state: CompanionInteractionState
): CompanionBackAction {
  if (state.route.kind === 'quest_experience' && state.route.attemptId) {
    return 'confirm_attempt_exit';
  }
  if (state.route.kind === 'home') return 'close_experience';
  if (state.route.kind === 'introduction') return 'return_to_destination';
  if (state.route.kind === 'destination') return 'return_to_home';
  return 'return_to_destination';
}

export function companionViewportResetKey(input: {
  creatureId: string;
  destination: CompanionDestination | null;
  questMode: CompanionQuestViewModel['mode'];
  activeQuestTitle?: string | null;
  journeyNodeId?: string | null;
  reviewItemId?: string | null;
  activeAttemptId?: string | null;
  memorySaved?: boolean;
}): string {
  return [
    input.creatureId,
    input.destination ?? 'home',
    input.questMode,
    input.activeQuestTitle ?? '',
    input.journeyNodeId ?? '',
    input.reviewItemId ?? '',
    input.activeAttemptId ? 'active-experience' : '',
    input.memorySaved ? 'memory-saved' : '',
  ].join('|');
}

export type CompanionQuestPresentation = {
  backdrop: 'normal' | 'strong';
  layout: 'standard' | 'fullBleed';
  startsImmediately: boolean;
};

export function companionQuestPresentation(
  execution: InteractiveQuestExecution | null,
): CompanionQuestPresentation {
  const fullBleed = Boolean(
    (execution?.kind === 'matching' && execution.packId === 'mossprout-garden') ||
    (execution?.kind === 'merge' && execution.packId === 'feastle-kitchen') ||
    (execution?.kind === 'block_jam' && execution.packId === 'tasklet-desk'),
  );
  return {
    backdrop: execution?.kind === 'block_blast' ? 'strong' : 'normal',
    layout: fullBleed ? 'fullBleed' : 'standard',
    startsImmediately: execution !== null,
  };
}

export function companionQuestUsesFullBleed(execution: InteractiveQuestExecution | null): boolean {
  return companionQuestPresentation(execution).layout === 'fullBleed';
}

export function companionQuestSkipsPreview(execution: InteractiveQuestExecution | null): boolean {
  return companionQuestPresentation(execution).startsImmediately;
}

export function companionQuestBackAction(input: {
  activeAttemptId?: string | null;
  experienceOpen: boolean;
}): 'confirm_attempt_exit' | 'return_to_do' | 'close_sheet' {
  if (input.activeAttemptId) return 'confirm_attempt_exit';
  if (input.experienceOpen) return 'return_to_do';
  return 'close_sheet';
}

export function buildCompanionQuestViewModel(input: {
  activeQuest: { title: string; hint: string; semanticInput?: boolean; journalInput?: boolean; journalFallback?: boolean; assistedJournalInput?: boolean } | null;
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
  if (questComplete || runtime?.complete) {
    return {
      mode: 'complete', runtimeState: runtime?.state, eyebrow: 'Quest complete', title: activeQuest.title,
      message: questComplete
        ? 'Your entry matched and has been submitted.'
        : 'You found what this quest was looking for.',
      rewardLabel: 'Bond strengthened', statusLabel: 'Complete', statusTone: 'success',
      criteria, evidence: items,
      primaryAction: questComplete ? null : { kind: 'report', label: 'Report back', icon: 'sparkles' },
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
  const blocked = runtime?.state === 'blocked_permission' || runtime?.state === 'unavailable' || runtime?.state === 'impossible_today';
  return {
    mode: blocked ? 'blocked' : 'active', runtimeState: runtime?.state,
    eyebrow: blocked ? questStateEyebrow(runtime?.state) : 'Quest in progress', title: activeQuest.title,
    message: runtime?.userMessage || activeQuest.hint,
    statusLabel: runtime ? questStatusLabel(runtime) : 'In progress',
    statusTone: runtime?.state === 'impossible_today' ? 'danger' : blocked ? 'warning' : 'neutral',
    criteria, evidence: items, captureFeedback,
    semanticInput: Boolean(activeQuest.semanticInput),
    journalInput: Boolean(activeQuest.journalInput ?? activeQuest.semanticInput),
    journalFallback: Boolean(activeQuest.journalFallback),
    assistedJournalInput: Boolean(activeQuest.assistedJournalInput),
    primaryAction: runtime && runtime.nextAction !== 'none'
      ? { kind: 'quest_action', label: questActionLabel(runtime.nextAction), icon: questActionIcon(runtime.nextAction), nextAction: runtime.nextAction }
      : null,
  };
}

export function companionQuestInlineNoteAction(
  model: CompanionQuestViewModel
): Extract<NonNullable<CompanionQuestViewModel['primaryAction']>, { kind: 'quest_action' }> | null {
  const action = model.primaryAction;
  if (
    (model.mode !== 'active' && model.mode !== 'blocked') ||
    !model.journalInput ||
    action?.kind !== 'quest_action' ||
    (action.nextAction !== 'add_note' && action.nextAction !== 'record_voice')
  ) {
    return null;
  }
  return action;
}

export function companionQuestInlinePhotoAction(
  model: CompanionQuestViewModel
): Extract<NonNullable<CompanionQuestViewModel['primaryAction']>, { kind: 'quest_action' }> | null {
  const action = model.primaryAction;
  if (
    (model.mode !== 'active' && model.mode !== 'blocked') ||
    action?.kind !== 'quest_action' ||
    (action.nextAction !== 'take_photo' && action.nextAction !== 'enable_camera' && action.nextAction !== 'enable_photos')
  ) {
    return null;
  }
  return action;
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
