import type { DayVisionSummary, JournalRouteProposal, PhotoVisionResult } from '@/types/home';
import type { IconSymbolName } from '@/components/ui/icon-symbol';
import {
  enrichPhotoJournalOnDevice,
  classifyPhotoJournalEnumOnDevice,
  FOUNDATION_PHOTO_SCHEMA_VERSION,
  foundationSceneAvailability,
  refinePhotoSemanticFrameOnDevice,
  retryPhotoTopLevelOnDevice,
  supportsFoundationPhotoJournalSchema,
} from '@/utils/foundation-scene';
import {
  buildPhotoJournalEvidence,
  prioritizedFoundationSignals,
  rankPhotoJournalRouteSupport,
  type PhotoJournalEvidencePacket,
  type PhotoJournalRouteSupport,
} from '@/utils/photo-journal-evidence';
import {
  buildPhotoSemanticFrame,
  photoSemanticFlowForTopLevel,
  reconcilePhotoSemanticFrame,
  type PhotoModelConfidence,
  type PhotoSemanticAttempt,
  type PhotoSemanticFrame,
  type PhotoTopLevelDecision,
  type PhotoTopLevelFailure,
  type PhotoTopLevelResult,
} from '@/utils/photo-semantic-frame';
import { journalRouteForKey } from '@/utils/journal-routing';
import { manualJournalFlow } from '@/utils/manual-journal-registry';

const ROUTE_MIN_SCORE = 0.76;
const ROUTE_MIN_LEAD = 0.12;
const ROUTE_MIN_EVIDENCE_SUPPORT = 0.55;
const ROUTE_CANDIDATE_MIN_EVIDENCE_SUPPORT = 0.3;
const ROUTE_COMPETITOR_MARGIN = 0.1;
const ALTERNATIVE_MIN_MODEL_SCORE = 0.25;
// On-device Foundation Models can legitimately take several seconds to warm
// up and produce a guided response. Five seconds caused valid generations to
// be abandoned just before they completed, especially on the first request
// after launch. Keep a bounded escape hatch, but give each stage enough time
// to finish while the progressive UI remains available.
const MODEL_STAGE_TIMEOUT_MS = 15_000;

export type PhotoJournalAttempt = {
  kind: 'primary' | 'repair' | 'simplified_retry';
  status: 'succeeded' | 'invalid' | 'failed' | 'skipped';
  errorCode: string | null;
  errorDescription: string | null;
  rawOutput: string | null;
  durationMs: number | null;
};

export type PhotoJournalCandidate = {
  id: string;
  kind: 'route' | 'flow';
  label: string;
  icon: IconSymbolName;
  confidence: number;
  flowId: string;
  route: JournalRouteProposal | null;
  modelConfidence: number | null;
  evidenceSupport: number;
  supportingSignals: string[];
  origin: 'foundation_primary' | 'foundation_alternative' | 'vision_catalog' | 'flow_confirmation' | 'media_confirmation';
};

export type PhotoJournalDecisionBasis = {
  autoRouteAllowed: boolean;
  checks: {
    outputConsistent: boolean;
    confidenceSource: 'vision_evidence' | 'legacy_model_authored';
    modelConfidence: number | null;
    minimumModelConfidence: number | null;
    modelLead: number | null;
    minimumModelLead: number | null;
    evidenceSupport: number;
    minimumEvidenceSupport: number;
    competingRouteKey: string | null;
    competingEvidenceSupport: number;
    competitorMargin: number;
  };
  rejectedAlternatives: { routeKey: string; reason: string }[];
  reasons: string[];
};

export type PhotoJournalClassification = {
  kind: 'exact' | 'flow_only' | 'ambiguous' | 'unrouted';
  stage: 'enum_route' | 'manual';
  flowId: string | null;
  categoryId: string | null;
  candidates: PhotoJournalCandidate[];
  selected: JournalRouteProposal | null;
  selectedFlowId: string | null;
  visualSubject: string | null;
  provider: 'appleFoundation' | 'deterministic' | 'manual';
  rawResponse: Record<string, unknown> | null;
  enumResponse: Record<string, unknown> | null;
  evidence: PhotoJournalEvidencePacket | null;
  attempts: PhotoJournalAttempt[];
  decisionBasis: PhotoJournalDecisionBasis | null;
  semanticFrame?: PhotoSemanticFrame | null;
  reason: string | null;
  navigationAction: 'open_details' | 'open_flow' | 'confirm_candidates' | 'manual';
  topLevelConfidence?: PhotoModelConfidence | null;
  subcategoryConfidence?: PhotoModelConfidence | null;
};

