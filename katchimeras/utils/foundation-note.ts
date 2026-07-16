import { requireOptionalNativeModule } from 'expo-modules-core';

import { type NoteArchetype } from '@/utils/note-meaning';
import type { JournalNoteClassification, JournalRouteProposal, StudioMediaType } from '@/types/home';
import {
  classificationForResolvedRoute,
  foundationAtomicNeedsRetry,
  foundationNoteRoute,
  journalNoteRouteNeedsConfirmation,
  rankJournalRoutes,
  resolveFoundationRouteEvidence,
  parseFoundationJournalClassification,
  type FoundationAtomicRouteRead,
} from '@/utils/journal-routing';
import { saveDevLastNoteAnalysis, type DevNoteAnalysisStatus } from '@/utils/dev-note-analysis';
import { isFoundationOnlyNoteRoutingEnabled } from '@/utils/dev-settings';

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
type FoundationNoteModule = {
  isAvailable: () => boolean;
  interpretNoteAsync: (transcript: string) => Promise<{
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
  }>;
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
      nativeFoundation.interpretNoteAsync(text).then((raw) => ({ kind: 'response' as const, raw })),
      new Promise<{ kind: 'timeout' }>((resolve) => setTimeout(() => resolve({ kind: 'timeout' }), FIRST_PASS_TIMEOUT_MS)),
    ]);
    if (outcome.kind === 'timeout') {
      recordDevNote(text, startedAt, true, 'timeout', `foundation_exceeded_${FIRST_PASS_TIMEOUT_MS}ms`);
      return null;
    }
    const raw = outcome.raw;
    const firstPassDurationMs = Date.now() - startedAt;
    const label = typeof raw.label === 'string' ? raw.label.trim() : '';
    const archetype = typeof raw.archetype === 'string' ? raw.archetype.trim().toLowerCase() : '';
    if (!label || label.length > 40 || !VALID_ARCHETYPES.includes(archetype as NoteArchetype)) {
      recordDevNote(text, startedAt, true, 'invalid_response', 'missing_or_invalid_label_or_archetype', raw);
      return null;
    }

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
    if (cleanString(raw.routeKey) && nativeFoundation.classifyNoteRouteAsync && foundationAtomicNeedsRetry(text, firstAtomic, { includeRegistryEvidence: !foundationOnlyRouting })) {
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
    const decision = resolveFoundationRouteEvidence(text, firstAtomic, retryRaw, { includeRegistryEvidence: !foundationOnlyRouting });
    const mediaRoute = media
      ? foundationNoteRoute({ provider: 'appleFoundation', llmClassified, mediaType: media.mediaType })
      : null;
    const journalRoutes = decision.routes.length ? decision.routes : rankJournalRoutes([mediaRoute]);
    const selected = decision.selected ?? (journalRoutes.length === 1 && !journalNoteRouteNeedsConfirmation(journalRoutes) ? journalRoutes[0] : null);
    const selectedRaw = retryRaw && decision.decisionSource === 'foundationRetry' ? { ...raw, ...retryRaw } : raw;
    const journalClassification = selected
      ? classificationForResolvedRoute(selected, selectedRaw, cleanString(raw.routeKey) ? decision.decisionSource : 'legacy')
      : null;
    const status: DevNoteAnalysisStatus = journalClassification
      ? mediaRoute && !decision.routes.length ? 'media_fallback' : 'classified'
      : journalRoutes.length ? 'ambiguous' : 'unrouted';
    const fallbackReason = retryRaw
      ? 'focused_route_retry_used'
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

    return { archetype: archetype as NoteArchetype, label, media, food, llmClassified, journalClassification, journalRoutes };
  } catch (error) {
    recordDevNote(text, startedAt, true, 'native_error', error instanceof Error ? error.message : 'unknown_native_error');
    return null;
  }
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
  const schema = rawResponse?.noteSchemaVersion;
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
