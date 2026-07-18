import type { DayVisionSummary, JournalRouteProposal, PhotoVisionResult } from '@/types/home';
import type { IconSymbolName } from '@/components/ui/icon-symbol';
import {
  enrichPhotoJournalOnDevice,
  FOUNDATION_PHOTO_SCHEMA_VERSION,
  foundationSceneAvailability,
  repairPhotoSemanticFrameOnDevice,
  refinePhotoSemanticFrameOnDevice,
  retryPhotoTopLevelOnDevice,
  resolvePhotoTopLevelAmbiguityOnDevice,
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
  groundedPhotoTopLevelFallback,
  photoSemanticFlowForTopLevel,
  reconcilePhotoSemanticFrame,
  reconcilePhotoTopLevelAmbiguity,
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
  specificEvidence?: PhotoJournalSpecificEvidenceDiagnostic | null;
  reason: string | null;
  navigationAction: 'open_details' | 'open_flow' | 'confirm_candidates' | 'manual';
};

export type PhotoJournalSpecificEvidenceRole = 'concrete_subject' | 'generic_class' | 'container' | 'not_applicable';

export type PhotoJournalSpecificEvidenceDiagnostic = {
  evidenceKey: string | null;
  role: PhotoJournalSpecificEvidenceRole | null;
  label: string | null;
  confidence: number | null;
  prefill: string | null;
  accepted: boolean;
  reason: string;
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
  const refinement = refinePhotoJournalAnalysis(baseFrame);
  return { initial, refinement };
}