export type ProgressivePhotoJournalAnalysis = {
  initial: PhotoJournalClassification;
  refinement: Promise<PhotoJournalClassification> | null;
};

export type PhotoJournalFieldProposal = {
  routeKey: string;
  value: string;
  confidence: number;
  provenance: 'appleFoundation';
  prefill: boolean;
  rawResponse: Record<string, unknown>;
};

export async function analyzePhotoJournal(
  vision: DayVisionSummary,
  rawVision: PhotoVisionResult | null
): Promise<PhotoJournalClassification> {
  const progressive = preparePhotoJournalAnalysis(vision, rawVision);
  return progressive.refinement ? progressive.refinement : progressive.initial;
}

export function preparePhotoJournalAnalysis(
  vision: DayVisionSummary,
  rawVision: PhotoVisionResult | null
): ProgressivePhotoJournalAnalysis {
  const evidence = buildPhotoJournalEvidence(vision, rawVision);
  const baseFrame = buildPhotoSemanticFrame(evidence);
  const initial = classificationFromSemanticFrame(baseFrame, null);
  const availability = foundationSceneAvailability();
  if (!availability.available || !supportsFoundationPhotoJournalSchema()) {
    const frame = reconcilePhotoSemanticFrame(baseFrame, null, {
      status: 'unavailable', reason: `Foundation semantic model unavailable: ${availability.reason}`,
    });
    return { initial: classificationFromSemanticFrame(frame, null), refinement: null };
  }
  const refinement = refinePhotoJournalAnalysis(baseFrame, vision, rawVision);
  return { initial, refinement };
}

async function refinePhotoJournalAnalysis(
  baseFrame: PhotoSemanticFrame,
  vision: DayVisionSummary,
  rawVision: PhotoVisionResult | null
): Promise<PhotoJournalClassification> {
  let result = await withSemanticTimeout(refinePhotoSemanticFrameOnDevice(baseFrame));
  let attempts: PhotoSemanticAttempt[] = [semanticAttempt('primary', result, 'Foundation top-level classification timed out')];

  // Retry transport failures and malformed output as a fresh, identical greedy
  // classification. Never show the previous answer to the retrying model.
  if (!result || isPhotoTopLevelFailure(result)) {
    result = await withSemanticTimeout(retryPhotoTopLevelOnDevice(baseFrame));
    attempts = [...attempts, semanticAttempt('technical_retry', result, 'Foundation top-level retry timed out')];
  }

  const semantic = photoTopLevelDecision(result);
  const frame = reconcilePhotoSemanticFrame(baseFrame, semantic, semantic
    ? undefined
    : {
        status: 'failed',
        reason: photoTopLevelFailureReason(result, 'Foundation top-level task failed'),
        durationMs: result?.durationMs ?? null,
        rawResponse: result?.rawResponse ?? null,
      }, attempts);

  const broad = classificationFromSemanticFrame(frame, frame.foundation.rawResponse);
  if (!semantic || semantic.confidence !== 'high' || frame.unresolvedFacet !== 'none') {
    return broad;
  }
  // A photo can establish that a person is central, but it cannot establish
  // the user's relationship to that person. People is therefore always the
  // final automatic photo-routing level; the user chooses its child category.
  if (frame.flowKey === 'people') {
    return { ...broad, reason: 'photo_people_subcategory_requires_user_selection' };
  }

  const childRaw = await withSemanticTimeout(classifyPhotoJournalEnumOnDevice(vision, rawVision, frame));
  if (!childRaw) return { ...broad, reason: 'foundation_child_route_failed' };
  return normalizePhotoJournalEnumRoute(childRaw, frame.evidence, frame);
}

function isPhotoTopLevelFailure(
  result: PhotoTopLevelResult | null,
  kind?: PhotoTopLevelFailure['failureKind']
): result is PhotoTopLevelFailure {
  return !!result && 'failureKind' in result && (!kind || result.failureKind === kind);
}

function photoTopLevelDecision(result: PhotoTopLevelResult | null): PhotoTopLevelDecision | null {
  return result && !('failureKind' in result) ? result : null;
}

function photoTopLevelFailureReason(result: PhotoTopLevelResult | null, fallback: string): string {
  return isPhotoTopLevelFailure(result) ? result.reason : fallback;
}

function semanticAttempt(
  kind: PhotoSemanticAttempt['kind'],
  result: PhotoTopLevelResult | null,
  timeoutReason: string
): PhotoSemanticAttempt {
  const decision = photoTopLevelDecision(result);
  const failure = isPhotoTopLevelFailure(result) ? result : null;
  return {
    kind,
    status: decision ? 'used' : 'failed',
    durationMs: result?.durationMs ?? null,
    rawResponse: result?.rawResponse ?? null,
    reason: decision ? null : failure?.reason ?? timeoutReason,
  };
}

