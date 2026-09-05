import type { QuestDefinition } from '@/utils/quests/definitions';

export type QuestExecution = NonNullable<QuestDefinition['execution']>;
export type InteractiveQuestExecution = Exclude<QuestExecution, { kind: 'evidence' }>;

export type QuestResult =
  | { kind: 'live_steps'; success: true; steps: number; target: number; durationMs: number; personalBest: boolean }
  | { kind: 'trivia'; success: true; score: number; questionCount: number; durationMs: number; questionIds: string[] }
  | {
      kind: 'word_game';
      success: true;
      puzzleId: string;
      solved: boolean;
      guessesUsed: number;
      maxGuesses: 6;
      durationMs: number;
      difficultyTier: 1 | 2 | 3 | 4 | 5;
      hintUsed: boolean;
    }
  | {
      kind: 'word_connect';
      success: true;
      packId: 'pagelet-word-paths';
      puzzleId: string;
      wordsFound: number;
      totalWords: number;
      bonusWordsFound: number;
      submittedWords: number;
      durationMs: number;
      difficultyTier: 1 | 2 | 3 | 4 | 5;
      hintsUsed: number;
    }
  | { kind: 'paced_breathing'; success: true; completedCycles: number; durationMs: number }
  | { kind: 'timing_zone'; success: boolean; hits: number; attempts: number; accuracy: number; averageOffsetMs: number; durationMs: number; personalBest?: boolean }
  | { kind: 'pattern_memory'; success: boolean; completedRounds: number; rounds: number; longestSequence: number; mistakes: number; durationMs: number; personalBest?: boolean }
  | { kind: 'sorting'; success: boolean; correctFirstPlacements: number; totalItems: number; mistakes: number; durationMs: number; itemIds: string[]; packId?: 'feastle-table' | 'tasklet-triage' | 'errandimp-loops'; personalBest?: boolean }
  | { kind: 'matching'; success: boolean; pairs: number; moves: number; durationMs: number; contentIds: string[]; packId?: 'relicoon-gallery' | 'mossprout-garden' | 'feastle-food'; personalBest?: boolean }
  | { kind: 'merge'; success: boolean; packId: 'feastle-kitchen'; ordersCompleted: number; ordersTotal: number; movesUsed: number; moveBudget: number; mergeCount: number; highestTier: number; orderIds: string[]; contentIds: string[]; durationMs: number; personalBest?: boolean }
  | { kind: 'block_jam'; success: boolean; rulesetId: 'tasklet-desk-jam-v2'; packId: 'tasklet-desk'; levelId: string; blocksCleared: number; totalBlocks: number; movesUsed: number; timeLimitMs: number; parMoves: number; undoCount: number; durationMs: number; personalBest?: boolean }
  | { kind: 'block_blast'; success: true; rulesetId: 'cheerlet-block-party-v1' | 'cheerlet-block-party-v2'; packId: 'cheerlet-party'; score: number; linesCleared: number; piecesPlaced: number; maxCombo: number; durationMs: number; seed: string; personalBest?: boolean }
  | { kind: 'rhythm'; success: boolean; sequenceAccuracy: number; timingAccuracy: number; score: number; durationMs: number; personalBest?: boolean };

export type QuestAttemptStatus = 'ready' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export type QuestAttempt = {
  id: string;
  questId: string;
  creatureId: string;
  dayId: string;
  seed: string;
  executionKind: InteractiveQuestExecution['kind'];
  configSnapshot: Record<string, unknown>;
  questRunId?: string;
  status: QuestAttemptStatus;
  startedAt?: number;
  endedAt?: number;
  result?: QuestResult;
};

export function isInteractiveExecution(execution: QuestDefinition['execution']): execution is InteractiveQuestExecution {
  return Boolean(execution && execution.kind !== 'evidence');
}

export function questExecution(definition: QuestDefinition | null | undefined): QuestExecution {
  return definition?.execution ?? { kind: 'evidence' };
}
