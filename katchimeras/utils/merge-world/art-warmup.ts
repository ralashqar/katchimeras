import type { MergeWorldState } from '@/types/merge-world';

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

  // Static Dream Echoes are already resident in the board atlas. Warm only
  // generators which are actually mounted and the outputs they can emit next;
  // this avoids decoding order and mist artwork a second time through Expo Image.
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

  return {
    generatorIds: [...generatorIds].sort(),
    itemDefinitionIds: [...itemDefinitionIds].sort(),
  };
}