function classificationFromSemanticFrame(
  frame: PhotoSemanticFrame,
  rawResponse: Record<string, unknown> | null
): PhotoJournalClassification {
  if (frame.stage !== 'foundation_reconciled') {
    return unrouted(
      rawResponse,
      frame.evidence,
      frame.foundation.status === 'not_requested' ? 'semantic_frame_pending' : `semantic_frame_${frame.foundation.status}`,
      frame
    );
  }
  if (!frame.subjectAnchor || photoSemanticFlowForTopLevel(frame.subjectAnchor.topLevel) !== frame.flowKey) {
    return unrouted(rawResponse, frame.evidence, 'semantic_subject_anchor_flow_mismatch', frame);
  }
  const topLevelConfidence = cleanModelConfidence(rawResponse?.confidence);
  const semanticAlternatives = groundedSemanticFlowCandidates(frame);
  if (semanticAlternatives.length === 2) {
    return {
      kind: 'ambiguous', stage: 'enum_route', flowId: null, categoryId: null,
      candidates: semanticAlternatives, selected: null, selectedFlowId: null,
      visualSubject: frame.primarySubject, provider: 'appleFoundation', rawResponse,
      enumResponse: rawResponse, evidence: frame.evidence, attempts: [], decisionBasis: null,
      semanticFrame: frame, reason: 'grounded_semantic_cross_flow_ambiguity', navigationAction: 'confirm_candidates',
      topLevelConfidence, subcategoryConfidence: null,
    };
  }
  if (frame.flowKey === 'ambiguous' || !frame.flowKey) {
    return unrouted(rawResponse, frame.evidence, 'semantic_flow_ambiguous', frame);
  }
  if (frame.unresolvedFacet === 'primary_subject') {
    return unrouted(rawResponse, frame.evidence, 'semantic_primary_subject_requires_manual_classification', frame);
  }
  if (topLevelConfidence !== 'high') {
    return {
      kind: 'ambiguous', stage: 'enum_route', flowId: null, categoryId: null,
      candidates: [flowCandidate(frame.flowKey, modelConfidenceScore(topLevelConfidence))],
      selected: null, selectedFlowId: null, visualSubject: frame.primarySubject,
      provider: 'appleFoundation', rawResponse, enumResponse: rawResponse, evidence: frame.evidence,
      attempts: [], decisionBasis: null, semanticFrame: frame,
      reason: `foundation_top_level_${topLevelConfidence ?? 'missing'}_confidence`,
      navigationAction: 'manual', topLevelConfidence, subcategoryConfidence: null,
    };
  }
  return {
    kind: 'flow_only', stage: 'enum_route', flowId: frame.flowKey, categoryId: null,
    candidates: [flowCandidate(frame.flowKey, primaryEvidenceConfidence(frame))], selected: null, selectedFlowId: frame.flowKey,
    visualSubject: frame.primarySubject,
    provider: 'appleFoundation',
    rawResponse, enumResponse: rawResponse, evidence: frame.evidence, attempts: [],
    decisionBasis: null, semanticFrame: frame,
    reason: frame.unresolvedFacet === 'none' ? 'semantic_child_route_pending' : `semantic_${frame.unresolvedFacet}_requires_confirmation`,
    navigationAction: 'open_flow',
    topLevelConfidence, subcategoryConfidence: null,
  };
}

