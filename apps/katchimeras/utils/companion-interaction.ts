import type {
  CompanionInteractionAction,
  CompanionInteractionState,
  CompanionDestination,
} from '@/types/companion-interaction';
import type { ConversationSession } from '@/types/companion-conversation';
import type { InteractiveQuestExecution } from '@/utils/quests/experiences/types';

export function companionInitialConversationCompletionReady(
  session: Pick<ConversationSession, 'definitionId' | 'outcomePresentation' | 'status'> | null | undefined,
  definitionId: string | null | undefined,
): boolean {
  return Boolean(
    definitionId
    && session?.definitionId === definitionId
    && session.status === 'completed'
    // A result is part of the conversation, not post-conversation chrome.
    // FTUE may finish only after the player explicitly dismisses it.
    && !session.outcomePresentation
  );
}

export function createCompanionInteractionState(input: {
  initialDestination?: CompanionDestination | null;
  initialConversation?: boolean;
}): CompanionInteractionState {
  const destination = input.initialDestination ?? null;
  return {
    destination,
    direction: 1,
    route: input.initialConversation
      ? { kind: 'conversation' }
      : destination ? { kind: 'destination', destination } : { kind: 'dashboard' },
  };
}

export function companionInteractionReducer(
  state: CompanionInteractionState,
  action: CompanionInteractionAction
): CompanionInteractionState {
  switch (action.type) {
    case 'select_destination': {
      const order: CompanionDestination[] = ['achievements', 'skins'];
      return {
        ...state,
        destination: action.destination,
        direction: state.destination === null ||
          order.indexOf(action.destination) >= order.indexOf(state.destination) ? 1 : -1,
        route: { kind: 'destination', destination: action.destination },
      };
    }
    case 'show_conversation':
      return { ...state, destination: null, direction: 1, route: { kind: 'conversation' } };
    case 'show_dashboard':
      return { ...state, destination: null, direction: -1, route: { kind: 'dashboard' } };
    case 'open_quick_goal_picker':
      return { ...state, destination: null, route: { kind: 'quick_goal_picker' } };
    case 'open_focus_questionnaire':
      return { ...state, destination: null, route: { kind: 'focus_questionnaire', sessionId: action.sessionId ?? null } };
    case 'sync_journey_session':
      return state.route.kind === 'focus_questionnaire'
        ? { ...state, route: { ...state.route, sessionId: action.sessionId } }
        : state;
    case 'return_to_destination':
      // Every focused flow unwinds to the stage; a side page stays where it is.
      return state.route.kind === 'destination'
        ? state
        : { ...state, destination: null, route: { kind: 'dashboard' } };
    case 'reset_companion':
      return createCompanionInteractionState({ initialDestination: action.initialDestination, initialConversation: action.initialConversation });
  }
}

export type CompanionBackAction = 'return_to_home' | 'close_experience';

/** One source of truth for companion back navigation: the stage closes the page, everything else returns to the stage. */
export function companionRouteBackAction(state: CompanionInteractionState): CompanionBackAction {
  return state.route.kind === 'dashboard' ? 'close_experience' : 'return_to_home';
}

export function companionViewportResetKey(input: {
  creatureId: string;
  destination: CompanionDestination | null;
  journeyNodeId?: string | null;
}): string {
  return [input.creatureId, input.destination ?? 'home', input.journeyNodeId ?? ''].join('|');
}

export type CompanionQuestPresentation = {
  backdrop: 'normal' | 'strong';
  layout: 'standard' | 'fullBleed';
  startsImmediately: boolean;
};

/** How the game hub frames an interactive quest experience. */
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
