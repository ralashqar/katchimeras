import { requireOptionalNativeModule } from 'expo-modules-core';

import { interpretNoteText, type NoteArchetype } from '@/utils/note-meaning';
import type { JournalNoteClassification, JournalRouteProposal, StudioMediaType } from '@/types/home';
import {
  classificationForResolvedRoute,
  journalRouteForKey,
  type FoundationAtomicRouteRead,
} from '@/utils/journal-routing';
import {
  classifyNoteRouteWithRunner as runAtomicFoundationRoute,
  emptyFoundationRouteRun,
  type FoundationConfidenceLevel,
  type FoundationRouteRun,
  type StructuredNoteTask,
} from '@/utils/foundation-note-routing';
import { saveDevLastNoteAnalysis, type DevNoteAnalysisStatus } from '@/utils/dev-note-analysis';
import { MANUAL_JOURNAL_FLOWS } from '@/utils/manual-journal-registry';

// On-device interpretation of a note (typed or voice transcript) via Apple
// Foundation Models (modules/katchimera-foundation). Present only on iOS 26+
// Apple-Intelligence devices; null everywhere else, so callers fall back to
// the cloud / rules. The text never leaves the device.
//
// One call returns the note's title + feeling AND its classification: whether
// it mentions a work of media (with the real, correctly-capitalized title from
// the model's world knowledge) and whether it's about food. `llmClassified`
// is true only when the classification fields were present — an OLD native
// build returns just {label, archetype}, and the caller then falls back to
// the deterministic regex classifier.
type FoundationNoteRaw = Record<string, unknown> & {
  label?: unknown;
  archetype?: unknown;
  mediaKind?: unknown;
  mediaTitle?: unknown;
  mediaCreator?: unknown;
  food?: unknown;
  classificationKind?: unknown;
  flowId?: unknown;
  categoryId?: unknown;
  specific?: unknown;
  context?: unknown;
  journalFeeling?: unknown;
  routeKey?: unknown;
  alternativeRouteKey?: unknown;
  routeConfidence?: unknown;
  alternativeRouteConfidence?: unknown;
  noteSchemaVersion?: unknown;
};

type FoundationNoteModule = {
  isAvailable: () => boolean;
  generateStructuredAsync?: (requestJson: string) => Promise<string>;
  interpretNoteAsync: (transcript: string) => Promise<FoundationNoteRaw>;
  classifyNoteRouteAsync?: (transcript: string) => Promise<FoundationAtomicRouteRead & { noteSchemaVersion?: unknown }>;
};

const nativeFoundation = requireOptionalNativeModule<FoundationNoteModule>('KatchimeraFoundation');

const VALID_ARCHETYPES: NoteArchetype[] = ['calm', 'energy', 'together', 'meaningful'];
const VALID_MEDIA_KINDS: StudioMediaType[] = ['book', 'film', 'show', 'game', 'music', 'art', 'other'];
const FIRST_PASS_TIMEOUT_MS = 3000;
const TOTAL_TIMEOUT_MS = 9000;
export type { FoundationConfidenceLevel } from '@/utils/foundation-note-routing';

export type OnDeviceNoteRead = {
  archetype: NoteArchetype;
  label: string;
  // Present (possibly null) ONLY when llmClassified — null means "the model
  // says this note is not about a media work".
  media: { mediaType: StudioMediaType; title: string | null; creator: string | null } | null;
  // The dish/drink phrase when the note is about food, else null.
  food: string | null;
  // The model actually classified this note (new native build responded with
  // the classification fields). When false, callers use the rule fallback.
  llmClassified: boolean;
  journalClassification: JournalNoteClassification | null;
  journalRoutes: JournalRouteProposal[];
  suggestedJournalFlowId: string | null;
  topLevelConfidence: FoundationConfidenceLevel | null;
  subcategoryConfidence: FoundationConfidenceLevel | null;
};

export function isFoundationNoteAvailable(): boolean {
  try {
    return nativeFoundation?.isAvailable() === true;
  } catch {
    return false;
  }
}