export function normalizePhotoJournalEnumRoute(
  raw: Record<string, unknown>,
  evidence: PhotoJournalEvidencePacket | null = null,
  semanticFrame: PhotoSemanticFrame | null = null
): PhotoJournalClassification {
  if (semanticFrame?.stage === 'foundation_reconciled') {
    if (semanticFrame.unresolvedFacet !== 'none') {
      return classificationFromSemanticFrame(semanticFrame, raw);
    }
    return normalizeSemanticChildRoute(raw, evidence, semanticFrame);
  }
  if (cleanString(raw.stage) !== 'enum_route' || cleanString(raw.status) === 'technical_failure') {
    const errorCode = cleanString(raw.errorCode);
    return unrouted(raw, evidence, errorCode === 'native_empty_response'
      ? 'foundation_native_empty_response'
      : 'foundation_enum_route_failure', semanticFrame);
  }
  const routeKey = cleanString(raw.routeKey);
  const alternativeKey = cleanString(raw.alternativeRouteKey);
  const directPhotoSchema = cleanInteger(raw.photoSchemaVersion) >= FOUNDATION_PHOTO_SCHEMA_VERSION;
  const legacyRouteScore = cleanConfidence(raw.routeConfidence);
  const alternativeScore = cleanConfidence(raw.alternativeRouteConfidence);
  const routeSupports = semanticFrame?.routeSupport ?? (evidence ? rankPhotoJournalRouteSupport(evidence) : []);
  const supportByRoute = new Map(routeSupports.map((support) => [support.routeKey, support]));
  if (routeKey === 'ambiguous') {
    const candidates = routeSupports
      .filter((support) => support.support >= ROUTE_CANDIDATE_MIN_EVIDENCE_SUPPORT)
      .slice(0, 3)
      .map((support) => routeCandidate(support.routeKey, support.support, support, 'vision_catalog'))
      .filter((candidate): candidate is PhotoJournalCandidate => candidate !== null);
    if (!candidates.length) return unrouted(raw, evidence, 'foundation_reported_visual_ambiguity_without_candidates', semanticFrame);
    const decisionBasis = buildDecisionBasis({
      autoRouteAllowed: false,
      outputConsistent: true,
      routeScore: null,
      lead: null,
      primarySupport: candidates[0]?.evidenceSupport ?? 0,
      competingSupport: routeSupports[1] ?? null,
      rejectedAlternatives: [],
      confidenceSource: 'vision_evidence',
    });
    return {
      kind: 'ambiguous', stage: 'enum_route',
      flowId: candidates.every((candidate) => candidate.flowId === candidates[0]?.flowId) ? candidates[0]?.flowId ?? null : null,
      categoryId: null, candidates, selected: null, selectedFlowId: null,
      visualSubject: evidenceSubject(evidence), provider: semanticFrame?.stage === 'evidence_prepared' ? 'deterministic' : 'appleFoundation', rawResponse: raw,
      enumResponse: raw, evidence, attempts: [], decisionBasis,
      semanticFrame,
      reason: 'foundation_reported_visual_ambiguity', navigationAction: 'confirm_candidates',
    };
  }
  const primarySupportEntry = routeKey ? supportByRoute.get(routeKey) : undefined;
  const routeScore = directPhotoSchema ? primarySupportEntry?.support ?? 0 : legacyRouteScore;
  const primary = routeKey && routeKey !== 'ambiguous'
    ? routeCandidate(routeKey, routeScore, primarySupportEntry, 'foundation_primary', directPhotoSchema ? null : routeScore)
    : null;
  const alternative = alternativeKey && alternativeKey !== 'ambiguous' && alternativeKey !== routeKey
    ? routeCandidate(alternativeKey, alternativeScore, supportByRoute.get(alternativeKey), 'foundation_alternative')
    : null;
  if (!primary && routeKey !== 'ambiguous') return unrouted(raw, evidence, 'foundation_returned_no_valid_enum_route', semanticFrame);
  const top = primary ?? alternative;
  if (!top) return unrouted(raw, evidence, 'foundation_returned_no_valid_enum_route', semanticFrame);
  const outputConsistent = directPhotoSchema || (alternative
    ? alternativeScore <= routeScore
    : alternativeScore <= 0.01);
  const competingSupport = routeSupports.find((support) => support.routeKey !== top.route?.id) ?? null;
  const primarySupport = top.evidenceSupport;
  const lead = directPhotoSchema
    ? primarySupport - (competingSupport?.support ?? 0)
    : routeScore - alternativeScore;
  const noCloseCompetitor = !competingSupport
    || competingSupport.support < primarySupport - ROUTE_COMPETITOR_MARGIN;
  const rejectedAlternatives: PhotoJournalDecisionBasis['rejectedAlternatives'] = [];
  const eligibleAlternative = alternative && (
    alternative.evidenceSupport >= ROUTE_CANDIDATE_MIN_EVIDENCE_SUPPORT
    || alternativeScore >= ALTERNATIVE_MIN_MODEL_SCORE
  ) ? alternative : null;
  if (alternative && !eligibleAlternative) {
    rejectedAlternatives.push({ routeKey: alternative.route?.id ?? alternative.id, reason: 'no_meaningful_model_or_vision_support' });
  }
  const evidenceCandidates = routeSupports
    .filter((support) => support.support >= ROUTE_CANDIDATE_MIN_EVIDENCE_SUPPORT)
    .filter((support) => support.routeKey !== primary?.route?.id && support.routeKey !== eligibleAlternative?.route?.id)
    .map((support) => routeCandidate(support.routeKey, support.support, support, 'vision_catalog'))
    .filter((candidate): candidate is PhotoJournalCandidate => candidate !== null);
  const candidates = uniqueCandidates([primary, eligibleAlternative, ...evidenceCandidates]).slice(0, 3);
  const autoRouteAllowed = !!primary?.route
    && outputConsistent
    && (directPhotoSchema || routeScore >= ROUTE_MIN_SCORE)
    && lead >= ROUTE_MIN_LEAD
    && primarySupport >= ROUTE_MIN_EVIDENCE_SUPPORT
    && noCloseCompetitor;
  const decisionBasis = buildDecisionBasis({
    autoRouteAllowed, outputConsistent,
    routeScore: directPhotoSchema ? null : routeScore,
    lead: directPhotoSchema ? null : lead,
    primarySupport, competingSupport, rejectedAlternatives,
    confidenceSource: directPhotoSchema ? 'vision_evidence' : 'legacy_model_authored',
  });

  if (autoRouteAllowed && primary?.route) {
    return {
      kind: 'exact', stage: 'enum_route', flowId: primary.flowId, categoryId: primary.route.choiceId,
      candidates, selected: primary.route, selectedFlowId: null, visualSubject: evidenceSubject(evidence),
      provider: semanticFrame?.stage === 'evidence_prepared' ? 'deterministic' : 'appleFoundation', rawResponse: raw, enumResponse: raw, evidence, attempts: [],
      decisionBasis, reason: null, navigationAction: 'open_details',
      semanticFrame,
    };
  }

  return {
    kind: 'ambiguous', stage: 'enum_route', flowId: candidates.every((candidate) => candidate.flowId === top.flowId) ? top.flowId : null,
    categoryId: null, candidates, selected: null, selectedFlowId: null,
    visualSubject: evidenceSubject(evidence), provider: semanticFrame?.stage === 'evidence_prepared' ? 'deterministic' : 'appleFoundation', rawResponse: raw,
    enumResponse: raw, evidence, attempts: [], decisionBasis,
    semanticFrame,
    reason: outputConsistent ? 'foundation_route_needs_evidence_confirmation' : 'foundation_enum_scores_inconsistent',
    navigationAction: 'confirm_candidates',
  };
}

