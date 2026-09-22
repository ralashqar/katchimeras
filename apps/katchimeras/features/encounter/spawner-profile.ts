import { dewSpringResolveBonus, gardenStallGlowBonus, heartwoodBuildingLevel, rootCellarOpenCells, seedNurseryTierThreeChance, seedNurseryTierTwoBonus } from '@/constants/heartwood-buildings';
import { wispPerk, type EncounterPerk } from '@/constants/helper-wisps';
import type { EncounterLoadout } from '@/types/encounter';
import type { MergeWorldState } from '@/types/merge-world';
import { DEFAULT_ENCOUNTER_PROFILE, type EncounterProfile, type EncounterRunState } from './encounter-run';

export { dewSpringResolveBonus, rootCellarOpenCells };

/** What the Haven and the helper Wisp add to an encounter, from the world's buildings and the loadout. */
export function encounterProfile(world: Pick<MergeWorldState, 'heartwoodBuildings'> | null | undefined, loadout: EncounterLoadout | null): EncounterProfile {
  const perk: EncounterPerk | null = wispPerk(loadout?.wispId);
  const nursery = heartwoodBuildingLevel(world, 'seed-nursery');
  return {
    ...DEFAULT_ENCOUNTER_PROFILE,
    startingResolve: dewSpringResolveBonus(heartwoodBuildingLevel(world, 'dew-spring')) + (perk?.kind === 'resolve' ? perk.amount : 0),
    extraCharges: perk?.kind === 'charges' ? perk.amount : 0,
    tierTwoChance: seedNurseryTierTwoBonus(nursery),
    tierThreeChance: seedNurseryTierThreeChance(nursery),
    openCells: rootCellarOpenCells(heartwoodBuildingLevel(world, 'root-cellar')) + (perk?.kind === 'reveal' ? perk.cells : 0),
    delay: perk?.kind === 'delay' ? perk.actions : 0,
    glowBonus: gardenStallGlowBonus(heartwoodBuildingLevel(world, 'garden-stall')) + (perk?.kind === 'glow' ? perk.fraction : 0),
  };
}

/** The odds a spawner tap plays with right now: the Nursery's, and Focus on top while it lasts. */
export function dropProfileFor(run: EncounterRunState, generatorId: string, profile: EncounterProfile): { tierTwoChance: number; tierThreeChance: number } {
  const focused = run.focus && run.focus.generatorId === generatorId && run.focus.taps > 0 ? run.focus.tierTwoChance : 0;
  return { tierTwoChance: Math.min(1, profile.tierTwoChance + focused), tierThreeChance: Math.min(1, profile.tierThreeChance) };
}
