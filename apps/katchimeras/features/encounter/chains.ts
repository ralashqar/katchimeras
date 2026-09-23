import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import type { MergeItemDefinition } from '@/types/merge-world';

/**
 * What a merge chain is for in a battle (encounter v2): Growth (the Garden's Seed, Sprout, Plant...) cuts root Mist
 * and bites what fears it; Water (the waterside's Pebble, Shell, Tidepool...) washes the Mist beside it away twice as
 * hard. A wisp can be weak to one of them: that chain hits it for one more. Other chains are plain.
 */
export type ChainRole = 'growth' | 'water';

const ROLE_BY_CHAIN: Readonly<Record<string, ChainRole>> = {
  'nature:garden': 'growth',
  'nature:waterside': 'water',
};

export function chainRole(definitionId: string, items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID): ChainRole | null {
  const chainId = items.get(definitionId)?.chainId;
  return chainId ? ROLE_BY_CHAIN[chainId] ?? null : null;
}

/** Water washes the Mist beside it this hard (light and dense); anything else wears it by one. */
export const WATER_WASH = 2;
/** The extra a chain deals to a wisp weak to it. */
export const WEAKNESS_BONUS = 1;
