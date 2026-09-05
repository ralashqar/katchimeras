import type { MemoryDomain, PhotoContainerKind, PhotoRepresentationKind } from '@/types/home';
import {
  photoClassificationEvidenceSignals,
  photoEvidenceEligibility,
  photoEvidenceSelectionRank,
  visiblePhotoEssenceEvidence,
  type PhotoJournalEvidencePacket,
  type PhotoJournalRouteSupport,
} from '@/utils/photo-journal-evidence';
import {
  journalModelFlowIdForInternalFlow,
  type JournalModelFlowId,
} from '@/utils/journal-model-flow';

export type PhotoSemanticUnresolvedFacet =
  | 'none'
  | 'media_type'
  | 'device_activity'
  | 'primary_subject'
  | 'relationship';

export type PhotoSemanticFlowKey =
  | 'went_somewhere'
  | 'food'
  | 'studio'
  | 'movement'
  | 'people'
  | 'work'
  | 'big_event'
  | 'general'
  | 'ambiguous';

export type PhotoTopLevel =
  | 'people'
  | 'food'
  | 'place'
  | 'media'
  | 'movement'
  | 'work'
  | 'event'
  | 'ordinary'
  | 'ambiguous';

export type PhotoModelConfidence = 'high' | 'medium' | 'low';

export type PhotoModelFlowId = JournalModelFlowId;

export type PhotoTopLevelDecision = {
  primaryEvidenceKey: string;
  topLevel: PhotoTopLevel;
  confidence: PhotoModelConfidence;
  rawResponse: Record<string, unknown>;
  durationMs: number;
};

export type PhotoTopLevelFailure = {
  failureKind: 'technical' | 'invalid_output';
  rawResponse: Record<string, unknown> | null;
  durationMs: number;
  reason: string;
};

export type PhotoTopLevelResult = PhotoTopLevelDecision | PhotoTopLevelFailure;

export type PhotoTopLevelAmbiguityDecision = {
  primaryEvidenceKey: string;
  primaryTopLevel: Exclude<PhotoTopLevel, 'ambiguous'>;
  alternativeEvidenceKey: string;
  alternativeTopLevel: Exclude<PhotoTopLevel, 'ambiguous'>;
  rawResponse: Record<string, unknown>;
  durationMs: number;
};

export type PhotoSubjectAnchor = {
  evidenceKey: string;
  label: string;
  topLevel: PhotoTopLevel;
  confidence: number;
  selectionRank: number;
  representation: PhotoRepresentationKind;
  source: 'foundation';
};

export type PhotoSemanticHypothesis = {
  conceptKey: string;
  label: string;
  domain: MemoryDomain;
  score: number;
  selectionRank: number;
  primaryEligible: boolean;
  eligibilityReason: string | null;
  evidenceIds: string[];
  supportingSignals: string[];
  contradictions: string[];
};

export type PhotoSemanticAttempt = {
  kind: 'primary' | 'technical_retry' | 'repair' | 'grounded_fallback' | 'ambiguity';
  status: 'used' | 'rejected' | 'failed';
  durationMs: number | null;
  rawResponse: Record<string, unknown> | null;
  reason: string | null;
};

export type PhotoSemanticFrame = {
  schemaVersion: 3;
  stage: 'evidence_prepared' | 'foundation_reconciled';
  evidence: PhotoJournalEvidencePacket;
  primaryEvidenceKeys: string[];
  classificationEvidenceKeys: string[];
  backgroundEvidenceKeys: string[];
  representation: { kind: PhotoRepresentationKind; confidence: number; evidenceIds: string[] };
  container: { kind: PhotoContainerKind; confidence: number; evidenceIds: string[] };
  hypotheses: PhotoSemanticHypothesis[];
  subjectAnchor: PhotoSubjectAnchor | null;
  primaryConceptKey: string | null;
  alternativeConceptKey: string | null;
  alternativeSubject: string | null;
  alternativeDomain: MemoryDomain | null;
  alternativeFlowKey: PhotoSemanticFlowKey | null;
  alternativeReason: string | null;
  supportingEvidenceKeys: string[];
  primarySubject: string | null;
  domain: MemoryDomain | null;
  flowKey: PhotoSemanticFlowKey | null;
  unresolvedFacet: PhotoSemanticUnresolvedFacet;
  routeSupport: PhotoJournalRouteSupport[];
  foundation: {
    status: 'not_requested' | 'used' | 'unavailable' | 'failed' | 'rejected';
    durationMs: number | null;
    rawResponse: Record<string, unknown> | null;
    reason: string | null;
    attempts: PhotoSemanticAttempt[];
  };
};

