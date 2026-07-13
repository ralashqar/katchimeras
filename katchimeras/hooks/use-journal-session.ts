import { useMemo, useReducer } from 'react';

import type { JournalSource } from '@/types/home';
import { createJournalSession, journalDraftIsDirty, journalSessionReducer } from '@/utils/journal-session';

export function useJournalSession(input: { sessionId: string; source: JournalSource; flowId?: string | null; categoryId?: string | null; specific?: string | null }) {
  const initial = useMemo(() => createJournalSession(input), [input.categoryId, input.flowId, input.sessionId, input.source, input.specific]);
  const [state, dispatch] = useReducer(journalSessionReducer, initial);
  return { state, dispatch, dirty: journalDraftIsDirty(state.draft) };
}
