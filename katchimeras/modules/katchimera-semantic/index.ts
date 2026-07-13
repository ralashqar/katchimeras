import { requireOptionalNativeModule } from 'expo-modules-core';

export type SemanticCategoryInput = {
  id: string;
  wordAnchors: string[];
  positiveSentences: string[];
  negativeSentences: string[];
};

export type SemanticComparison = {
  categoryId: string;
  wordScore: number | null;
  sentenceScore: number | null;
  negativeScore: number | null;
  matchedAnchors: { input: string; anchor: string; score: number; kind: 'word' | 'sentence' | 'negative' }[];
};

export type SemanticAvailability = {
  wordEmbeddingAvailable: boolean;
  sentenceEmbeddingAvailable: boolean;
  language: string;
  wordRevision?: number;
  sentenceRevision?: number;
  reason?: string;
};

type NativeSemanticModule = {
  availability(language: string): SemanticAvailability;
  compareLabelsAsync(
    labels: { text: string; confidence: number; prominence?: number }[],
    categories: SemanticCategoryInput[],
    language: string
  ): Promise<SemanticComparison[]>;
  compareTextAsync(text: string, categories: SemanticCategoryInput[], language: string): Promise<SemanticComparison[]>;
};

export default requireOptionalNativeModule<NativeSemanticModule>('KatchimeraSemantic');
