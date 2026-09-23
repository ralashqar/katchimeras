import { CAPPED_REPLAY_GLOW_FACTOR, FULL_RATE_REPLAYS_PER_DAY } from '@/constants/level-track-milestones';
import type { EncounterDifficulty, EncounterGrade } from '@/types/encounter';

/**
 * What a cleared encounter pays. A rung's authored base, or the difficulty's
 * default; more for a better grade; the first clear in full, a replay for a
 * fraction; the Garden Stall and a signature Wisp add their share of Glow last.
 * Numbers only here.
 */
export const ENCOUNTER_BASE_GLOW: Readonly<Record<EncounterDifficulty, number>> = { calm: 12, thick: 20, dark: 32, boss: 60 };
export const ENCOUNTER_BASE_XP: Readonly<Record<EncounterDifficulty, number>> = { calm: 8, thick: 12, dark: 18, boss: 30 };
export const GRADE_MULTIPLIER: Readonly<Record<EncounterGrade, number>> = { cleared: 1, bright: 1.25, perfect: 1.5 };
export const REPLAY_GLOW_FACTOR = 0.4;
export const REPLAY_XP_FACTOR = 0.6;

export type EncounterRewardInput = {
  difficulty: EncounterDifficulty;
  /** The rung's own base; zero or absent means the difficulty's default. */
  base?: { glow: number; xp: number } | null;
  grade: EncounterGrade;
  firstClear: boolean;
  /** The Haven's and the Wisp's share of Glow, as a fraction added to the whole. */
  glowBonus?: number;
  /** Replays already paid on this tile today: past the first few, a replay pays a trickle. */
  replaysToday?: number;
};

export function encounterRewards(input: EncounterRewardInput): { glow: number; xp: number } {
  const baseGlow = input.base && input.base.glow > 0 ? input.base.glow : ENCOUNTER_BASE_GLOW[input.difficulty];
  const baseXp = input.base && input.base.xp > 0 ? input.base.xp : ENCOUNTER_BASE_XP[input.difficulty];
  const multiplier = GRADE_MULTIPLIER[input.grade];
  const glowFactor = input.firstClear ? 1 : (input.replaysToday ?? 0) < FULL_RATE_REPLAYS_PER_DAY ? REPLAY_GLOW_FACTOR : CAPPED_REPLAY_GLOW_FACTOR;
  const xpFactor = input.firstClear ? 1 : REPLAY_XP_FACTOR;
  const bonus = 1 + Math.max(0, input.glowBonus ?? 0);
  return {
    glow: Math.max(1, Math.round(baseGlow * multiplier * glowFactor * bonus)),
    xp: Math.max(1, Math.round(baseXp * multiplier * xpFactor)),
  };
}