function normalizeSemanticChildRoute(
  raw: Record<string, unknown>,
  evidence: PhotoJournalEvidencePacket | null,
  frame: PhotoSemanticFrame
): PhotoJournalClassification {
  const flowId = frame.flowKey && frame.flowKey !== 'ambiguous' ? frame.flowKey : null;
  if (!flowId) return unrouted(raw, evidence, 'semantic_child_route_has_no_locked_flow', frame);
  if (flowId === 'people') {
    const topLevelConfidence = cleanModelConfidence(frame.foundation.rawResponse?.confidence);
    return {
      kind: 'flow_only', stage: 'enum_route', flowId, categoryId: null,
      candidates: [flowCandidate(flowId, modelConfidenceScore(topLevelConfidence))],
      selected: null, selectedFlowId: flowId,
      visualSubject: frame.primarySubject, provider: 'appleFoundation', rawResponse: raw,
      enumResponse: raw, evidence, attempts: [], decisionBasis: null,
      semanticFrame: frame, reason: 'photo_people_subcategory_requires_user_selection',
      navigationAction: 'open_flow', topLevelConfidence,
      subcategoryConfidence: cleanModelConfidence(raw.confidence),
    };
  }
  if (cleanString(raw.stage) !== 'enum_route' || cleanString(raw.status) === 'technical_failure') {
    return classificationFromSemanticFrame(frame, raw);
  }
  const routeKey = cleanString(raw.routeKey);
  const subcategoryConfidence = cleanModelConfidence(raw.confidence);
  const topLevelConfidence = cleanModelConfidence(frame.foundation.rawResponse?.confidence);
  if (!routeKey || !subcategoryConfidence) {
    return {
      ...classificationFromSemanticFrame(frame, raw),
      topLevelConfidence,
      subcategoryConfidence,
      reason: !routeKey ? 'semantic_child_route_empty' : 'semantic_child_confidence_missing',
    };
  }
  if (routeKey === 'undetermined') {
    return {
      kind: 'flow_only', stage: 'enum_route', flowId, categoryId: null,
      candidates: [flowCandidate(flowId, modelConfidenceScore(topLevelConfidence))],
      selected: null, selectedFlowId: flowId,
      visualSubject: frame.primarySubject, provider: 'appleFoundation', rawResponse: raw,
      enumResponse: raw, evidence, attempts: [], decisionBasis: null,
      semanticFrame: frame, reason: 'foundation_child_not_visually_distinguishable',
      navigationAction: 'open_flow', topLevelConfidence, subcategoryConfidence,
    };
  }
  const confidenceScore = modelConfidenceScore(subcategoryConfidence);
  const baseRoute = journalRouteForKey(routeKey, confidenceScore, 'Apple Foundation selected a child of the evidence-locked journal flow');
  if (!baseRoute || baseRoute.flowId !== flowId) {
    return {
      ...classificationFromSemanticFrame(frame, raw),
      topLevelConfidence,
      subcategoryConfidence,
      reason: baseRoute ? 'semantic_child_route_escaped_locked_flow' : 'semantic_child_route_invalid',
    };
  }
  const verificationVerdict = cleanString(raw.verificationVerdict);
  const verificationEvidenceKey = cleanString(raw.verificationEvidenceKey);
  const verificationConfidence = cleanModelConfidence(raw.verificationConfidence);
  const visibleRouteSupport = rankPhotoJournalRouteSupport(evidence ?? frame.evidence);
  const proposedVisibleSupport = visibleRouteSupport.find((support) => support.routeKey === routeKey)?.support ?? 0;
  const strongestVisibleSibling = visibleRouteSupport
    .filter((support) => support.routeKey !== routeKey && support.routeKey.startsWith(`${flowId}.`))
    .sort((left, right) => right.support - left.support)[0] ?? null;
  const contradictedByVisibleSibling = !!strongestVisibleSibling
    && strongestVisibleSibling.support >= ROUTE_CANDIDATE_MIN_EVIDENCE_SUPPORT
    && strongestVisibleSibling.support >= proposedVisibleSupport + ROUTE_COMPETITOR_MARGIN;
  const independentlyGrounded = verificationVerdict === 'supported'
    && verificationConfidence === 'high'
    && verificationEvidenceKey !== null
    && verificationEvidenceKey !== 'none'
    && frame.classificationEvidenceKeys.includes(verificationEvidenceKey)
    && !contradictedByVisibleSibling;
  if (subcategoryConfidence !== 'high' || !independentlyGrounded) {
    const reason = subcategoryConfidence !== 'high'
      ? `foundation_child_${subcategoryConfidence}_confidence`
      : contradictedByVisibleSibling
        ? 'foundation_child_contradicted_by_visible_sibling'
        : verificationVerdict === 'not_distinguishable'
          ? 'foundation_child_not_visually_distinguishable'
          : `foundation_child_verification_${cleanString(raw.verificationStatus) ?? 'missing'}`;
    return {
      kind: 'flow_only', stage: 'enum_route', flowId, categoryId: null,
      candidates: [flowCandidate(flowId, modelConfidenceScore(topLevelConfidence))],
      selected: null, selectedFlowId: flowId,
      visualSubject: frame.primarySubject, provider: 'appleFoundation', rawResponse: raw,
      enumResponse: raw, evidence, attempts: [], decisionBasis: null,
      semanticFrame: frame, reason,
      navigationAction: 'open_flow', topLevelConfidence, subcategoryConfidence,
    };
  }
  const route = baseRoute;
  const candidateBase = routeCandidate(routeKey, confidenceScore, undefined, 'foundation_primary', confidenceScore);
  if (!candidateBase) return classificationFromSemanticFrame(frame, raw);
  const candidate = { ...candidateBase, route };
  return {
    kind: 'exact', stage: 'enum_route', flowId, categoryId: route.choiceId,
    candidates: [candidate], selected: route, selectedFlowId: null,
    visualSubject: frame.primarySubject, provider: 'appleFoundation', rawResponse: raw,
    enumResponse: raw, evidence, attempts: [], decisionBasis: {
      autoRouteAllowed: true,
      checks: {
        outputConsistent: true, confidenceSource: 'legacy_model_authored', modelConfidence: confidenceScore,
        minimumModelConfidence: modelConfidenceScore('high'), modelLead: null, minimumModelLead: null,
        evidenceSupport: 0, minimumEvidenceSupport: 0,
        competingRouteKey: null, competingEvidenceSupport: 0, competitorMargin: 0,
      },
      rejectedAlternatives: [], reasons: [
        'semantic_flow_locked',
        'child_route_validated_inside_locked_flow',
        'independent_child_confidence_high',
        'independent_child_grounding_verified',
      ],
    },
    semanticFrame: frame, reason: null, navigationAction: 'open_details',
    topLevelConfidence, subcategoryConfidence,
  };
}

