import type { WorldUpgradeOffer } from '@/features/world-upgrades/world-upgrade-offers';
import type { MergeWorldState, MossproutNatureIslandLevel } from '@/types/merge-world';
import type { KingdomHexCompanionSlot } from '@/utils/katchimera-kingdom-slots';
import { buildMossproutHexNeighborhoodScene } from './mossprout-hex-neighborhood-scene';
import { kingdomHexTileSourceForLod, kingdomHexTileOverlaySourceForLod } from '@/utils/world-visuals';

export function worldUpgradePreview(offer: WorldUpgradeOffer, world: MergeWorldState, slots: KingdomHexCompanionSlot[]) {
  const target = offer.visualTarget;
  const nature = { ...world.haven.mossproutNatureIslands };
  if (target.kind === 'haven_nature_island') nature[target.islandId as keyof typeof nature] = offer.nextLevel as MossproutNatureIslandLevel;
  const garden = { ...world.haven.structures.mossproutGarden, plantableMemories: [],
    gateway: world.worldUnlocks?.['mossprout:overgrown-trail'] ? 'egg' as const : 'locked' as const };
  if (target.kind === 'haven_structure' && target.structureId === 'mossprout-hex-garden') garden.level = offer.nextLevel;
  if (target.kind === 'haven_structure' && target.structureId === 'steppling-home') garden.gateway = 'egg';
  const scene = buildMossproutHexNeighborhoodScene(slots, nature, garden);
  const id = target.kind === 'haven_structure' ? `structure:${target.structureId}`
    : target.kind === 'haven_nature_island' ? `nature:mossprout:${target.islandId}` : `companion:${target.familyId}`;
  const layer = scene.tileArtLayers.find((item) => item.id === id);
  return layer ? { preview: kingdomHexTileSourceForLod(layer, 'medium'), overlay: kingdomHexTileOverlaySourceForLod(layer, 'medium') } : {};
}
