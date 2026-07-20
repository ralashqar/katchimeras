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
import { JOURNAL_CLASSIFICATION_CATALOG } from '@/utils/journal-classification-catalog';

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
const FLOW_ROUTE_TIMEOUT_MS = 3500;

type FoundationRouteRun = {
  raw: (FoundationAtomicRouteRead & Record<string, unknown>) | null;
  durationMs: number;
  failure: 'timeout' | 'error' | null;
};

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
    // Route first. It controls navigation and must not wait behind optional
    // title/feeling enrichment. The generic bridge uses two small constrained
    // Foundation calls (flow, then one flow's children) instead of one brittle
    // 75-route generated schema.
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
    let retryRaw = routeRun.raw;
    const retryDurationMs = routeRun.durationMs;
    const retryFailure = routeRun.failure;
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
      ? `foundation_enrichment_exceeded_${readTimeout}ms`
      : outcome.kind === 'error'
        ? 'foundation_note_read_error'
        : outcome.kind === 'skipped'
          ? 'foundation_note_read_skipped_after_route'
        : richResponseValid
          ? null
          : 'missing_or_invalid_label_or_archetype';
    const fallbackReason = !richResponseValid && focusedRouteUsed
      ? `${firstPassFailure ?? 'invalid_rich_response'}_split_route_used`
      : focusedRouteUsed
        ? 'split_foundation_route_used'
      : retryFailure
        ? `split_route_${retryFailure}`
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

async function classifyNoteRouteOnDevice(transcript: string, timeoutMs: number): Promise<FoundationRouteRun> {
  const startedAt = Date.now();
  if (nativeFoundation?.generateStructuredAsync) {
    const flows = MANUAL_JOURNAL_FLOWS.map((flow) => flow.id);
    const flowSummary = MANUAL_JOURNAL_FLOWS
      .map((flow) => `${flow.id}: ${flow.shortTitle ?? flow.title}. ${flow.description ?? ''}`.trim())
      .join('\n');
    const flowRun = await runStructuredNoteTask({
      taskId: 'note.flow.v1',
      instructions: [
        'Choose the single best broad journal section for one personal note.',
        'Select only from the supplied section IDs. Prefer a concrete subject or action over a generic moment.',
        'Eating or drinking is food; consuming a book, film, show, game, music, podcast, news, or watched sport is studio.',
        'Use general only when no more specific supplied section fits.',
      ].join(' '),
      prompt: `Journal sections:\n${flowSummary}\n\nNote: ${JSON.stringify(transcript)}\nChoose the best section ID.`,
      fields: [{ name: 'flowId', description: 'Best supplied broad journal section ID', kind: 'enum', values: flows }],
    }, Math.min(FLOW_ROUTE_TIMEOUT_MS, timeoutMs));
    if (!flowRun.response) {
      return { raw: null, durationMs: Date.now() - startedAt, failure: flowRun.failure };
    }
    const flowId = cleanString(flowRun.response.flowId);
    const flow = MANUAL_JOURNAL_FLOWS.find((candidate) => candidate.id === flowId);
    if (!flow) return { raw: null, durationMs: Date.now() - startedAt, failure: 'error' };

    const remaining = Math.max(0, timeoutMs - (Date.now() - startedAt));
    if (remaining < 500) return { raw: null, durationMs: Date.now() - startedAt, failure: 'timeout' };
    const candidates = JOURNAL_CLASSIFICATION_CATALOG.filter((entry) => entry.flowId === flow.id);
    const childSummary = candidates.map((entry) => {
      const examples = entry.examples.map((example) => JSON.stringify(example)).join(', ');
      const exclusions = entry.exclusions.length ? ` Exclude: ${entry.exclusions.join('; ')}.` : '';
      return `${entry.routeKey}: ${entry.definition} Examples: ${examples}.${exclusions}`;
    }).join('\n');
    const childRun = await runStructuredNoteTask({
      taskId: 'note.child-route.v1',
      instructions: [
        `The broad journal section ${flow.id} is already selected and immutable.`,
        'Choose exactly one supplied child route using its definition, examples, and exclusions.',
        'Return a concise editable entity or title explicitly supported by the note, never the whole sentence.',
        'For food, a standalone fruit or small item is a snack unless the note identifies breakfast, lunch, dinner, or a meal.',
        'For media, return only the named work title. Use an empty specific value rather than guessing.',
      ].join(' '),
      prompt: `Allowed routes inside ${flow.id}:\n${childSummary}\n\nNote: ${JSON.stringify(transcript)}\nChoose one route and extract its concise field value.`,
      fields: [
        { name: 'routeKey', description: `Best route inside the locked ${flow.id} section`, kind: 'enum', values: candidates.map((entry) => entry.routeKey) },
        { name: 'specific', description: `Concise ${flow.specificFieldLabel.toLowerCase()} supported by the note; never the whole note`, kind: 'string' },
      ],
    }, remaining);
    if (!childRun.response) {
      return { raw: null, durationMs: Date.now() - startedAt, failure: childRun.failure };
    }
    const routeKey = cleanString(childRun.response.routeKey);
    if (!routeKey || !candidates.some((entry) => entry.routeKey === routeKey)) {
      return { raw: null, durationMs: Date.now() - startedAt, failure: 'error' };
    }
    const specific = cleanShort(childRun.response.specific, 120);
    return {
      raw: {
        routeKey,
        routeConfidence: 0.9,
        alternativeRouteKey: '',
        alternativeRouteConfidence: 0,
        specific: specific && !noteSpecificCopiesSentence(specific, transcript) ? specific : '',
        routeStrategy: 'split_dynamic_v1',
        flowResponse: flowRun.response,
        childResponse: childRun.response,
      },
      durationMs: Date.now() - startedAt,
      failure: null,
    };
  }

  // Compatibility only for native clients predating the generic structured
  // bridge. New clients never pay for the monolithic 75-route schema.
  if (nativeFoundation?.classifyNoteRouteAsync) {
    const result = await Promise.race([
      nativeFoundation.classifyNoteRouteAsync(transcript)
        .then((value) => ({ kind: 'response' as const, value }))
        .catch(() => ({ kind: 'error' as const })),
      new Promise<{ kind: 'timeout' }>((resolve) => setTimeout(() => resolve({ kind: 'timeout' }), timeoutMs)),
    ]);
    return result.kind === 'response'
      ? { raw: result.value as FoundationAtomicRouteRead & Record<string, unknown>, durationMs: Date.now() - startedAt, failure: null }
      : { raw: null, durationMs: Date.now() - startedAt, failure: result.kind };
  }
  return { raw: null, durationMs: Date.now() - startedAt, failure: 'error' };
}

type StructuredNoteTask = {
  taskId: string;
  instructions: string;
  prompt: string;
  fields: Array<{ name: string; description: string; kind: 'string' | 'enum'; values?: string[] }>;
};

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