export async function enrichPhotoJournalRoute(
  route: JournalRouteProposal,
  visualSubject: string | null,
  vision: DayVisionSummary,
  rawVision: PhotoVisionResult | null
): Promise<PhotoJournalFieldProposal | null> {
  const flow = manualJournalFlow(route.flowId);
  const choice = flow?.choices.find((item) => item.id === route.choiceId);
  if (!flow || !choice) return null;
  const enrichmentMode = choice.photoEnrichmentMode ?? flow.photoEnrichmentMode ?? 'none';
  if (enrichmentMode === 'none' || !supportsFoundationPhotoJournalSchema()) return null;
  const fieldLabel = choice.specificFieldLabel ?? flow.specificFieldLabel;
  const raw = await enrichPhotoJournalOnDevice(route.id, fieldLabel, visualSubject, vision, rawVision);
  const lockedRouteKey = cleanString(raw?.lockedRouteKey);
  const disposition = cleanString(raw?.disposition)?.toLowerCase();
  const value = cleanString(raw?.specific)?.slice(0, 120) ?? null;
  const confidence = cleanConfidence(raw?.confidence);
  if (!raw || lockedRouteKey !== route.id || !value || disposition === 'discard' || disposition === 'skipped') return null;
  // Book titles have already passed the stricter OCR-index and semantic-role
  // validator in foundation-scene. A low/missing model confidence must not
  // throw away that grounded editable title after the loading state completes.
  const validatedBookTitle = route.id === 'studio.book'
    && cleanString(raw.semanticRole) === 'official_book_title';
  return {
    routeKey: route.id,
    value,
    confidence,
    provenance: 'appleFoundation',
    prefill: validatedBookTitle || confidence >= 0.75,
    rawResponse: raw,
  };
}

