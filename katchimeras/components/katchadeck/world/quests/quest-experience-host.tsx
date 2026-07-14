import type { QuestResult, InteractiveQuestExecution } from '@/utils/quests/experiences/types';
import { LiveStepQuest } from './live-step-quest';
import { TriviaQuest } from './trivia-quest';
import { LostWordQuest } from './lost-word-quest';
import { PacedBreathingQuest } from './paced-breathing-quest';
import { TimingZoneQuest } from './timing-zone-quest';
import { PatternMemoryQuest } from './pattern-memory-quest';
import { SortingQuest } from './sorting-quest';
import { MatchingQuest } from './matching-quest';
import { RhythmQuest } from './rhythm-quest';

export function QuestExperienceHost({ execution, config, seed, recentQuestionIds, recentPuzzleIds, recentSortingItemIds = [], sortingBestDurationMs = null, recentMatchingContentIds = [], matchingBestDurationMs = null, onAttemptStart, onAttemptCancel, onComplete, onRunningChange }: {
  execution: InteractiveQuestExecution;
  config: Record<string, unknown>;
  seed: string;
  recentQuestionIds: string[];
  recentPuzzleIds: string[];
  recentSortingItemIds?: string[];
  sortingBestDurationMs?: number | null;
  recentMatchingContentIds?: string[];
  matchingBestDurationMs?: number | null;
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
  if (execution.kind === 'paced_breathing') return <PacedBreathingQuest config={config as { inhaleMs: number; exhaleMs: number; cycles: number; tier: number }} onAttemptStart={onAttemptStart} onAttemptCancel={onAttemptCancel} onComplete={onComplete} onRunningChange={onRunningChange} />;
  if (execution.kind === 'timing_zone') return <TimingZoneQuest config={config as { challengeId: 'steppling-stride' | 'mossprout-tend'; attempts: number; targetHits: number; traversalMs: number; zoneWidth: number; tier: number }} onAttemptStart={onAttemptStart} onAttemptCancel={onAttemptCancel} onComplete={onComplete} onRunningChange={onRunningChange} />;
  if (execution.kind === 'pattern_memory') return <PatternMemoryQuest config={config as { rounds: number; targetRounds: number; startLength: number; maxLength: number; playbackMs: number; tier: number }} seed={seed} onAttemptStart={onAttemptStart} onAttemptCancel={onAttemptCancel} onComplete={onComplete} onRunningChange={onRunningChange} />;
  if (execution.kind === 'sorting') return <SortingQuest config={config as { itemCount: number; targetCorrect: number; tier: number }} packId={execution.packId} seed={seed} recentIds={recentSortingItemIds} bestDurationMs={sortingBestDurationMs} onAttemptStart={onAttemptStart} onAttemptCancel={onAttemptCancel} onComplete={onComplete} onRunningChange={onRunningChange} />;
  if (execution.kind === 'matching') return <MatchingQuest config={config as { pairCount: number; moveBudget: number; tier: number }} packId={execution.packId} seed={seed} recentIds={recentMatchingContentIds} bestDurationMs={matchingBestDurationMs} onAttemptStart={onAttemptStart} onAttemptCancel={onAttemptCancel} onComplete={onComplete} onRunningChange={onRunningChange} />;
  return <RhythmQuest config={config as { phraseLengths: number[]; phrases: number; targetScore: number; bpm: number; hitWindowMs: number; tier: number }} seed={seed} onAttemptStart={onAttemptStart} onAttemptCancel={onAttemptCancel} onComplete={onComplete} onRunningChange={onRunningChange} />;
}
