import type { CompanionReflectionDraft } from '@/types/companion-interaction';
import type { JournalSource, ManualJournalSubmission } from '@/types/home';

export type PreparedCompanionReflection = {
  sourceId: string;
  submission: ManualJournalSubmission;
};

export function prepareCompanionReflection(input: {
  creatureId: string;
  dayId: string;
  draft: CompanionReflectionDraft;
}): PreparedCompanionReflection | null {
  const text = input.draft.text.trim();
  const audioUri = input.draft.audioUri?.trim() || null;
  if (!text && !audioUri) return null;

  // One canonical reflection per companion and day. Repeated taps therefore
  // resolve to the same journal idempotency key instead of duplicating a note
  // or awarding bond more than once.
  const sourceId = `companion-reflection:${input.creatureId}:${input.dayId}`;
  const origin = {
    kind: 'companion_reflection' as const,
    creatureId: input.creatureId,
    promptId: input.draft.promptId,
    promptText: input.draft.promptText,
  };
  const source: Extract<JournalSource, { kind: 'text_note' | 'voice_note' }> = input.draft.kind === 'voice'
    ? {
        kind: 'voice_note',
        sourceId,
        audioUri,
        durationMs: input.draft.durationMs ?? null,
        origin,
      }
    : { kind: 'text_note', sourceId, origin };

  return {
    sourceId,
    submission: {
      sessionId: sourceId,
      flowId: 'general',
      path: ['general', 'other'],
      categoryId: 'other',
      canonicalQualityIds: [],
      fields: { specific: null, context: null },
      feeling: null,
      note: text || null,
      linkedNote: {
        kind: input.draft.kind,
        text,
        audioUri,
        durationMs: input.draft.durationMs ?? null,
      },
      confirmedFacets: [],
      journalSource: source,
    },
  };
}
