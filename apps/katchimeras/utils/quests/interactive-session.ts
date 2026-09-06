import type { QuestExperienceHistory } from '@/components/katchadeck/world/quests/quest-experience-host';
import type { CompanionQuestState } from '@/utils/katchimera-quests';
import { questDefinition } from '@/utils/quests/definitions';
import {
  completedQuestCount,
  resolveBlockJamConfig,
  resolveBreathingConfig,
  resolveLostWordDifficulty,
  resolveMatchingConfig,
  resolveMergeConfig,
  resolvePatternConfig,
  resolveRhythmConfig,
  resolveSortingConfig,
  resolveStepChallengeConfig,
  resolveTimingConfig,
  resolveWordPathsDifficulty,
} from '@/utils/quests/experiences/difficulty';
import { selectWordPathPuzzle } from '@/utils/quests/experiences/word-paths-puzzles';

export function resolveInteractiveQuestConfig(
  state: CompanionQuestState,
  creatureId: string,
  questId: string,
  seed = `${creatureId}:${questId}`
): Record<string, unknown> | null {
  const definition = questDefinition(questId);
  const execution = definition?.execution;
  if (!execution || execution.kind === 'evidence') return null;
  const completedCount = completedQuestCount(state.quests, questId, creatureId, state.attempts);

  if (execution.kind === 'live_steps') {
    return resolveStepChallengeConfig({ challengeId: execution.challengeId, completedCount });
  }
  if (execution.kind === 'trivia') return { packIds: execution.packIds, questionCount: execution.questionCount };
  if (execution.kind === 'word_game') {
    return {
      gameId: execution.gameId,
      rulesetId: execution.rulesetId,
      answerLength: execution.answerLength,
      maxGuesses: execution.maxGuesses,
      ...resolveLostWordDifficulty(completedCount),
    };
  }
  if (execution.kind === 'word_connect') {
    const difficulty = resolveWordPathsDifficulty(completedCount);
    const recentPuzzleIds = state.attempts.flatMap((attempt) =>
      attempt.questId === questId && attempt.creatureId === creatureId && attempt.result?.kind === 'word_connect'
        ? [attempt.result.puzzleId]
        : []
    ).slice(-30);
    const puzzle = selectWordPathPuzzle(`${seed}:round:${completedCount}`, recentPuzzleIds, difficulty.difficultyTier);
    return {
      gameId: execution.gameId,
      packId: execution.packId,
      rulesetId: execution.rulesetId,
      ...difficulty,
      puzzleId: puzzle.id,
    };
  }
  if (execution.kind === 'paced_breathing') return resolveBreathingConfig(completedCount);
  if (execution.kind === 'timing_zone') return resolveTimingConfig(execution.challengeId, completedCount);
  if (execution.kind === 'pattern_memory') return resolvePatternConfig(completedCount);
  if (execution.kind === 'sorting') return resolveSortingConfig(completedCount);
  if (execution.kind === 'matching') return resolveMatchingConfig(completedCount);
  if (execution.kind === 'merge') return resolveMergeConfig(completedCount);
  if (execution.kind === 'block_jam') {
    const recentLevels = state.attempts.flatMap((attempt) =>
      attempt.result?.kind === 'block_jam' && attempt.result.rulesetId === 'tasklet-desk-jam-v2'
        ? [attempt.result.levelId]
        : []
    ).slice(-12);
    return resolveBlockJamConfig(completedCount, seed, recentLevels);
  }
  if (execution.kind === 'block_blast') {
    return { packId: execution.packId, rulesetId: execution.rulesetId, boardSize: 8, mode: 'endless' };
  }
  return resolveRhythmConfig(completedCount);
}

export function questExperienceHistory(
  state: CompanionQuestState,
  questId: string,
  config: Record<string, unknown>
): QuestExperienceHistory {
  const relevant = state.attempts.filter((attempt) => attempt.questId === questId);
  const sortingItems = typeof config.itemCount === 'number' ? config.itemCount : null;
  const matchingPairs = typeof config.pairCount === 'number' ? config.pairCount : null;
  const sortingBestDurationMs = relevant.reduce<number | null>((best, attempt) => {
    const result = attempt.result?.kind === 'sorting' ? attempt.result : null;
    if (!result?.success || (sortingItems != null && result.totalItems !== sortingItems)) return best;
    return best == null ? result.durationMs : Math.min(best, result.durationMs);
  }, null);
  const matchingBestDurationMs = relevant.reduce<number | null>((best, attempt) => {
    const result = attempt.result?.kind === 'matching' ? attempt.result : null;
    if (!result?.success || (matchingPairs != null && result.pairs !== matchingPairs)) return best;
    return best == null ? result.durationMs : Math.min(best, result.durationMs);
  }, null);
  const mergeBest = relevant.reduce<{ movesUsed: number; durationMs: number } | null>((best, attempt) => {
    const result = attempt.result?.kind === 'merge' ? attempt.result : null;
    if (!result?.success) return best;
    return !best || result.durationMs < best.durationMs || (result.durationMs === best.durationMs && result.movesUsed < best.movesUsed)
      ? { movesUsed: result.movesUsed, durationMs: result.durationMs }
      : best;
  }, null);
  const blockJamBest = relevant.reduce<{ movesUsed: number; durationMs: number } | null>((best, attempt) => {
    const result = attempt.result?.kind === 'block_jam' ? attempt.result : null;
    if (!result?.success || result.levelId !== config.levelId) return best;
    return !best || result.durationMs < best.durationMs || (result.durationMs === best.durationMs && result.movesUsed < best.movesUsed)
      ? { movesUsed: result.movesUsed, durationMs: result.durationMs }
      : best;
  }, null);

  return {
    recentQuestionIds: state.attempts.flatMap((attempt) => attempt.result?.kind === 'trivia' ? attempt.result.questionIds : []).slice(-40),
    recentPuzzleIds: state.attempts.flatMap((attempt) => attempt.result?.kind === 'word_game' ? [attempt.result.puzzleId] : []).slice(-30),
    recentWordPathPuzzleIds: state.attempts.flatMap((attempt) => attempt.result?.kind === 'word_connect' ? [attempt.result.puzzleId] : []).slice(-30),
    recentSortingItemIds: state.attempts.flatMap((attempt) => attempt.result?.kind === 'sorting' ? attempt.result.itemIds : []).slice(-40),
    sortingBestDurationMs,
    recentMatchingContentIds: state.attempts.flatMap((attempt) => attempt.result?.kind === 'matching' ? attempt.result.contentIds : []).slice(-32),
    matchingBestDurationMs,
    recentMergeOrderIds: state.attempts.flatMap((attempt) => attempt.result?.kind === 'merge' ? attempt.result.contentIds : []).slice(-12),
    mergeBest,
    blockJamBest,
  };
}
