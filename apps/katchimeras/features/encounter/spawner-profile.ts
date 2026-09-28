import { dewSpringCalmTurns, dewSpringResolveBonus, gardenStallGlowBonus, heartwoodBuildingLevel, rootCellarOpenCells, seedNurseryTierThreeChance, seedNurseryTierTwoBonus } from '@/constants/heartwood-buildings';
import { wispPerk, type EncounterPerk } from '@/constants/helper-wisps';
import { bloomSeedPace, fernWispSlow, heroBuildingLevel } from '@/constants/hero-buildings';
import { heroDamageMultiplier } from '@/features/mission-mechanics/combat-rules';
import type { EncounterLoadout } from '@/types/encounter';
import type { MergeWorldState } from '@/types/merge-world';
import { DEFAULT_ENCOUNTER_PROFILE, type EncounterProfile, type EncounterRunState } from './encounter-run';

export { dewSpringResolveBonus, rootCellarOpenCells };

/** What the Haven and the helper Wisp add to an encounter, from the world's buildings and the loadout. */
/** A hero's level in a Lanes battle: every shot hits harder at levels 3, 6 and 9. */
export function heroShotPower(level: number): number {
  return level >= 9 ? 3 : level >= 6 ? 2 : level >= 3 ? 1 : 0;
}

/** Baseline used by content validation: the recommended hero with buildings at that tier. */
export function recommendedCombatProfile(level: number): EncounterProfile {
  const building = { level: Math.max(0, Math.min(10, level)), builtAt: 0 };
  return encounterProfile({ heartwoodBuildings: { 'seed-nursery': building, 'root-cellar': building, 'dew-spring': building }, heroBuildings: { 'bloom-house': building, 'fern-thicket': building } }, { companionId: 'mossprout', level });
}

export function encounterProfile(world: (Pick<MergeWorldState, 'heartwoodBuildings'> & Partial<Pick<MergeWorldState, 'heroBuildings'>>) | null | undefined, loadout: EncounterLoadout | null): EncounterProfile {
  const perk: EncounterPerk | null = wispPerk(loadout?.wispId);
  const nursery = heartwoodBuildingLevel(world, 'seed-nursery');
  const milestone = (level: number) => level >= 9 ? 3 : level >= 6 ? 2 : level >= 3 ? 1 : 0;
  const cellar = milestone(heartwoodBuildingLevel(world, 'root-cellar'));
  const dew = milestone(heartwoodBuildingLevel(world, 'dew-spring'));
  const bloom = milestone(heroBuildingLevel(world, 'bloom-house'));
  const lead = loadout?.companionId;
  return {
    ...DEFAULT_ENCOUNTER_PROFILE,
    damageMultiplier: heroDamageMultiplier(loadout?.level ?? 1),
    shieldBonus: (cellar >= 1 ? 1 : 0) + (lead === 'mossprout' && (loadout?.level ?? 1) >= 6 ? 1 : 0),
    healBonus: (dew >= 2 ? 1 : 0) + (lead === 'drizzlet' ? 1 : 0),
    supportPace: Math.min(0.35, bloom * 0.06 + cellar * 0.03 + (lead === 'petalimp' ? 0.05 : 0)),
    openingShield: dew >= 3 || perk?.kind === 'resolve',
    warningMs: lead === 'steppling' ? 2500 : 2000,
    startingResolve: dewSpringResolveBonus(heartwoodBuildingLevel(world, 'dew-spring')) + (perk?.kind === 'resolve' ? perk.amount : 0),
    extraCharges: perk?.kind === 'charges' ? perk.amount : 0,
    tierTwoChance: seedNurseryTierTwoBonus(nursery),
    tierThreeChance: seedNurseryTierThreeChance(nursery),
    seedPace: bloomSeedPace(heroBuildingLevel(world, 'bloom-house')),
    wispSlow: Math.min(0.35, fernWispSlow(heroBuildingLevel(world, 'fern-thicket')) + (perk?.kind === 'delay' ? 0.05 : 0) + (lead === 'fernip' ? 0.04 : 0)),
    shotPower: heroShotPower(loadout?.level ?? 1),
    // The Seed Sprinkler sparks more often, and harder, as the Seed Nursery grows.
    sparkEvery: nursery >= 4 ? 2 : 3,
    sparkDamage: nursery >= 5 ? 2 : 1,
    // Territory: a common helper Wisp's steadiness opens Mist before the first move (a legendary two cells).
    openCells: rootCellarOpenCells(heartwoodBuildingLevel(world, 'root-cellar')) + (perk?.kind === 'reveal' ? perk.cells : 0) + (perk?.kind === 'resolve' ? perk.amount : 0),
    // The Dew Spring's calm holds the wisps back a turn at levels 3, 6 and 9.
    delay: dewSpringCalmTurns(heartwoodBuildingLevel(world, 'dew-spring')) + (perk?.kind === 'delay' ? perk.actions : 0),
    glowBonus: gardenStallGlowBonus(heartwoodBuildingLevel(world, 'garden-stall')) + (perk?.kind === 'glow' ? perk.fraction : 0),
  };
}

/** The odds a spawner tap plays with right now: the Nursery's, and Focus on top while it lasts. */
export function dropProfileFor(run: EncounterRunState, generatorId: string, profile: EncounterProfile): { tierTwoChance: number; tierThreeChance: number } {
  const focused = run.focus && run.focus.generatorId === generatorId && run.focus.taps > 0 ? run.focus.tierTwoChance : 0;
  return { tierTwoChance: Math.min(1, profile.tierTwoChance + focused), tierThreeChance: Math.min(1, profile.tierThreeChance) };
}
