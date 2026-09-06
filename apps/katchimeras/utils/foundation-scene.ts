import { requireOptionalNativeModule } from 'expo-modules-core';
import type { DayVisionSummary, PhotoVisionResult } from '@/types/home';
import { JOURNAL_CLASSIFICATION_CATALOG } from '@/utils/journal-classification-catalog';
import { MANUAL_JOURNAL_FLOWS } from '@/utils/manual-journal-registry';
import {
  photoTopLevelDecisionIssue,
  photoTopLevelEvidenceText,
  photoTopLevelForSemanticFlow,
  photoModelFlowIdForSemanticFlow,
  type PhotoSemanticFrame,
  type PhotoModelConfidence,
  type PhotoTopLevel,
  type PhotoTopLevelAmbiguityDecision,
  type PhotoTopLevelDecision,
  type PhotoTopLevelFailure,
  type PhotoTopLevelResult,
} from '@/utils/photo-semantic-frame';

// On-device hierarchical scene classification via Apple Foundation Models
// (iOS 26+, Apple-Intelligence devices). The app locks a principal visual
// evidence cluster, then Foundation selects a broad flow and independent child.
// Unsupported devices remain unresolved for manual selection.
type FoundationSceneModule = {
  isAvailable?: () => boolean;
  generateStructuredAsync?: (requestJson: string) => Promise<string>;
  availabilityInfo?: () => {
    status?: unknown;
    reason?: unknown;
    locale?: unknown;
    localeSupported?: unknown;
    noteSchemaVersion?: unknown;
    photoSchemaVersion?: unknown;
    structuredBridgeVersion?: unknown;
  };
  classifySceneAsync?: (tags: string[], faceCount: number) => Promise<{ type?: unknown; subject?: unknown }>;
  // Deep read (newer builds): adds the media branch — when the photo is OF a
  // work (book cover, poster, album) the model identifies it from the OCR'd
  // text + its own knowledge of the work.
  readSceneAsync?: (
    tags: string[],
    ocrLines: string[],
    faceCount: number
  ) => Promise<{ type?: unknown; subject?: unknown; mediaKind?: unknown; title?: unknown; creator?: unknown }>;
  readMemoryAsync?: (
    tags: string[],
    ocrLines: string[],
    faceCount: number
  ) => Promise<{
    domain?: unknown;
    subject?: unknown;
    animalKind?: unknown;
    mediaKind?: unknown;
    title?: unknown;
    creator?: unknown;
    food?: unknown;
    activity?: unknown;
    representation?: unknown;
    container?: unknown;
    confidence?: unknown;
    alternatives?: unknown;
    supportingSubjects?: unknown;
    promptVersion?: unknown;
  }>;
  readMemoryV2Async?: (
    tags: string[],
    ocrLines: string[],
    faceCount: number,
    spatialCandidates: string[]
  ) => Promise<{
    domain?: unknown;
    subject?: unknown;
    animalKind?: unknown;
    mediaKind?: unknown;
    title?: unknown;
    creator?: unknown;
    food?: unknown;
    activity?: unknown;
    representation?: unknown;
    container?: unknown;
    confidence?: unknown;
    alternatives?: unknown;
    supportingSubjects?: unknown;
    promptVersion?: unknown;
  }>;
  classifyPhotoAnchorAsync?: (
    labels: string[],
    confidences: number[],
    faceCount: number,
    humanCount: number,
    documentDetected: boolean,
    dominantSubjectCoverage: number,
    spatialCandidates: string[]
  ) => Promise<Record<string, unknown>>;
  enrichPhotoOcrAsync?: (
    routeKey: string,
    representation: string,
    container: string,
    visualSubject: string,
    ocrLines: string[],
    ocrConfidences: number[],
    ocrRegions: string[]
  ) => Promise<Record<string, unknown>>;
  rankPhotoJournalCandidatesAsync?: (
    stage: string, taskInstructions: string, evidence: string,
    candidateIds: string[], candidateDescriptions: string[], routePrefix: string
  ) => Promise<Record<string, unknown>>;
  classifyNoteRouteAsync?: (transcript: string) => Promise<Record<string, unknown>>;
  classifyPhotoRouteAsync?: (
    evidence: string,
    candidateRouteKeys: string[],
    candidateDescriptions: string[],
    specificEvidenceKeys: string[],
    specificEvidenceDescriptions: string[]
  ) => Promise<Record<string, unknown>>;
  interpretPhotoSemanticsAsync?: (
    evidence: string,
    primaryEvidenceKeys: string[],
    backgroundEvidenceKeys: string[],
    evidenceDescriptions: string[]
  ) => Promise<Record<string, unknown>>;
  enrichPhotoJournalAsync?: (
    routeKey: string, fieldLabel: string, visualSubject: string,
    ocrLines: string[], ocrConfidences: number[], ocrRegions: string[], taskInstructions: string
  ) => Promise<Record<string, unknown>>;
};

export const FOUNDATION_MEMORY_PROMPT_VERSION = 2;
export const FOUNDATION_NOTE_SCHEMA_VERSION = 6;
export const FOUNDATION_PHOTO_SCHEMA_VERSION = 17;
// Photo schema 13 introduced the dynamic structured bridge used by the live
// classifier. Later app schema versions change the app-authored prompt
// contract, not the native bridge shape, so an installed v13 development
// client remains usable.
export const FOUNDATION_PHOTO_MIN_COMPATIBLE_SCHEMA_VERSION = 13;
export const FOUNDATION_STRUCTURED_BRIDGE_VERSION = 1;

export type PhotoJournalAnchorEvidence = {
  lockedRouteKey?: string | null;
  detail?: string | null;
  representationV2?: string | null;
  container?: string | null;
  confidence?: number | null;
};

export type FoundationUnavailableReason =
  | 'native_module_missing'
  | 'scene_reader_missing'
  | 'apple_intelligence_not_enabled'
  | 'device_not_eligible'
  | 'model_not_ready'
  | 'ios_version_unsupported'
  | 'framework_not_linked'
  | 'unknown_unavailable_reason'
  | 'model_unavailable';

const nativeFoundation = requireOptionalNativeModule<FoundationSceneModule>('KatchimeraFoundation');

export function isFoundationSceneAvailable(): boolean {
  try {
    const hasSceneReader = !!(
      nativeFoundation?.classifyPhotoAnchorAsync ||
      nativeFoundation?.rankPhotoJournalCandidatesAsync ||
      nativeFoundation?.readMemoryV2Async ||
      nativeFoundation?.readMemoryAsync ||
      nativeFoundation?.readSceneAsync ||
      nativeFoundation?.classifySceneAsync
    );
    return hasSceneReader && (nativeFoundation?.isAvailable?.() ?? false);
  } catch {
    return false;
  }
}

