import { requireOptionalNativeModule } from 'expo-modules-core';

import { interpretNoteText, type NoteArchetype } from '@/utils/note-meaning';
import type { JournalNoteClassification, JournalRouteProposal, StudioMediaType } from '@/types/home';
import {
  classificationForResolvedRoute,
  journalRouteForKey,
  type FoundationAtomicRouteRead,
} from '@/utils/journal-routing';
import {
  classifyNoteRouteWithRunner as runStrictTwoPassFoundationRoute,
  type FoundationConfidenceLevel,
} from '@/utils/foundation-note-routing';
import { saveDevLastNoteAnalysis, type DevNoteAnalysisStatus } from '@/utils/dev-note-analysis';
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
const FOUNDATION_CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const;

type FoundationRouteRun = {
  raw: (Record<string, unknown>) | null;
  suggestedFlowId: string | null;
  topLevelConfidence: FoundationConfidenceLevel | null;
  subcategoryConfidence: FoundationConfidenceLevel | null;
  topLevelResponse: Record<string, unknown> | null;
  subcategoryResponse: Record<string, unknown> | null;
  durationMs: number;
  failure: 'timeout' | 'error' | null;
};
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
    const retryRaw = routeRun.raw;
    const retryDurationMs = routeRun.durationMs;
    const retryFailure = routeRun.failure;
    const journalRoutes = retryRaw?.routeKey
      ? [journalRouteForKey(
          String(retryRaw.routeKey),
          confidenceValue(routeRun.subcategoryConfidence),
          `Apple Foundation selected this subcategory with ${routeRun.subcategoryConfidence ?? 'unknown'} confidence`
        )].filter((route): route is JournalRouteProposal => !!route)
      : [];
    const selected = routeRun.subcategoryConfidence === 'high' ? journalRoutes[0] ?? null : null;
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
    const fallbackReason = !richResponseValid && focusedRouteUsed
      ? `${firstPassFailure ?? 'invalid_rich_response'}_split_route_used`
      : focusedRouteUsed
        ? 'split_foundation_route_used'
      : retryFailure
        ? `split_route_${retryFailure}`
      : routeRun.topLevelConfidence !== 'high'
        ? `top_level_${routeRun.topLevelConfidence ?? 'invalid'}_needs_confirmation`
      : routeRun.subcategoryConfidence !== 'high'
        ? `subcategory_${routeRun.subcategoryConfidence ?? 'invalid'}_needs_confirmation`
      : status === 'ambiguous'
        ? 'route_candidates_need_confirmation'
        : status === 'unrouted'
          ? 'no_valid_two_pass_foundation_route'
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
  if (!nativeFoundation?.generateStructuredAsync) return emptyRouteRun(0, 'error');
  return runStrictTwoPassFoundationRoute(transcript, timeoutMs, runStructuredNoteTask);
}