export function photoSemanticFlowForTopLevel(topLevel: PhotoTopLevel): PhotoSemanticFlowKey {
  if (topLevel === 'place') return 'went_somewhere';
  if (topLevel === 'media') return 'studio';
  if (topLevel === 'event') return 'big_event';
  if (topLevel === 'ordinary') return 'general';
  return topLevel;
}

/** Clear model vocabulary for the app's legacy/manual journal flow IDs. */
export function photoModelFlowIdForSemanticFlow(flowId: string): PhotoModelFlowId | null {
  return journalModelFlowIdForInternalFlow(flowId);
}

export function photoTopLevelForSemanticFlow(flowId: string): Exclude<PhotoTopLevel, 'ambiguous'> | null {
  if (flowId === 'went_somewhere' || flowId === 'place') return 'place';
  if (flowId === 'studio' || flowId === 'media') return 'media';
  if (flowId === 'big_event' || flowId === 'event') return 'event';
  if (flowId === 'general' || flowId === 'other' || flowId === 'ordinary') return 'ordinary';
  if (flowId === 'people' || flowId === 'food' || flowId === 'movement' || flowId === 'work') return flowId;
  return null;
}

export function photoSemanticDomainForTopLevel(topLevel: PhotoTopLevel): MemoryDomain {
  if (topLevel === 'place') return 'place';
  if (topLevel === 'media') return 'media';
  if (topLevel === 'event') return 'life_event';
  if (topLevel === 'ordinary' || topLevel === 'ambiguous') return 'other';
  return topLevel;
}

export function buildPhotoSemanticFrame(evidence: PhotoJournalEvidencePacket): PhotoSemanticFrame {
  const visible = visiblePhotoEssenceEvidence(evidence);
  const primary = visible.signals;
  const classificationEvidence = photoClassificationEvidenceSignals(evidence, 8);
  const background = classificationEvidence.filter((signal) => !primary.some((item) => item.id === signal.id));
  const hypotheses = classificationEvidence.map((signal) => {
    const eligibility = photoEvidenceEligibility(signal);
    const isPrimary = primary.some((item) => item.id === signal.id);
    return {
      conceptKey: signal.id,
      label: signal.name,
      domain: 'other' as MemoryDomain,
      score: signal.confidence,
      selectionRank: photoEvidenceSelectionRank(signal),
      primaryEligible: isPrimary && eligibility.primaryEligible,
      eligibilityReason: isPrimary ? eligibility.eligibilityReason : eligibility.eligibilityReason ?? 'not_visible_in_essence',
      evidenceIds: [signal.id],
      supportingSignals: [signal.name],
      contradictions: isPrimary ? [] : ['not part of the visible Essence input'],
    };
  });
  const representation: PhotoSemanticFrame['representation'] = visible.representation === 'screen_content'
    ? { kind: 'native_digital_image', confidence: evidence.representation?.confidence ?? 0, evidenceIds: ['summary:representation'] }
    : visible.representation === 'real_world'
      ? { kind: 'physical_scene', confidence: evidence.representation?.confidence ?? 0, evidenceIds: ['summary:representation'] }
      : { kind: 'unknown', confidence: evidence.representation?.confidence ?? 0, evidenceIds: [] };
  return {
    schemaVersion: 3,
    stage: 'evidence_prepared',
    evidence,
    primaryEvidenceKeys: primary.map((signal) => signal.id),
    classificationEvidenceKeys: classificationEvidence.map((signal) => signal.id),
    backgroundEvidenceKeys: background.map((signal) => signal.id),
    representation,
    container: { kind: 'unknown', confidence: 0, evidenceIds: [] },
    hypotheses,
    subjectAnchor: null,
    primaryConceptKey: null,
    alternativeConceptKey: null,
    alternativeSubject: null,
    alternativeDomain: null,
    alternativeFlowKey: null,
    alternativeReason: null,
    supportingEvidenceKeys: [],
    primarySubject: null,
    domain: null,
    flowKey: null,
    unresolvedFacet: 'primary_subject',
    routeSupport: [],
    foundation: { status: 'not_requested', durationMs: null, rawResponse: null, reason: null, attempts: [] },
  };
}

