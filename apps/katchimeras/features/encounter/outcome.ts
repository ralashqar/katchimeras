import type { EncounterDefinition, EncounterGrade } from '@/types/encounter';
import { resolveLeft, type EncounterRunState, type EncounterStatus } from './encounter-run';

/** How an attempt ended, for the outcome sheet and the world's ledger. */
export type EncounterOutcome = {
  cleared: boolean;
  grade: EncounterGrade;
  /** Resolve left at the end; null on a board with no budget. */
  resolveLeft: number | null;
  actions: number;
  merges: number;
  continues: number;
  rescued: boolean;
};

/**
 * The grade a clear earns: Bright and Perfect by the Resolve left over,
 * never above Cleared once the player kept going or the cache had to open.
 * A board with no budget is simply Cleared.
 */
export function encounterGrade(encounter: EncounterDefinition, run: EncounterRunState): EncounterGrade {
  if (run.resolve.budget == null || run.resolve.continues > 0 || run.cacheOpened) return 'cleared';
  const left = resolveLeft(run);
  if (left >= encounter.grades.perfect) return 'perfect';
  if (left >= encounter.grades.bright) return 'bright';
  return 'cleared';
}

export function encounterOutcome(encounter: EncounterDefinition, run: EncounterRunState, status: EncounterStatus): EncounterOutcome {
  const cleared = status === 'cleared';
  return {
    cleared,
    grade: cleared ? encounterGrade(encounter, run) : 'cleared',
    resolveLeft: run.resolve.budget == null ? null : resolveLeft(run),
    actions: run.actions,
    merges: run.merges,
    continues: run.resolve.continues,
    rescued: run.cacheOpened,
  };
}
