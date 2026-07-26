import { useCallback, useEffect, useReducer } from 'react';

import type { CompanionThread } from '@/types/companion-interaction';
import {
  companionInteractionReducer,
  companionRouteBackAction,
  createCompanionInteractionState,
} from '@/utils/companion-interaction';

export function useCompanionExperienceController({
  creatureId,
  initialThread,
  onClose,
  onSelectThread,
}: {
  creatureId: string;
  initialThread: CompanionThread;
  onClose: () => void;
  onSelectThread?: (thread: CompanionThread) => void;
}) {
  const [state, dispatch] = useReducer(
    companionInteractionReducer,
    { initialThread },
    createCompanionInteractionState
  );

  useEffect(() => {
    dispatch({ type: 'reset_companion', initialThread });
  }, [creatureId, initialThread]);

  const selectThread = useCallback((thread: CompanionThread) => {
    dispatch({ type: 'select_thread', thread });
    onSelectThread?.(thread);
  }, [onSelectThread]);

  const requestBack = useCallback(() => {
    const action = companionRouteBackAction(state);
    if (action === 'return_to_thread') dispatch({ type: 'return_to_thread' });
    else if (action === 'close_sheet') onClose();
    return action;
  }, [onClose, state]);

  const openQuickGoalPicker = useCallback(
    () => dispatch({ type: 'open_quick_goal_picker' }),
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
  const returnToThread = useCallback(() => dispatch({ type: 'return_to_thread' }), []);
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
    thread: state.thread,
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
    selectThread,
    requestBack,
    openQuickGoalPicker,
    openJourneyQuestionnaire,
    syncJourneySession,
    openCheckIn,
    openQuestExperience,
    setQuestAttempt,
    returnToThread,
    resetQuestExperience,
    reviewItem,
  };
}