export function reconcilePhotoSemanticFrame(
  base: PhotoSemanticFrame,
  decision: PhotoTopLevelDecision | null,
  failure?: {
    status: 'unavailable' | 'failed';
    reason: string;
    durationMs?: number | null;
    rawResponse?: Record<string, unknown> | null;
  },
  attempts: PhotoSemanticAttempt[] = []
): PhotoSemanticFrame {
  if (!decision) {
    return {
      ...base,
      foundation: {
        status: failure?.status ?? 'failed',
        durationMs: failure?.durationMs ?? null,
        rawResponse: failure?.rawResponse ?? null,
        reason: failure?.reason ?? 'Foundation returned no grounded top-level decision',
        attempts,
      },
    };
  }
  const issue = photoTopLevelDecisionIssue(base, decision);
  const primary = base.hypotheses.find((item) => item.conceptKey === decision.primaryEvidenceKey);
  if (issue || !primary) {
    return {
      ...base,
      foundation: {
        status: 'rejected', durationMs: decision.durationMs,
        rawResponse: decision.rawResponse, reason: issue ?? 'Primary evidence key was not supplied', attempts,
      },
    };
  }
  return resolvedFrame(base, primary, decision.topLevel, null, null, decision.rawResponse, decision.durationMs, attempts);
}

export function reconcilePhotoTopLevelAmbiguity(
  base: PhotoSemanticFrame,
  decision: PhotoTopLevelAmbiguityDecision | null,
  attempts: PhotoSemanticAttempt[]
): PhotoSemanticFrame {
  if (!decision) return { ...base, foundation: { ...base.foundation, status: 'failed', reason: 'No grounded top-level alternatives returned', attempts } };
  const primary = base.hypotheses.find((item) => item.conceptKey === decision.primaryEvidenceKey);
  const alternative = base.hypotheses.find((item) => item.conceptKey === decision.alternativeEvidenceKey);
  const primaryIssue = photoTopLevelDecisionIssue(base, {
    primaryEvidenceKey: decision.primaryEvidenceKey,
    topLevel: decision.primaryTopLevel,
    confidence: 'low',
    rawResponse: decision.rawResponse,
    durationMs: decision.durationMs,
  });
  const alternativeIssue = photoTopLevelDecisionIssue(base, {
    primaryEvidenceKey: decision.alternativeEvidenceKey,
    topLevel: decision.alternativeTopLevel,
    confidence: 'low',
    rawResponse: decision.rawResponse,
    durationMs: decision.durationMs,
  });
  const issue = primaryIssue ?? alternativeIssue ?? (!base.primaryEvidenceKeys.includes(decision.primaryEvidenceKey)
    || !base.primaryEvidenceKeys.includes(decision.alternativeEvidenceKey)
    ? 'Top-level ambiguity cited evidence outside visible Essence'
    : decision.primaryEvidenceKey === decision.alternativeEvidenceKey
      ? 'Top-level ambiguity reused one evidence key'
      : decision.primaryTopLevel === decision.alternativeTopLevel
        ? 'Top-level ambiguity returned the same category twice'
        : null);
  if (issue || !primary || !alternative) {
    return { ...base, foundation: { status: 'rejected', durationMs: decision.durationMs, rawResponse: decision.rawResponse, reason: issue ?? 'Ambiguity evidence was not supplied', attempts } };
  }
  return resolvedFrame(base, primary, decision.primaryTopLevel, alternative, decision.alternativeTopLevel, decision.rawResponse, decision.durationMs, attempts);
}

function resolvedFrame(
  base: PhotoSemanticFrame,
  primary: PhotoSemanticHypothesis,
  topLevel: PhotoTopLevel,
  alternative: PhotoSemanticHypothesis | null,
  alternativeTopLevel: PhotoTopLevel | null,
  rawResponse: Record<string, unknown>,
  durationMs: number,
  attempts: PhotoSemanticAttempt[]
): PhotoSemanticFrame {
  const flowKey = photoSemanticFlowForTopLevel(topLevel);
  const domain = photoSemanticDomainForTopLevel(topLevel);
  const alternativeFlowKey = alternativeTopLevel ? photoSemanticFlowForTopLevel(alternativeTopLevel) : null;
  const unresolvedFacet: PhotoSemanticUnresolvedFacet = topLevel === 'ambiguous'
      ? 'primary_subject'
      : 'none';
  const container: PhotoSemanticFrame['container'] = topLevel === 'ambiguous'
    ? base.container
    : { kind: 'none', confidence: primary.score, evidenceIds: [primary.conceptKey] };
  const hypotheses = [
    { ...primary, domain, contradictions: [] },
    ...(alternative && alternativeTopLevel ? [{ ...alternative, domain: photoSemanticDomainForTopLevel(alternativeTopLevel), contradictions: [] }] : []),
    ...base.hypotheses.filter((item) => item.conceptKey !== primary.conceptKey && item.conceptKey !== alternative?.conceptKey),
  ];
  return {
    ...base,
    stage: 'foundation_reconciled',
    container,
    hypotheses,
    subjectAnchor: {
      evidenceKey: primary.conceptKey,
      label: primary.label,
      topLevel,
      confidence: primary.score,
      selectionRank: primary.selectionRank,
      representation: base.representation.kind,
      source: 'foundation',
    },
    primaryConceptKey: primary.conceptKey,
    alternativeConceptKey: alternative?.conceptKey ?? null,
    alternativeSubject: alternative?.label ?? null,
    alternativeDomain: alternativeTopLevel ? photoSemanticDomainForTopLevel(alternativeTopLevel) : null,
    alternativeFlowKey,
    alternativeReason: alternative ? 'accepted_grounded_top_level_ambiguity' : 'none_supplied',
    supportingEvidenceKeys: [],
    primarySubject: primary.label,
    domain,
    flowKey,
    unresolvedFacet,
    foundation: { status: 'used', durationMs, rawResponse, reason: null, attempts },
  };
}

