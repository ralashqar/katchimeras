import type { JournalAttachment, JournalDraft, JournalSource } from '@/types/home';

export type JournalStage = 'flow' | 'category' | 'details';
export type JournalSessionState = {
  stage: JournalStage;
  direction: 1 | -1;
  draft: JournalDraft;
};

export type JournalSessionAction =
  | { type: 'select_flow'; flowId: string }
  | { type: 'select_category'; categoryId: string }
  | { type: 'set_field'; key: string; value: string | string[] | boolean | null }
  | { type: 'set_feeling'; value: string | null }
  | { type: 'set_note'; value: string | null }
  | { type: 'set_attachments'; value: JournalAttachment[] }
  | { type: 'back' }
  | { type: 'reset_category' };

export function createJournalSession(input: {
  sessionId: string;
  source: JournalSource;
  flowId?: string | null;
  categoryId?: string | null;
  specific?: string | null;
}): JournalSessionState {
  return {
    stage: input.categoryId ? 'details' : input.flowId ? 'category' : 'flow',
    direction: 1,
    draft: {
      sessionId: input.sessionId,
      source: input.source,
      flowId: input.flowId ?? null,
      categoryId: input.categoryId ?? null,
      fields: { specific: input.specific ?? null, context: null },
      feeling: null,
      note: null,
      attachments: [],
      confirmedFacets: [],
    },
  };
}

export function journalSessionReducer(state: JournalSessionState, action: JournalSessionAction): JournalSessionState {
  switch (action.type) {
    case 'select_flow':
      return { stage: 'category', direction: 1, draft: { ...state.draft, flowId: action.flowId, categoryId: null } };
    case 'select_category':
      return {
        stage: 'details', direction: 1,
        draft: { ...state.draft, categoryId: action.categoryId, fields: { specific: null, context: null }, feeling: null, note: null, attachments: [] },
      };
    case 'set_field':
      return { ...state, draft: { ...state.draft, fields: { ...state.draft.fields, [action.key]: action.value } } };
    case 'set_feeling': return { ...state, draft: { ...state.draft, feeling: action.value } };
    case 'set_note': return { ...state, draft: { ...state.draft, note: action.value } };
    case 'set_attachments': return { ...state, draft: { ...state.draft, attachments: action.value } };
    case 'reset_category': return { stage: 'category', direction: -1, draft: { ...state.draft, categoryId: null } };
    case 'back':
      if (state.stage === 'details') return { stage: 'category', direction: -1, draft: state.draft };
      if (state.stage === 'category') return { stage: 'flow', direction: -1, draft: { ...state.draft, flowId: null, categoryId: null } };
      return state;
  }
}

export function journalDraftIsDirty(draft: JournalDraft): boolean {
  return !!draft.categoryId || !!draft.feeling || !!draft.note?.trim() || draft.attachments.length > 0 || Object.values(draft.fields).some((value) => Array.isArray(value) ? value.length > 0 : typeof value === 'string' ? !!value.trim() : !!value);
}
