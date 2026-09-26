import type { MergeCharacterId } from './merge-world';

/**
 * A Katchimera's one signature ability on the Mist board, and how it grows
 * with their level. Progression changes what the ability does, not only a
 * number: a later tier reaches higher pieces, clears Mist beside its target,
 * or touches two things at once. Every number is data on a tier.
 */
export type CompanionAbilityId = 'bloom' | 'clear-path' | 'focus' | 'ripple' | 'scout'
  /** Lanes (`features/encounter/lane-abilities.ts`): the friends' abilities that act on the wisps and the plants in play. */
  | 'petal-burst' | 'vine-snare' | 'second-helpings' | 'seedkeeper' | 'rainfall' | 'falling-leaves' | 'forget';

export type CompanionAbilityTier = {
  /** The Katchimera level this tier is reached at. */
  level: number;
  /** Merges that charge one use. */
  chargeEvery: number;
  /** Bloom: the highest tier of plant it can raise. */
  maxTier?: number;
  /** Bloom: the light Mist beside the target clears too, and a piece caught beside it is freed. */
  clearsAdjacentLight?: boolean;
  /** Bloom: the first use each board raises two pieces. */
  twoTargets?: boolean;
  /** Focus / Ripple: tiers the next merge (the next Water merge) clears as if stronger. */
  boost?: number;
  /** Scout: Mist cells whose hidden contents it shows. */
  cells?: number;
  /** Focus: charges added to the spawner, and the better odds for its next taps. */
  charges?: number;
  tierTwoChance?: number;
  taps?: number;
  /** Vine Snare: seconds the wisp is held. */
  seconds?: number;
  /** Vine Snare / Forget: how many wisps it takes (the nearest first). */
  wisps?: number;
  /** Falling Leaves: damage to every wisp over the board. */
  damage?: number;
  /** Rainfall: rows every wisp is pushed back. */
  rows?: number;
  /** Petal Burst: Sprouts that land. */
  sprouts?: number;
};

export type CompanionAbilityDefinition = {
  id: CompanionAbilityId;
  companion: MergeCharacterId;
  name: string;
  description: string;
  /** `mist`: a Mist cell (Clear Path). */
  targeting: 'item' | 'none' | 'spawner' | 'mist';
  /** It acts on a Lanes battle's wisps and plants in play (`applyLaneAbility`): only there. */
  lanes?: boolean;
  /** What the hero says as they use it (the battle's speech bubble), in their voice. */
  callout?: string;
  tiers: readonly CompanionAbilityTier[];
};