async function classifyNoteRouteWithRunnerReference(
  transcript: string,
  timeoutMs: number,
  runner: StructuredNoteTaskRunner
): Promise<FoundationRouteRun> {
  const startedAt = Date.now();
    const flows = MANUAL_JOURNAL_FLOWS.map((flow) => flow.id);
    const flowSummary = MANUAL_JOURNAL_FLOWS
      .map((flow) => `${flow.id}: ${flow.shortTitle ?? flow.title}. ${flow.description ?? ''}`.trim())
      .join('\n');
    const flowRun = await runner({
      taskId: 'note.flow.v1',
      instructions: [
        'Choose the single best broad journal section for one personal note.',
        'Select only from the supplied section IDs. Base the choice on what the person actually did.',
        'Watched a movie, watched a show, read a book, played a video game, or listened to media means studio.',
        'Examples: "I watched X movie" is studio. "I read X" is studio. "I went for a run" is movement.',
        'Use general only when no more specific supplied section fits.',
        'Report high confidence only when the note clearly names the relevant action or subject; otherwise medium or low.',
      ].join(' '),
      prompt: `Journal sections:\n${flowSummary}\n\nNote: ${JSON.stringify(transcript)}\nChoose the best section ID.`,
      fields: [
        { name: 'flowId', description: 'Best supplied broad journal section ID', kind: 'enum', values: flows },
        { name: 'confidence', description: 'Independent confidence in the broad section choice', kind: 'enum', values: [...FOUNDATION_CONFIDENCE_LEVELS] },
      ],
      sampling: 'greedy',
    }, Math.min(FLOW_ROUTE_TIMEOUT_MS, timeoutMs));
    if (!flowRun.response) {
      return emptyRouteRun(Date.now() - startedAt, flowRun.failure);
    }
    const flowId = cleanString(flowRun.response.flowId);
    const topLevelConfidence = confidenceLevel(flowRun.response.confidence);
    const flow = MANUAL_JOURNAL_FLOWS.find((candidate) => candidate.id === flowId);
    if (!flow || !topLevelConfidence) return emptyRouteRun(Date.now() - startedAt, 'error');

    // A non-high top-level decision must be confirmed by the person before a
    // subcategory is considered. This prevents a second model call from
    // silently turning an uncertain broad section into a confident route.
    if (topLevelConfidence !== 'high') {
      return {
        raw: null,
        suggestedFlowId: flow.id,
        topLevelConfidence,
        subcategoryConfidence: null,
        topLevelResponse: flowRun.response,
        subcategoryResponse: null,
        durationMs: Date.now() - startedAt,
        failure: null,
      };
    }

    const remaining = Math.max(0, timeoutMs - (Date.now() - startedAt));
    if (remaining < 500) {
      return {
        ...emptyRouteRun(Date.now() - startedAt, 'timeout'),
        suggestedFlowId: flow.id,
        topLevelConfidence,
        topLevelResponse: flowRun.response,
      };
    }
    const candidates = JOURNAL_CLASSIFICATION_CATALOG.filter((entry) => entry.flowId === flow.id);
    const childSummary = candidates.map((entry) => {
      const examples = entry.examples.map((example) => JSON.stringify(example)).join(', ');
      const exclusions = entry.exclusions.length ? ` Exclude: ${entry.exclusions.join('; ')}.` : '';
      return `${entry.routeKey}: ${entry.definition} Examples: ${examples}.${exclusions}`;
    }).join('\n');
    const childRun = await runner({
      taskId: 'note.child-route.v1',
      instructions: [
        `Choose exactly one subcategory within the already selected ${flow.id} journal section.`,
        'Start the classification again from the original note. Use only the note, definitions, examples, and exclusions below.',
        'Do not infer confidence from the fact that the broad section was selected.',
        'For studio: watched a movie means film; read or listened to an audiobook means book; watched an episode or series means show.',
        'For food, a standalone fruit or small item is a snack unless the note identifies breakfast, lunch, dinner, or a meal.',
        'Report high confidence only when the original note clearly distinguishes the selected subcategory.',
      ].join(' '),
      prompt: `Original note: ${JSON.stringify(transcript)}\n\nAllowed subcategories inside ${flow.id}:\n${childSummary}\n\nChoose the best subcategory from scratch.`,
      fields: [
        { name: 'routeKey', description: `Best route inside the selected ${flow.id} section`, kind: 'enum', values: candidates.map((entry) => entry.routeKey) },
        { name: 'confidence', description: 'Independent confidence in this subcategory choice based only on the original note', kind: 'enum', values: [...FOUNDATION_CONFIDENCE_LEVELS] },
      ],
      sampling: 'greedy',
    }, remaining);
    if (!childRun.response) {
      return {
        ...emptyRouteRun(Date.now() - startedAt, childRun.failure),
        suggestedFlowId: flow.id,
        topLevelConfidence,
        topLevelResponse: flowRun.response,
      };
    }
    const routeKey = cleanString(childRun.response.routeKey);
    const subcategoryConfidence = confidenceLevel(childRun.response.confidence);
    if (!routeKey || !subcategoryConfidence || !candidates.some((entry) => entry.routeKey === routeKey)) {
      return {
        ...emptyRouteRun(Date.now() - startedAt, 'error'),
        suggestedFlowId: flow.id,
        topLevelConfidence,
        topLevelResponse: flowRun.response,
        subcategoryResponse: childRun.response,
      };
    }
    return {
      raw: {
        routeKey,
        routeStrategy: 'strict_two_pass_v2',
      },
      suggestedFlowId: flow.id,
      topLevelConfidence,
      subcategoryConfidence,
      topLevelResponse: flowRun.response,
      subcategoryResponse: childRun.response,
      durationMs: Date.now() - startedAt,
      failure: null,
    };
}

export type StructuredNoteTask = {
  taskId: string;
  instructions: string;
  prompt: string;
  fields: Array<{ name: string; description: string; kind: 'string' | 'enum'; values?: string[] }>;
  sampling?: 'greedy';
};

export type StructuredNoteTaskRunner = (
  task: StructuredNoteTask,
  timeoutMs: number
) => Promise<{ response: Record<string, unknown> | null; failure: 'timeout' | 'error' | null }>;

function emptyRouteRun(durationMs: number, failure: FoundationRouteRun['failure']): FoundationRouteRun {
  return {
    raw: null,
    suggestedFlowId: null,
    topLevelConfidence: null,
    subcategoryConfidence: null,
    topLevelResponse: null,
    subcategoryResponse: null,
    durationMs,
    failure,
  };
}

function confidenceLevel(value: unknown): FoundationConfidenceLevel | null {
  return typeof value === 'string' && FOUNDATION_CONFIDENCE_LEVELS.includes(value.trim().toLowerCase() as FoundationConfidenceLevel)
    ? value.trim().toLowerCase() as FoundationConfidenceLevel
    : null;
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
