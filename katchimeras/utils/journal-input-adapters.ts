import type { JournalRouteProposal, JournalSource } from '@/types/home';
import type { InterpretedNote } from '@/utils/note-interpret';
import { interpretNote } from '@/utils/note-interpret';
import type { JournalAnalysisContext, JournalDraftSeed, JournalInputAdapter, JournalSourceAnalysis } from '@/utils/journal-domain';
import { journalRouteForAlias, journalRouteForQuality, rankJournalRoutes } from '@/utils/journal-routing';

export type NoteJournalInput = {
  source: Extract<JournalSource, { kind: 'text_note' | 'voice_note' }>;
  text?: string;
  audioUri?: string;
};

export const manualJournalInputAdapter: JournalInputAdapter<{ source: Extract<JournalSource, { kind: 'manual' }> }> = {
  kind: 'manual',
  async analyze() { return { routes: [] }; },
  seedDraft(input) { return { source: input.source, flowId: null, categoryId: null, fields: {}, feeling: null, note: null, attachments: [], confirmedFacets: [] }; },
};

export type PhotoJournalInput = {
  source: Extract<JournalSource, { kind: 'photo' }>;
  routes: JournalRouteProposal[];
  suggestedSpecific?: string | null;
};

export const photoJournalInputAdapter: JournalInputAdapter<PhotoJournalInput> = {
  kind: 'photo',
  async analyze(input) { return { routes: input.routes, suggestedSpecific: input.suggestedSpecific }; },
  seedDraft(input, analysis) {
    const route = analysis.routes[0];
    return { source: input.source, flowId: route?.flowId ?? null, categoryId: route?.choiceId ?? null, fields: { specific: analysis.suggestedSpecific ?? null }, confirmedFacets: route?.confirmedFacets ?? [] };
  },
};

export const noteJournalInputAdapter: JournalInputAdapter<NoteJournalInput> = {
  kind: 'text_note',
  async analyze(input, context) {
    const interpreted = await interpretNote(
      input.text?.trim() ? { text: input.text.trim() } : { audioUri: input.audioUri },
      { allowRemote: context.allowRemote }
    );
    return noteAnalysis(interpreted);
  },
  seedDraft(input, analysis) {
    return seedNoteDraft(input, analysis);
  },
};

export const voiceJournalInputAdapter: JournalInputAdapter<NoteJournalInput> = {
  ...noteJournalInputAdapter,
  kind: 'voice_note',
};

export function noteAnalysis(interpreted: InterpretedNote): JournalSourceAnalysis {
  const ranked = noteRoutesForSignals(interpreted);
  return {
    routes: ranked,
    suggestedSpecific: interpreted.media?.title ?? interpreted.food ?? interpreted.label ?? null,
    transcript: interpreted.transcript,
  };
}

export function noteRoutesForSignals(input: {
  semanticCategoryId?: string | null;
  semanticConfidence?: number | null;
  media?: InterpretedNote['media'];
  food?: string | null;
  bigMoment?: { type: string; subject?: string | null };
  llmClassified?: boolean;
}): JournalRouteProposal[] {
  const routes: Array<JournalRouteProposal | null> = [];
  if (input.semanticCategoryId) routes.push(journalRouteForQuality(input.semanticCategoryId, input.semanticConfidence ?? 0.72, 'Natural Language matched this category'));
  if (input.media?.mediaType) routes.push(journalRouteForAlias(input.media.mediaType, input.llmClassified ? 0.9 : 0.78, 'The note explicitly describes media'));
  if (input.food) routes.push(journalRouteForQuality('subject.food', input.llmClassified ? 0.9 : 0.78, 'The note explicitly describes food'));
  if (input.bigMoment?.type) routes.push(journalRouteForAlias(input.bigMoment.type, 0.86, 'The note describes a milestone'));
  return rankJournalRoutes(routes);
}

function seedNoteDraft(input: NoteJournalInput, analysis: JournalSourceAnalysis): JournalDraftSeed {
  const route = analysis.routes[0];
  return {
    source: input.source,
    flowId: route?.flowId ?? null,
    categoryId: route?.choiceId ?? null,
    fields: { specific: analysis.suggestedSpecific ?? null, context: null },
    note: analysis.transcript ?? input.text ?? null,
    confirmedFacets: route?.confirmedFacets ?? [],
    attachments: [{
      id: `attachment:${input.source.sourceId}`,
      kind: input.source.kind === 'voice_note' ? 'voice' : 'text',
      text: analysis.transcript ?? input.text ?? null,
      uri: input.source.kind === 'voice_note' ? input.source.audioUri ?? input.audioUri ?? null : null,
      durationMs: input.source.kind === 'voice_note' ? input.source.durationMs ?? null : null,
    }],
  };
}