export function foundationSceneAvailability(): {
  available: boolean;
  reason: 'available' | FoundationUnavailableReason;
  locale?: string;
  localeSupported?: boolean;
  noteSchemaVersion?: number;
  photoSchemaVersion?: number;
  structuredBridgeVersion?: number;
} {
  if (!nativeFoundation) return { available: false, reason: 'native_module_missing' };
  if (!nativeFoundation.rankPhotoJournalCandidatesAsync && !nativeFoundation.classifyPhotoAnchorAsync && !nativeFoundation.readMemoryV2Async && !nativeFoundation.readMemoryAsync && !nativeFoundation.readSceneAsync && !nativeFoundation.classifySceneAsync) {
    return { available: false, reason: 'scene_reader_missing' };
  }
  try {
    const info = nativeFoundation.availabilityInfo?.();
    const locale = typeof info?.locale === 'string' ? info.locale : undefined;
    const localeSupported = info?.localeSupported === 'true'
      ? true
      : info?.localeSupported === 'false'
        ? false
        : undefined;
    const noteSchemaVersion = typeof info?.noteSchemaVersion === 'string' && /^\d+$/.test(info.noteSchemaVersion)
      ? Number(info.noteSchemaVersion)
      : undefined;
    const photoSchemaVersion = typeof info?.photoSchemaVersion === 'string' && /^\d+$/.test(info.photoSchemaVersion)
      ? Number(info.photoSchemaVersion)
      : undefined;
    const structuredBridgeVersion = typeof info?.structuredBridgeVersion === 'string' && /^\d+$/.test(info.structuredBridgeVersion)
      ? Number(info.structuredBridgeVersion)
      : undefined;
    if (info?.status === 'available') return { available: true, reason: 'available', locale, localeSupported, noteSchemaVersion, photoSchemaVersion, structuredBridgeVersion };
    const knownReasons: FoundationUnavailableReason[] = [
      'apple_intelligence_not_enabled',
      'device_not_eligible',
      'model_not_ready',
      'ios_version_unsupported',
      'framework_not_linked',
      'unknown_unavailable_reason',
    ];
    if (typeof info?.reason === 'string' && knownReasons.includes(info.reason as FoundationUnavailableReason)) {
      return { available: false, reason: info.reason as FoundationUnavailableReason, locale, localeSupported, noteSchemaVersion, photoSchemaVersion, structuredBridgeVersion };
    }
    return nativeFoundation.isAvailable?.()
      ? { available: true, reason: 'available' }
      : { available: false, reason: 'model_unavailable' };
  } catch {
    return { available: false, reason: 'model_unavailable' };
  }
}

export type DeepSceneRead = {
  memoryDomain: string | null;
  type: string;
  subject: string | null;
  mediaKind: string | null;
  title: string | null;
  creator: string | null;
  representation: 'real_world' | 'screen_content' | 'unknown' | null;
  representationV2: string | null;
  container: string | null;
  confidence: number | null;
  alternatives: string[];
  supportingSubjects: string[];
  promptVersion: string | null;
  lockedRouteKey?: string | null;
  ocrPurpose?: 'identity' | 'context' | 'ignore' | null;
  photoSchemaVersion?: number | null;
  foundationPasses?: FoundationPhotoPasses;
};

export type FoundationPhotoPassTrace = {
  status: 'used' | 'discarded' | 'failed' | 'skipped';
  durationMs: number;
  rawResponse: Record<string, unknown> | null;
  reason: string | null;
};

export type FoundationPhotoPasses = {
  visualAnchor: FoundationPhotoPassTrace;
  ocrEnrichment: FoundationPhotoPassTrace | null;
};

const PHOTO_ROUTES = new Set([
  'animal.dog', 'animal.cat', 'animal.other', 'people', 'food',
  'media.book', 'media.film', 'media.show', 'media.game', 'media.music', 'media.art', 'media.other',
  'movement', 'place', 'work', 'nature', 'life_event', 'document', 'screen', 'other',
]);

type StructuredBridgeField = {
  name: string;
  description: string;
  kind: 'string' | 'enum';
  values?: string[];
};

type StructuredBridgeTask = {
  taskId: string;
  instructions: string;
  prompt: string;
  fields: StructuredBridgeField[];
  sampling?: 'greedy';
};

async function generateStructuredTask(task: StructuredBridgeTask): Promise<Record<string, unknown> | null> {
  const result = await generateStructuredTaskDetailed(task);
  return result.response;
}

type StructuredBridgeRun = {
  response: Record<string, unknown> | null;
  rawResponse: Record<string, unknown> | null;
  durationMs: number;
  reason: string | null;
};

async function generateStructuredTaskDetailed(task: StructuredBridgeTask): Promise<StructuredBridgeRun> {
  const startedAt = Date.now();
  if (!nativeFoundation?.generateStructuredAsync) {
    return { response: null, rawResponse: null, durationMs: 0, reason: 'structured_bridge_missing' };
  }
  if (!(nativeFoundation.isAvailable?.() ?? false)) {
    return { response: null, rawResponse: null, durationMs: 0, reason: 'foundation_model_unavailable' };
  }
  try {
    const responseJson = await nativeFoundation.generateStructuredAsync(JSON.stringify({
      bridgeVersion: FOUNDATION_STRUCTURED_BRIDGE_VERSION,
      ...task,
    }));
    const parsed: unknown = JSON.parse(responseJson);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { response: null, rawResponse: null, durationMs: Date.now() - startedAt, reason: 'structured_bridge_invalid_json_shape' };
    }
    const rawResponse = parsed as Record<string, unknown>;
    if (rawResponse.status !== 'succeeded') {
      const errorCode = cleanText(rawResponse.errorCode, 80) ?? cleanText(rawResponse.status, 80) ?? 'structured_bridge_failed';
      const errorDescription = cleanText(rawResponse.errorDescription, 240);
      return {
        response: null,
        rawResponse,
        durationMs: Date.now() - startedAt,
        reason: errorDescription ? `${errorCode}: ${errorDescription}` : errorCode,
      };
    }
    return { response: rawResponse, rawResponse, durationMs: Date.now() - startedAt, reason: null };
  } catch (error) {
    return {
      response: null,
      rawResponse: {
        status: 'bridge_exception',
        errorCode: 'structured_bridge_exception',
        errorDescription: error instanceof Error ? error.message : String(error),
        taskId: task.taskId,
      },
      durationMs: Date.now() - startedAt,
      reason: error instanceof Error ? error.message : 'structured_bridge_exception',
    };
  }
}

export function supportsFoundationPhotoSchemaV2(): boolean {
  return !!nativeFoundation?.classifyPhotoAnchorAsync && !!nativeFoundation?.enrichPhotoOcrAsync;
}

export function supportsFoundationPhotoJournalSchema(): boolean {
  if (!nativeFoundation?.generateStructuredAsync) return false;
  const availability = foundationSceneAvailability();
  return (availability.photoSchemaVersion ?? 0) >= FOUNDATION_PHOTO_MIN_COMPATIBLE_SCHEMA_VERSION
    && (availability.structuredBridgeVersion ?? 0) >= FOUNDATION_STRUCTURED_BRIDGE_VERSION;
}

export async function refinePhotoSemanticFrameOnDevice(
  frame: PhotoSemanticFrame
): Promise<PhotoTopLevelResult> {
  return runPhotoSemanticFrameTask(frame, 'primary', null);
}

export async function retryPhotoTopLevelOnDevice(
  frame: PhotoSemanticFrame
): Promise<PhotoTopLevelResult> {
  return runPhotoSemanticFrameTask(frame, 'retry', null);
}

export async function repairPhotoSemanticFrameOnDevice(
  frame: PhotoSemanticFrame,
  previousRawResponse: Record<string, unknown>,
  rejectionReason: string,
  lockedPrimaryEvidenceKey: string | null
): Promise<PhotoTopLevelResult> {
  return runPhotoSemanticFrameTask(frame, 'repair', { previousRawResponse, rejectionReason, lockedPrimaryEvidenceKey });
}

