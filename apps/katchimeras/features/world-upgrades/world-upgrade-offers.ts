import { HAVEN_ENVIRONMENTS } from '@/constants/haven-catalog';
import { MOSSPROUT_NATURE_ISLANDS } from '@/constants/mossprout-nature-islands';
import { SHARED_WORLD_PURCHASES } from '@/constants/shared-world';
import type { MergeCharacterId, MergeWorldState } from '@/types/merge-world';
import type { KatchimeraSkinId } from '@/types/katchimera';
import type { StoryWorldUpgradeEffectPayload, StoryTarget } from '@/types/content-flow';
import { worldUpgradeStory } from './world-upgrade-stories';
import { upgradeCompletedLevel } from './world-upgrade-progress';
import { petalimpIslandChapterStatus, PETALIMP_ISLAND_CAMPAIGN_ID, PETALIMP_ISLAND_ID } from '@/constants/petalimp-island-campaign';

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
  transition?: 'island_reveal';
  economyMode?: 'normal' | 'free';
};
export type WorldUpgradeOffer = WorldUpgradeDefinition & {
  currentLevel: number;
  maxLevel: number;
  storyId?: string;
  eligible: boolean;
  affordable: boolean;
  missingGlow: number;
  lockedReason?: string;
  /** A discovered island host replaces the generic upgrade toy on its marker. */
  markerSkinId?: KatchimeraSkinId;
};

export const WORLD_UPGRADE_DEFINITIONS: readonly WorldUpgradeDefinition[] = [
  {
    id: 'nature:bloom-garden', target: { kind: 'haven_nature_island', islandId: 'bloom-garden' },
    visualTarget: { kind: 'haven_nature_island', islandId: 'bloom-garden' }, name: 'Bloom Garden',
    nextName: 'A forgotten garden', description: 'Clear the mist to reveal this hidden patch.', nextLevel: 0,
    cost: 40, action: 'Clear mist', transition: 'island_reveal',
  },
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
    action: island.id === PETALIMP_ISLAND_ID && level.level === 1 ? 'Restore' : level.level === 1 ? 'Clear mist' : 'Upgrade',
    ...(island.id === PETALIMP_ISLAND_ID && level.level === 1 ? { economyMode: 'free' as const } : {}),
  }))),
  ...SHARED_WORLD_PURCHASES.map((purchase): WorldUpgradeDefinition => ({
    id: `mist:${purchase.tileId}`, target: { kind: 'haven_structure', structureId: purchase.tileId },
    visualTarget: { kind: 'haven_structure', structureId: purchase.tileId }, name: purchase.name,
    nextName: 'A new clearing', description: 'Clear the mist and discover who is waiting here.',
    nextLevel: 1, cost: purchase.price, action: 'Clear mist', unlockId: purchase.unlockId,
  })),
];

export function worldUpgradeOffers(world: MergeWorldState): WorldUpgradeOffer[] {
  return WORLD_UPGRADE_DEFINITIONS.flatMap((definition): WorldUpgradeOffer[] => {
    const target = definition.target;
    const currentLevel = target.kind === 'haven_tile' ? world.haven.tileStages[target.familyId as MergeCharacterId] ?? 0
      : target.kind === 'haven_nature_island' ? world.haven.mossproutNatureIslands[target.islandId as keyof typeof world.haven.mossproutNatureIslands] ?? 0
      : world.worldUnlocks?.[definition.unlockId!] ? 1 : 0;
    const isBloom = target.kind === 'haven_nature_island' && target.islandId === PETALIMP_ISLAND_ID;
    const bloomRevealed = Boolean(world.haven.mossproutNatureIslandReveals[PETALIMP_ISLAND_ID]);
    if (definition.transition === 'island_reveal') {
      if (bloomRevealed || currentLevel !== 0) return [];
      return [{ ...definition, currentLevel: 0, maxLevel: 4, eligible: true, affordable: world.coins >= definition.cost,
        missingGlow: Math.max(0, definition.cost - world.coins) }];
    }
    if (currentLevel + 1 !== definition.nextLevel || (isBloom && !bloomRevealed)) return [];
    let eligible = true;
    let cost = definition.cost;
    let economyMode = definition.economyMode;
    if (isBloom) {
      const level = definition.nextLevel as import('@/types/merge-world').MossproutNatureIslandLevel;
      const status = petalimpIslandChapterStatus(world, level);
      eligible = status === 'restoration_ready';
      if (level === 1) {
        cost = 0;
        economyMode = 'free';
      }
    }
    const markerSkinId = isBloom && world.islandCampaigns?.[PETALIMP_ISLAND_CAMPAIGN_ID]?.discoveryRevealSeenAt != null
      ? 'petalimp' as const
      : undefined;
    return [{ ...definition, cost, economyMode, currentLevel, maxLevel: worldUpgradeMaxLevel(definition), storyId: worldUpgradeStory(definition.id, definition.nextLevel)?.id, eligible, markerSkinId,
      affordable: world.coins >= cost, missingGlow: Math.max(0, cost - world.coins) }];
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
  const definition = WORLD_UPGRADE_DEFINITIONS.filter((item) => item.id === id && !item.transition && item.nextLevel <= currentLevel).at(-1);
  if (!definition) return null;
  return { ...definition, currentLevel, maxLevel: worldUpgradeMaxLevel(definition),
    eligible: false, affordable: false, missingGlow: 0, storyId: worldUpgradeStory(id, definition.nextLevel)?.id };
}


/** A pending mist lesson owns its upgrade UI even if an old FTUE snapshot lags. */
export function visibleWorldUpgradeOffers(offers: WorldUpgradeOffer[], ftueStepId: string | undefined,
  glowRun: { nodeId: string; status: string } | null) {
  return offers.filter((offer) => (offer.eligible || offer.markerSkinId != null) && (
    glowRun && glowRun.status !== 'completed'
      ? ['gateway.ready', 'gateway.return', 'gateway.offer', 'gateway.buy'].includes(glowRun.nodeId) && offer.id === 'mist:steppling-home'
      : ftueStepId ? ['world.first_bloom_offer', 'world.first_bloom_restore'].includes(ftueStepId) && offer.id === 'haven:mossprout'
        : true));
}
