import registryJson from '@/data/intelligence/memory-qualities.json';
import type {
  DayEvidenceProvider,
  IntelligenceObservation,
  MemoryDomain,
  MemoryQualityCentrality,
  MemoryQualityScore,
  UserConfirmation,
} from '@/types/home';

export type QualityDefinition = {
  id: string;
  domain: MemoryDomain;
  aliases: string[];
  physicalOnly: boolean;
  assignmentSeedId?: string;
  readyThreshold?: number;
  reviewThreshold?: number;
};

type QualityRegistry = {
  schemaVersion: number;
  defaults: { readyThreshold: number; reviewThreshold: number };
  providerWeights: Record<DayEvidenceProvider, number>;
  centralityWeights: Record<MemoryQualityCentrality, number>;
  qualities: QualityDefinition[];
};

export const QUALITY_REGISTRY = validateRegistry(registryJson as QualityRegistry);
const BY_ID = new Map(QUALITY_REGISTRY.qualities.map((quality) => [quality.id, quality]));

export function qualityDefinition(qualityId: string): QualityDefinition | null {
  return BY_ID.get(qualityId) ?? null;
}

export function qualityThresholds(qualityId: string): { ready: number; review: number } {
  const quality = qualityDefinition(qualityId);
  return {
    ready: quality?.readyThreshold ?? QUALITY_REGISTRY.defaults.readyThreshold,
    review: quality?.reviewThreshold ?? QUALITY_REGISTRY.defaults.reviewThreshold,
  };
}

export function qualityCentralityWeight(centrality: MemoryQualityCentrality): number {
  return QUALITY_REGISTRY.centralityWeights[centrality] ?? 1;
}

export function deriveMemoryQualities(input: {
  observations: IntelligenceObservation[];
  confirmations?: UserConfirmation[];
  primaryValues?: string[];
  supportingValues?: string[];
  screenContent?: boolean;
}): MemoryQualityScore[] {
  const primary = normalizedSet(input.primaryValues ?? []);
  const supporting = normalizedSet(input.supportingValues ?? []);
  const results: MemoryQualityScore[] = [];

  for (const quality of QUALITY_REGISTRY.qualities) {
    const sources = input.observations
      .filter((observation) => qualityMatchesText(quality, `${observation.value} ${observation.raw ?? ''}`))
      .map((observation) => {
        const canonicalValue = normalize(observation.value);
        const centrality = matchesAny(canonicalValue, primary)
          ? 'primary'
          : matchesAny(canonicalValue, supporting)
            ? 'supporting'
            : observation.confidence < 0.3
              ? 'incidental'
              : 'supporting';
        return {
          provider: observation.provider,
          confidence: clamp01(observation.confidence),
          // Confidence answers whether the quality is present. Prominence is
          // retained independently in `centrality` and applied only by the
          // consumer's policy. Multiplying it here caused quests to penalize
          // supporting subjects twice.
          weight: QUALITY_REGISTRY.providerWeights[observation.provider] ?? 0.65,
          raw: observation.raw ?? observation.value,
          centrality,
        };
      });

    const confirmation = (input.confirmations ?? []).find(
      (item) => item.facetKey === `quality:${quality.id}`
    );
    const rejected = confirmation?.facetValue === 'rejected' || isSemanticallyRejected(quality, input.confirmations ?? []);
    const confirmed = confirmation?.facetValue === 'confirmed';
    if (quality.physicalOnly && input.screenContent) continue;
    if (sources.length === 0 && !confirmation) continue;

    const strongest = sources.reduce((max, source) => Math.max(max, source.confidence * source.weight), 0);
    const distinctProviders = new Set(sources.map((source) => source.provider)).size;
    const corroboration = Math.min(0.12, Math.max(0, distinctProviders - 1) * 0.06);
    const score = rejected ? 0 : confirmed ? 1 : clamp01(strongest + corroboration);
    const centrality = sources.some((source) => source.centrality === 'primary')
      ? 'primary'
      : sources.some((source) => source.centrality === 'supporting')
        ? 'supporting'
        : 'incidental';
    results.push({
      qualityId: quality.id,
      score: round2(score),
      centrality,
      status: rejected ? 'rejected' : confirmed ? 'confirmed' : 'inferred',
      sources: sources.map(({ centrality: _centrality, ...source }) => ({
        ...source,
        confidence: round2(source.confidence),
        weight: round2(source.weight),
      })),
      reasons: [
        rejected
          ? 'User rejected this quality'
          : confirmed
            ? 'User confirmed this quality with supporting visual evidence'
            : `Combined ${distinctProviders || 1} provider${distinctProviders === 1 ? '' : 's'}`,
      ],
    });
  }

  return results.sort((left, right) => right.score - left.score || left.qualityId.localeCompare(right.qualityId));
}

function isSemanticallyRejected(quality: QualityDefinition, confirmations: UserConfirmation[]): boolean {
  return confirmations.some((confirmation) => {
    if (confirmation.facetKey === 'food_kind' && confirmation.facetValue === 'incidental') {
      return quality.domain === 'food';
    }
    if (confirmation.facetKey === 'media_type' && confirmation.facetValue === 'other') {
      return quality.domain === 'media';
    }
    if (confirmation.facetKey === 'relationship' && confirmation.facetValue === 'incidental') {
      return ['subject.dog', 'subject.cat', 'subject.baby', 'subject.child', 'subject.person', 'subject.group'].includes(quality.id);
    }
    return false;
  });
}

export function qualityMatchesText(quality: QualityDefinition, value: string): boolean {
  const text = ` ${normalize(value)} `;
  return quality.aliases.some((alias) => text.includes(` ${normalize(alias)} `));
}

function validateRegistry(value: QualityRegistry): QualityRegistry {
  if (!value || value.schemaVersion !== 1 || !Array.isArray(value.qualities)) {
    throw new Error('Invalid memory-quality registry');
  }
  const ids = new Set<string>();
  for (const quality of value.qualities) {
    if (!quality.id || ids.has(quality.id) || !quality.domain || !quality.aliases?.length) {
      throw new Error(`Invalid or duplicate memory quality: ${quality.id ?? 'unknown'}`);
    }
    ids.add(quality.id);
    const thresholds = {
      ready: quality.readyThreshold ?? value.defaults.readyThreshold,
      review: quality.reviewThreshold ?? value.defaults.reviewThreshold,
    };
    if (thresholds.review < 0 || thresholds.ready > 1 || thresholds.review >= thresholds.ready) {
      throw new Error(`Invalid thresholds for memory quality ${quality.id}`);
    }
  }
  return value;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizedSet(values: string[]): Set<string> {
  return new Set(values.map(normalize).filter(Boolean));
}

function matchesAny(text: string, values: Set<string>): boolean {
  for (const value of values) if (` ${text} `.includes(` ${value} `) || ` ${value} `.includes(` ${text} `)) return true;
  return false;
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function round2(value: number): number {
  return Math.round(clamp01(value) * 100) / 100;
}
