import { SLEEPING_GROVE_RUNGS, type GroveRung } from '@/constants/regions/sleeping-grove';
import type { RegionMissionDefinition } from '@/constants/island-campaigns/types';
import type { EncounterGrade } from '@/types/encounter';
import type { MergeWorldState } from '@/types/merge-world';

/**
 * Where the Sleeping Grove stands: each rung done, next or ahead. The opening
 * is done once the first session is; the rescue once Steppling has hatched;
 * an encounter once the ledger has cleared it. Rungs open in order, and one
 * that asks for a Katchimera waits until that friend is home.
 */
export type GroveRungState = {
  rung: number;
  title: string;
  state: 'done' | 'next' | 'ahead';
  mission: RegionMissionDefinition | null;
  bestGrade?: EncounterGrade;
  /** Why a rung that is next cannot be entered from here. */
  note?: string;
};

export function groveProgress(world: Pick<MergeWorldState, 'encounters' | 'unlockedCharacters' | 'hatchableEggs' | 'stepplingEgg'>, input: { ftueComplete: boolean }): GroveRungState[] {
  const stepplingHome = Boolean(world.hatchableEggs?.steppling?.hatchedAt || world.stepplingEgg?.hatchedAt || world.unlockedCharacters.includes('steppling'));
  const done = (entry: GroveRung): boolean => entry.kind === 'opening' ? input.ftueComplete
    : entry.kind === 'rescue' ? stepplingHome
      : Boolean(world.encounters?.clears[entry.mission.id]);
  let blocked = false;
  return SLEEPING_GROVE_RUNGS.map((entry) => {
    const isDone = done(entry);
    const title = entry.kind === 'encounter' ? entry.mission.title : entry.title;
    const mission = entry.kind === 'encounter' ? entry.mission : null;
    const clear = mission ? world.encounters?.clears[mission.id] : null;
    if (isDone) return { rung: entry.rung, title, state: 'done' as const, mission, ...(clear ? { bestGrade: clear.bestGrade } : {}) };
    const state = blocked ? 'ahead' as const : 'next' as const;
    blocked = true;
    const needsSteppling = Boolean(mission?.eligible?.includes('steppling')) && !stepplingHome;
    const note = entry.kind === 'rescue' ? 'At Steppling’s clearing, on the map.' : needsSteppling ? 'Steppling has to be home first.' : undefined;
    return { rung: entry.rung, title, state, mission, ...(note ? { note } : {}) };
  });
}