async function runPhotoSemanticFrameTask(
  frame: PhotoSemanticFrame,
  mode: 'primary' | 'retry' | 'repair',
  _repair: {
    previousRawResponse: Record<string, unknown>;
    rejectionReason: string;
    lockedPrimaryEvidenceKey: string | null;
  } | null
): Promise<PhotoTopLevelResult> {
  if (!nativeFoundation?.generateStructuredAsync || !(nativeFoundation.isAvailable?.() ?? false)) {
    return topLevelFailure('technical', null, 0, 'Foundation structured bridge unavailable');
  }
  if (!frame.primaryEvidenceKeys.length) return topLevelFailure('invalid_output', null, 0, 'No visible Essence evidence supplied');
  const startedAt = Date.now();
  try {
    const lockedPrincipalEvidenceKey = frame.primaryEvidenceKeys[0];
    const allowedFlowIds = MANUAL_JOURNAL_FLOWS.flatMap((flow) => {
      const modelFlowId = photoModelFlowIdForSemanticFlow(flow.id);
      return modelFlowId ? [modelFlowId] : [];
    });
    const flowDescriptions = MANUAL_JOURNAL_FLOWS
      .flatMap((flow) => {
        const modelFlowId = photoModelFlowIdForSemanticFlow(flow.id);
        return modelFlowId ? [`${modelFlowId}: ${flow.title}${flow.description ? `. ${flow.description}` : ''}`] : [];
      })
      .join('\n');
    const allowedTopLevelValues = [...allowedFlowIds, 'undetermined'];
    const taskId = mode === 'primary' ? 'photo.top-level.v5' : mode === 'retry' ? 'photo.top-level.retry.v5' : 'photo.top-level.repair.v5';
    const instructions = [
      'Map the mechanically locked principal visual evidence cluster to one supplied broad journal flow, or return undetermined when the visual evidence cannot safely establish any one flow.',
      'The app has already selected the principal cluster from detector confidence, observation-source reliability, independent corroboration, and available spatial evidence.',
      'The supplied observations are the top filtered Essence tags from the same relevance pipeline used by the review UI. No unfiltered raw-label background is available.',
      'Do not re-rank the observations or replace the locked principal with another Essence tag.',
      'Cluster member labels are lexical detector variants describing the same proposed subject; read them together.',
      'Other visible Essence clusters may qualify how the locked principal relates to another visible object, including whether it is directly present or depicted, but they may not become a replacement principal.',
      'Representation describes the outer captured image and is not by itself proof that every detected subject is physically present.',
      'OCR is intentionally absent. Use only the supplied visual evidence and the supplied flow titles and descriptions.',
      'Choose the flow that best represents the locked principal subject in the photo.',
      'Use undetermined when the locked principal and its context conflict, or when choosing a broad flow would depend on replacing the locked principal.',
      'Report high confidence only when the visual evidence clearly identifies one flow over the alternatives. Use medium when plausible but review is advisable, and low when the user should choose.',
    ].join(' ');
    const prompt = [
      photoTopLevelEvidenceText(frame),
      `Broad journal flows:\n${flowDescriptions}\nundetermined: The visual evidence does not safely identify one broad journal flow; the user must choose.`,
      'Select the best broad flow for the locked principal evidence. Judge this stage independently.',
    ].join('\n\n');
    const fields: StructuredBridgeField[] = [
      { name: 'flowId', description: 'Best broad journal flow for the locked principal visual evidence, or undetermined when no one flow is grounded', kind: 'enum', values: allowedTopLevelValues },
      { name: 'confidence', description: 'Confidence in this broad-flow decision only', kind: 'enum', values: ['high', 'medium', 'low'] },
    ];
    const modelRequest = { taskId, instructions, prompt, fields, sampling: 'greedy' };
    const bridge = await generateStructuredTaskDetailed({
      taskId,
      instructions,
      prompt,
      fields,
      sampling: 'greedy',
    });
    if (!bridge.response) {
      return topLevelFailure('technical', { ...(bridge.rawResponse ?? {}), modelRequest }, bridge.durationMs, bridge.reason ?? 'Foundation structured bridge returned no result');
    }
    const raw: Record<string, unknown> = { ...bridge.response, modelRequest };
    const flowId = cleanEnum(raw.flowId, allowedTopLevelValues);
    if (!flowId) return topLevelFailure('invalid_output', raw, bridge.durationMs, 'Foundation omitted a valid broad journal flow');
    const topLevel = flowId === 'undetermined' ? 'ambiguous' : photoTopLevelForSemanticFlow(flowId);
    if (!topLevel) return topLevelFailure('invalid_output', raw, bridge.durationMs, 'Foundation returned an unmapped broad journal flow');
    const confidence = cleanEnum(raw.confidence, ['high', 'medium', 'low']) as PhotoModelConfidence | null;
    if (!confidence) return topLevelFailure('invalid_output', raw, bridge.durationMs, 'Foundation omitted top-level confidence');
    const decision: PhotoTopLevelDecision = {
      primaryEvidenceKey: lockedPrincipalEvidenceKey,
      topLevel,
      confidence,
      rawResponse: {
        ...raw,
        lockedPrincipalEvidenceKey,
        resolvedTopLevel: topLevel,
        evidenceEnvelope: {
          visualObservationCount: frame.classificationEvidenceKeys.length,
          clusterCount: frame.evidence.signals.length,
          ocrStatus: frame.evidence.ocr.status,
          ocrReason: frame.evidence.ocr.reason,
          ocrLineCount: frame.evidence.ocr.lines.length,
        },
      },
      durationMs: bridge.durationMs,
    };
    const decisionIssue = photoTopLevelDecisionIssue(frame, decision);
    return decisionIssue
      ? topLevelFailure('invalid_output', decision.rawResponse, bridge.durationMs, decisionIssue)
      : decision;
  } catch (error) {
    return topLevelFailure(
      'technical',
      { status: 'javascript_exception', errorDescription: error instanceof Error ? error.message : String(error) },
      Date.now() - startedAt,
      error instanceof Error ? error.message : 'Top-level Foundation task failed'
    );
  }
}

function topLevelFailure(
  failureKind: PhotoTopLevelFailure['failureKind'],
  rawResponse: Record<string, unknown> | null,
  durationMs: number,
  reason: string
): PhotoTopLevelFailure {
  return { failureKind, rawResponse, durationMs, reason };
}

export async function resolvePhotoTopLevelAmbiguityOnDevice(
  frame: PhotoSemanticFrame
): Promise<PhotoTopLevelAmbiguityDecision | null> {
  if (!nativeFoundation?.generateStructuredAsync || !(nativeFoundation.isAvailable?.() ?? false)) return null;
  if (frame.primaryEvidenceKeys.length < 2) return null;
  const allowedTopLevels: Exclude<PhotoTopLevel, 'ambiguous'>[] = ['people', 'food', 'place', 'media', 'movement', 'work', 'event', 'ordinary'];
  const startedAt = Date.now();
  try {
    const raw = await generateStructuredTask({
      taskId: 'photo.top-level-ambiguity.v1',
      instructions: [
        'Resolve a genuine broad photo ambiguity using only visible Essence evidence.',
        'Return two different supplied evidence IDs and two different broad top-level categories.',
        'Do not choose routes, relationships, containers, OCR values, or confidence.',
      ].join(' '),
      prompt: `${photoTopLevelEvidenceText(frame)} Choose the two competing grounded meanings in priority order.`,
      fields: [
        { name: 'primaryEvidenceKey', description: 'First competing visible Essence ID', kind: 'enum', values: frame.primaryEvidenceKeys },
        { name: 'primaryTopLevel', description: 'Top level of first meaning', kind: 'enum', values: allowedTopLevels },
        { name: 'alternativeEvidenceKey', description: 'Second competing visible Essence ID', kind: 'enum', values: frame.primaryEvidenceKeys },
        { name: 'alternativeTopLevel', description: 'Top level of second meaning', kind: 'enum', values: allowedTopLevels },
      ],
    });
    if (!raw) return null;
    const primaryEvidenceKey = cleanToken(raw.primaryEvidenceKey);
    const alternativeEvidenceKey = cleanToken(raw.alternativeEvidenceKey);
    const primaryTopLevel = cleanEnum(raw.primaryTopLevel, allowedTopLevels) as Exclude<PhotoTopLevel, 'ambiguous'> | null;
    const alternativeTopLevel = cleanEnum(raw.alternativeTopLevel, allowedTopLevels) as Exclude<PhotoTopLevel, 'ambiguous'> | null;
    if (!primaryEvidenceKey || !alternativeEvidenceKey || !primaryTopLevel || !alternativeTopLevel) return null;
    return { primaryEvidenceKey, primaryTopLevel, alternativeEvidenceKey, alternativeTopLevel, rawResponse: raw, durationMs: Date.now() - startedAt };
  } catch {
    return null;
  }
}

