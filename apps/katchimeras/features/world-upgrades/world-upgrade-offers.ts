import { HAVEN_ENVIRONMENTS } from '@/constants/haven-catalog';
import { MOSSPROUT_NATURE_ISLANDS } from '@/constants/mossprout-nature-islands';
import { SHARED_WORLD_PURCHASES } from '@/constants/shared-world';
import { hatchableByTile } from '@/constants/hatchable-companions/registry';
import { hatchableTileState, type HatchableTileState } from '@/utils/merge-world/glow-discovery-policy';
import type { MergeCharacterId, MergeWorldState } from '@/types/merge-world';
import type { KatchimeraSkinId } from '@/types/katchimera';
import type { StoryWorldUpgradeEffectPayload, StoryTarget } from '@/types/content-flow';
import { worldUpgradeStory } from './world-upgrade-stories';
import { upgradeCompletedLevel } from './world-upgrade-progress';
import { islandCampaignChapterStatus } from '@/constants/island-campaigns/helpers';
import { ISLAND_CAMPAIGNS, islandCampaignForIsland } from '@/constants/island-campaigns/registry';
import { islandWakeEntry, islandWakeLockedReason, islandWakeState } from '@/constants/island-campaigns/wake-order';
import { mossproutNatureIslandById } from '@/constants/mossprout-nature-islands';
import type { MossproutNatureIslandId, MossproutNatureIslandLevel } from '@/types/merge-world';

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
  /** Short label for the disabled action while `lockedReason` explains it. */
  lockedLabel?: string;
  /** A discovered island host replaces the generic upgrade toy on its marker. */
  markerSkinId?: KatchimeraSkinId;
  /** A friend still resting in the mist: the marker shows their silhouette. */
  sleepingSkinId?: KatchimeraSkinId;
  /** Only the round portrait frame, no speech bubble around it (the opening's own tile). */
  bareMarker?: boolean;
  /** A friend's restoration board in progress: the marker's bar shows the beds, not Glow. */
  restorationProgress?: { current: number; total: number };
  /** A hatchable companion's misted tile: the marker is a silhouette Egg, lit by where the tile stands. */
  hatchable?: { companion: MergeCharacterId; state: HatchableTileState; sleepingLine: string };
};

export const WORLD_UPGRADE_DEFINITIONS: readonly WorldUpgradeDefinition[] = [
  // A friend's island is revealed first, then restored through their story.
  ...ISLAND_CAMPAIGNS.map((campaign): WorldUpgradeDefinition => {
    const island = mossproutNatureIslandById.get(campaign.islandId)!;
    return {
      id: `nature:${campaign.islandId}`, target: { kind: 'haven_nature_island', islandId: campaign.islandId },
      visualTarget: { kind: 'haven_nature_island', islandId: campaign.islandId }, name: island.name,
      nextName: campaign.copy.mistNextName, description: campaign.copy.mistDescription, nextLevel: 0,
      cost: island.levels[0]!.coinCost, action: 'Clear mist', transition: 'island_reveal',
    };
  }),
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
    action: islandCampaignForIsland(island.id) && level.level === 1 ? 'Restore' : level.level === 1 ? 'Clear mist' : 'Upgrade',
    ...(islandCampaignForIsland(island.id) && level.level === 1 ? { economyMode: 'free' as const } : {}),
  }))),
  ...SHARED_WORLD_PURCHASES.map((purchase): WorldUpgradeDefinition => ({
    id: `mist:${purchase.tileId}`, target: { kind: 'haven_structure', structureId: purchase.tileId },
    visualTarget: { kind: 'haven_structure', structureId: purchase.tileId }, name: purchase.name,
    nextName: 'A new clearing', description: 'Spend light here and see who the Mist was keeping.',
    nextLevel: 1, cost: purchase.price, action: 'Clear mist', unlockId: purchase.unlockId,
  })),
];

