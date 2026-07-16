import type { QuestResult, InteractiveQuestExecution } from '@/utils/quests/experiences/types';
import { LiveStepQuest } from './live-step-quest';
import { TriviaQuest } from './trivia-quest';
import { LostWordQuest } from './lost-word-quest';
import { WordPathsQuest } from './word-paths-quest';
import { PacedBreathingQuest } from './paced-breathing-quest';
import { TimingZoneQuest } from './timing-zone-quest';
import { PatternMemoryQuest } from './pattern-memory-quest';
import { SortingQuest } from './sorting-quest';
import { MatchingQuest } from './matching-quest';
import { RhythmQuest } from './rhythm-quest';
import { MergeQuest } from './merge-quest';
import type { MergeRoundConfig } from '@/utils/quests/experiences/merge';
import { BlockJamQuest } from './block-jam-quest';
import { BlockBlastQuest } from './block-blast-quest';

export function QuestExperienceHost({ execution, config, seed, recentQuestionIds, recentPuzzleIds, recentWordPathPuzzleIds = [], recentSortingItemIds = [], sortingBestDurationMs = null, recentMatchingContentIds = [], matchingBestDurationMs = null, recentMergeOrderIds = [], mergeBest = null, blockJamBest = null, onAttemptStart, onAttemptCancel, onComplete, onRunningChange }: {
  execution: InteractiveQuestExecution;
  config: Record<string, unknown>;
  seed: string;
  recentQuestionIds: string[];
  recentPuzzleIds: string[];
  recentWordPathPuzzleIds?: string[];
  recentSortingItemIds?: string[];
  sortingBestDurationMs?: number | null;
  recentMatchingContentIds?: string[];
  matchingBestDurationMs?: number | null;
  recentMergeOrderIds?: string[];
  mergeBest?: { movesUsed: number; durationMs: number } | null;
  blockJamBest?: { movesUsed: number; durationMs: number } | null;
  onAttemptStart: (config: Record<string, unknown>) => string;
  onAttemptCancel: (attemptId: string) => void;
  onComplete: (attemptId: string, result: QuestResult) => void;
  onRunningChange: (running: boolean, attemptId?: string | null) => void;
}) {
  if (execution.kind === 'live_steps') {
    return <LiveStepQuest config={config as { challengeId: 'step_sprint' | 'step_time_trial'; target: number; durationMs: number | null; tier: number }} onAttemptStart={onAttemptStart} onAttemptCancel={onAttemptCancel} onComplete={onComplete} onRunningChange={onRunningChange} />;
  }
  if (execution.kind === 'trivia') {
    return <TriviaQuest config={{ packIds: execution.packIds, questionCount: execution.questionCount }} seed={seed} recentQuestionIds={recentQuestionIds} onAttemptStart={onAttemptStart} onAttemptCancel={onAttemptCancel} onComplete={onComplete} onRunningChange={onRunningChange} />;
  }
  if (execution.kind === 'word_game') return <LostWordQuest config={config as { difficultyTier: 1 | 2 | 3 | 4 | 5; hintUnlockAfter: number | null }} seed={seed} recentPuzzleIds={recentPuzzleIds} onAttemptStart={onAttemptStart} onAttemptCancel={onAttemptCancel} onComplete={onComplete} onRunningChange={onRunningChange} />;
  if (execution.kind === 'word_connect') return <WordPathsQuest key={String(config.puzzleId ?? seed)} config={config as { difficultyTier: 1 | 2 | 3 | 4 | 5; hintAllowance: 1; puzzleId?: string }} seed={seed} recentPuzzleIds={recentWordPathPuzzleIds} onAttemptStart={onAttemptStart} onAttemptCancel={onAttemptCancel} onComplete={onComplete} onRunningChange={onRunningChange} />;
  if (execution.kind === 'paced_breathing') return <PacedBreathingQuest config={config as { inhaleMs: number; exhaleMs: number; cycles: number; tier: number }} onAttemptStart={onAttemptStart} onAttemptCancel={onAttemptCancel} onComplete={onComplete} onRunningChange={onRunningChange} />;
  if (execution.kind === 'timing_zone') return <TimingZoneQuest config={config as { challengeId: 'steppling-stride' | 'mossprout-tend'; attempts: number; targetHits: number; traversalMs: number; zoneWidth: number; tier: number }} onAttemptStart={onAttemptStart} onAttemptCancel={onAttemptCancel} onComplete={onComplete} onRunningChange={onRunningChange} />;
  if (execution.kind === 'pattern_memory') return <PatternMemoryQuest config={config as { rounds: number; targetRounds: number; startLength: number; maxLength: number; playbackMs: number; tier: number }} seed={seed} onAttemptStart={onAttemptStart} onAttemptCancel={onAttemptCancel} onComplete={onComplete} onRunningChange={onRunningChange} />;
  if (execution.kind === 'sorting') return <SortingQuest config={config as { itemCount: number; targetCorrect: number; tier: number }} packId={execution.packId} seed={seed} recentIds={recentSortingItemIds} bestDurationMs={sortingBestDurationMs} onAttemptStart={onAttemptStart} onAttemptCancel={onAttemptCancel} onComplete={onComplete} onRunningChange={onRunningChange} />;
  if (execution.kind === 'matching') return <MatchingQuest config={config as { pairCount: number; moveBudget: number; tier: number }} packId={execution.packId} seed={seed} recentIds={recentMatchingContentIds} bestDurationMs={matchingBestDurationMs} onAttemptStart={onAttemptStart} onAttemptCancel={onAttemptCancel} onComplete={onComplete} onRunningChange={onRunningChange} />;
  if (execution.kind === 'merge') return <MergeQuest config={config as MergeRoundConfig} packId={execution.packId} seed={seed} recentOrderIds={recentMergeOrderIds} best={mergeBest} onAttemptStart={onAttemptStart} onAttemptCancel={onAttemptCancel} onComplete={onComplete} onRunningChange={onRunningChange} />;
  if (execution.kind === 'block_jam') return <BlockJamQuest key={String(config.levelId)} config={config as { packId: 'tasklet-desk'; rulesetId?: string; tier: 1 | 2 | 3; levelId: string; timeLimitMs?: number; parMoves?: number }} best={blockJamBest} onAttemptStart={onAttemptStart} onAttemptCancel={onAttemptCancel} onComplete={onComplete} onRunningChange={onRunningChange} />;
  if (execution.kind === 'block_blast') return <BlockBlastQuest key={String(config.rulesetId ?? seed)} config={config as { packId: 'cheerlet-party'; rulesetId: 'cheerlet-block-party-v1'; boardSize?: 8; mode?: 'endless' }} seed={seed} onAttemptStart={onAttemptStart} onAttemptCancel={onAttemptCancel} onComplete={onComplete} onRunningChange={onRunningChange} />;
  return <RhythmQuest config={config as { phraseLengths: number[]; phrases: number; targetScore: number; bpm: number; hitWindowMs: number; tier: number }} seed={seed} onAttemptStart={onAttemptStart} onAttemptCancel={onAttemptCancel} onComplete={onComplete} onRunningChange={onRunningChange} />;
}
