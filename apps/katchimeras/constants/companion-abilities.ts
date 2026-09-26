import type { CompanionAbilityDefinition, CompanionAbilityTier } from '@/types/companion-ability';
import type { MergeCharacterId } from '@/types/merge-world';

/**
 * The playable Katchimeras' abilities (`docs/encounter-tactics.md`): each bends the one rule (merge beside Mist to
 * clear it), never plain damage. Using one is not a merge, so the wisps never get a turn for it. A tier is reached at
 * its level and holds until the next; level 1 is always authored.
 */
export const COMPANION_ABILITIES: readonly CompanionAbilityDefinition[] = [
  {
    id: 'bloom', companion: 'mossprout', name: 'Bloom', targeting: 'item', callout: 'Grow, little one.',
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
    id: 'clear-path', companion: 'steppling', name: 'Clear Path', targeting: 'mist', callout: 'This way. Follow me.',
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
    id: 'focus', companion: 'baristabbit', name: 'Focus', targeting: 'none', callout: 'Steady. Make this one count.',
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
    id: 'ripple', companion: 'shellio', name: 'Ripple', targeting: 'none', callout: 'Watch the water.',
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
    id: 'scout', companion: 'voyagle', name: 'Scout', targeting: 'none', callout: 'Let me look under there.',
    description: 'Voyagle looks under the Mist: what a few hidden cells are holding.',
    tiers: [
      { level: 1, chargeEvery: 6, cells: 2 },
      { level: 3, chargeEvery: 5, cells: 3 },
      { level: 5, chargeEvery: 5, cells: 4 },
      { level: 7, chargeEvery: 4, cells: 5 },
      { level: 10, chargeEvery: 4, cells: 6 },
    ],
  },
  // Every friend brought home is a hero (cozy 4X v2, Phase 5): each ability acts on the battle itself, the wisps
  // coming down and the plants shooting up (`features/encounter/lane-abilities.ts`). The island friends play under
  // their own form's id (`ISLAND_HEROES`).
  {
    id: 'petal-burst', companion: 'petalimp', name: 'Petal Burst', targeting: 'none', lanes: true, callout: 'Up you come, all of you.',
    description: 'Sprouts burst up on empty cells, shooting at once.',
    tiers: [
      { level: 1, chargeEvery: 7, sprouts: 2 },
      { level: 3, chargeEvery: 6, sprouts: 3 },
      { level: 5, chargeEvery: 6, sprouts: 4 },
      { level: 7, chargeEvery: 5, sprouts: 4 },
      { level: 10, chargeEvery: 4, sprouts: 5 },
    ],
  },
  {
    id: 'vine-snare', companion: 'fernip', name: 'Vine Snare', targeting: 'none', lanes: true, callout: 'Got you. Hold still.',
    description: 'Vines hold the nearest wisp still while your plants shoot it.',
    tiers: [
      { level: 1, chargeEvery: 7, seconds: 4, wisps: 1 },
      { level: 3, chargeEvery: 6, seconds: 5, wisps: 1 },
      { level: 5, chargeEvery: 6, seconds: 5, wisps: 2 },
      { level: 7, chargeEvery: 5, seconds: 6, wisps: 2 },
      { level: 10, chargeEvery: 5, seconds: 6, wisps: 3 },
    ],
  },
  {
    id: 'second-helpings', companion: 'feastle', name: 'Second Helpings', targeting: 'none', lanes: true, callout: 'Everyone eats. Everyone shoots.',
    description: 'Every plant on the board shoots at once.',
    tiers: [
      { level: 1, chargeEvery: 7 },
      { level: 3, chargeEvery: 6 },
      { level: 5, chargeEvery: 5 },
      { level: 7, chargeEvery: 4 },
      { level: 10, chargeEvery: 4 },
    ],
  },
  {
    id: 'seedkeeper', companion: 'blossle', name: 'Seedkeeper', targeting: 'none', lanes: true, callout: 'I kept these for you. Grow.',
    description: 'Every Seed on the board grows a size.',
    tiers: [
      { level: 1, chargeEvery: 7, maxTier: 1 },
      { level: 3, chargeEvery: 6, maxTier: 1 },
      { level: 5, chargeEvery: 6, maxTier: 2 },
      { level: 7, chargeEvery: 5, maxTier: 2 },
      { level: 10, chargeEvery: 5, maxTier: 3 },
    ],
  },
  {
    id: 'rainfall', companion: 'drizzlet', name: 'Rainfall', targeting: 'none', lanes: true, callout: 'Here comes the rain.',
    description: 'Rain washes the spat Mist off the board and pushes every wisp back.',
    tiers: [
      { level: 1, chargeEvery: 8, rows: 1 },
      { level: 3, chargeEvery: 7, rows: 1 },
      { level: 5, chargeEvery: 7, rows: 2 },
      { level: 7, chargeEvery: 6, rows: 2 },
      { level: 10, chargeEvery: 5, rows: 3 },
    ],
  },
  {
    id: 'falling-leaves', companion: 'amberleaf', name: 'Falling Leaves', targeting: 'none', lanes: true, callout: 'Let them fall.',
    description: 'Golden leaves fall on every wisp over the board.',
    tiers: [
      { level: 1, chargeEvery: 8, damage: 1 },
      { level: 3, chargeEvery: 7, damage: 2 },
      { level: 5, chargeEvery: 7, damage: 2 },
      { level: 7, chargeEvery: 6, damage: 3 },
      { level: 10, chargeEvery: 5, damage: 4 },
    ],
  },
  {
    id: 'forget', companion: 'mistle', name: 'Forget', targeting: 'none', lanes: true, callout: 'Go back. Forget the way here.',
    description: 'The nearest wisp forgets its way and drifts back to where it came from.',
    tiers: [
      { level: 1, chargeEvery: 8, wisps: 1 },
      { level: 3, chargeEvery: 7, wisps: 1 },
      { level: 5, chargeEvery: 7, wisps: 2 },
      { level: 7, chargeEvery: 6, wisps: 2 },
      { level: 10, chargeEvery: 5, wisps: 3 },
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
