import type { DayScores, DayVisionSummary, HomeScoreKey } from '@/types/home';
import { resolvePhotoCategory } from '@/utils/photo-category';

// The four "what stood out" choices a capture offers, and how each + the photo's
// detected subject translate into captured energy (our HomeScoreKey axes). Pure,
// so it's fully unit-testable. Scaled to the same range as prompt scoreBias
// (~0.1–0.34). "Meaningful" has no axis of its own, so it gently deepens the
// day's already-strongest axis — it intensifies what the day was about.

export type MeaningTag = 'calm' | 'energy' | 'together' | 'meaningful';

export const CAPTURE_MEANINGS: readonly { id: MeaningTag; emoji: string; label: string }[] = [
  { id: 'calm', emoji: '🌿', label: 'Calm' },
  { id: 'energy', emoji: '⚡', label: 'Energy' },
  { id: 'together', emoji: '🧑‍🤝‍🧑', label: 'Together' },
  { id: 'meaningful', emoji: '✨', label: 'Meaningful' },
];

const SCORE_KEYS: HomeScoreKey[] = ['energy', 'calm', 'social', 'exploration', 'focus'];

export function buildCaptureEnergy(
  meaning: MeaningTag,
  vision: DayVisionSummary | null,
  dayScores?: DayScores
): Partial<DayScores> {
  const deltas: Partial<DayScores> = {};
  const add = (key: HomeScoreKey, value: number) => {
    deltas[key] = clamp01((deltas[key] ?? 0) + value);
  };

  if (meaning === 'calm') add('calm', 0.26);
  else if (meaning === 'energy') add('energy', 0.26);
  else if (meaning === 'together') add('social', 0.26);
  else if (meaning === 'meaningful') add(dominantAxis(dayScores), 0.18);

  // The photo's subject nudges a second axis, so a captured landmark reads as
  // exploration, a shared frame as social, a meal as a touch of calm, etc.
  if (vision) {
    const category = resolvePhotoCategory(vision).id;
    if (category === 'nature' || category === 'water' || category === 'mountains') add('exploration', 0.1);
    if (category === 'landmark') add('exploration', 0.12);
    if (category === 'active') add('energy', 0.1);
    if (category === 'culture') add('focus', 0.08);
    if (category === 'food' || category === 'drink') add('calm', 0.06);
    if (vision.maxFaceCount >= 1) add('social', 0.1);
  }

  return deltas;
}

// Sum two delta maps (used to accumulate multiple captures on one day).
export function mergeCaptureEnergy(
  existing: Partial<DayScores> | undefined,
  incoming: Partial<DayScores>
): Partial<DayScores> {
  const result: Partial<DayScores> = { ...existing };
  for (const key of SCORE_KEYS) {
    const sum = (result[key] ?? 0) + (incoming[key] ?? 0);
    if (sum > 0) {
      result[key] = clamp01(sum);
    }
  }
  return result;
}

function dominantAxis(scores?: DayScores): HomeScoreKey {
  if (!scores) return 'calm';
  return SCORE_KEYS.reduce((best, key) => (scores[key] > scores[best] ? key : best), SCORE_KEYS[0]);
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}
