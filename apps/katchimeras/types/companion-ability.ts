import type { MergeCharacterId } from './merge-world';

/**
 * A Katchimera's one signature ability on the Mist board, and how it grows
 * with their level. Progression changes what the ability does, not only a
 * number: a later tier reaches higher pieces, clears Mist beside its target,
 * or touches two things at once. Every number is data on a tier.
 */
export type CompanionAbilityId = 'bloom' | 'trailfinder' | 'focus';

export type CompanionAbilityTier = {
  /** The Katchimera level this tier is reached at. */
  level: number;
  /** Merges that charge one use. */
  chargeEvery: number;
  /** Bloom: the highest tier of plant it can raise. */
  maxTier?: number;
  /** Bloom: its Mist beside the target clears too. */
  clearsAdjacentLight?: boolean;
  /** Bloom: the first use each board raises two pieces. */
  twoTargets?: boolean;
  /** Trailfinder: Mist cells revealed. */
  cells?: number;
  /** Focus: charges added to the spawner, and the better odds for its next taps. */
  charges?: number;
  tierTwoChance?: number;
  taps?: number;
};

export type CompanionAbilityDefinition = {
  id: CompanionAbilityId;
  companion: MergeCharacterId;
  name: string;
  description: string;
  targeting: 'item' | 'none' | 'spawner';
  tiers: readonly CompanionAbilityTier[];
};
