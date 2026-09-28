import { TERRITORY_DEFAULT_STARS, type EncounterDefinition, type EncounterGrade } from '@/types/encounter';
import { resolveLeft, type EncounterRunState, type EncounterStatus } from './encounter-run';
import type { MissionMechanicState } from '@/types/mission-mechanic';

/** How an attempt ended, for the outcome sheet and the world's ledger. */
export type EncounterOutcome = {
  frontierReward?: 'timber' | 'glow';
  combat?: { elapsedMs: number; breaches: number; prevented: number; abilityUses: number };
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

export function encounterOutcome(encounter: EncounterDefinition, run: EncounterRunState, status: EncounterStatus, mechanicState?: MissionMechanicState | null): EncounterOutcome {
  const cleared = status === 'cleared';
  const combat = mechanicState?.kind === 'lanes' ? mechanicState.combat : null;
  const laneGrade = !cleared || run.resolve.continues > 0 || run.cacheOpened ? 'cleared' : combat?.breaches === 0 ? 'perfect' : combat?.breaches === 1 ? 'bright' : 'cleared';
  return {
    cleared,
    ...(run.loadout?.frontierReward ? { frontierReward: run.loadout.frontierReward } : {}),
    grade: combat ? laneGrade : cleared ? encounterGrade(encounter, run) : 'cleared',
    ...(combat && mechanicState?.kind === 'lanes' ? { combat: { elapsedMs: mechanicState.clock, breaches: combat.breaches, prevented: combat.prevented, abilityUses: (run.ability?.uses ?? 0) + (run.partnerAbility?.uses ?? 0) } } : {}),
    resolveLeft: run.resolve.budget == null ? null : resolveLeft(run),
    actions: run.actions,
    merges: run.merges,
    continues: run.resolve.continues,
    rescued: run.cacheOpened,
    territory: run.territory ? { mist: run.territory.last, peak: run.territory.peak, overrun: run.territory.overrun, cells: encounter.rows * 5 } : null,
  };
}