export async function classifyPhotoJournalEnumOnDevice(
  _vision: DayVisionSummary,
  _rawVision?: PhotoVisionResult | null,
  semanticFrame?: PhotoSemanticFrame | null
): Promise<Record<string, unknown> | null> {
  if (!nativeFoundation?.generateStructuredAsync || !(nativeFoundation.isAvailable?.() ?? false)) return null;
  if (!semanticFrame || semanticFrame.stage !== 'foundation_reconciled' || !semanticFrame.flowKey || semanticFrame.flowKey === 'ambiguous') return null;
  if (semanticFrame.flowKey === 'people') return null;
  const evidence = photoTopLevelEvidenceText(semanticFrame);
  if (!evidence) return null;
  const candidates = JOURNAL_CLASSIFICATION_CATALOG.filter((entry) => entry.flowId === semanticFrame.flowKey);
  if (!candidates.length) return null;
  const candidateRouteKeys = candidates.map((entry) => entry.routeKey);
  const candidateDescriptions = candidates.map((entry) => [
    `${entry.label}. ${entry.definition}`,
    entry.exclusions.length ? `Exclude: ${entry.exclusions.slice(0, 2).join(' / ')}.` : '',
  ].filter(Boolean).join(' '));
  const allowedChildRouteKeys = [...candidateRouteKeys, 'undetermined'];
  const allowedChildDescriptions = [
    ...candidateDescriptions,
    'The visual evidence does not distinguish one child route from its siblings; the user must choose inside the selected broad flow.',
  ];
  const modelRequest = {
    requestedAt: new Date().toISOString(),
    stage: 'enum_route',
    outputSchema: 'PhotoRouteDecision.routeKey+confidence+independentGrounding',
    evidence,
    lockedFlowId: semanticFrame.flowKey,
    candidateRouteKeys: allowedChildRouteKeys,
    candidateDescriptions: allowedChildDescriptions,
    sampling: 'greedy',
  } as Record<string, unknown>;
  const routeInstructions = [
    'Re-read the complete visual evidence and classify one personal photo inside the already selected broad journal flow.',
    'This is a fresh child-category decision. Do not inherit or calculate from the top-level confidence.',
    'Select only among the supplied child routes. The input is visual evidence and OCR is intentionally absent.',
    'Treat the locked principal cluster as the subject and the remaining clusters only as context.',
    'Broad or contextual evidence that fits several sibling routes is insufficient for high confidence.',
    'Use high confidence only when the visual evidence distinguishes one supplied child route from its siblings.',
    'When the evidence does not distinguish a child route, return undetermined so the app can ask the user inside the selected broad flow.',
    'High means the subcategory is visually clear; medium means plausible but review is advisable; low means the user should choose.',
    'Do not extract names, OCR values, or editable fields in this classification pass.',
  ].join(' ');
  const routePrompt = [
    `Original visual evidence (OCR excluded):\n${evidence}`,
    `Selected broad flow: ${semanticFrame.flowKey}`,
    `Allowed child routes:\n${allowedChildRouteKeys.map((key, index) => `${key}: ${allowedChildDescriptions[index]}`).join('\n')}`,
    'From scratch, select the best child route and report confidence in this child decision.',
  ].join('\n\n');
  const routeFields: StructuredBridgeField[] = [
    { name: 'routeKey', description: 'Best child route inside the selected broad flow, or undetermined when siblings are not visually distinguishable', kind: 'enum', values: allowedChildRouteKeys },
    { name: 'confidence', description: 'Confidence in this child-route decision only', kind: 'enum', values: ['high', 'medium', 'low'] },
  ];
  Object.assign(modelRequest, {
    taskId: 'photo.child-route.v5',
    instructions: routeInstructions,
    prompt: routePrompt,
    fields: routeFields,
  });
  const runGenericRouteTask = async (taskId: string) => {
    const response = await generateStructuredTask({
      taskId,
      instructions: routeInstructions,
      prompt: routePrompt,
      fields: routeFields,
      sampling: 'greedy',
    });
    return response ? { ...response, photoSchemaVersion: FOUNDATION_PHOTO_SCHEMA_VERSION } : null;
  };
  const verifySpecificRoute = async (response: Record<string, unknown>) => {
    if (response.confidence !== 'high') {
      return {
        verificationStatus: 'skipped',
        verificationVerdict: 'not_distinguishable',
        verificationEvidenceKey: 'none',
        verificationConfidence: 'low',
      };
    }
    const proposedRouteKey = typeof response.routeKey === 'string' ? response.routeKey : '';
    if (proposedRouteKey === 'undetermined') {
      return {
        verificationStatus: 'skipped',
        verificationVerdict: 'not_distinguishable',
        verificationEvidenceKey: 'none',
        verificationConfidence: 'high',
      };
    }
    const proposedIndex = candidateRouteKeys.indexOf(proposedRouteKey);
    if (proposedIndex < 0) {
      return {
        verificationStatus: 'invalid_proposal',
        verificationVerdict: 'not_distinguishable',
        verificationEvidenceKey: 'none',
        verificationConfidence: 'low',
      };
    }
    const verificationInstructions = [
      'Verify whether one proposed child route is specifically grounded by the supplied visual evidence.',
      'This is an independent child-specificity check. Do not inherit confidence from either the broad-flow decision or the proposing child classifier.',
      'Do not choose a different route and do not infer identity, relationship, intent, ownership, named content, or activity unless the supplied observations visibly establish it.',
      'A broad subject observation that fits several sibling routes does not distinguish the proposal.',
      'Supporting context is valid only when it visibly describes the same locked principal subject and separates the proposal from every supplied sibling.',
      'Return supported only when one supplied evidence ID directly distinguishes the proposal from all siblings.',
      'Otherwise return not_distinguishable and evidenceKey none so the app can ask the user inside the selected broad flow.',
    ].join(' ');
    const siblingDescriptions = candidateRouteKeys
      .map((key, index) => ({ key, description: candidateDescriptions[index] }))
      .filter((candidate) => candidate.key !== proposedRouteKey)
      .map((candidate) => `${candidate.key}: ${candidate.description}`)
      .join('\n');
    const verificationPrompt = [
      `Original visual evidence (OCR excluded):\n${evidence}`,
      `Locked broad flow: ${semanticFrame.flowKey}`,
      `Proposed child route:\n${proposedRouteKey}: ${candidateDescriptions[proposedIndex]}`,
      `Sibling routes that must be ruled out by visible evidence:\n${siblingDescriptions}`,
      'Decide only whether the proposal is visually distinguishable from every sibling.',
    ].join('\n\n');
    const verificationFields: StructuredBridgeField[] = [
      {
        name: 'verdict',
        description: 'Whether visible evidence specifically distinguishes the proposed child from all siblings',
        kind: 'enum',
        values: ['supported', 'not_distinguishable'],
      },
      {
        name: 'evidenceKey',
        description: 'Supplied evidence ID that directly distinguishes the proposed child, or none',
        kind: 'enum',
        values: ['none', ...semanticFrame.classificationEvidenceKeys],
      },
      {
        name: 'confidence',
        description: 'Independent confidence in this child-specificity verification only',
        kind: 'enum',
        values: ['high', 'medium', 'low'],
      },
    ];
    const verificationRequest = {
      taskId: 'photo.child-route-verifier.v1',
      instructions: verificationInstructions,
      prompt: verificationPrompt,
      fields: verificationFields,
      sampling: 'greedy' as const,
    };
    Object.assign(modelRequest, { verificationRequest });
    try {
      const verification = await generateStructuredTask(verificationRequest);
      const verdict = verification?.verdict;
      const evidenceKey = verification?.evidenceKey;
      const confidence = verification?.confidence;
      const valid = (verdict === 'supported' || verdict === 'not_distinguishable')
        && typeof evidenceKey === 'string'
        && verificationFields[1].values?.includes(evidenceKey)
        && (confidence === 'high' || confidence === 'medium' || confidence === 'low');
      if (!valid) {
        return {
          verificationStatus: 'invalid_output',
          verificationVerdict: 'not_distinguishable',
          verificationEvidenceKey: 'none',
          verificationConfidence: 'low',
          verificationRawResponse: verification ?? {},
        };
      }
      return {
        verificationStatus: 'completed',
        verificationVerdict: verdict,
        verificationEvidenceKey: evidenceKey,
        verificationConfidence: confidence,
        verificationRawResponse: verification,
      };
    } catch (error) {
      return {
        verificationStatus: 'technical_failure',
        verificationVerdict: 'not_distinguishable',
        verificationEvidenceKey: 'none',
        verificationConfidence: 'low',
        verificationError: error instanceof Error ? error.message : String(error),
      };
    }
  };
  const startedAt = Date.now();
  try {
    const primaryStartedAt = Date.now();
    const response = await runGenericRouteTask('photo.child-route.v5') ?? {};
    const primaryDurationMs = Date.now() - primaryStartedAt;
    const attempts: Record<string, unknown>[] = [];
    if (hasRouteDecision(response)) {
      attempts.push(successfulEnumAttempt('primary', response, primaryDurationMs));
      const verification = await verifySpecificRoute(response);
      return enumRouteResponse(response, verification, modelRequest, startedAt, attempts);
    }

    attempts.push(emptyEnumAttempt('primary', response, primaryDurationMs));
    const retryStartedAt = Date.now();
    const retry = await runGenericRouteTask('photo.child-route.retry.v5') ?? {};
    const retryDurationMs = Date.now() - retryStartedAt;
    if (hasRouteDecision(retry)) {
      attempts.push(successfulEnumAttempt('simplified_retry', retry, retryDurationMs));
      const verification = await verifySpecificRoute(retry);
      return enumRouteResponse(retry, verification, modelRequest, startedAt, attempts);
    }
    attempts.push(emptyEnumAttempt('simplified_retry', retry, retryDurationMs));
    return {
      schemaVersion: FOUNDATION_PHOTO_SCHEMA_VERSION,
      stage: 'enum_route',
      status: 'technical_failure',
      errorCode: 'native_empty_response',
      errorDescription: 'Foundation returned no route fields for both compact enum attempts.',
      modelRequest,
      attemptsJson: JSON.stringify(attempts),
      nativeRoundTripMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      schemaVersion: FOUNDATION_PHOTO_SCHEMA_VERSION,
      stage: 'enum_route',
      status: 'technical_failure',
      errorCode: 'native_bridge_failure',
      errorDescription: error instanceof Error ? error.message : String(error),
      modelRequest,
      nativeRoundTripMs: Date.now() - startedAt,
    };
  }
}

