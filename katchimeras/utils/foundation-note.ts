import { requireOptionalNativeModule } from 'expo-modules-core';

import { interpretNoteText, type NoteArchetype } from '@/utils/note-meaning';
import type { JournalNoteClassification, JournalRouteProposal, StudioMediaType } from '@/types/home';
import {
  classificationForResolvedRoute,
  foundationNoteRoute,
  journalNoteRouteNeedsConfirmation,
  rankJournalRoutes,
  resolveFoundationRouteEvidence,
  parseFoundationJournalClassification,
  type FoundationAtomicRouteRead,
} from '@/utils/journal-routing';
import { saveDevLastNoteAnalysis, type DevNoteAnalysisStatus } from '@/utils/dev-note-analysis';
import { isFoundationOnlyNoteRoutingEnabled } from '@/utils/dev-settings';
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
const FIRST_PASS_TIMEOUT_MS = 6500;
const TOTAL_TIMEOUT_MS = 9000;

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
  const foundationOnlyRouting = isFoundationOnlyNoteRoutingEnabled();
  const foundationAvailable = isFoundationNoteAvailable();
  if (!nativeFoundation?.interpretNoteAsync || !foundationAvailable) {
    recordDevNote(text, startedAt, foundationAvailable, 'unavailable', nativeFoundation?.interpretNoteAsync ? 'foundation_model_unavailable' : 'native_note_reader_missing');
    return null;
  }
  try {
    const outcome = await Promise.race([
      nativeFoundation.interpretNoteAsync(text)
        .then((raw) => ({ kind: 'response' as const, raw }))
        .catch(() => ({ kind: 'error' as const })),
      new Promise<{ kind: 'timeout' }>((resolve) => setTimeout(() => resolve({ kind: 'timeout' }), FIRST_PASS_TIMEOUT_MS)),
    ]);
    const raw: FoundationNoteRaw = outcome.kind === 'response' ? outcome.raw : {};
    const firstPassDurationMs = Date.now() - startedAt;
    const generatedLabel = typeof raw.label === 'string' ? raw.label.trim() : '';
    const generatedArchetype = typeof raw.archetype === 'string' ? raw.archetype.trim().toLowerCase() : '';
    const richResponseValid = !!generatedLabel && generatedLabel.length <= 40 && VALID_ARCHETYPES.includes(generatedArchetype as NoteArchetype);
    const localPresentation = richResponseValid ? null : interpretNoteText(text);
    const label = richResponseValid ? generatedLabel : localPresentation!.label;
    const archetype = richResponseValid ? generatedArchetype as NoteArchetype : localPresentation!.archetype;

    // Classification: only trust it when the new-build fields are present AND
    // mediaKind is a value we know ('none' = classified as not-media).
    const mediaKind = typeof raw.mediaKind === 'string' ? raw.mediaKind.trim().toLowerCase() : null;
    const llmClassified = mediaKind === 'none' || VALID_MEDIA_KINDS.includes(mediaKind as StudioMediaType);
    const media =
      llmClassified && mediaKind !== 'none'
        ? {
            mediaType: mediaKind as StudioMediaType,
            title: cleanShort(raw.mediaTitle, 80),
            creator: cleanShort(raw.mediaCreator, 60),
          }
        : null;
    const food = llmClassified ? cleanShort(raw.food, 60) : null;
    const parsedLegacy = parseFoundationJournalClassification(raw);
    const firstAtomic: FoundationAtomicRouteRead = cleanString(raw.routeKey)
      ? raw
      : parsedLegacy?.flowId && parsedLegacy.categoryId
        ? {
            routeKey: `${parsedLegacy.flowId}.${parsedLegacy.categoryId}`,
            routeConfidence: parsedLegacy.kind === 'generic' ? 0.68 : 0.9,
            specific: raw.specific,
            context: raw.context,
            journalFeeling: raw.journalFeeling,
          }
        : raw;
    let retryRaw: (FoundationAtomicRouteRead & Record<string, unknown>) | null = null;
    let retryDurationMs: number | null = null;
    let retryFailure: 'timeout' | 'error' | null = null;
    // Routing is a separate Foundation task. Keeping the 75-value route enum
    // out of NoteRead restores the small schema that was reliable before note
    // routing was added. Always run this focused call when the native build
    // exposes it; this also recovers current builds when NoteRead returns {}.
    if (nativeFoundation.classifyNoteRouteAsync) {
      const remaining = Math.max(0, TOTAL_TIMEOUT_MS - (Date.now() - startedAt));
      if (remaining >= 500) {
        const retryStartedAt = Date.now();
        const retry = await Promise.race([
          nativeFoundation.classifyNoteRouteAsync(text)
            .then((value) => ({ kind: 'response' as const, value }))
            .catch(() => ({ kind: 'error' as const })),
          new Promise<{ kind: 'timeout' }>((resolve) => setTimeout(() => resolve({ kind: 'timeout' }), remaining)),
        ]);
        retryDurationMs = Date.now() - retryStartedAt;
        if (retry.kind === 'response') retryRaw = retry.value as FoundationAtomicRouteRead & Record<string, unknown>;
        else retryFailure = retry.kind;
      }
    }
    // When the focused call succeeds it is the sole Foundation routing read.
    // Ignore route fields from schema-v4 NoteRead responses so the retired,
    // overloaded call cannot compete with the dedicated route decision.
    const focusedAtomic = cleanString(retryRaw?.routeKey) ? retryRaw : null;
    const decision = resolveFoundationRouteEvidence(
      text,
      focusedAtomic ? null : firstAtomic,
      focusedAtomic,
      { includeRegistryEvidence: !foundationOnlyRouting }
    );
    const mediaRoute = media
      ? foundationNoteRoute({ provider: 'appleFoundation', llmClassified, mediaType: media.mediaType })
      : null;
    const journalRoutes = decision.routes.length ? decision.routes : rankJournalRoutes([mediaRoute]);
    const selected = decision.selected ?? (journalRoutes.length === 1 && !journalNoteRouteNeedsConfirmation(journalRoutes) ? journalRoutes[0] : null);
    const selectedFoundationRaw = retryRaw ? { ...raw, ...retryRaw } : raw;
    const hasGeneratedSpecific = !!(
      cleanShort(selectedFoundationRaw.specific, 120)
      || media?.title
      || food
    );
    if (selected && !hasGeneratedSpecific && nativeFoundation.generateStructuredAsync) {
      const remaining = Math.max(0, TOTAL_TIMEOUT_MS - (Date.now() - startedAt));
      if (remaining >= 500) {
        const enrichment = await enrichNoteSpecificOnDevice(text, selected, remaining);
        if (enrichment?.specific) {
          retryRaw = {
            ...(retryRaw ?? {}),
            specific: enrichment.specific,
            specificEnrichment: enrichment.rawResponse,
          };
        }
      }
    }
    const selectedRaw = retryRaw ? { ...raw, ...retryRaw } : raw;
    const classificationSource = cleanString(raw.routeKey) || cleanString(retryRaw?.routeKey)
      ? decision.decisionSource
      : 'legacy';
    const journalClassification = selected
      ? classificationForResolvedRoute(selected, selectedRaw, classificationSource)
      : null;
    const status: DevNoteAnalysisStatus = journalClassification
      ? mediaRoute && !decision.routes.length ? 'media_fallback' : 'classified'
      : journalRoutes.length ? 'ambiguous' : 'unrouted';
    const focusedRouteUsed = !!cleanString(retryRaw?.routeKey);
    const firstPassFailure = outcome.kind === 'timeout'
      ? `foundation_exceeded_${FIRST_PASS_TIMEOUT_MS}ms`
      : outcome.kind === 'error'
        ? 'foundation_note_read_error'
        : richResponseValid
          ? null
          : 'missing_or_invalid_label_or_archetype';
    const fallbackReason = !richResponseValid && focusedRouteUsed
      ? `${firstPassFailure ?? 'invalid_rich_response'}_focused_route_used`
      : focusedRouteUsed
        ? 'split_foundation_route_used'
      : retryFailure
        ? `focused_route_retry_${retryFailure}`
      : status === 'ambiguous'
        ? 'route_candidates_need_confirmation'
        : status === 'media_fallback'
          ? 'structured_route_missing_using_media_kind'
          : status === 'unrouted'
            ? 'no_valid_structured_route_or_supported_fallback'
            : null;
    recordDevNote(text, startedAt, true, status, fallbackReason, raw, journalClassification, media, food, retryRaw, journalRoutes, firstPassDurationMs, retryDurationMs);

    // A failed enrichment read must not erase a successful Foundation route.
    // The local presentation is used only for a temporary title/mood on old
    // builds; journalClassification and journalRoutes remain Foundation output.
    if (!richResponseValid && !journalClassification) return null;
    return { archetype, label, media, food, llmClassified, journalClassification, journalRoutes };
  } catch (error) {
    recordDevNote(text, startedAt, true, 'native_error', error instanceof Error ? error.message : 'unknown_native_error');
    return null;
  }
}

async function enrichNoteSpecificOnDevice(
  transcript: string,
  route: JournalRouteProposal,
  timeoutMs: number
): Promise<{ specific: string; rawResponse: Record<string, unknown> } | null> {
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
          'Preserve or restore normal title casing. You may safely normalize an explicitly named work using knowledge, but never invent an absent entity.',
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
    return { specific, rawResponse };
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
  retryDurationMs: number | null = null
): void {
  const schema = rawResponse?.noteSchemaVersion ?? retryResponse?.noteSchemaVersion;
  saveDevLastNoteAnalysis({
    transcript,
    durationMs: Date.now() - startedAt,
    firstPassDurationMs,
    retryDurationMs,
    routingMode: isFoundationOnlyNoteRoutingEnabled() ? 'foundation_only' : 'hybrid',
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
  });
}

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
