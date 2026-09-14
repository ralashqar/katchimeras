import { useCallback, useEffect, useReducer } from 'react';

import type { CompanionDestination } from '@/types/companion-interaction';
import {
  companionInteractionReducer,
  companionRouteBackAction,
  createCompanionInteractionState,
} from '@/utils/companion-interaction';

export function useCompanionExperienceController({
  creatureId,
  initialDestination,
  initialConversation = false,
  onClose,
  onSelectDestination,
}: {
  creatureId: string;
  initialDestination?: CompanionDestination | null;
  initialConversation?: boolean;
  onClose: () => void;
  onSelectDestination?: (destination: CompanionDestination | null) => void;
}) {
  const [state, dispatch] = useReducer(
    companionInteractionReducer,
    { initialDestination, initialConversation },
    createCompanionInteractionState
  );

  useEffect(() => {
    dispatch({ type: 'reset_companion', initialDestination, initialConversation });
    // The opening destination is a launch intent. Destination changes are
    // mirrored outside this controller only so temporary journal routes can
    // restore the page; they must not reset the live navigation stack.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatureId]);

  const selectDestination = useCallback((destination: CompanionDestination) => {
    dispatch({ type: 'select_destination', destination });
    onSelectDestination?.(destination);
  }, [onSelectDestination]);

  const showDashboard = useCallback(() => {
    dispatch({ type: 'show_dashboard' });
    onSelectDestination?.(null);
  }, [onSelectDestination]);
  const showConversation = useCallback(() => {
    dispatch({ type: 'show_conversation' });
    onSelectDestination?.(null);
  }, [onSelectDestination]);

  const requestBack = useCallback(() => {
    const action = companionRouteBackAction(state);
    if (action === 'return_to_home') showDashboard();
    else onClose();
    return action;
  }, [onClose, showDashboard, state]);

  const openQuickGoalPicker = useCallback(() => dispatch({ type: 'open_quick_goal_picker' }), []);
  const openFocusQuestionnaire = useCallback(
    (sessionId?: string | null) => dispatch({ type: 'open_focus_questionnaire', sessionId }),
    []
  );
  const syncJourneySession = useCallback(
    (sessionId: string) => dispatch({ type: 'sync_journey_session', sessionId }),
    []
  );
  const returnToDestination = useCallback(() => dispatch({ type: 'return_to_destination' }), []);

  return {
    state,
    dispatch,
    route: state.route,
    destination: state.destination,
    direction: state.direction,
    quickGoalPickerOpen: state.route.kind === 'quick_goal_picker',
    journeyQuestionnaireOpen: state.route.kind === 'focus_questionnaire',
    journeyQuestionnaireSessionId: state.route.kind === 'focus_questionnaire' ? state.route.sessionId : null,
    selectDestination,
    showHome: showDashboard,
    showDashboard,
    showConversation,
    requestBack,
    openQuickGoalPicker,
    openFocusQuestionnaire,
    syncJourneySession,
    returnToDestination,
  };
}