export function worldUpgradeOffers(world: MergeWorldState): WorldUpgradeOffer[] {
  return WORLD_UPGRADE_DEFINITIONS.flatMap((definition): WorldUpgradeOffer[] => {
    const target = definition.target;
    const currentLevel = target.kind === 'haven_tile' ? world.haven.tileStages[target.familyId as MergeCharacterId] ?? 0
      : target.kind === 'haven_nature_island' ? world.haven.mossproutNatureIslands[target.islandId as keyof typeof world.haven.mossproutNatureIslands] ?? 0
      : world.worldUnlocks?.[definition.unlockId!] ? 1 : 0;
    const campaign = target.kind === 'haven_nature_island' ? islandCampaignForIsland(target.islandId) : null;
    const revealed = campaign ? Boolean(world.haven.mossproutNatureIslandReveals[campaign.islandId]) : false;
    const islandId = target.kind === 'haven_nature_island' ? target.islandId as MossproutNatureIslandId : null;
    if (islandId && currentLevel === 0 && islandWakeState(world, islandId) === 'sleeping') {
      // One resting marker per island: the reveal for a friend's island, the first level otherwise.
      const representative = definition.transition === 'island_reveal' || (!campaign && definition.nextLevel === 1);
      if (!representative) return [];
      return [{ ...definition, currentLevel: 0, maxLevel: 4, eligible: false, affordable: false, missingGlow: definition.cost,
        lockedReason: islandWakeLockedReason(world, islandId) ?? undefined, lockedLabel: 'Resting',
        sleepingSkinId: islandWakeEntry(islandId)?.residentSkinId }];
    }
    if (definition.transition === 'island_reveal') {
      if (revealed || currentLevel !== 0) return [];
      return [{ ...definition, currentLevel: 0, maxLevel: 4, eligible: true, affordable: world.coins >= definition.cost,
        missingGlow: Math.max(0, definition.cost - world.coins) }];
    }
    if (currentLevel + 1 !== definition.nextLevel || (campaign && !revealed)) return [];
    let eligible = true;
    let cost = definition.cost;
    let economyMode = definition.economyMode;
    let restorationProgress: WorldUpgradeOffer['restorationProgress'];
    if (campaign) {
      const level = definition.nextLevel as MossproutNatureIslandLevel;
      eligible = islandCampaignChapterStatus(world, campaign, level) === 'restoration_ready';
      if (level === 1) {
        cost = 0;
        economyMode = 'free';
      }
      const restoration = world.islandCampaigns?.[campaign.campaignId]?.chapters[String(level)]?.restoration;
      if (restoration) {
        // Paid when the beds opened: the upgrade costs nothing more, and the marker's bar is the beds.
        cost = 0;
        economyMode = 'free';
        restorationProgress = restoration.completedAt == null ? restoration.progress : undefined;
      }
    }
    const markerSkinId = campaign && world.islandCampaigns?.[campaign.campaignId]?.discoveryRevealSeenAt != null
      ? campaign.residentSkinId
      : undefined;
    // A hatchable companion's tile: asleep under the Mist until its turn, in the tile's own words.
    const hatchableDefinition = target.kind === 'haven_structure' ? hatchableByTile(target.structureId) : null;
    const hatchable: WorldUpgradeOffer['hatchable'] = hatchableDefinition
      ? { companion: hatchableDefinition.companion, state: hatchableTileState(world, hatchableDefinition), sleepingLine: hatchableDefinition.tile.markerLines.sleeping }
      : undefined;
    if (hatchable?.state === 'sleeping') {
      eligible = false;
    }
    return [{ ...definition, cost, economyMode, currentLevel, maxLevel: worldUpgradeMaxLevel(definition), storyId: worldUpgradeStory(definition.id, definition.nextLevel)?.id, eligible, markerSkinId,
      affordable: world.coins >= cost, missingGlow: Math.max(0, cost - world.coins), ...(restorationProgress ? { restorationProgress } : {}),
      ...(hatchable ? { hatchable, ...(hatchable.state === 'sleeping' ? { lockedReason: hatchable.sleepingLine, lockedLabel: 'Held' } : {}) } : {}) }];
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


/**
 * A pending mist lesson owns its upgrade UI even if an old FTUE snapshot lags.
 * `activeTileId` is the hatchable tile whose discovery `glowRun` belongs to.
 */
export function visibleWorldUpgradeOffers(offers: WorldUpgradeOffer[], ftueStepId: string | undefined,
  glowRun: { nodeId: string; status: string } | null, activeTileId = 'steppling-home') {
  return offers.filter((offer) => (offer.eligible || offer.markerSkinId != null || offer.sleepingSkinId != null || offer.hatchable?.state === 'sleeping') && (
    glowRun && glowRun.status !== 'completed'
      ? ['gateway.ready', 'gateway.return', 'gateway.offer'].includes(glowRun.nodeId) && offer.id === `mist:${activeTileId}`
      // The six resting friends are the opening's whole point: they stay on the
      // map from the first frame (inert), while every other marker waits.
      : ftueStepId ? (['world.first_bloom_offer', 'world.first_bloom_restore'].includes(ftueStepId) && offer.id === 'haven:mossprout') || offer.sleepingSkinId != null
        : true));
}
