import { requireOptionalNativeModule } from 'expo-modules-core';

import type { DayVisionSummary } from '@/types/home';
import { type CaptureMeaning, type MeaningTag } from '@/utils/capture-energy';

// JS bridge to the on-device Apple Foundation Models module
// (modules/katchimera-foundation). Present only on iOS 26+ Apple-Intelligence
// devices; null everywhere else, so callers fall back to the rule-based set.
type FoundationNativeModule = {
  isAvailable: () => boolean;
  suggestMeaningsAsync: (
    tags: string[],
    faceCount: number
  ) => Promise<{ label?: unknown; archetype?: unknown }[]>;
};

const nativeFoundation = requireOptionalNativeModule<FoundationNativeModule>('KatchimeraFoundation');

const VALID_ARCHETYPES: MeaningTag[] = ['calm', 'energy', 'together', 'meaningful'];
const ARCHETYPE_EMOJI: Record<MeaningTag, string> = {
  calm: '🌿',
  energy: '⚡',
  together: '🧑‍🤝‍🧑',
  meaningful: '✨',
};
const SUGGEST_TIMEOUT_MS = 2500;

export function isFoundationMeaningAvailable(): boolean {
  try {
    return nativeFoundation?.isAvailable() === true;
  } catch {
    return false;
  }
}

// Pure: validate + normalise the model's raw output into CaptureMeaning[]. Keeps
// one option per distinct archetype (so the four feelings stay distinct), drops
// anything malformed, and returns null unless at least three usable options
// survive — the caller then falls back to the rule-based set.
export function mapFoundationMeanings(
  raw: { label?: unknown; archetype?: unknown }[]
): CaptureMeaning[] | null {
  const out: CaptureMeaning[] = [];
  const seen = new Set<MeaningTag>();
  for (const item of raw) {
    const label = typeof item.label === 'string' ? item.label.trim() : '';
    const archetype = typeof item.archetype === 'string' ? item.archetype.trim().toLowerCase() : '';
    if (!label || label.length > 24) {
      continue;
    }
    if (!VALID_ARCHETYPES.includes(archetype as MeaningTag) || seen.has(archetype as MeaningTag)) {
      continue;
    }
    seen.add(archetype as MeaningTag);
    out.push({ id: archetype as MeaningTag, emoji: ARCHETYPE_EMOJI[archetype as MeaningTag], label });
  }
  return out.length >= 3 ? out.slice(0, 4) : null;
}

// Ask the on-device model for meaning options fitting the photo's essence.
// Returns null (fast) when unavailable, on timeout, or on any malformed result —
// the caller falls back to selectCaptureMeanings(). The tags never leave the
// device.
export async function suggestFoundationMeanings(
  vision: DayVisionSummary
): Promise<CaptureMeaning[] | null> {
  if (!nativeFoundation?.suggestMeaningsAsync || !isFoundationMeaningAvailable()) {
    return null;
  }
  // Concepts are salience-sorted, so the most prominent subject leads; details
  // follow as supporting context. Dedupe (a detail can echo a concept) so the
  // model gets a clean ranked list with the main subject unmistakably first.
  const ordered = [...vision.concepts.map((concept) => concept.name), ...vision.details].map((tag) =>
    tag.replace(/_/g, ' ').trim()
  );
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const tag of ordered) {
    const key = tag.toLowerCase();
    if (tag && !seen.has(key)) {
      seen.add(key);
      tags.push(tag);
    }
    if (tags.length >= 8) {
      break;
    }
  }
  if (tags.length === 0 && vision.maxFaceCount < 1) {
    return null;
  }
  try {
    const raw = await withTimeout(
      nativeFoundation.suggestMeaningsAsync(tags, vision.maxFaceCount),
      SUGGEST_TIMEOUT_MS
    );
    return raw ? mapFoundationMeanings(raw) : null;
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), ms);
    }),
  ]);
}
