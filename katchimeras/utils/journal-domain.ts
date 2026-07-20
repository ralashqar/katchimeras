import type {
  JournalAttachment,
  JournalCommitCommand,
  JournalDraft,
  JournalInputKind,
  JournalLocationSelection,
  JournalRecord,
  JournalRouteProposal,
  JournalSource,
  ManualJournalSubmission,
} from '@/types/home';
import { manualJournalFlow } from '@/utils/manual-journal-registry';

export type JournalAnalysisContext = { allowRemote?: boolean };
export type JournalSourceAnalysis = {
  routes: JournalRouteProposal[];
  suggestedSpecific?: string | null;
  suggestedContext?: string | null;
  suggestedFeeling?: string | null;
  transcript?: string | null;
};
export type JournalDraftSeed = Pick<JournalDraft, 'source'> & Partial<Omit<JournalDraft, 'source'>>;

export interface JournalInputAdapter<Input> {
  kind: JournalInputKind;
  analyze(input: Input, context: JournalAnalysisContext): Promise<JournalSourceAnalysis>;
  seedDraft(input: Input, analysis: JournalSourceAnalysis): JournalDraftSeed;
}

export function journalIdempotencyKey(source: JournalSource, sessionId: string): string {
  return source.kind === 'photo' ? `photo:${source.sourceId}` : `${source.kind}:${source.sourceId || sessionId}`;
}

export function journalRecordId(idempotencyKey: string): string {
  return `journal:${stableHash(idempotencyKey)}`;
}

export function submissionToJournalCommand(submission: ManualJournalSubmission, now: Date): JournalCommitCommand | null {
  const flow = manualJournalFlow(submission.flowId);
  const choice = flow?.choices.find((item) => item.id === submission.categoryId);
  if (!flow || !choice) return null;
  const sessionId = submission.sessionId ?? `${now.getTime().toString(36)}-${submission.flowId}`;
  const source: JournalSource = submission.journalSource ?? (submission.sourceType === 'photo' && submission.sourceId
    ? { kind: 'photo', sourceId: submission.sourceId, thumbnailUri: submission.thumbnailUri ?? null }
    : { kind: 'manual', sourceId: submission.sourceId ?? sessionId });
  const attachments: JournalAttachment[] = [];
  if (source.kind === 'photo') attachments.push({ id: `photo:${stableHash(source.sourceId)}`, kind: 'photo', uri: source.thumbnailUri ?? source.sourceId });
  if (submission.linkedNote && (submission.linkedNote.text.trim() || submission.linkedNote.audioUri)) {
    attachments.push({
      id: `attachment:${stableHash(`${sessionId}:note`)}`,
      kind: submission.linkedNote.kind,
      text: submission.linkedNote.text.trim() || null,
      uri: submission.linkedNote.audioUri ?? null,
      durationMs: submission.linkedNote.durationMs ?? null,
    });
  }
  const draft: JournalDraft = {
    sessionId,
    source,
    flowId: flow.id,
    categoryId: choice.id,
    fields: submission.fields,
    feeling: submission.feeling ?? null,
    note: submission.note?.trim() || null,
    attachments,
    confirmedFacets: submission.confirmedFacets ?? choice.confirmedFacets ?? [],
    location: flow.adapter === 'place' ? sanitizeJournalLocation(submission.location) : null,
  };
  return { idempotencyKey: journalIdempotencyKey(source, sessionId), draft };
}

export function commandToJournalRecord(command: JournalCommitCommand, now: Date): JournalRecord | null {
  const { draft } = command;
  if (!draft.flowId || !draft.categoryId) return null;
  const flow = manualJournalFlow(draft.flowId);
  const choice = flow?.choices.find((item) => item.id === draft.categoryId);
  if (!flow || !choice) return null;
  return {
    id: journalRecordId(command.idempotencyKey),
    schemaVersion: 1,
    idempotencyKey: command.idempotencyKey,
    source: draft.source,
    flowId: flow.id,
    flowVersion: flow.version,
    categoryId: choice.id,
    canonicalQualityIds: choice.qualityIds ?? [],
    fields: draft.fields,
    feeling: draft.feeling,
    note: draft.note,
    attachments: draft.attachments,
    confirmedFacets: draft.confirmedFacets,
    location: flow.adapter === 'place' ? sanitizeJournalLocation(draft.location) : null,
    createdAt: now.toISOString(),
  };
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function sanitizeJournalLocation(value?: JournalLocationSelection | null): JournalLocationSelection | null {
  if (!value) return null;
  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  const name = value.name.trim().slice(0, 160);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || !name) return null;
  const address = value.address?.trim().slice(0, 320) || null;
  const placeId = value.placeId?.trim().slice(0, 500) || null;
  const accuracyMeters = value.accuracyMeters != null && Number.isFinite(value.accuracyMeters) && value.accuracyMeters >= 0
    ? Math.min(value.accuracyMeters, 100_000)
    : null;
  return { latitude, longitude, name, address, placeId, source: value.source, accuracyMeters };
}
