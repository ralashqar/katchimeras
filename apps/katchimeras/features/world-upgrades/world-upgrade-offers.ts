import { HAVEN_ENVIRONMENTS } from '@/constants/haven-catalog';
import { MOSSPROUT_NATURE_ISLANDS } from '@/constants/mossprout-nature-islands';
import { SHARED_WORLD_PURCHASES } from '@/constants/shared-world';
import type { MergeCharacterId, MergeWorldState } from '@/types/merge-world';
import type { StoryWorldUpgradeEffectPayload, StoryTarget } from '@/types/content-flow';
import { worldUpgradeStory } from './world-upgrade-stories';
import { upgradeCompletedLevel } from './world-upgrade-progress';

export type WorldUpgradeDefinition = {
  id: string;
  target: StoryWorldUpgradeEffectPayload['target'];
  visualTarget: Extract<StoryTarget, { kind: 'haven_structure' | 'haven_tile' | 'haven_nature_island' }>;
  name: string;
  nextName: string;
  description: string;
  nextLevel: number;
  cost: number;
  action: 'Clear mist' | 'Restore' | 'Upgrade';
  unlockId?: string;
};
export type WorldUpgradeOffer = WorldUpgradeDefinition & {
  currentLevel: number;
  maxLevel: number;
  storyId?: string;
  eligible: boolean;
  affordable: boolean;
  missingGlow: number;
};

export const WORLD_UPGRADE_DEFINITIONS: readonly WorldUpgradeDefinition[] = [
  ...Object.values(HAVEN_ENVIRONMENTS).flatMap((environment) => environment!.stages.filter((stage) => stage.stage > 0
    // Mossprout's later Haven tiers are earned through the nature islands.
    && (environment!.characterId !== 'mossprout' || stage.stage === 1)).map((stage): WorldUpgradeDefinition => ({
      id: `haven:${environment!.characterId}`, target: { kind: 'haven_tile', familyId: environment!.characterId },
      visualTarget: environment!.characterId === 'mossprout' ? { kind: 'haven_structure', structureId: 'mossprout-hex-garden' } : { kind: 'haven_tile', familyId: environment!.characterId },
      name: environment!.characterId === 'mossprout' ? 'Mossprout’s Garden' : stage.name,
      nextName: stage.name, description: stage.narrative, nextLevel: stage.stage, cost: stage.coinCost,
      action: stage.stage === 1 ? 'Restore' : 'Upgrade',
    }))),
  ...MOSSPROUT_NATURE_ISLANDS.flatMap((island) => island.levels.map((level): WorldUpgradeDefinition => ({
    id: `nature:${island.id}`, target: { kind: 'haven_nature_island', islandId: island.id },
    visualTarget: { kind: 'haven_nature_island', islandId: island.id }, name: island.name, nextName: level.name,
    description: level.description, nextLevel: level.level, cost: level.coinCost,
    action: level.level === 1 ? 'Clear mist' : 'Upgrade',
  }))),
  ...SHARED_WORLD_PURCHASES.map((purchase): WorldUpgradeDefinition => ({
    id: `mist:${purchase.tileId}`, target: { kind: 'haven_structure', structureId: purchase.tileId },
    visualTarget: { kind: 'haven_structure', structureId: purchase.tileId }, name: purchase.name,
    nextName: 'A new clearing', description: 'Clear the mist and discover who is waiting here.',
    nextLevel: 1, cost: purchase.price, action: 'Clear mist', unlockId: purchase.unlockId,
  })),
];

export function worldUpgradeOffers(world: MergeWorldState): WorldUpgradeOffer[] {
  return WORLD_UPGRADE_DEFINITIONS.flatMap((definition) => {
    const target = definition.target;
    const currentLevel = target.kind === 'haven_tile' ? world.haven.tileStages[target.familyId as MergeCharacterId] ?? 0
      : target.kind === 'haven_nature_island' ? world.haven.mossproutNatureIslands[target.islandId as keyof typeof world.haven.mossproutNatureIslands] ?? 0
      : world.worldUnlocks?.[definition.unlockId!] ? 1 : 0;
    if (currentLevel + 1 !== definition.nextLevel) return [];
    // Authored next levels are available independently of story/companion progress.
    return [{ ...definition, currentLevel, maxLevel: worldUpgradeMaxLevel(definition), storyId: worldUpgradeStory(definition.id, definition.nextLevel)?.id, eligible: true,
      affordable: world.coins >= definition.cost, missingGlow: Math.max(0, definition.cost - world.coins) }];
  });
}

export function worldUpgradeMaxLevel(definition: WorldUpgradeDefinition): number {
  const target = definition.target;
  if (target.kind === 'haven_tile') return Math.max(...(HAVEN_ENVIRONMENTS[target.familyId as MergeCharacterId]?.stages.map((stage) => stage.stage) ?? [definition.nextLevel]));
  return Math.max(...WORLD_UPGRADE_DEFINITIONS.filter((item) => item.id === definition.id).map((item) => item.nextLevel));
}

/** A completed tile can still open its story archive without offering a purchase. */
export function worldUpgradeArchiveOffer(world: MergeWorldState, id: string): WorldUpgradeOffer | null {
  const currentLevel = upgradeCompletedLevel(world, id);
  const definition = WORLD_UPGRADE_DEFINITIONS.filter((item) => item.id === id && item.nextLevel <= currentLevel).at(-1);
  if (!definition) return null;
  return { ...definition, currentLevel, maxLevel: worldUpgradeMaxLevel(definition),
    eligible: false, affordable: false, missingGlow: 0, storyId: worldUpgradeStory(id, definition.nextLevel)?.id };
}


/** A pending mist lesson owns its upgrade UI even if an old FTUE snapshot lags. */
export function visibleWorldUpgradeOffers(offers: WorldUpgradeOffer[], ftueStepId: string | undefined,
  glowRun: { nodeId: string; status: string } | null) {
  return offers.filter((offer) => offer.eligible && (
    glowRun && glowRun.status !== 'completed'
      ? ['gateway.ready', 'gateway.return', 'gateway.offer', 'gateway.buy'].includes(glowRun.nodeId) && offer.id === 'mist:steppling-home'
      : ftueStepId ? ['world.first_bloom_offer', 'world.first_bloom_restore'].includes(ftueStepId) && offer.id === 'haven:mossprout'
        : true));
}