function hasRouteDecision(response: Record<string, unknown> | null | undefined): boolean {
  return typeof response?.routeKey === 'string' && response.routeKey.trim().length > 0
    && (response.confidence === 'high' || response.confidence === 'medium' || response.confidence === 'low');
}

function enumRouteResponse(
  response: Record<string, unknown>,
  verification: Record<string, unknown>,
  modelRequest: Record<string, unknown>,
  startedAt: number,
  attempts: Record<string, unknown>[]
): Record<string, unknown> {
  return {
    ...response,
    ...verification,
    stage: 'enum_route',
    modelRequest,
    attemptsJson: JSON.stringify(attempts),
    nativeRoundTripMs: Date.now() - startedAt,
  };
}

function successfulEnumAttempt(kind: string, response: Record<string, unknown>, durationMs: number): Record<string, unknown> {
  return { kind, status: 'succeeded', errorCode: '', errorDescription: '', rawOutput: JSON.stringify(response), durationMs };
}

function emptyEnumAttempt(kind: string, response: Record<string, unknown>, durationMs: number): Record<string, unknown> {
  return {
    kind,
    status: 'failed',
    errorCode: 'native_empty_response',
    errorDescription: 'Native Foundation classifier returned an empty route decision.',
    rawOutput: JSON.stringify(response),
    durationMs,
  };
}

export async function enrichPhotoJournalOnDevice(
  routeKey: string,
  fieldLabel: string,
  visualSubject: string | null,
  vision: { recognizedText?: { text: string; confidence: number }[] },
  rawVision?: PhotoVisionResult | null
): Promise<Record<string, unknown> | null> {
  if ((!nativeFoundation?.generateStructuredAsync && !nativeFoundation?.enrichPhotoJournalAsync) || !(nativeFoundation.isAvailable?.() ?? false)) return null;
  const recognized = rawVision?.recognizedText?.length ? rawVision.recognizedText : vision.recognizedText ?? [];
  const candidates = recognized.filter((item) => !!item.text.trim()).slice(0, 16);
  if (!candidates.length) return null;
  try {
    const regions = candidates.map((item) => {
      const region = 'region' in item
        ? item.region as { x: number; y: number; width: number; height: number } | undefined
        : undefined;
      return region ? regionDescription(region) : '';
    });
    const ocr = candidates.map((item, index) => `[${index}] ${item.text.trim()} confidence ${item.confidence.toFixed(3)}${regions[index] ? `; ${regions[index]}` : ''}`).join(' | ');
    const isBook = routeKey === 'studio.book';
    const runOcrTask = (repairReason?: string) => generateStructuredTask({
      taskId: isBook ? (repairReason ? 'photo.book-ocr.repair.v1' : 'photo.book-ocr.v1') : 'photo.journal-ocr.v1',
      instructions: [
        'Fill one editable manual-journal field from OCR for an already selected immutable route.',
        'Interpret all OCR lines together. OCR order is not semantic priority. Reassemble split lines only from supplied words.',
        'World knowledge may distinguish title, author, subtitle, and promotion, but may never add absent words.',
        'Discard mangled, generic, unrelated, or unsupported text. Printed names never establish a relationship.',
        photoJournalOcrInstructions(routeKey, fieldLabel),
        repairReason ? `The previous extraction was rejected because ${repairReason}. Keep title, author, subtitle, and marketing OCR indexes separate. Discard if no defensible value remains.` : '',
      ].filter(Boolean).join(' '),
      prompt: `Locked journal route: ${routeKey}. Editable field: ${fieldLabel}. Visual subject: ${visualSubject ?? ''}. OCR: ${ocr}`,
      fields: isBook ? [
        { name: 'disposition', description: 'Whether OCR supports an official book title', kind: 'enum', values: ['used', 'partial', 'discard'] },
        { name: 'title', description: 'Official main book title using only supplied OCR words', kind: 'string' },
        { name: 'author', description: 'Author name from OCR or empty', kind: 'string' },
        { name: 'subtitle', description: 'Optional subtitle from OCR or empty', kind: 'string' },
        { name: 'marketingCopy', description: 'Promotional or endorsement text rejected as title or empty', kind: 'string' },
        { name: 'confidence', description: 'Confidence from 0 to 1 as a decimal string', kind: 'string' },
        { name: 'usedTitleOcrIndexes', description: 'Comma-separated zero-based OCR indexes used only for title', kind: 'string' },
        { name: 'usedAuthorOcrIndexes', description: 'Comma-separated zero-based OCR indexes used only for author', kind: 'string' },
        { name: 'usedSubtitleOcrIndexes', description: 'Comma-separated zero-based OCR indexes used only for subtitle', kind: 'string' },
        { name: 'usedMarketingOcrIndexes', description: 'Comma-separated zero-based OCR indexes used only for marketing copy', kind: 'string' },
        { name: 'reason', description: 'Short explanation distinguishing title from other cover text', kind: 'string' },
      ] : [
        { name: 'disposition', description: 'Whether OCR provides a useful field value', kind: 'enum', values: ['used', 'partial', 'discard'] },
        { name: 'specific', description: 'Short editable field value using only supplied OCR words', kind: 'string' },
        { name: 'confidence', description: 'Confidence from 0 to 1 as a decimal string', kind: 'string' },
        { name: 'usedOcrIndexes', description: 'Comma-separated zero-based OCR indexes used', kind: 'string' },
        { name: 'reason', description: 'Short reason for using or discarding OCR', kind: 'string' },
      ],
    });
    const generic = await runOcrTask();
    if (generic) {
      if (!isBook) return validateGenericJournalOcr(generic, candidates.map((item) => item.text), routeKey, 'photo-journal-generic-bridge-v2');
      const first = validateBookJournalOcr(generic, candidates.map((item) => item.text), routeKey, 'photo-journal-book-generic-v1');
      if (!first.issue) return first.response;
      const repaired = await runOcrTask(first.issue);
      if (repaired) return validateBookJournalOcr(repaired, candidates.map((item) => item.text), routeKey, 'photo-journal-book-generic-v1-repair').response;
      return first.response;
    }
    const legacy = await nativeFoundation?.enrichPhotoJournalAsync?.(
      routeKey, fieldLabel, visualSubject ?? '',
      candidates.map((item) => item.text), candidates.map((item) => item.confidence), regions,
      photoJournalOcrInstructions(routeKey, fieldLabel)
    ) ?? null;
    if (!legacy) return null;
    return isBook
      ? validateBookJournalOcr(legacy, candidates.map((item) => item.text), routeKey, 'photo-journal-book-native-v1').response
      : validateGenericJournalOcr(legacy, candidates.map((item) => item.text), routeKey, 'photo-journal-generic-native-v1');
  } catch {
    return null;
  }
}

