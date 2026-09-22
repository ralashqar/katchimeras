import type { CompanionAbilityDefinition, CompanionAbilityTier } from '@/types/companion-ability';
import type { MergeCharacterId } from '@/types/merge-world';

/**
 * The three playable Katchimeras' abilities. A tier is reached at its level
 * and holds until the next; level 1 is always authored.
 */
export const COMPANION_ABILITIES: readonly CompanionAbilityDefinition[] = [
  {
    id: 'bloom', companion: 'mossprout', name: 'Bloom', targeting: 'item',
    description: 'Raise one plant a step, the way only Mossprout can.',
    tiers: [
      { level: 1, chargeEvery: 8, maxTier: 2 },
      { level: 2, chargeEvery: 7, maxTier: 2 },
      { level: 3, chargeEvery: 7, maxTier: 3 },
      { level: 4, chargeEvery: 6, maxTier: 3, clearsAdjacentLight: true },
      { level: 5, chargeEvery: 6, maxTier: 3, clearsAdjacentLight: true, twoTargets: true },
      { level: 7, chargeEvery: 5, maxTier: 4, clearsAdjacentLight: true, twoTargets: true },
      { level: 10, chargeEvery: 4, maxTier: 4, clearsAdjacentLight: true, twoTargets: true },
    ],
  },
  {
    id: 'trailfinder', companion: 'steppling', name: 'Trailfinder', targeting: 'none',
    description: 'Steppling knows where the Mist is thin.',
    tiers: [
      { level: 1, chargeEvery: 6, cells: 1 },
      { level: 2, chargeEvery: 5, cells: 2 },
      { level: 3, chargeEvery: 5, cells: 2 },
      { level: 4, chargeEvery: 4, cells: 3 },
      { level: 5, chargeEvery: 4, cells: 3 },
      { level: 7, chargeEvery: 3, cells: 4 },
      { level: 10, chargeEvery: 3, cells: 5 },
    ],
  },
  {
    id: 'focus', companion: 'baristabbit', name: 'Focus', targeting: 'spawner',
    description: 'One spawner, tended properly: more in it, and better.',
    tiers: [
      { level: 1, chargeEvery: 8, charges: 1, tierTwoChance: 0.3, taps: 3 },
      { level: 2, chargeEvery: 7, charges: 2, tierTwoChance: 0.3, taps: 3 },
      { level: 3, chargeEvery: 7, charges: 2, tierTwoChance: 0.4, taps: 3 },
      { level: 4, chargeEvery: 6, charges: 3, tierTwoChance: 0.4, taps: 3 },
      { level: 5, chargeEvery: 6, charges: 3, tierTwoChance: 0.5, taps: 4 },
      { level: 7, chargeEvery: 5, charges: 4, tierTwoChance: 0.5, taps: 4 },
      { level: 10, chargeEvery: 4, charges: 4, tierTwoChance: 0.6, taps: 5 },
    ],
  },
];

const byCompanion = new Map(COMPANION_ABILITIES.map((ability) => [ability.companion, ability]));

export const abilityForCompanion = (companion: MergeCharacterId): CompanionAbilityDefinition | null => byCompanion.get(companion) ?? null;

/** The highest tier at or under the level; level 1's when the level is below every tier. */
export function abilityTier(ability: CompanionAbilityDefinition, level: number): CompanionAbilityTier {
  const at = Math.max(1, Math.floor(level));
  let tier = ability.tiers[0]!;
  for (const candidate of ability.tiers) if (candidate.level <= at) tier = candidate;
  return tier;
}
