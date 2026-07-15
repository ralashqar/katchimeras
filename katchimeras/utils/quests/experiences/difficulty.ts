import type { CompanionQuest } from '@/utils/katchimera-quests';
export { resolveMergeConfig } from './merge';

const SPRINT_TARGETS = [100, 120, 150, 175, 200] as const;
const TIME_TRIAL_TARGETS = [250, 400, 600] as const;

export function completedQuestCount(quests: CompanionQuest[], questId: string, creatureId: string): number {
  return quests.filter((quest) => quest.questId === questId && quest.creatureId === creatureId && quest.completedAt).length;
}

export function resolveStepChallengeConfig(input: {
  challengeId: 'step_sprint' | 'step_time_trial';
  completedCount: number;
}) {
  if (input.challengeId === 'step_sprint') {
    return {
      challengeId: input.challengeId,
      target: SPRINT_TARGETS[Math.min(input.completedCount, SPRINT_TARGETS.length - 1)],
      durationMs: 60_000,
      tier: Math.min(input.completedCount + 1, SPRINT_TARGETS.length),
    } as const;
  }
  return {
    challengeId: input.challengeId,
    target: TIME_TRIAL_TARGETS[Math.min(input.completedCount, TIME_TRIAL_TARGETS.length - 1)],
    durationMs: null,
    tier: Math.min(input.completedCount + 1, TIME_TRIAL_TARGETS.length),
  } as const;
}

export function resolveLostWordDifficulty(completedCount: number): {
  difficultyTier: 1 | 2 | 3 | 4 | 5;
  initialHint: 'clue_and_first_letter' | 'clue' | 'broad_clue' | 'delayed_clue' | 'category';
  hintUnlockAfter: number | null;
} {
  if (completedCount <= 1) return { difficultyTier: 1, initialHint: 'clue_and_first_letter', hintUnlockAfter: null };
  if (completedCount <= 3) return { difficultyTier: 2, initialHint: 'clue', hintUnlockAfter: null };
  if (completedCount <= 6) return { difficultyTier: 3, initialHint: 'broad_clue', hintUnlockAfter: null };
  if (completedCount <= 9) return { difficultyTier: 4, initialHint: 'delayed_clue', hintUnlockAfter: 2 };
  return { difficultyTier: 5, initialHint: 'category', hintUnlockAfter: 3 };
}

export function resolveWordPathsDifficulty(completedCount: number): { difficultyTier: 1 | 2 | 3 | 4 | 5; hintAllowance: 1 } {
  return { difficultyTier: Math.min(5, 1 + Math.floor(completedCount / 2)) as 1 | 2 | 3 | 4 | 5, hintAllowance: 1 };
}

export function resolveBreathingConfig(completedCount: number) {
  return { inhaleMs: 4_000, exhaleMs: 6_000, cycles: Math.min(6, 4 + Math.floor(completedCount / 2)), tier: Math.min(3, 1 + Math.floor(completedCount / 2)) };
}

export function resolveTimingConfig(challengeId: 'steppling-stride' | 'mossprout-tend', completedCount: number) {
  const tier = Math.min(5, completedCount + 1);
  if (challengeId === 'mossprout-tend') return { challengeId, attempts: 8, targetHits: 6, traversalMs: Math.max(1_400, 1_900 - (tier - 1) * 100), zoneWidth: Math.max(0.2, 0.34 - (tier - 1) * 0.03), tier };
  return { challengeId, attempts: 12, targetHits: 8, traversalMs: Math.max(1_100, 1_800 - (tier - 1) * 175), zoneWidth: Math.max(0.18, 0.32 - (tier - 1) * 0.035), tier };
}

export function resolvePatternConfig(completedCount: number) {
  const tier = Math.min(5, completedCount + 1);
  return { rounds: 4, targetRounds: 3, startLength: Math.min(5, 3 + Math.floor((tier - 1) / 2)), maxLength: Math.min(7, 4 + tier), playbackMs: Math.max(420, 650 - (tier - 1) * 45), tier };
}

export function resolveSortingConfig(completedCount: number) {
  const tier = Math.min(3, 1 + Math.floor(completedCount / 2));
  const itemCount = [9, 12, 15][tier - 1];
  return { itemCount, targetCorrect: Math.ceil(itemCount * 0.75), tier };
}

export function resolveMatchingConfig(completedCount: number) {
  const tier = Math.min(3, 1 + Math.floor(completedCount / 2));
  const pairCount = [4, 6, 8][tier - 1];
  return { pairCount, moveBudget: [14, 20, 28][tier - 1], tier };
}

export function resolveRhythmConfig(completedCount: number) {
  const tier = Math.min(5, completedCount + 1);
  return { phraseLengths: [4, 5, 6], phrases: 3, targetScore: 0.7, bpm: Math.min(100, 72 + (tier - 1) * 7), hitWindowMs: Math.max(180, 300 - (tier - 1) * 30), tier };
}
