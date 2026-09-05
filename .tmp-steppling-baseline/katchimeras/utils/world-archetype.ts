import type { DayScores, HomeRarityTier } from '@/types/home';
import type { WorldArchetype } from '@/types/world';

// Maps the existing 5-axis day scores onto the six World archetypes. Five align
// 1:1 with HomeScoreKey; `meaningful` is synthesised from living-rarity + the
// day's meaning/reflection signals (which the score axes don't capture).
export type ArchetypeSignals = {
  scores: DayScores;
  rarity: HomeRarityTier | null;
  livingFactorCount: number;
  // capturedMeanings tagged 'meaningful' + meaning/meaningful_photo prompts.
  meaningfulCount: number;
};

// Stable tie-break order so equal scores always resolve the same archetype.
const ARCHETYPE_ORDER: WorldArchetype[] = [
  'meaningful',
  'calm',
  'social',
  'exploration',
  'active',
  'focus',
];

function rarityWeight(rarity: HomeRarityTier | null): number {
  switch (rarity) {
    case 'legendary':
      return 1;
    case 'epic':
      return 0.7;
    case 'rare':
      return 0.4;
    default:
      return 0;
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// Per-archetype weight in 0..1. `active` reads from the energy axis; the rest
// from their like-named axis; `meaningful` is composed.
export function archetypeScores(signals: ArchetypeSignals): Record<WorldArchetype, number> {
  const s = signals.scores;
  return {
    calm: clamp01(s.calm ?? 0),
    active: clamp01(s.energy ?? 0),
    social: clamp01(s.social ?? 0),
    exploration: clamp01(s.exploration ?? 0),
    focus: clamp01(s.focus ?? 0),
    meaningful: clamp01(
      rarityWeight(signals.rarity) + signals.meaningfulCount * 0.22 + signals.livingFactorCount * 0.12
    ),
  };
}

// The day's identity: a primary archetype always, plus a secondary when a second
// axis is genuinely present (≥55% of the primary and ≥0.22 absolute).
export function deriveArchetypes(signals: ArchetypeSignals): {
  primary: WorldArchetype;
  secondary: WorldArchetype | null;
  scores: Record<WorldArchetype, number>;
} {
  const scores = archetypeScores(signals);
  const ranked = ARCHETYPE_ORDER.map((key) => ({ key, value: scores[key] })).sort(
    (a, b) => b.value - a.value || ARCHETYPE_ORDER.indexOf(a.key) - ARCHETYPE_ORDER.indexOf(b.key)
  );
  const primary = ranked[0].key;
  const runnerUp = ranked[1];
  const secondary =
    runnerUp && runnerUp.value >= 0.22 && runnerUp.value >= ranked[0].value * 0.55
      ? runnerUp.key
      : null;
  return { primary, secondary, scores };
}