export function photoTopLevelDecisionIssue(base: PhotoSemanticFrame, decision: PhotoTopLevelDecision): string | null {
  if (!base.primaryEvidenceKeys.includes(decision.primaryEvidenceKey)) return 'Foundation selected evidence outside visible Essence';
  return null;
}

export function photoTopLevelEvidenceText(frame: PhotoSemanticFrame): string {
  const visible = visiblePhotoEssenceEvidence(frame.evidence);
  const lockedPrincipalKey = frame.primaryEvidenceKeys[0] ?? null;
  const signals = frame.classificationEvidenceKeys.map((key, index) => {
    const signal = frame.evidence.signals.find((item) => item.id === key);
    if (!signal) return null;
    const role = key === lockedPrincipalKey ? 'locked_principal_essence' : 'filtered_essence_context';
    return [
      `${index + 1}. ${key}=${signal.name}`,
      `members [${signal.memberLabels.join(' | ')}]`,
      `maxDetector ${signal.maxDetectorConfidence.toFixed(3)}`,
      `corroborated ${signal.corroboratedConfidence.toFixed(3)}`,
      `sourceReliability ${signal.sourceReliability.toFixed(3)}`,
      `sourceAdjusted ${signal.sourceAdjustedConfidence.toFixed(3)}`,
      `spatial ${signal.spatialContribution.toFixed(3)}`,
      `salience ${signal.salience.toFixed(3)}`,
      `role ${role}`,
      `sources ${signal.sources.join('+')}`,
      `ranking [${signal.rankReasons.join(' | ')}]`,
    ].join('; ');
  }).filter(Boolean).join('\n') || 'none';
  const dominantRegion = frame.evidence.classifiedRegionCount > 0
    ? `dominant coverage ${frame.evidence.dominantCoverage.toFixed(2)}; ${frame.evidence.classifiedRegionCount} classified region(s)`
    : `dominant coverage ${frame.evidence.dominantCoverage.toFixed(2)} is unlabelled and must not be attributed to any evidence cluster`;
  return `Filtered Essence evidence only (up to eight clusters; OCR and unfiltered raw labels excluded):\n${signals}\nLocked principal evidence: ${lockedPrincipalKey ?? 'none'}.\nRepresentation ${visible.representation}; faces ${visible.faceCount}; humans ${visible.humanCount}; max face coverage ${frame.evidence.maxFaceCoverage.toFixed(3)}; max human coverage ${frame.evidence.maxHumanCoverage.toFixed(3)}; ${dominantRegion}. Spatial ranking is already represented by each filtered Essence cluster's spatial contribution; no additional labels are supplied.`;
}

export function photoSemanticFrameText(frame: PhotoSemanticFrame): string {
  const resolved = frame.stage === 'foundation_reconciled'
    ? ` Locked top level ${frame.subjectAnchor?.topLevel ?? 'ambiguous'}; subject ${frame.primarySubject ?? 'unknown'}; flow ${frame.flowKey ?? 'ambiguous'}; alternative ${frame.alternativeFlowKey ?? 'none'}; unresolved ${frame.unresolvedFacet}.`
    : '';
  return `${photoTopLevelEvidenceText(frame)}${resolved}`;
}

export function semanticFrameNeedsFoundation(_frame: PhotoSemanticFrame): boolean { return true; }
export function semanticFrameCanAutoRoute(_frame: PhotoSemanticFrame): boolean { return false; }

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replaceAll('_', ' ').replace(/\s+/g, ' ');
}
