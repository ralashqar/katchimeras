import { TERRITORY_DEFAULT_STARS, type EncounterDefinition, type EncounterGrade } from '@/types/encounter';
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
  /** A territory battle: the Mist's cells at the end, the most it held, and the cells that would have lost it. */
  territory?: { mist: number; peak: number; overrun: number; cells: number } | null;
};

/**
 * The grade a clear earns: Bright and Perfect by the Resolve left over,
 * never above Cleared once the player kept going or the cache had to open.
 * A board with no budget is simply Cleared.
 */
export function encounterGrade(encounter: EncounterDefinition, run: EncounterRunState): EncounterGrade {
  // A territory battle: stars are the ground won back, how little of the board the Mist still holds at the end.
  // Keep going or the rescue caps it.
  if (run.territory) {
    if (run.resolve.continues > 0 || run.cacheOpened) return 'cleared';
    const [perfect, bright] = encounter.territory?.stars ?? TERRITORY_DEFAULT_STARS;
    const held = run.territory.last / (encounter.rows * 5);
    if (held <= perfect + 1e-9) return 'perfect';
    return held <= bright + 1e-9 ? 'bright' : 'cleared';
  }
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
    territory: run.territory ? { mist: run.territory.last, peak: run.territory.peak, overrun: run.territory.overrun, cells: encounter.rows * 5 } : null,
  };
}
