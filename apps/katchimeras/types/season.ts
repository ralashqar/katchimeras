import type { WispId } from '@/types/wisp';

export type SeasonReward =
  | { kind: 'merge_energy'; amount: number }
  | { kind: 'coins'; amount: number }
  | { kind: 'gems'; amount: number }
  | { kind: 'wisp'; wispId: WispId }
  | { kind: 'cosmetic'; cosmeticId: string };

export type SeasonTier = {
  id: string;
  xp: number;
  freeReward: SeasonReward;
  premiumReward?: SeasonReward;
};

export type SeasonDefinition = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  enabled: boolean;
  tiers: readonly SeasonTier[];
};

export type SeasonProgressState = {
  version: 1;
  seasonId: string;
  xp: number;
  premium: boolean;
  claimedFreeTierIds: string[];
  claimedPremiumTierIds: string[];
  processedEventIds: string[];
};