function displayEvidenceLabel(value: string): string {
  const normalized = value.trim().replaceAll('_', ' ').replace(/\s+/g, ' ');
  return normalized ? normalized.charAt(0).toLocaleUpperCase() + normalized.slice(1) : '';
}

async function withSemanticTimeout<T>(value: Promise<T>, ms = MODEL_STAGE_TIMEOUT_MS): Promise<T | null> {
  return withClearedTimeout(value, ms);
}

function withClearedTimeout<T>(value: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    value.then(
      (result) => { clearTimeout(timer); resolve(result); },
      () => { clearTimeout(timer); resolve(null); }
    );
  });
}

function routeCandidate(
  routeKey: string,
  confidence: number,
  support: PhotoJournalRouteSupport | undefined,
  origin: PhotoJournalCandidate['origin'],
  modelConfidence: number | null = origin === 'vision_catalog' ? null : confidence
): PhotoJournalCandidate | null {
  const reason = origin === 'vision_catalog'
    ? 'Apple Vision supports this journal catalog route'
    : 'Apple Foundation selected this photo route enum';
  const route = journalRouteForKey(routeKey, confidence, reason);
  return route ? {
    id: `route:${routeKey}`, kind: 'route', label: route.label, icon: photoRouteCandidateIcon(route), confidence, flowId: route.flowId, route,
    modelConfidence,
    evidenceSupport: support?.support ?? 0,
    supportingSignals: support?.supportingSignals ?? [],
    origin,
  } : null;
}

function flowCandidate(flowId: string, confidence: number): PhotoJournalCandidate {
  const flow = manualJournalFlow(flowId)!;
  return {
    id: `flow:${flowId}`, kind: 'flow', label: flow.shortTitle ?? flow.title, icon: flow.icon, confidence, flowId, route: null,
    modelConfidence: confidence, evidenceSupport: 0, supportingSignals: [], origin: 'flow_confirmation',
  };
}

function groundedSemanticFlowCandidates(frame: PhotoSemanticFrame): PhotoJournalCandidate[] {
  if (!frame.flowKey || frame.flowKey === 'ambiguous' || !frame.alternativeFlowKey
    || frame.alternativeFlowKey === 'ambiguous' || !frame.alternativeConceptKey || !frame.alternativeSubject) return [];
  const primary = frame.primaryConceptKey
    ? frame.evidence.signals.find((signal) => signal.id === frame.primaryConceptKey)
    : null;
  const alternative = frame.evidence.signals.find((signal) => signal.id === frame.alternativeConceptKey);
  if (!primary || !alternative) return [];
  return [
    semanticFlowCandidate(frame.flowKey, primary.name, primary.confidence, primary.id),
    semanticFlowCandidate(frame.alternativeFlowKey, alternative.name, alternative.confidence, alternative.id),
  ];
}

function semanticFlowCandidate(flowId: string, subject: string, confidence: number, evidenceKey: string): PhotoJournalCandidate {
  const flow = manualJournalFlow(flowId)!;
  return {
    id: `semantic-flow:${flowId}:${evidenceKey}`,
    kind: 'flow',
    label: displayEvidenceLabel(subject),
    icon: flow.icon,
    confidence,
    flowId,
    route: null,
    modelConfidence: null,
    evidenceSupport: confidence,
    supportingSignals: [subject],
    origin: 'flow_confirmation',
  };
}

