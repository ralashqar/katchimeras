import type { DayEvidence, DayEvidenceSourceType } from '@/types/home';
import { signalMatches } from '@/utils/intelligence/taxonomy';

export type EvidenceMatchPolicy = {
  value: string;
  minConfidence?: number;
  sourceTypes?: DayEvidenceSourceType[];
  requireCount?: number;
  withinIsoDate?: string | null;
  allowCorroboration?: boolean;
};

export type EvidenceMatchResult = {
  matched: boolean;
  evidenceIds: string[];
  confidence: number;
  reason: string | null;
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
  const scored: { id: string; score: number }[] = [];

  for (const item of evidence) {
    if (sourceTypes && !sourceTypes.includes(item.sourceType)) continue;
    if (policy.withinIsoDate && item.observedAt.slice(0, 10) !== policy.withinIsoDate) continue;

    for (const signal of item.signals) {
      if (!signalMatches(signal.key, policy.value)) continue;
      const providerWeight = SOURCE_WEIGHT[signal.provider] ?? 0.65;
      const score = clamp01(signal.confidence * providerWeight);
      if (score >= minConfidence) {
        scored.push({ id: item.id, score });
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
      };
    }
  }

  return {
    matched: false,
    evidenceIds: [],
    confidence: scored[0]?.score ?? 0,
    reason: `No ${sourceTypes?.join('/') ?? 'evidence'} confidently matched ${policy.value}.`,
  };
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

