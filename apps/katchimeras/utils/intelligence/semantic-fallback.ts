import SemanticNative, { type SemanticComparison } from '@/modules/katchimera-semantic';
import type { PhotoVisionResult, StudioMediaType } from '@/types/home';
import { detectStudioInText, extractStudioTitle } from '@/utils/studio-detect';
import { semanticCategoriesFor, type SemanticCategoryDefinition, type SemanticSource } from './semantic-categories';

export type SemanticCandidate = {
  categoryId: string;
  label: string;
  score: number;
  status: 'ready' | 'review';
  matchedAnchors: SemanticComparison['matchedAnchors'];
};

export type SemanticRead = {
  provider: 'appleNaturalLanguage';
  language: 'en';
  candidates: SemanticCandidate[];
  selected: SemanticCandidate | null;
  needsClarification: boolean;
};

function nativeInput(category: SemanticCategoryDefinition) {
  return {
    id: category.id,
    wordAnchors: category.wordAnchors,
    positiveSentences: category.positiveSentences,
    negativeSentences: category.negativeSentences,
  };
}

function finalize(comparisons: SemanticComparison[], categories: SemanticCategoryDefinition[], boosts: Map<string, number> = new Map()): SemanticRead | null {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const ranked = comparisons
    .map((comparison) => {
      const category = byId.get(comparison.categoryId);
      if (!category) return null;
      const word = comparison.wordScore ?? 0;
      const sentence = comparison.sentenceScore ?? 0;
      const negative = comparison.negativeScore ?? 0;
      const semantic = sentence > 0 ? sentence * 0.58 + word * 0.22 : word * 0.8;
      const score = clamp01(semantic + (boosts.get(category.id) ?? 0) - Math.max(0, negative - sentence) * 0.45);
      if (score < category.thresholds.review) return null;
      return {
        categoryId: category.id,
        label: category.displayName,
        score: round2(score),
        status: score >= category.thresholds.accept ? 'ready' as const : 'review' as const,
        matchedAnchors: comparison.matchedAnchors,
      };
    })
    .filter((candidate): candidate is SemanticCandidate => !!candidate)
    .sort((left, right) => right.score - left.score || left.categoryId.localeCompare(right.categoryId));
  if (!ranked.length) return null;
  const first = ranked[0];
  const definition = byId.get(first.categoryId)!;
  const margin = first.score - (ranked[1]?.score ?? 0);
  const selected = first.status === 'ready' && margin >= definition.thresholds.minimumMargin && !definition.sensitive ? first : null;
  return { provider: 'appleNaturalLanguage', language: 'en', candidates: ranked.slice(0, 4), selected, needsClarification: !selected };
}

export async function classifyNoteSemantically(text: string, source: Exclude<SemanticSource, 'photo'>): Promise<SemanticRead | null> {
  if (!SemanticNative?.compareTextAsync || !text.trim()) return null;
  const categories = semanticCategoriesFor(source);
  const deterministic = detectStudioInText(text);
  const boosts = new Map<string, number>();
  if (deterministic.detected && deterministic.mediaType) boosts.set(`media.${deterministic.mediaType}`, 0.38);
  try {
    const comparisons = await SemanticNative.compareTextAsync(text, categories.map(nativeInput), 'en');
    return finalize(comparisons, categories, boosts);
  } catch {
    return null;
  }
}

export async function classifyPhotoLabelsSemantically(result: PhotoVisionResult): Promise<SemanticRead | null> {
  if (!SemanticNative?.compareLabelsAsync) return null;
  const categories = semanticCategoriesFor('photo').filter((category) => category.physicalOnly);
  const regionLabels = (result.regionClassifications ?? []).flatMap((region) =>
    region.labels.map((label) => ({ text: label.name, confidence: label.confidence, prominence: region.region.confidence ?? 0.7 }))
  );
  const labels = [...(result.labels ?? []).map((label) => ({ text: label.name, confidence: label.confidence, prominence: 0.75 })), ...regionLabels];
  if (!labels.length) return null;
  try {
    return finalize(await SemanticNative.compareLabelsAsync(labels, categories.map(nativeInput), 'en'), categories);
  } catch {
    return null;
  }
}

export function semanticMedia(read: SemanticRead | null, text: string): { mediaType: StudioMediaType; title: string | null; creator: null } | null {
  const candidate = read?.selected ?? null;
  if (!candidate?.categoryId.startsWith('media.')) return null;
  const mediaType = candidate.categoryId.slice('media.'.length) as StudioMediaType;
  return { mediaType, title: extractStudioTitle(text), creator: null };
}

function clamp01(value: number): number { return Math.min(1, Math.max(0, value)); }
function round2(value: number): number { return Math.round(clamp01(value) * 100) / 100; }