async function refinePhotoJournalAnalysis(baseFrame: PhotoSemanticFrame): Promise<PhotoJournalClassification> {
  let result = await withSemanticTimeout(refinePhotoSemanticFrameOnDevice(baseFrame));
  let attempts: PhotoSemanticAttempt[] = [semanticAttempt('primary', result, 'Foundation top-level classification timed out')];

  // Technical execution failures retry the same small two-field task. They are
  // not semantic disagreements and must never be sent to repair or ambiguity.
  if (!result || isPhotoTopLevelFailure(result, 'technical')) {
    result = await withSemanticTimeout(retryPhotoTopLevelOnDevice(baseFrame));
    attempts = [...attempts, semanticAttempt('technical_retry', result, 'Foundation top-level retry timed out')];
  }

  let semantic = photoTopLevelDecision(result);
  let frame = reconcilePhotoSemanticFrame(baseFrame, semantic, semantic
    ? undefined
    : { status: 'failed', reason: photoTopLevelFailureReason(result, 'Foundation top-level task failed') }, attempts);

  // Repair is reserved for a response that completed but violated the grounded
  // two-field contract. A transport/model failure has no semantic object to fix.
  if (!semantic && isPhotoTopLevelFailure(result, 'invalid_output')) {
    const rejectedPrimaryEvidenceKey = typeof result.rawResponse?.primaryEvidenceKey === 'string'
      && baseFrame.primaryEvidenceKeys.includes(result.rawResponse.primaryEvidenceKey)
      ? result.rawResponse.primaryEvidenceKey
      : null;
    // A containment rejection means the selected subject itself was wrong
    // (for example Person depicted inside a leading Television). Let repair
    // choose another visible primary instead of locking it to that Person.
    const repairPrimaryEvidenceKey = result.reason.includes('likely depicted inside')
      ? null
      : rejectedPrimaryEvidenceKey;
    const repair = await withSemanticTimeout(repairPhotoSemanticFrameOnDevice(
      baseFrame,
      result.rawResponse ?? {},
      result.reason,
      repairPrimaryEvidenceKey
    ));
    attempts = [...attempts, semanticAttempt('repair', repair, 'Foundation top-level repair timed out')];
    semantic = photoTopLevelDecision(repair);
    if (!semantic) {
      // If Foundation contradicts the grounded contract twice, preserve an
      // obvious first-ranked ontology anchor rather than showing an unrouted
      // error. This cannot use a secondary chip or OCR.
      const fallback = groundedPhotoTopLevelFallback(
        baseFrame,
        photoTopLevelFailureReason(repair, 'Foundation top-level repair failed')
      );
      if (fallback) {
        attempts = [...attempts, semanticAttempt('grounded_fallback', fallback, 'No grounded top-level fallback')];
        semantic = fallback;
      }
    }
    frame = reconcilePhotoSemanticFrame(baseFrame, semantic, semantic
      ? undefined
      : { status: 'failed', reason: photoTopLevelFailureReason(repair, 'Foundation top-level repair failed') }, attempts);
  }

  // Only an explicit valid `ambiguous` decision starts the separate grounded
  // two-alternative pass. Technical failures now remain technical failures.
  if (frame.stage === 'foundation_reconciled' && frame.flowKey === 'ambiguous') {
    const ambiguity = await withSemanticTimeout(resolvePhotoTopLevelAmbiguityOnDevice(baseFrame));
    const ambiguityAttempt: PhotoSemanticAttempt = {
      kind: 'ambiguity', status: ambiguity ? 'used' : 'failed',
      durationMs: ambiguity?.durationMs ?? null, rawResponse: ambiguity?.rawResponse ?? null,
      reason: ambiguity ? null : 'Foundation returned no grounded top-level alternatives',
    };
    attempts = [...attempts, ambiguityAttempt];
    frame = reconcilePhotoTopLevelAmbiguity(baseFrame, ambiguity, attempts);
  }
  const grounded = classificationFromSemanticFrame(frame, frame.foundation.rawResponse);
  // The photo classifier deliberately stops at the broad journal section. The
  // manual journal owns all child choices consistently for books, screens,
  // places, food, and every other top-level result.
  return grounded;
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
  const semanticAlternatives = groundedSemanticFlowCandidates(frame);
  if (semanticAlternatives.length === 2) {
    return {
      kind: 'ambiguous', stage: 'enum_route', flowId: null, categoryId: null,
      candidates: semanticAlternatives, selected: null, selectedFlowId: null,
      visualSubject: frame.primarySubject, provider: 'appleFoundation', rawResponse,
      enumResponse: rawResponse, evidence: frame.evidence, attempts: [], decisionBasis: null,
      semanticFrame: frame, reason: 'grounded_semantic_cross_flow_ambiguity', navigationAction: 'confirm_candidates',
    };
  }
  if (frame.flowKey === 'ambiguous' || !frame.flowKey) {
    return unrouted(rawResponse, frame.evidence, 'semantic_flow_ambiguous', frame);
  }
  if (frame.flowKey === 'people' || frame.unresolvedFacet === 'relationship') {
    return {
      kind: 'flow_only', stage: 'enum_route', flowId: 'people', categoryId: null,
      candidates: [flowCandidate('people', primaryEvidenceConfidence(frame))], selected: null, selectedFlowId: 'people',
      visualSubject: frame.primarySubject,
      provider: 'appleFoundation',
      rawResponse, enumResponse: rawResponse, evidence: frame.evidence, attempts: [],
      decisionBasis: null, semanticFrame: frame, reason: 'photo_relationship_requires_confirmation',
      navigationAction: 'open_flow',
    };
  }
  if (frame.unresolvedFacet === 'primary_subject') {
    return unrouted(rawResponse, frame.evidence, 'semantic_primary_subject_requires_manual_classification', frame);
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
  };
}

