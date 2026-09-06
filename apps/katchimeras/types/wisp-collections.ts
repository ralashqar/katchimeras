import type { WispId } from '@/types/wisp';

export type WispEvolutionTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'radiant';

export type WispCollectionDefinition = {
  id: string;
  name: string;
  description: string;
  wispIds: readonly WispId[];
  rewardLabel: string;
  seasonal: boolean;
};

export type WispCollectionProgress = {
  owned: number;
  total: number;
  complete: boolean;
  evolved: number;
};