function cleanShort(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length > 0 && text.length <= max ? text : null;
}

// Ask the on-device model for a title + feeling + classification. Returns null
// (fast) when unavailable, on timeout, or on any malformed result — the caller
// then falls back to the cloud interpreter / rules.
export async function interpretNoteOnDevice(transcript: string): Promise<OnDeviceNoteRead | null> {
  const text = transcript.trim();
  if (!text) return null;
  const startedAt = Date.now();
  const foundationAvailable = isFoundationNoteAvailable();
  if (!nativeFoundation?.interpretNoteAsync || !foundationAvailable) {
    recordDevNote(text, startedAt, foundationAvailable, 'unavailable', nativeFoundation?.interpretNoteAsync ? 'foundation_model_unavailable' : 'native_note_reader_missing');
    return null;
  }
  try {
    // Route first in one constrained atomic-category call. Optional
    // title/feeling enrichment must not control journal navigation.
    const routeRun = await classifyNoteRouteOnDevice(text, TOTAL_TIMEOUT_MS);
    const remainingForRead = Math.max(0, TOTAL_TIMEOUT_MS - (Date.now() - startedAt));
    const readTimeout = Math.min(FIRST_PASS_TIMEOUT_MS, remainingForRead);
    const outcome = readTimeout >= 500
      ? await Promise.race([
          nativeFoundation.interpretNoteAsync(text)
            .then((raw) => ({ kind: 'response' as const, raw }))
            .catch(() => ({ kind: 'error' as const })),
          new Promise<{ kind: 'timeout' }>((resolve) => setTimeout(() => resolve({ kind: 'timeout' }), readTimeout)),
        ])
      : { kind: 'skipped' as const };
    const raw: FoundationNoteRaw = outcome.kind === 'response' ? outcome.raw : {};
    const firstPassDurationMs = outcome.kind === 'skipped'
      ? null
      : Math.max(0, Date.now() - startedAt - routeRun.durationMs);
    const generatedLabel = typeof raw.label === 'string' ? raw.label.trim() : '';
    const generatedArchetype = typeof raw.archetype === 'string' ? raw.archetype.trim().toLowerCase() : '';
    const richResponseValid = !!generatedLabel && generatedLabel.length <= 40 && VALID_ARCHETYPES.includes(generatedArchetype as NoteArchetype);
    const localPresentation = richResponseValid ? null : interpretNoteText(text);
    const label = richResponseValid ? generatedLabel : localPresentation!.label;
    const archetype = richResponseValid ? generatedArchetype as NoteArchetype : localPresentation!.archetype;

    const retryRaw = routeRun.raw;
    const retryDurationMs = routeRun.durationMs;
    const retryFailure = routeRun.failure;
    const journalRoutes = retryRaw?.routeKey
      ? [journalRouteForKey(
          String(retryRaw.routeKey),
          confidenceValue(routeRun.subcategoryConfidence),
          `Apple Foundation selected this category with ${routeRun.subcategoryConfidence ?? 'unknown'} confidence`
        )].filter((route): route is JournalRouteProposal => !!route)
      : [];
    const selected = routeRun.subcategoryConfidence === 'high' ? journalRoutes[0] ?? null : null;

    // Enrichment cannot independently turn a note into media or food. Only
    // expose those values after the atomic journal route is accepted.
    const mediaKind = typeof raw.mediaKind === 'string' ? raw.mediaKind.trim().toLowerCase() : null;
    const llmClassified = mediaKind === 'none' || VALID_MEDIA_KINDS.includes(mediaKind as StudioMediaType);
    const media =
      selected?.flowId === 'studio' && llmClassified && mediaKind !== 'none'
        ? {
            mediaType: mediaKind as StudioMediaType,
            title: cleanShort(raw.mediaTitle, 80),
            creator: cleanShort(raw.mediaCreator, 60),
          }
        : null;
    const food = selected?.flowId === 'food' && llmClassified ? cleanShort(raw.food, 60) : null;
    const selectedRaw = retryRaw ? { ...raw, ...retryRaw } : raw;
    const journalClassification = selected
      ? classificationForResolvedRoute(selected, selectedRaw, 'foundation')
      : null;
    const status: DevNoteAnalysisStatus = journalClassification
      ? 'classified'
      : journalRoutes.length || routeRun.suggestedFlowId ? 'ambiguous' : 'unrouted';
    const focusedRouteUsed = !!cleanString(retryRaw?.routeKey);
    const firstPassFailure = outcome.kind === 'timeout'
      ? `foundation_enrichment_exceeded_${readTimeout}ms`
      : outcome.kind === 'error'
        ? 'foundation_note_read_error'
        : outcome.kind === 'skipped'
          ? 'foundation_note_read_skipped_after_route'
        : richResponseValid
          ? null
          : 'missing_or_invalid_label_or_archetype';
    const fallbackReason = retryFailure
        ? `atomic_route_${retryFailure}`
      : focusedRouteUsed && routeRun.subcategoryConfidence !== 'high'
        ? `atomic_${routeRun.subcategoryConfidence ?? 'invalid'}_needs_confirmation`
      : !richResponseValid && focusedRouteUsed
        ? `${firstPassFailure ?? 'invalid_rich_response'}_atomic_route_used`
      : focusedRouteUsed
        ? 'atomic_foundation_route_used'
      : status === 'ambiguous'
        ? 'route_candidates_need_confirmation'
      : status === 'unrouted'
          ? 'no_valid_atomic_foundation_route'
          : null;
    recordDevNote(
      text,
      startedAt,
      true,
      status,
      fallbackReason,
      raw,
      journalClassification,
      media,
      food,
      retryRaw,
      journalRoutes,
      firstPassDurationMs,
      retryDurationMs,
      routeRun
    );

    // A failed enrichment read must not erase a successful Foundation route.
    // The local presentation is used only for a temporary title/mood on old
    // builds; journalClassification and journalRoutes remain Foundation output.
    if (!richResponseValid && !journalClassification && !routeRun.suggestedFlowId) return null;
    return {
      archetype,
      label,
      media,
      food,
      llmClassified,
      journalClassification,
      journalRoutes,
      suggestedJournalFlowId: routeRun.suggestedFlowId,
      topLevelConfidence: routeRun.topLevelConfidence,
      subcategoryConfidence: routeRun.subcategoryConfidence,
    };
  } catch (error) {
    recordDevNote(text, startedAt, true, 'native_error', error instanceof Error ? error.message : 'unknown_native_error');
    return null;
  }
}

