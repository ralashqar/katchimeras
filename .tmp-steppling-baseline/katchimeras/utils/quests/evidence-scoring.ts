import type { DayEvidence, DayEvidenceSourceType } from '@/types/home';
import { signalMatches } from '@/utils/intelligence/taxonomy';
import { qualityDefinition, qualityMatchesText } from '@/utils/intelligence/quality-registry';

export type EvidenceMatchPolicy = {
  value: string;
  minConfidence?: number;
  sourceTypes?: DayEvidenceSourceType[];
  requireCount?: number;
  withinIsoDate?: string | null;
  allowCorroboration?: boolean;
  minimumCentrality?: 'primary' | 'supporting' | 'any';
};

export type EvidenceMatchResult = {
  matched: boolean;
  evidenceIds: string[];
  confidence: number;
  reason: string | null;
  qualityId?: string | null;
  centrality?: 'primary' | 'supporting' | 'incidental' | null;
};

const SOURCE_WEIGHT: Record<string, number> = {
  manual: 1,
  appleFoundation: 0.95,
  appleVision: 0.9,
  remoteLlm: 0.88,
  deterministic: 0.72,
  appleSpeech: 0.7,
};

export function scoreEvidenceMatch(evidence: DayEvidence[], policy: EvidenceMatchPolicy): EvidenceMatchResult {
  const minConfidence = policy.minConfidence ?? 0.62;
  const requireCount = policy.requireCount ?? 1;
  const sourceTypes = policy.sourceTypes;
  const scored: { id: string; score: number; centrality: 'primary' | 'supporting' | 'incidental' }[] = [];

  for (const item of evidence) {
    if (sourceTypes && !sourceTypes.includes(item.sourceType)) continue;
    if (policy.withinIsoDate && item.observedAt.slice(0, 10) !== policy.withinIsoDate) continue;

    for (const signal of item.signals) {
      const quality = qualityDefinition(policy.value);
      const matches = quality
        ? signal.key === policy.value || qualityMatchesText(quality, `${signal.key} ${signal.raw ?? ''}`)
        : signalMatches(signal.key, policy.value);
      if (!matches) continue;
      const centrality = signal.centrality ?? 'supporting';
      if (!centralityMeets(centrality, policy.minimumCentrality ?? 'any')) continue;
      // Memory quality scores are already calibrated from provider reliability
      // and centrality; applying the provider weight again would double-discount
      // them (the previous Skylo failure did exactly this to city evidence).
      const providerWeight = SOURCE_WEIGHT[signal.provider] ?? 0.65;
      const score = clamp01(quality ? signal.confidence : signal.confidence * providerWeight);
      if (score >= minConfidence) {
        scored.push({ id: item.id, score, centrality });
      }
    }
  }

  const direct = scored.sort((left, right) => right.score - left.score).slice(0, requireCount);
  if (direct.length >= requireCount) {
    return {
      matched: true,
      evidenceIds: direct.map((item) => item.id),
      confidence: direct.reduce((sum, item) => sum + item.score, 0) / direct.length,
      reason: null,
      qualityId: qualityDefinition(policy.value) ? policy.value : null,
      centrality: direct[0]?.centrality ?? null,
    };
  }

  if (policy.allowCorroboration) {
    const weak = scored.filter((item) => item.score >= minConfidence * 0.72).slice(0, 3);
    const corroborated = clamp01(weak.reduce((sum, item) => sum + item.score, 0) / Math.max(1, requireCount));
    if (weak.length >= 2 && corroborated >= minConfidence) {
      return {
        matched: true,
        evidenceIds: weak.map((item) => item.id),
        confidence: corroborated,
        reason: null,
        qualityId: qualityDefinition(policy.value) ? policy.value : null,
        centrality: weak[0]?.centrality ?? null,
      };
    }
  }

  return {
    matched: false,
    evidenceIds: [],
    confidence: scored[0]?.score ?? 0,
    reason: `No ${sourceTypes?.join('/') ?? 'evidence'} confidently matched ${policy.value}.`,
    qualityId: qualityDefinition(policy.value) ? policy.value : null,
    centrality: null,
  };
}

function centralityMeets(actual: 'primary' | 'supporting' | 'incidental', minimum: 'primary' | 'supporting' | 'any') {
  if (minimum === 'any') return true;
  if (minimum === 'primary') return actual === 'primary';
  return actual === 'primary' || actual === 'supporting';
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}