export function normalizePhotoJournalEnumRoute(
  raw: Record<string, unknown>,
  evidence: PhotoJournalEvidencePacket | null = null,
  semanticFrame: PhotoSemanticFrame | null = null
): PhotoJournalClassification {
  if (semanticFrame?.stage === 'foundation_reconciled') {
    if (semanticFrame.flowKey === 'people' || semanticFrame.unresolvedFacet !== 'none') {
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

  // A photo can establish that people are central, but cannot safely establish
  // partner/family/friend relationships. Let the user choose within People.
  if (top.flowId === 'people') {
    return {
      kind: 'flow_only', stage: 'enum_route', flowId: 'people', categoryId: null,
      candidates: [flowCandidate('people', routeScore)], selected: null, selectedFlowId: 'people',
      visualSubject: evidenceSubject(evidence), provider: semanticFrame?.stage === 'evidence_prepared' ? 'deterministic' : 'appleFoundation', rawResponse: raw,
      enumResponse: raw, evidence, attempts: [], decisionBasis: { ...decisionBasis, autoRouteAllowed: false, reasons: [...decisionBasis.reasons, 'relationship_requires_confirmation'] },
      semanticFrame,
      reason: 'photo_relationship_requires_confirmation', navigationAction: 'open_flow',
    };
  }

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
  if (cleanString(raw.stage) !== 'enum_route' || cleanString(raw.status) === 'technical_failure') {
    return classificationFromSemanticFrame(frame, raw);
  }
  const routeKey = cleanString(raw.routeKey);
  if (!routeKey || routeKey === 'ambiguous') {
    return {
      ...classificationFromSemanticFrame(frame, raw),
      reason: routeKey === 'ambiguous' ? 'semantic_child_route_ambiguous' : 'semantic_child_route_empty',
    };
  }
  const baseRoute = journalRouteForKey(routeKey, 0, 'Apple Foundation selected a child of the evidence-locked journal flow');
  if (!baseRoute || baseRoute.flowId !== flowId) {
    return {
      ...classificationFromSemanticFrame(frame, raw),
      specificEvidence: rejectedSpecificEvidence(raw, baseRoute ? 'child_route_escaped_locked_flow' : 'child_route_invalid'),
      reason: baseRoute ? 'semantic_child_route_escaped_locked_flow' : 'semantic_child_route_invalid',
    };
  }
  const specificEvidence = validateFoodSpecificEvidence(raw, frame, baseRoute);
  const support = semanticChildRouteSupport(routeKey, frame, specificEvidence);
  if (!support || support.support < ROUTE_MIN_EVIDENCE_SUPPORT) {
    return {
      ...classificationFromSemanticFrame(frame, raw),
      specificEvidence,
      reason: 'semantic_child_route_lacks_independent_support',
    };
  }
  const routeWithConfidence = { ...baseRoute, confidence: support.support };
  const route = specificEvidence.accepted && specificEvidence.prefill
    ? { ...routeWithConfidence, prefilledSpecific: specificEvidence.prefill }
    : routeWithConfidence;
  const candidateBase = routeCandidate(routeKey, support.support, support, 'foundation_primary', null);
  if (!candidateBase) return classificationFromSemanticFrame(frame, raw);
  const candidate = { ...candidateBase, route };
  return {
    kind: 'exact', stage: 'enum_route', flowId, categoryId: route.choiceId,
    candidates: [candidate], selected: route, selectedFlowId: null,
    visualSubject: frame.primarySubject, provider: 'appleFoundation', rawResponse: raw,
    enumResponse: raw, evidence, attempts: [], decisionBasis: {
      autoRouteAllowed: true,
      checks: {
        outputConsistent: true, confidenceSource: 'vision_evidence', modelConfidence: null,
        minimumModelConfidence: null, modelLead: null, minimumModelLead: null,
        evidenceSupport: support.support, minimumEvidenceSupport: ROUTE_MIN_EVIDENCE_SUPPORT,
        competingRouteKey: null, competingEvidenceSupport: 0, competitorMargin: 0,
      },
      rejectedAlternatives: [], reasons: ['semantic_flow_locked', 'child_route_validated_inside_locked_flow', 'independent_route_support_met'],
    },
    semanticFrame: frame, specificEvidence, reason: null, navigationAction: 'open_details',
  };
}

function semanticChildRouteSupport(
  routeKey: string,
  frame: PhotoSemanticFrame,
  specificEvidence: PhotoJournalSpecificEvidenceDiagnostic
): PhotoJournalRouteSupport | null {
  const direct = rankPhotoJournalRouteSupport(frame.evidence).find((item) => item.routeKey === routeKey) ?? null;
  if (direct && direct.support >= ROUTE_MIN_EVIDENCE_SUPPORT) return direct;

  // Food child names such as "snack" are not normally visible in Vision. A
  // concrete, model-selected Essence ID is valid route evidence because the ID
  // itself is supplied and verified rather than invented text.
  if (routeKey.startsWith('food.') && specificEvidence.accepted && specificEvidence.confidence !== null) {
    return {
      routeKey,
      support: specificEvidence.confidence,
      supportingSignals: specificEvidence.label ? [specificEvidence.label] : [],
    };
  }

  // A physical book is itself sufficient support for the only book child; OCR
  // remains enrichment and never participates in this routing decision.
  if (routeKey === 'studio.book'
    && frame.subjectAnchor?.topLevel === 'media'
    && /\b(book|publication|paperback|hardcover|hardback|novel)\b/i.test(frame.subjectAnchor.label)) {
    const bookSupport = frame.evidence.documentDetected
      ? Math.max(frame.subjectAnchor.confidence, 0.72)
      : Math.max(frame.subjectAnchor.confidence, Math.min(1, frame.subjectAnchor.selectionRank));
    return {
      routeKey,
      support: bookSupport,
      supportingSignals: [frame.subjectAnchor.label],
    };
  }
  return direct;
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
  // A validated visual Food value is already grounded in a visible Essence ID.
  // Do not let lower-quality menu or packaging OCR replace it asynchronously.
  if (enrichmentMode === 'food_fallback' && route.prefilledSpecific?.trim()) return null;
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

function validateFoodSpecificEvidence(
  raw: Record<string, unknown>,
  frame: PhotoSemanticFrame,
  route: JournalRouteProposal
): PhotoJournalSpecificEvidenceDiagnostic {
  const evidenceKey = cleanString(raw.specificEvidenceKey);
  const role = cleanSpecificEvidenceRole(raw.specificEvidenceRole);
  if (!evidenceKey || evidenceKey === 'none') {
    return { evidenceKey: null, role, label: null, confidence: null, prefill: null, accepted: false, reason: 'no_specific_evidence_selected' };
  }
  const signal = frame.evidence.signals.find((item) => item.id === evidenceKey) ?? null;
  const diagnostic = {
    evidenceKey,
    role,
    label: signal?.name ?? null,
    confidence: signal?.confidence ?? null,
    prefill: null,
    accepted: false,
    reason: 'not_validated',
  } satisfies PhotoJournalSpecificEvidenceDiagnostic;
  if (frame.flowKey !== 'food' || route.flowId !== 'food') return { ...diagnostic, reason: 'visual_prefill_not_enabled_for_flow' };
  if (!frame.primaryEvidenceKeys.includes(evidenceKey) || !signal) return { ...diagnostic, reason: 'evidence_not_visible_or_eligible' };
  if (role !== 'concrete_subject') return { ...diagnostic, reason: 'evidence_role_not_concrete_subject' };
  if (signal.confidence < 0.6) return { ...diagnostic, reason: 'evidence_confidence_below_threshold' };
  const prefill = displayEvidenceLabel(signal.name);
  if (!prefill) return { ...diagnostic, reason: 'evidence_label_empty' };
  return { ...diagnostic, prefill, accepted: true, reason: 'accepted_visible_food_subject' };
}

function rejectedSpecificEvidence(raw: Record<string, unknown>, reason: string): PhotoJournalSpecificEvidenceDiagnostic {
  const evidenceKey = cleanString(raw.specificEvidenceKey);
  return {
    evidenceKey: evidenceKey && evidenceKey !== 'none' ? evidenceKey : null,
    role: cleanSpecificEvidenceRole(raw.specificEvidenceRole),
    label: null,
    confidence: null,
    prefill: null,
    accepted: false,
    reason,
  };
}

function cleanSpecificEvidenceRole(value: unknown): PhotoJournalSpecificEvidenceRole | null {
  const role = cleanString(value);
  return role && ['concrete_subject', 'generic_class', 'container', 'not_applicable'].includes(role)
    ? role as PhotoJournalSpecificEvidenceRole
    : null;
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

function cleanConfidence(value: unknown): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 0;
}

function cleanInteger(value: unknown): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isInteger(parsed) ? parsed : 0;
}
