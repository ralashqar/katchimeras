import type { CompanionReflectionDraft } from '@/types/companion-interaction';
import type { JournalSource, ManualJournalSubmission } from '@/types/home';
import { companionCheckInSummary } from '@/utils/companion-check-in';
import type { CompanionJourneyCheckIn } from '@/utils/companion-journey';

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

export function prepareCompanionCheckInReflection(input: {
  checkIn: CompanionJourneyCheckIn;
  note?: CompanionReflectionDraft | null;
}): PreparedCompanionReflection | null {
  const summary = companionCheckInSummary(input.checkIn);
  if (!input.checkIn.completedAt || !summary) return null;
  const noteText = input.note?.text.trim() ?? '';
  const audioUri = input.note?.audioUri?.trim() || null;
  const sourceId = `companion-reflection:${input.checkIn.companionId}:${input.checkIn.dayId}`;
  const origin = {
    kind: 'companion_reflection' as const,
    creatureId: input.checkIn.companionId,
    familyId: input.checkIn.familyId,
    goalId: input.checkIn.goalId,
    checkInId: input.checkIn.id,
    answerIds: input.checkIn.answers.map((answer) => `${answer.questionId}:${answer.optionId}`),
    promptId: `companion-check-in:${input.checkIn.familyId}`,
    promptText: 'Three-question companion check-in',
  };
  const kind = input.note?.kind === 'voice' && audioUri ? 'voice' as const : 'text' as const;
  const linkedText = [summary, noteText].filter(Boolean).join('\n\n');
  const source: Extract<JournalSource, { kind: 'text_note' | 'voice_note' }> = kind === 'voice'
    ? {
        kind: 'voice_note',
        sourceId,
        audioUri,
        durationMs: input.note?.durationMs ?? null,
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
      fields: {
        specific: summary,
        context: input.checkIn.goalId,
        reflection_answers: input.checkIn.answers.map((answer) => answer.label),
      },
      feeling: null,
      note: noteText || summary,
      linkedNote: {
        kind,
        text: linkedText,
        audioUri,
        durationMs: input.note?.durationMs ?? null,
      },
      confirmedFacets: [],
      journalSource: source,
    },
  };
}