function validateGenericJournalOcr(
  raw: Record<string, unknown>,
  ocrLines: string[],
  routeKey: string,
  promptVersion: string
): Record<string, unknown> {
  const specific = cleanText(raw.specific, 120) ?? '';
  const indexes = parseOcrIndexes(raw.usedOcrIndexes, ocrLines.length);
  const indexedText = indexes.map((index) => ocrLines[index]).join(' ');
  let issue: string | null = null;
  if (cleanToken(raw.disposition) === 'discard' || !specific) issue = 'no_useful_ocr_value_returned';
  else if (!indexes.length) issue = 'ocr_value_has_no_declared_source_indexes';
  else if (!ocrValueIsSupported(specific, indexedText)) issue = 'ocr_value_not_grounded_in_declared_indexes';
  else if (!ocrValueIsSupported(specific, ocrLines.join(' '))) issue = 'ocr_value_contains_words_absent_from_ocr';
  const accepted = !issue;
  return {
    ...raw,
    disposition: accepted ? cleanToken(raw.disposition) ?? 'used' : 'discard',
    specific: accepted ? specific : '',
    usedOcrIndexes: accepted ? indexes.join(',') : '',
    lockedRouteKey: routeKey,
    promptVersion,
    validationIssue: issue ?? '',
    reason: accepted ? raw.reason : issue,
  };
}

function validateBookJournalOcr(
  raw: Record<string, unknown>,
  ocrLines: string[],
  routeKey: string,
  promptVersion: string
): { response: Record<string, unknown>; issue: string | null } {
  const title = cleanText(raw.title, 120) ?? '';
  const author = cleanText(raw.author, 120) ?? '';
  const subtitle = cleanText(raw.subtitle, 120) ?? '';
  const marketingCopy = cleanText(raw.marketingCopy, 240) ?? '';
  const titleIndexes = parseOcrIndexes(raw.usedTitleOcrIndexes, ocrLines.length);
  const authorIndexes = parseOcrIndexes(raw.usedAuthorOcrIndexes, ocrLines.length);
  const subtitleIndexes = parseOcrIndexes(raw.usedSubtitleOcrIndexes, ocrLines.length);
  const marketingIndexes = parseOcrIndexes(raw.usedMarketingOcrIndexes, ocrLines.length);
  const otherIndexes = new Set([...authorIndexes, ...subtitleIndexes, ...marketingIndexes]);
  const indexedTitleText = titleIndexes.map((index) => ocrLines[index]).join(' ');
  const normalizedTitle = normalizeOcrValue(title);
  let issue: string | null = null;
  if (cleanToken(raw.disposition) === 'discard' || !normalizedTitle) issue = 'no_official_title_returned';
  else if (!titleIndexes.length || !ocrValueIsSupported(title, indexedTitleText)) issue = 'title_not_grounded_in_declared_ocr_indexes';
  else if (titleIndexes.some((index) => otherIndexes.has(index))) issue = 'title_indexes_overlap_author_subtitle_or_marketing';
  else if (normalizedTitle === normalizeOcrValue(author)) issue = 'title_duplicates_author';
  else if (normalizedTitle === normalizeOcrValue(subtitle)) issue = 'title_is_subtitle_only';
  else if (normalizedTitle === normalizeOcrValue(marketingCopy) || /\b(bestseller|best selling|award winning|major film|phenomenal)\b/.test(normalizedTitle)) issue = 'title_is_marketing_copy';
  else if (!ocrValueIsSupported(title, ocrLines.join(' '))) issue = 'title_contains_words_absent_from_ocr';
  const accepted = !issue;
  return {
    issue,
    response: {
      ...raw,
      disposition: accepted ? cleanToken(raw.disposition) ?? 'used' : 'discard',
      specific: accepted ? title : '',
      usedOcrIndexes: accepted ? String(raw.usedTitleOcrIndexes ?? '') : '',
      semanticRole: accepted ? 'official_book_title' : 'none',
      author,
      subtitle,
      rejectedMarketingCopy: marketingCopy,
      lockedRouteKey: routeKey,
      promptVersion,
      validationIssue: issue ?? '',
      reason: accepted ? raw.reason : issue,
    },
  };
}

function parseOcrIndexes(value: unknown, count: number): number[] {
  if (typeof value !== 'string' || !value.trim()) return [];
  const indexes = [...new Set(value.split(',').map((part) => Number(part.trim())))];
  return indexes.every((index) => Number.isInteger(index) && index >= 0 && index < count) ? indexes.sort((left, right) => left - right) : [];
}

