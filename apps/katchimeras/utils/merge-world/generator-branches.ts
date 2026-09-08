import { COMPANION_BOARD_ALLOCATIONS } from '@/constants/companion-discovery-catalog';
import { MERGE_GENERATORS, MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import type { MergeChainId, MergeCharacterId, MergeGeneratorState, MergeWorldState } from '@/types/merge-world';

/**
 * Every shared generator owns two authored chains: the one its founding friend
 * brings, and a second branch a later friend introduces. The catalog already
 * says who — `COMPANION_BOARD_ALLOCATIONS` pairs each expansion companion with
 * a `<generator>:<branch suffix>` feature. Mossprout's Garden Basket, for
 * example, holds `nature:garden` from the start and gains `nature:waterside`
 * only once Shellio arrives with it.
 *
 * Nothing enforced that, so a brand new Garden Basket dropped Seeds and Shells
 * side by side and orders asked for both. These helpers are the single answer
 * to "can this world make this yet", read at every point that spawns an item
 * or authors a request.
 */
export type GeneratorBranch = {
  chainId: MergeChainId;
  generatorId: string;
  /** The friend who introduces this branch; until they arrive it stays shut. */
  hostCharacterId: MergeCharacterId;
  /** The founding chain the same basket keeps open, used as the substitute. */
  openChainId: MergeChainId;
};

function branchFeatureId(generatorId: string, chainId: MergeChainId) {
  return `${generatorId}:${chainId.split(':')[1] ?? chainId}`;
}

export const GENERATOR_BRANCHES: ReadonlyMap<MergeChainId, GeneratorBranch> = new Map(
  MERGE_GENERATORS.flatMap((generator): [MergeChainId, GeneratorBranch][] => {
    const [openChainId, chainId] = generator.chainIds;
    // A basket whose two chains are the same (the Memory Nursery) has no branch.
    if (chainId === openChainId) return [];
    const featureId = branchFeatureId(generator.id, chainId);
    const host = COMPANION_BOARD_ALLOCATIONS.find((allocation) =>
      allocation.role === 'expansion' && allocation.permanentFeatureId === featureId);
    if (!host) return [];
    return [[chainId, { chainId, generatorId: generator.id, hostCharacterId: host.characterId, openChainId }]];
  }),
);

/** True once the friend who brings this branch is part of the player's world. */
export function generatorChainOpen(state: Pick<MergeWorldState, 'unlockedCharacters'>, chainId: MergeChainId): boolean {
  const branch = GENERATOR_BRANCHES.get(chainId);
  return !branch || state.unlockedCharacters.includes(branch.hostCharacterId);
}

/**
 * The chain a request may actually ask for. A branch nobody has introduced yet
 * falls back to the founding chain of the same basket, so an authored order
 * stays askable instead of becoming impossible.
 */
export function openChainFor(state: Pick<MergeWorldState, 'unlockedCharacters'>, chainId: MergeChainId): MergeChainId {
  const branch = GENERATOR_BRANCHES.get(chainId);
  return !branch || state.unlockedCharacters.includes(branch.hostCharacterId) ? chainId : branch.openChainId;
}

/** Rewrites one `chain:tier` id onto its open chain, keeping the tier if authored. */
export function openDefinitionFor(state: Pick<MergeWorldState, 'unlockedCharacters'>, definitionId: string): string {
  const item = MERGE_ITEMS_BY_ID.get(definitionId);
  if (!item) return definitionId;
  const chainId = openChainFor(state, item.chainId);
  if (chainId === item.chainId) return definitionId;
  const tier = definitionId.slice(definitionId.lastIndexOf(':') + 1);
  for (let candidate = Number(tier); candidate > 1; candidate -= 1) {
    if (MERGE_ITEMS_BY_ID.has(`${chainId}:${candidate}`)) return `${chainId}:${candidate}`;
  }
  return `${chainId}:1`;
}

/** The tier-one drops a basket can currently make, never an empty list. */
export function openTierOneDropIds(
  state: Pick<MergeWorldState, 'unlockedCharacters'>,
  generator: Pick<MergeGeneratorState, 'tierOneDropDefinitionIds'>,
): readonly string[] {
  const open = generator.tierOneDropDefinitionIds.filter((definitionId) => {
    const item = MERGE_ITEMS_BY_ID.get(definitionId);
    return !item || generatorChainOpen(state, item.chainId);
  });
  return open.length ? open : generator.tierOneDropDefinitionIds;
}