async function classifyNoteRouteOnDevice(transcript: string, timeoutMs: number): Promise<FoundationRouteRun> {
  if (!nativeFoundation?.generateStructuredAsync) return emptyFoundationRouteRun(0, 'error');
  return runAtomicFoundationRoute(transcript, timeoutMs, runStructuredNoteTask);
}

function confidenceValue(value: FoundationConfidenceLevel | null): number {
  if (value === 'high') return 0.95;
  if (value === 'medium') return 0.6;
  return 0.35;
}

async function runStructuredNoteTask(
  task: StructuredNoteTask,
  timeoutMs: number
): Promise<{ response: Record<string, unknown> | null; failure: 'timeout' | 'error' | null }> {
  if (!nativeFoundation?.generateStructuredAsync || timeoutMs < 500) {
    return { response: null, failure: timeoutMs < 500 ? 'timeout' : 'error' };
  }
  try {
    const responseJson = await Promise.race([
      nativeFoundation.generateStructuredAsync(JSON.stringify({ bridgeVersion: 1, ...task })),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    if (!responseJson) return { response: null, failure: 'timeout' };
    const parsed: unknown = JSON.parse(responseJson);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { response: null, failure: 'error' };
    const response = parsed as Record<string, unknown>;
    return response.status === 'succeeded' && response.taskId === task.taskId
      ? { response, failure: null }
      : { response: null, failure: 'error' };
  } catch {
    return { response: null, failure: 'error' };
  }
}

export async function extractNoteSpecificOnDevice(
  transcript: string,
  route: JournalRouteProposal,
  timeoutMs = 4500
): Promise<string | null> {
  const flow = MANUAL_JOURNAL_FLOWS.find((item) => item.id === route.flowId);
  const choice = flow?.choices.find((item) => item.id === route.choiceId);
  if (!flow || !choice || !nativeFoundation?.generateStructuredAsync) return null;
  const fieldLabel = choice.specificFieldLabel ?? flow.specificFieldLabel;
  try {
    const responseJson = await Promise.race([
      nativeFoundation.generateStructuredAsync(JSON.stringify({
        bridgeVersion: 1,
        taskId: 'note.specific.v1',
        instructions: [
          'Extract one concise editable journal field value from a personal note.',
          'The supplied journal route is already selected and immutable; never reclassify it.',
          'Return the specific entity or title only, not the complete sentence and not commentary.',
          'Preserve the explicitly supplied words and normalize ordinary title casing, but do not complete or guess a title from world knowledge.',
          'Examples: "I ate an apple" becomes "Apple"; "I read Harry Potter" becomes "Harry Potter".',
          'Use an empty string when the note does not support a useful value.',
        ].join(' '),
        prompt: `Locked route: ${route.id}. Editable field: ${fieldLabel}. Note: ${JSON.stringify(transcript)}`,
        fields: [{
          name: 'specific',
          description: `Concise ${fieldLabel.toLowerCase()} explicitly supported by the note; never the whole note`,
          kind: 'string',
        }],
      })),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    if (!responseJson) return null;
    const parsed: unknown = JSON.parse(responseJson);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const rawResponse = parsed as Record<string, unknown>;
    if (rawResponse.status !== 'succeeded' || rawResponse.taskId !== 'note.specific.v1') return null;
    const specific = cleanShort(rawResponse.specific, 120);
    if (!specific || noteSpecificCopiesSentence(specific, transcript)) return null;
    return specific;
  } catch {
    return null;
  }
}

function noteSpecificCopiesSentence(specific: string, transcript: string): boolean {
  const normalizedSpecific = specific.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const normalizedTranscript = transcript.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (normalizedSpecific !== normalizedTranscript) return false;
  return /^(?:i|we|my|our)\b/.test(normalizedTranscript) && normalizedTranscript.split(/\s+/).length >= 3;
}

function recordDevNote(
  transcript: string,
  startedAt: number,
  foundationAvailable: boolean,
  status: DevNoteAnalysisStatus,
  fallbackReason: string | null,
  rawResponse: Record<string, unknown> | null = null,
  normalizedClassification: JournalNoteClassification | null = null,
  normalizedMedia: OnDeviceNoteRead['media'] = null,
  normalizedFood: string | null = null,
  retryResponse: Record<string, unknown> | null = null,
  routeCandidates: JournalRouteProposal[] = [],
  firstPassDurationMs: number | null = null,
  retryDurationMs: number | null = null,
  routeRun: FoundationRouteRun | null = null
): void {
  const schema = rawResponse?.noteSchemaVersion ?? retryResponse?.noteSchemaVersion;
  saveDevLastNoteAnalysis({
    transcript,
    durationMs: Date.now() - startedAt,
    firstPassDurationMs,
    retryDurationMs,
    routingMode: 'foundation_only',
    foundationAvailable,
    nativeNoteSchemaVersion: typeof schema === 'string' && /^\d+$/.test(schema) ? Number(schema) : null,
    status,
    fallbackReason,
    rawResponse,
    normalizedClassification,
    normalizedMedia,
    normalizedFood,
    retryResponse,
    routeCandidates,
    topLevelFlowId: routeRun?.suggestedFlowId ?? null,
    topLevelConfidence: routeRun?.topLevelConfidence ?? null,
    subcategoryConfidence: routeRun?.subcategoryConfidence ?? null,
    topLevelResponse: routeRun?.topLevelResponse ?? null,
    subcategoryResponse: routeRun?.subcategoryResponse ?? null,
  });
}

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