function normalizeOcrValue(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function ocrValueIsSupported(value: string, ocr: string): boolean {
  const tokens = normalizeOcrValue(value).split(' ').filter((token) => token.length > 2);
  const ocrTokens = new Set(normalizeOcrValue(ocr).split(' ').filter(Boolean));
  return tokens.length > 0 && tokens.every((token) => ocrTokens.has(token));
}

function photoJournalOcrInstructions(routeKey: string, fieldLabel: string): string {
  const common = `Return only the value appropriate for “${fieldLabel}” using words supported by OCR. `
    + 'Interpret all OCR lines together instead of selecting the first or shortest line. '
    + 'Prefer the official main title or named subject over promotional copy, subtitles, bylines, credits, interface labels, and background text. '
    + 'World knowledge may help distinguish the roles of supplied text, but must never add words absent from OCR. Discard uncertain or mangled text.';

  if (routeKey === 'studio.book') {
    return `${common} This is a book cover. Separate the cover text into: official book title, optional subtitle, author, and endorsement or marketing copy. `
      + 'The editable value must be the official main book title, not the author and not a cover claim. '
      + 'Phrases such as “the phenomenal”, “international bestseller”, “award-winning”, “now a major film”, review quotes, and publisher slogans are marketing copy, even when they appear first or prominently. '
      + 'Prefer a complete title line over a short teaser fragment. For example, when OCR contains a bestseller claim, an author name, and “A Brief History of Time”, return “A Brief History of Time”.';
  }
  if (routeKey === 'studio.film' || routeKey === 'studio.show') {
    return `${common} Separate the work title from actor names, episode metadata, channel names, ratings, playback controls, and promotional slogans.`;
  }
  if (routeKey === 'studio.game') {
    return `${common} Separate the game title from player names, scores, menu commands, platform labels, and interface text.`;
  }
  if (routeKey === 'studio.music' || routeKey === 'studio.podcast') {
    return `${common} Separate the work title from artist or host names, track metadata, playback controls, and platform labels.`;
  }
  if (routeKey.startsWith('went_somewhere.')) {
    return `${common} Prefer the actual venue or place name over advertisements, directions, opening-hours text, and incidental signs.`;
  }
  if (routeKey.startsWith('food.')) {
    return `${common} Prefer the dish or drink name over prices, menu headings, dietary badges, and promotional copy.`;
  }
  return common;
}

export async function readPhotoAnchorOnDevice(
  vision: { concepts?: { name: string; peakConfidence: number }[]; dominantSubjectCoverage?: number; maxFaceCount?: number },
  rawVision?: PhotoVisionResult | null
): Promise<DeepSceneRead | null> {
  if (!nativeFoundation?.classifyPhotoAnchorAsync || !(nativeFoundation.isAvailable?.() ?? false)) return null;
  const ranked = rawVision?.labels?.length
    ? [...rawVision.labels].sort((left, right) => right.confidence - left.confidence).slice(0, 12)
    : [...(vision.concepts ?? [])]
        .sort((left, right) => right.peakConfidence - left.peakConfidence)
        .slice(0, 12)
        .map((item) => ({ name: item.name, confidence: item.peakConfidence }));
  if (!ranked.length) return null;
  const startedAt = Date.now();
  try {
    const raw = await nativeFoundation.classifyPhotoAnchorAsync(
      ranked.map((item) => item.name),
      ranked.map((item) => item.confidence),
      Math.max(0, Math.trunc(rawVision?.faceCount ?? vision.maxFaceCount ?? 0)),
      Math.max(0, Math.trunc(rawVision?.humanCount ?? rawVision?.humans?.length ?? 0)),
      rawVision?.documentDetected === true,
      Math.max(0, Math.min(1, vision.dominantSubjectCoverage ?? dominantCoverage(rawVision))),
      spatialCandidateDescriptions(rawVision)
    );
    const routeKey = cleanToken(raw.routeKey);
    if (!routeKey || !PHOTO_ROUTES.has(routeKey)) return null;
    if (!photoAnchorHasRequiredVisionSupport(routeKey, ranked.map((item) => item.name), rawVision?.documentDetected === true)) return null;
    const route = photoRouteShape(routeKey);
    if (!route) return null;
    const representationV2 = cleanEnum(raw.representation, ['physical_scene', 'physical_artwork', 'physical_document', 'device_showing_content', 'native_digital_image', 'screenshot', 'unknown']);
    const subject = cleanText(raw.subject, 60);
    const modelOcrPurpose = cleanEnum(raw.ocrPurpose, ['identity', 'context', 'ignore']) as DeepSceneRead['ocrPurpose'];
    const ocrPurpose: DeepSceneRead['ocrPurpose'] = routeKey.startsWith('media.')
      ? 'identity'
      : routeKey === 'document'
        ? 'context'
        : modelOcrPurpose;
    return {
      memoryDomain: route.memoryDomain,
      type: route.type,
      subject,
      mediaKind: route.mediaKind,
      title: null,
      creator: null,
      representation: legacyRepresentation(representationV2),
      representationV2,
      container: cleanEnum(raw.container, ['none', 'book', 'screen', 'frame_or_canvas', 'poster_or_print', 'document', 'packaging', 'unknown']),
      confidence: cleanConfidence(raw.confidence),
      alternatives: cleanToken(raw.alternativeRouteKey) ? [cleanToken(raw.alternativeRouteKey)!] : [],
      supportingSubjects: cleanCsv(raw.supportingSubjects, 4),
      promptVersion: cleanText(raw.promptVersion, 48),
      lockedRouteKey: routeKey,
      ocrPurpose,
      photoSchemaVersion: cleanInteger(raw.photoSchemaVersion),
      foundationPasses: {
        visualAnchor: { status: 'used', durationMs: Date.now() - startedAt, rawResponse: raw, reason: null },
        ocrEnrichment: null,
      },
    };
  } catch {
    return null;
  }
}

function photoAnchorHasRequiredVisionSupport(routeKey: string, labels: string[], documentDetected: boolean): boolean {
  const normalized = labels.map((label) => label.toLowerCase().replace(/_/g, ' '));
  const has = (pattern: RegExp) => normalized.some((label) => pattern.test(label));
  // A model-generated book container cannot corroborate its own book route.
  // Require independent Vision/document evidence so a television is never
  // rewritten as a book merely because the structured fields agree together.
  if (routeKey === 'media.book') return documentDetected || has(/\b(book|bookshelf|magazine|document|page|paperback|hardback)\b/);
  return true;
}

export async function enrichPhotoAnchorOnDevice(
  anchor: DeepSceneRead,
  vision: { recognizedText?: { text: string; confidence: number }[] },
  rawVision?: PhotoVisionResult | null
): Promise<DeepSceneRead> {
  const priorPasses = anchor.foundationPasses;
  if (!nativeFoundation?.enrichPhotoOcrAsync || !anchor.lockedRouteKey || anchor.ocrPurpose === 'ignore') {
    return priorPasses ? {
      ...anchor,
      foundationPasses: {
        ...priorPasses,
        ocrEnrichment: { status: 'skipped', durationMs: 0, rawResponse: null, reason: anchor.ocrPurpose === 'ignore' ? 'visual_anchor_marked_ocr_irrelevant' : 'ocr_enrichment_unavailable' },
      },
    } : anchor;
  }
  const recognized = rawVision?.recognizedText?.length ? rawVision.recognizedText : vision.recognizedText ?? [];
  const candidates = recognized.filter((item) => !!item.text.trim()).slice(0, 16);
  if (!candidates.length) {
    return priorPasses ? {
      ...anchor,
      foundationPasses: { ...priorPasses, ocrEnrichment: { status: 'skipped', durationMs: 0, rawResponse: null, reason: 'no_ocr_text' } },
    } : anchor;
  }
  const startedAt = Date.now();
  try {
    const raw = await nativeFoundation.enrichPhotoOcrAsync(
      anchor.lockedRouteKey,
      anchor.representationV2 ?? 'unknown',
      anchor.container ?? 'unknown',
      anchor.subject ?? '',
      candidates.map((item) => item.text),
      candidates.map((item) => item.confidence),
      candidates.map((item) => {
        const region = 'region' in item
          ? item.region as { x: number; y: number; width: number; height: number } | undefined
          : undefined;
        return region ? regionDescription(region) : '';
      })
    );
    const disposition = cleanEnum(raw.disposition, ['used', 'partial', 'discard']);
    const durationMs = Date.now() - startedAt;
    if (!disposition || disposition === 'discard') {
      return {
        ...anchor,
        foundationPasses: priorPasses ? {
          ...priorPasses,
          ocrEnrichment: { status: disposition === 'discard' ? 'discarded' : 'failed', durationMs, rawResponse: raw, reason: cleanText(raw.reason, 120) ?? 'invalid_ocr_enrichment' },
        } : undefined,
      };
    }
    const title = cleanText(raw.title, 80);
    const creator = cleanText(raw.creator, 60);
    const subject = cleanText(raw.subject, 60);
    const refinedSubject = anchor.lockedRouteKey.startsWith('media.')
      ? title ?? anchor.subject
      : subject ?? title ?? anchor.subject;
    return {
      ...anchor,
      subject: refinedSubject,
      title: title ?? anchor.title,
      creator: creator ?? anchor.creator,
      confidence: Math.min(anchor.confidence ?? 1, cleanConfidence(raw.confidence) ?? anchor.confidence ?? 0.8),
      promptVersion: cleanText(raw.promptVersion, 48) ?? anchor.promptVersion,
      foundationPasses: priorPasses ? {
        ...priorPasses,
        ocrEnrichment: { status: 'used', durationMs, rawResponse: raw, reason: cleanText(raw.reason, 120) },
      } : undefined,
    };
  } catch (error) {
    return {
      ...anchor,
      foundationPasses: priorPasses ? {
        ...priorPasses,
        ocrEnrichment: { status: 'failed', durationMs: Date.now() - startedAt, rawResponse: null, reason: error instanceof Error ? error.message : 'ocr_enrichment_failed' },
      } : undefined,
    };
  }
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/^["'“”]+|["'“”]+$/g, '').trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

function cleanToken(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;
}

function cleanConfidence(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : null;
}

function cleanInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isInteger(parsed) ? parsed : null;
}

function cleanCsv(value: unknown, limit: number): string[] {
  return typeof value === 'string' ? value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, limit) : [];
}

function dominantCoverage(raw: PhotoVisionResult | null | undefined): number {
  const region = raw?.dominantSubject;
  return region ? Math.max(0, Math.min(1, region.width * region.height)) : 0;
}

function regionDescription(region: { x: number; y: number; width: number; height: number }): string {
  return `x ${region.x.toFixed(3)}, y ${region.y.toFixed(3)}, width ${region.width.toFixed(3)}, height ${region.height.toFixed(3)}`;
}

function photoRouteShape(routeKey: string): { memoryDomain: string; type: string; mediaKind: string | null } | null {
  if (routeKey.startsWith('media.')) return { memoryDomain: 'media', type: 'media', mediaKind: routeKey.slice('media.'.length) };
  if (routeKey.startsWith('animal.')) return { memoryDomain: 'animal', type: 'pet', mediaKind: null };
  switch (routeKey) {
    case 'people': return { memoryDomain: 'people', type: 'social', mediaKind: null };
    case 'food': return { memoryDomain: 'food', type: 'food', mediaKind: null };
    case 'movement': return { memoryDomain: 'movement', type: 'activity', mediaKind: null };
    case 'work': return { memoryDomain: 'work', type: 'activity', mediaKind: null };
    case 'life_event': return { memoryDomain: 'life_event', type: 'social', mediaKind: null };
    case 'place':
    case 'nature':
    case 'document':
    case 'screen':
    case 'other': return { memoryDomain: routeKey === 'document' || routeKey === 'screen' ? 'other' : routeKey, type: routeKey, mediaKind: null };
    default: return null;
  }
}

// The deep hierarchical read (media-aware). Null when the native method is
// missing (older build), the model is unavailable, or the call fails — the
// caller then tries the legacy classify, then the rule engine.
export async function readSceneOnDevice(
  tags: string[],
  ocrLines: string[],
  faceCount: number,
  _imageUri?: string | null,
  _rawVision?: PhotoVisionResult | null
): Promise<DeepSceneRead | null> {
  if (
    (!nativeFoundation?.readMemoryV2Async && !nativeFoundation?.readMemoryAsync && !nativeFoundation?.readSceneAsync) ||
    !(nativeFoundation.isAvailable?.() ?? false) ||
    (tags.length === 0 && ocrLines.length === 0)
  ) {
    return null;
  }
  try {
    if (nativeFoundation.readMemoryV2Async) {
      const memory = await nativeFoundation.readMemoryV2Async(
        tags.slice(0, 12),
        ocrLines.slice(0, 12),
        Math.max(0, Math.trunc(faceCount)),
        spatialCandidateDescriptions(_rawVision)
      );
      const structured = sceneFromMemoryResult(memory);
      if (structured) return structured;
    }
    if (nativeFoundation.readMemoryAsync) {
      const memory = await nativeFoundation.readMemoryAsync(
        tags.slice(0, 12),
        ocrLines.slice(0, 12),
        Math.max(0, Math.trunc(faceCount))
      );
      const structured = sceneFromMemoryResult(memory);
      if (structured) return structured;
    }
    if (!nativeFoundation.readSceneAsync) return null;
    const result = await nativeFoundation.readSceneAsync(
      tags.slice(0, 12),
      ocrLines.slice(0, 12),
      Math.max(0, Math.trunc(faceCount))
    );
    const type = typeof result?.type === 'string' ? result.type.trim().toLowerCase() : '';
    if (!type) return null;
    const mediaKind = typeof result?.mediaKind === 'string' ? result.mediaKind.trim().toLowerCase() : '';
    return {
      memoryDomain: null,
      type,
      subject: cleanText(result?.subject, 60),
      mediaKind: mediaKind && mediaKind !== 'none' ? mediaKind : null,
      title: cleanText(result?.title, 60),
      creator: cleanText(result?.creator, 48),
      representation: null,
      representationV2: null,
      container: null,
      confidence: null,
      alternatives: [],
      supportingSubjects: [],
      promptVersion: null,
    };
  } catch {
    return null;
  }
}

function spatialCandidateDescriptions(raw: PhotoVisionResult | null | undefined): string[] {
  const candidates = (raw?.regionClassifications ?? []).map((item, index) => {
    const area = Math.max(0, item.region.width * item.region.height);
    const labels = [...item.labels]
      .sort((left, right) => right.confidence - left.confidence)
      .slice(0, 3)
      .map((label) => `${label.name} ${label.confidence.toFixed(2)}`)
      .join(', ');
    const centreX = item.region.x + item.region.width / 2;
    const centreY = item.region.y + item.region.height / 2;
    return `region ${index + 1}: ${labels}; coverage ${area.toFixed(2)}; centre ${centreX.toFixed(2)},${centreY.toFixed(2)}; saliency ${item.region.confidence.toFixed(2)}`;
  });
  return candidates.slice(0, 3);
}

function sceneFromMemoryResult(memory: {
  domain?: unknown;
  subject?: unknown;
  mediaKind?: unknown;
  title?: unknown;
  creator?: unknown;
  representation?: unknown;
  container?: unknown;
  confidence?: unknown;
  alternatives?: unknown;
  supportingSubjects?: unknown;
  promptVersion?: unknown;
} | null | undefined): DeepSceneRead | null {
  const domain = typeof memory?.domain === 'string' ? memory.domain.trim().toLowerCase() : '';
  const type = mapMemoryDomainToScene(domain);
  if (!type || !memory) return null;
  const mediaKind = typeof memory.mediaKind === 'string' ? memory.mediaKind.trim().toLowerCase() : '';
  return {
    memoryDomain: domain,
    type,
    subject: cleanText(memory.subject, 60),
    mediaKind: mediaKind && mediaKind !== 'none' ? mediaKind : null,
    title: cleanText(memory.title, 60),
    creator: cleanText(memory.creator, 48),
    representation: legacyRepresentation(memory.representation),
    representationV2: cleanEnum(memory.representation, ['physical_scene', 'physical_artwork', 'physical_document', 'device_showing_content', 'native_digital_image', 'screenshot', 'unknown']),
    container: cleanEnum(memory.container, ['none', 'book', 'screen', 'frame_or_canvas', 'poster_or_print', 'document', 'packaging', 'unknown']),
    confidence: Number.isFinite(Number(memory.confidence)) ? Math.min(1, Math.max(0, Number(memory.confidence))) : null,
    alternatives: typeof memory.alternatives === 'string' ? memory.alternatives.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 3) : [],
    supportingSubjects: typeof memory.supportingSubjects === 'string'
      ? memory.supportingSubjects.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 4)
      : [],
    promptVersion: cleanText(memory.promptVersion, 48),
  };
}

