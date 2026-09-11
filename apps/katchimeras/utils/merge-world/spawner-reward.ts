import { MERGE_CHARACTER_NAMES, MERGE_GENERATORS_BY_ID, MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import type { MergeWorldState } from '@/types/merge-world';
import { GENERATOR_BRANCHES, generatorChainOpen } from './generator-branches';

/**
 * What a spawner can make, for the reward page that greets it: each of its
 * chains as a ladder from tier one to the top. A branch no friend has opened
 * yet is still shown, dimmed, with who brings it, so the ladder promises
 * rather than hides. Art is the screen's to attach: this stays free of assets.
 */
export type SpawnerRewardChainItem = { id: string; name: string; tier: number };
export type SpawnerRewardChain = {
  id: string;
  /** "Sock to Expedition Kit" */
  title: string;
  open: boolean;
  /** Why a closed branch is closed: "Opens when Voyagle arrives". */
  note: string | null;
  items: readonly SpawnerRewardChainItem[];
};

/** The tiers of one chain, first to last, following each item's next. */
export function chainLadder(chainId: string): SpawnerRewardChainItem[] {
  const items: SpawnerRewardChainItem[] = [];
  let definitionId: string | null = `${chainId}:1`;
  const seen = new Set<string>();
  while (definitionId && !seen.has(definitionId)) {
    seen.add(definitionId);
    const definition = MERGE_ITEMS_BY_ID.get(definitionId);
    if (!definition) break;
    items.push({ id: definition.id, name: definition.name, tier: definition.tier });
    definitionId = definition.nextItemId;
  }
  return items;
}

export function spawnerRewardChains(state: Pick<MergeWorldState, 'unlockedCharacters'>, generatorId: string): SpawnerRewardChain[] {
  const generator = MERGE_GENERATORS_BY_ID.get(generatorId);
  if (!generator) return [];
  return [...new Set(generator.chainIds)].flatMap((chainId) => {
    const items = chainLadder(chainId);
    if (!items.length) return [];
    const open = generatorChainOpen(state, chainId);
    const host = GENERATOR_BRANCHES.get(chainId)?.hostCharacterId;
    return [{
      id: chainId,
      title: items.length > 1 ? `${items[0]!.name} to ${items[items.length - 1]!.name}` : items[0]!.name,
      open,
      note: open || !host ? null : `Opens when ${MERGE_CHARACTER_NAMES[host]} arrives`,
      items,
    }];
  });
}
