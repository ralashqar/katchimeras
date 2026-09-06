import type { DayScores, HomeScoreKey } from '@/types/home';

export const scoreOrder: HomeScoreKey[] = ['energy', 'calm', 'social', 'exploration', 'focus'];

export const pathSupportMap: Record<HomeScoreKey, HomeScoreKey> = {
  energy: 'exploration',
  calm: 'focus',
  social: 'calm',
  exploration: 'energy',
  focus: 'calm',
};

export function createEmptyScores(): DayScores {
  return {
    energy: 0,
    calm: 0,
    social: 0,
    exploration: 0,
    focus: 0,
  };
}

export function clampScore(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

export function clamp01(value: number) {
  return Math.min(Math.max(value, 0), 1);
}
