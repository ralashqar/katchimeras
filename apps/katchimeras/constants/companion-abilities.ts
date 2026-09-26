import type { CompanionAbilityDefinition, CompanionAbilityTier } from '@/types/companion-ability';
import type { MergeCharacterId } from '@/types/merge-world';

/**
 * The playable Katchimeras' abilities (`docs/encounter-tactics.md`): each bends the one rule (merge beside Mist to
 * clear it), never plain damage. Using one is not a merge, so the wisps never get a turn for it. A tier is reached at
 * its level and holds until the next; level 1 is always authored.
 */
export const COMPANION_ABILITIES: readonly CompanionAbilityDefinition[] = [
  {
    id: 'bloom', companion: 'mossprout', name: 'Bloom', targeting: 'item',
    description: 'Raise one plant a size: it shoots harder at once.',
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
    id: 'clear-path', companion: 'steppling', name: 'Clear Path', targeting: 'mist',
    description: 'Steppling clears one Mist cell, whatever it holds, and frees what is under it.',
    tiers: [
      { level: 1, chargeEvery: 6 },
      { level: 2, chargeEvery: 5 },
      { level: 4, chargeEvery: 4 },
      { level: 7, chargeEvery: 3 },
      { level: 10, chargeEvery: 3 },
    ],
  },
  {
    id: 'focus', companion: 'baristabbit', name: 'Focus', targeting: 'none',
    description: 'The next merge lands a size bigger.',
    tiers: [
      { level: 1, chargeEvery: 7, boost: 1 },
      { level: 2, chargeEvery: 6, boost: 1 },
      { level: 4, chargeEvery: 5, boost: 1 },
      { level: 5, chargeEvery: 5, boost: 2 },
      { level: 7, chargeEvery: 4, boost: 2 },
      { level: 10, chargeEvery: 4, boost: 2 },
    ],
  },
  {
    id: 'ripple', companion: 'shellio', name: 'Ripple', targeting: 'none',
    description: 'The next Water merge clears more Mist around it.',
    tiers: [
      { level: 1, chargeEvery: 6, boost: 1 },
      { level: 3, chargeEvery: 5, boost: 1 },
      { level: 4, chargeEvery: 5, boost: 2 },
      { level: 7, chargeEvery: 4, boost: 2 },
      { level: 10, chargeEvery: 3, boost: 2 },
    ],
  },
  {
    id: 'scout', companion: 'voyagle', name: 'Scout', targeting: 'none',
    description: 'Voyagle looks under the Mist: what a few hidden cells are holding.',
    tiers: [
      { level: 1, chargeEvery: 6, cells: 2 },
      { level: 3, chargeEvery: 5, cells: 3 },
      { level: 5, chargeEvery: 5, cells: 4 },
      { level: 7, chargeEvery: 4, cells: 5 },
      { level: 10, chargeEvery: 4, cells: 6 },
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