function cleanEnum(value: unknown, allowed: string[]): string | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return allowed.includes(normalized) ? normalized : null;
}

function legacyRepresentation(value: unknown): DeepSceneRead['representation'] {
  const normalized = String(value);
  if (normalized === 'physical_scene' || normalized === 'physical_artwork' || normalized === 'physical_document') return 'real_world';
  if (normalized === 'device_showing_content' || normalized === 'native_digital_image' || normalized === 'screenshot') return 'screen_content';
  return normalized === 'real_world' || normalized === 'screen_content' || normalized === 'unknown'
    ? normalized as DeepSceneRead['representation']
    : null;
}

function mapMemoryDomainToScene(domain: string): string | null {
  switch (domain) {
    case 'animal': return 'pet';
    case 'people': return 'social';
    case 'movement':
    case 'work': return 'activity';
    case 'life_event': return 'social';
    case 'food':
    case 'media':
    case 'place':
    case 'nature':
    case 'other': return domain;
    default: return null;
  }
}

export async function classifySceneOnDevice(
  tags: string[],
  faceCount: number
): Promise<{ type: string; subject: string | null } | null> {
  if (!nativeFoundation?.classifySceneAsync || !isFoundationSceneAvailable() || tags.length === 0) {
    return null;
  }
  try {
    const result = await nativeFoundation.classifySceneAsync(tags.slice(0, 12), Math.max(0, Math.trunc(faceCount)));
    const type = typeof result?.type === 'string' ? result.type.trim().toLowerCase() : '';
    if (!type) return null;
    const subject = typeof result?.subject === 'string' && result.subject.trim() ? result.subject.trim() : null;
    return { type, subject };
  } catch {
    return null;
  }
}
