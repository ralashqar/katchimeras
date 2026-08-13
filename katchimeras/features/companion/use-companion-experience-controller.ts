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

  const showVisit = useCallback(() => {
    dispatch({ type: 'show_visit' });
    onSelectDestination?.(null);
  }, [onSelectDestination]);

  const showDashboard = useCallback(() => {
    dispatch({ type: 'show_dashboard' });
    onSelectDestination?.(null);
  }, [onSelectDestination]);
  const showChatLobby = useCallback(() => {
    dispatch({ type: 'show_chat_lobby' });
    onSelectDestination?.(null);
  }, [onSelectDestination]);
  const showConversation = useCallback(() => {
    dispatch({ type: 'show_conversation' });
    onSelectDestination?.(null);
  }, [onSelectDestination]);
  const openSharedHistory = useCallback(() => dispatch({ type: 'open_shared_history' }), []);

  const requestBack = useCallback(() => {
    const action = companionRouteBackAction(state);
    if (action === 'return_to_destination') dispatch({ type: 'return_to_destination' });
    else if (action === 'return_to_home') showDashboard();
    else if (action === 'return_to_chat_lobby') showChatLobby();
    else if (action === 'close_experience') onClose();
    return action;
  }, [onClose, showChatLobby, showDashboard, state]);

  const openQuickGoalPicker = useCallback(
    () => dispatch({ type: 'open_quick_goal_picker' }),
    []
  );
  const openIntroduction = useCallback(
    () => dispatch({ type: 'open_introduction' }),
    []
  );
  const openJourneyQuestionnaire = useCallback(
    (sessionId?: string | null) => dispatch({ type: 'open_journey_questionnaire', sessionId }),
    []
  );
  const syncJourneySession = useCallback(
    (sessionId: string) => dispatch({ type: 'sync_journey_session', sessionId }),
    []
  );
  const openCheckIn = useCallback(
    (checkInId: string) => dispatch({ type: 'open_check_in', checkInId }),
    []
  );
  const openQuestExperience = useCallback(
    () => dispatch({ type: 'open_quest_experience' }),
    []
  );
  const setQuestAttempt = useCallback(
    (attemptId: string | null) => dispatch({ type: 'set_quest_attempt', attemptId }),
    []
  );
  const returnToDestination = useCallback(
    () => dispatch({ type: 'return_to_destination' }),
    []
  );
  const resetQuestExperience = useCallback(
    () => dispatch({ type: 'reset_quest_experience' }),
    []
  );
  const reviewItem = useCallback(
    (itemId: string | null) => dispatch({ type: 'review_item', itemId }),
    []
  );

  return {
    state,
    dispatch,
    route: state.route,
    destination: state.destination,
    direction: state.direction,
    reviewItemId: state.reviewItemId,
    experienceInstance: state.experienceInstance,
    activeAttemptId: state.route.kind === 'quest_experience' ? state.route.attemptId : null,
    questExperienceOpen: state.route.kind === 'quest_experience',
    quickGoalPickerOpen: state.route.kind === 'quick_goal_picker',
    journeyQuestionnaireOpen: state.route.kind === 'journey_questionnaire',
    journeyQuestionnaireSessionId: state.route.kind === 'journey_questionnaire'
      ? state.route.sessionId
      : null,
    checkInOpen: state.route.kind === 'check_in',
    introductionOpen: state.route.kind === 'introduction',
    selectDestination,
    showHome: showDashboard,
    showDashboard,
    showChatLobby,
    showConversation,
    showVisit,
    openSharedHistory,
    requestBack,
    openQuickGoalPicker,
    openIntroduction,
    openJourneyQuestionnaire,
    syncJourneySession,
    openCheckIn,
    openQuestExperience,
    setQuestAttempt,
    returnToDestination,
    resetQuestExperience,
    reviewItem,
  };
}