function photoRouteCandidateIcon(route: JournalRouteProposal): IconSymbolName {
  const choice = manualJournalFlow(route.flowId)?.choices.find((item) => item.id === route.choiceId);
  if (choice && ['book.fill', 'film.fill', 'tv.fill', 'gamecontroller.fill', 'music.note', 'paintbrush.fill', 'play.rectangle.fill'].includes(choice.icon)) {
    return choice.icon;
  }
  switch (route.flowId) {
    case 'went_somewhere': return 'mappin.and.ellipse';
    case 'food': return 'fork.knife';
    case 'studio': return 'play.rectangle.fill';
    case 'movement': return 'figure.walk';
    case 'people': return 'person.2.fill';
    case 'work': return 'briefcase.fill';
    case 'big_event': return 'party.popper.fill';
    default: return 'circle.fill';
  }
}

function evidenceSubject(evidence: PhotoJournalEvidencePacket | null): string | null {
  return evidence ? prioritizedFoundationSignals(evidence, 1)[0]?.name?.slice(0, 80) ?? null : null;
}

function primaryEvidenceConfidence(frame: PhotoSemanticFrame): number {
  return frame.evidence.signals.find((signal) => signal.id === frame.primaryConceptKey)?.confidence ?? 0.5;
}

function uniqueCandidates(candidates: (PhotoJournalCandidate | null)[]): PhotoJournalCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate): candidate is PhotoJournalCandidate => {
    if (!candidate || seen.has(candidate.id)) return false;
    seen.add(candidate.id);
    return true;
  });
}

function buildDecisionBasis(input: {
  autoRouteAllowed: boolean;
  outputConsistent: boolean;
  routeScore: number | null;
  lead: number | null;
  primarySupport: number;
  competingSupport: PhotoJournalRouteSupport | null;
  rejectedAlternatives: PhotoJournalDecisionBasis['rejectedAlternatives'];
  confidenceSource: PhotoJournalDecisionBasis['checks']['confidenceSource'];
}): PhotoJournalDecisionBasis {
  const reasons: string[] = [];
  if (!input.outputConsistent) reasons.push('inconsistent_model_scores');
  if (input.routeScore !== null && input.routeScore < ROUTE_MIN_SCORE) reasons.push('model_confidence_below_threshold');
  if (input.lead !== null && input.lead < ROUTE_MIN_LEAD) reasons.push('model_lead_below_threshold');
  if (input.primarySupport < ROUTE_MIN_EVIDENCE_SUPPORT) reasons.push('vision_support_below_threshold');
  if (input.competingSupport && input.competingSupport.support >= input.primarySupport - ROUTE_COMPETITOR_MARGIN) {
    reasons.push('competing_vision_supported_route');
  }
  if (input.autoRouteAllowed) reasons.push('all_auto_route_checks_passed');
  return {
    autoRouteAllowed: input.autoRouteAllowed,
    checks: {
      outputConsistent: input.outputConsistent,
      confidenceSource: input.confidenceSource,
      modelConfidence: input.routeScore,
      minimumModelConfidence: input.routeScore === null ? null : ROUTE_MIN_SCORE,
      modelLead: input.lead,
      minimumModelLead: input.lead === null ? null : ROUTE_MIN_LEAD,
      evidenceSupport: input.primarySupport,
      minimumEvidenceSupport: ROUTE_MIN_EVIDENCE_SUPPORT,
      competingRouteKey: input.competingSupport?.routeKey ?? null,
      competingEvidenceSupport: input.competingSupport?.support ?? 0,
      competitorMargin: ROUTE_COMPETITOR_MARGIN,
    },
    rejectedAlternatives: input.rejectedAlternatives,
    reasons,
  };
}

function unrouted(
  rawResponse: Record<string, unknown> | null,
  evidence: PhotoJournalEvidencePacket | null,
  reason: string,
  semanticFrame: PhotoSemanticFrame | null = null
): PhotoJournalClassification {
  return {
    kind: 'unrouted', stage: 'manual', flowId: null, categoryId: null, candidates: [], selected: null,
    selectedFlowId: null, visualSubject: semanticFrame?.primarySubject ?? evidenceSubject(evidence), provider: 'manual', rawResponse,
    enumResponse: rawResponse, evidence, attempts: [], decisionBasis: null, semanticFrame, reason, navigationAction: 'manual',
  };
}

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function cleanModelConfidence(value: unknown): PhotoModelConfidence | null {
  return value === 'high' || value === 'medium' || value === 'low' ? value : null;
}

function modelConfidenceScore(value: PhotoModelConfidence | null): number {
  if (value === 'high') return 0.95;
  if (value === 'medium') return 0.6;
  return 0.35;
}

function cleanConfidence(value: unknown): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 0;
}

function cleanInteger(value: unknown): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isInteger(parsed) ? parsed : 0;
}
