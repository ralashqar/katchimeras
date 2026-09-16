import type { ContentPackMergeChain } from '@/types/content-pack';
import type { MergeItemDefinition } from '@/types/merge-world';

/** The same compiler is used for published and bundled chains. */
export function compileMergeChain(chain: ContentPackMergeChain): MergeItemDefinition[] {
  const [familyId, branchId] = chain.chainId.split(':');
  return chain.names.map((name, index) => ({
    id: `${chain.chainId}:${index + 1}`, familyId, branchId, chainId: chain.chainId,
    tier: index + 1, name, icon: chain.icon, color: chain.color,
    nextItemId: index + 1 < chain.names.length ? `${chain.chainId}:${index + 2}` : null,
    sellValue: Math.max(1, 2 ** index),
  }));
}
