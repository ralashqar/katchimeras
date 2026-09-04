import type { MergeWorldState } from '@/types/merge-world';
import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';

export type MergeArtWarmupPlan = {
  generatorIds: readonly string[];
  itemDefinitionIds: readonly string[];
};

/**
 * Keep the warm-up set deliberately bounded to artwork the mounted board can
 * show next. Higher tiers beyond the generator's bounded bonus drop are loaded
 * naturally when they first become reachable through merging.
 */
export function mergeArtWarmupPlan(state: MergeWorldState): MergeArtWarmupPlan {
  const generatorIds = new Set<string>();
  const itemDefinitionIds = new Set<string>();

  state.board.forEach((cell) => {
    if (cell.occupant?.kind === 'generator') generatorIds.add(cell.occupant.generatorId);
    if (cell.occupant?.kind === 'item') itemDefinitionIds.add(cell.occupant.definitionId);
  });

  // Mist/echo art has its own renderer. Warm only mounted generators and the
  // outputs they can emit next, rather than the entire item catalog.
  [...generatorIds].forEach((generatorId) => {
    const generator = state.generators[generatorId];
    if (!generator) return;
    generator.tierOneDropDefinitionIds.forEach((definitionId) => {
      itemDefinitionIds.add(definitionId);
      if (generator.level >= 2) itemDefinitionIds.add(definitionId.replace(/:1$/, ':2'));
      if (generator.level >= 4) itemDefinitionIds.add(definitionId.replace(/:1$/, ':3'));
    });
    if (generator.forcedDropDefinitionId) itemDefinitionIds.add(generator.forcedDropDefinitionId);
  });

  // One lookahead tier only: cold result decoding must not start on a merge.
  [...itemDefinitionIds].forEach((id) => {
    const next = MERGE_ITEMS_BY_ID.get(id)?.nextItemId;
    if (next) itemDefinitionIds.add(next);
  });
  return {
    generatorIds: [...generatorIds].sort(),
    itemDefinitionIds: [...itemDefinitionIds].sort(),
  };
}
