export type JournalModelFlowId =
  | 'place'
  | 'food'
  | 'media'
  | 'movement'
  | 'people'
  | 'work'
  | 'event'
  | 'other';

export function journalModelFlowIdForInternalFlow(flowId: string): JournalModelFlowId | null {
  if (flowId === 'went_somewhere' || flowId === 'place') return 'place';
  if (flowId === 'studio' || flowId === 'media') return 'media';
  if (flowId === 'big_event' || flowId === 'event') return 'event';
  if (flowId === 'general' || flowId === 'other' || flowId === 'ordinary') return 'other';
  if (flowId === 'food' || flowId === 'movement' || flowId === 'people' || flowId === 'work') return flowId;
  return null;
}

export function internalJournalFlowIdForModelFlow(flowId: string): string | null {
  if (flowId === 'place' || flowId === 'went_somewhere') return 'went_somewhere';
  if (flowId === 'media' || flowId === 'studio') return 'studio';
  if (flowId === 'event' || flowId === 'big_event') return 'big_event';
  if (flowId === 'other' || flowId === 'ordinary' || flowId === 'general') return 'general';
  if (flowId === 'food' || flowId === 'movement' || flowId === 'people' || flowId === 'work') return flowId;
  return null;
}
