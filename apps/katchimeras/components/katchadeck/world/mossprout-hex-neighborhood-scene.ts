import { mossproutHexPoint, mossproutLayerGeometry, mossproutSceneEnvelope } from '@incubator/environments/mossprout-layout';
import { MOSSPROUT_PRESET } from '@incubator/environments/mossprout-preset';
import { HEARTWOOD_ART } from '@/constants/heartwood-art';
import { dormant, stirring, rooted, blooming, awakened } from '@/constants/heartwood-garden-bounds.gen.json';
import type { HeartwoodStage } from '@/features/shared-adventure/heartwood-progression';
import type { ImageSourcePropType } from 'react-native';
import { sharedResidentAnchor } from './shared-resident-presentation';

import type { KingdomHexScene, KingdomTileArtLayer, KingdomTileRender } from '@/components/katchadeck/world/kingdom-hex-scene';
import { KINGDOM_HEX_TILE_ALPHA_BOUNDS } from '@/constants/kingdom-hex-tile-bounds.gen';
import { MOSSPROUT_NATURE_ISLANDS, mossproutNatureIslandById } from '@/constants/mossprout-nature-islands';
import { hexAlphaBounds } from '@/utils/hex-alpha-bounds';
import { artSourceSet } from '@/utils/art-source';
import { HATCHABLE_COMPANIONS, hatchableByCompanion } from '@/constants/hatchable-companions/registry';
import { hatchableMistedTileArt, hatchableTileArt } from '@/constants/hatchable-companions/tile-art';
import type { HatchableCompanionDefinition } from '@/types/hatchable-companion';
import { SHARED_WORLD_TILES } from '@/constants/shared-world';
import { STORY_TILES, type StoryTileDefinition, type StoryTileState } from '@/constants/story-tiles/registry';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import { storyTileResidents, storyTileStructureId } from '@/utils/story-tile-residents';
import { storyTileArt, storyTileMistedArt } from '@/constants/story-tiles/tile-art';
import { heroTileLook } from '@/constants/hero-building-art';
import { mossproutMemoryPlantById, mossproutMemoryPlantStage } from '@/constants/mossprout-memory-plants';
import type { MossproutGardenPlantSlotId, MossproutNatureIslandId, MossproutNatureIslandLevel, PlantableMemoryInstance } from '@/types/merge-world';
import type { KingdomHexCompanionSlot } from '@/utils/katchimera-kingdom-slots';
import { hexDrawDepth, hexSpiral, type HexCoord } from '@/utils/world-hex';
import { GARDEN_PLANT_SLOT_POSITIONS, MOSSPROUT_FIRST_MEMORY_SLOT_ID, mossproutGardenPlantSlotFrame } from '@/utils/mossprout-garden-layout';

export { mossproutGardenPlantSlotFrame } from '@/utils/mossprout-garden-layout';

const SOURCE_SIZE = { height: 1024, width: 1024 } as const;
// Enumerate only rectangles. Babel wraps JSON namespace imports with a
// `default` object; including that in the union makes the whole scene NaN.
const HEARTWOOD_BOUNDS = { dormant, stirring, rooted, blooming, awakened };
const MAIN_RESIDENT_SOURCE = require('@incubator/art-world/square/mossprout-standing-resident-512.webp');

type TileSources = {
  full: ImageSourcePropType;
  medium: ImageSourcePropType;
  thumb: ImageSourcePropType;
};

type ArtSpec = {
  alphaBounds: { bottom: number; left: number; right: number; top: number };
  coord: HexCoord;
  sources: TileSources;
};

const MAIN: ArtSpec = {
  alphaBounds: KINGDOM_HEX_TILE_ALPHA_BOUNDS['mossprout_focused_v1_main_hex_tile.webp'],
  coord: SHARED_WORLD_TILES['mossprout-home'].coord,
  sources: {
    full: require('@incubator/art-world/hex/mossprout_focused_v1_main_hex_tile.webp'),
    medium: MOSSPROUT_PRESET.home.source,
    thumb: require('@incubator/art-world/hex/mossprout_focused_v1_main_hex_tile_256.webp'),
  },
};

export type MossproutGardenSceneState = {
  heartwoodStage?: HeartwoodStage;
  /** A hero building's look on its friend's tile (the Explorer's Lodge on Steppling's), by tile id: 0 is the tile's own art. */
  heroTileLooks?: Readonly<Record<string, number>>;
  /** Steppling's tile, kept for callers from before `hatchableTiles`; the map wins when both are given. */
  gateway?: 'locked' | 'egg' | 'open';
  /** Every hatchable companion's tile by tile id: misted, an Egg on it, or open with the friend home. */
  hatchableTiles?: Partial<Record<string, 'locked' | 'egg' | 'open'>>;
  /** Every story tile by tile id: under the Mist until a journey episode reveals it. */
  storyTiles?: Partial<Record<string, StoryTileState>>;
  level: number;
  plantableMemories: readonly PlantableMemoryInstance[];
  previewMemoryId?: string;
  featureLevels?: { spring: number; path: number };
};

// Every memory-plant export is normalized to a 384px square with its planting
// contact at y=366. Anchor that contact—not the image box—to the bed centre.
const MEMORY_PLANT_ART_CONTACT_Y = 366 / 384;

export const MOSSPROUT_GARDEN_PLANT_SLOT_IDS = Object.keys(GARDEN_PLANT_SLOT_POSITIONS) as MossproutGardenPlantSlotId[];

const DREAM_MIST_LOCKED_NATURE_SOURCES: TileSources = {
  full: require('@incubator/art-world/hex/dream_mist_locked_hex_tile_v4.webp'),
  medium: MOSSPROUT_PRESET.mist,
  thumb: require('@incubator/art-world/hex/dream_mist_locked_hex_tile_v4_256.webp'),
};
const DREAM_MIST_LOCKED_NATURE_ALPHA_BOUNDS = KINGDOM_HEX_TILE_ALPHA_BOUNDS['dream_mist_locked_hex_tile_v4.webp'];
/**
 * Mossprout's home under the Mist (the Last Clearing's opening): his own tile buried in the house Mist, with the round
 * patio left clear where he stands, so he stands in his clearing rather than floating on a cloud. Same canvas as his
 * tile, so the lift crossblends in place.
 */
const MOSSPROUT_VEILED: ArtSpec = {
  alphaBounds: KINGDOM_HEX_TILE_ALPHA_BOUNDS['mossprout_veiled_main_hex_tile_v1.webp'],
  coord: SHARED_WORLD_TILES['mossprout-home'].coord,
  sources: {
    full: require('@incubator/art-world/hex/mossprout_veiled_main_hex_tile_v1.webp'),
    medium: require('@incubator/art-world/hex/mossprout_veiled_main_hex_tile_v1_512.webp'),
    thumb: require('@incubator/art-world/hex/mossprout_veiled_main_hex_tile_v1_256.webp'),
  },
};

// Each island's existing art is the fallback for every unlocked level.
// Add a levelArt entry with bundled LODs and measured bounds when bespoke art exists.
type NatureArtSpec = ArtSpec & {
  revealedArt?: Omit<ArtSpec, 'coord'>;
  levelArt?: Partial<Record<Exclude<MossproutNatureIslandLevel, 0>, Omit<ArtSpec, 'coord'>>>;
};
/**
 * An island's art: the bundled table; else art a content pack brought under
 * `island:<id>[:level:<n>]`, with its bounds and its definition's coord; else
 * the seed nursery's, standing in for an island the app has no art for.
 */
export function natureIslandArt(islandId: MossproutNatureIslandId): NatureArtSpec {
  const bundled = MOSSPROUT_NATURE_ISLAND_ART[islandId];
  if (bundled) return bundled;
  const fallback = MOSSPROUT_NATURE_ISLAND_ART['seed-nursery']!;
  const sources = artSourceSet(`island:${islandId}`);
  if (!sources) return fallback;
  const levelArt: NonNullable<NatureArtSpec['levelArt']> = {};
  for (const level of [1, 2, 3, 4] as const) {
    const levelSources = artSourceSet(`island:${islandId}:level:${level}`);
    if (levelSources) levelArt[level] = { alphaBounds: hexAlphaBounds(`island:${islandId}:level:${level}`), sources: levelSources };
  }
  return {
    alphaBounds: hexAlphaBounds(`island:${islandId}`),
    coord: mossproutNatureIslandById.get(islandId)?.coord ?? fallback.coord,
    sources,
    ...(Object.keys(levelArt).length ? { levelArt } : {}),
  };
}
/**
 * The art a revealed island wears at a level: its freshly revealed look at 0, its own stage art above that, and the
 * island's one picture where a stage has none. The world and the upgrade panel's stage slots both read this, so a
 * slot can never show a different tile from the one the map drew at that level.
 */
export function natureIslandLevelArt(islandId: MossproutNatureIslandId, level: number): Omit<ArtSpec, 'coord'> {
  const art = natureIslandArt(islandId);
  return (level <= 0 ? art.revealedArt : art.levelArt?.[level as Exclude<MossproutNatureIslandLevel, 0>]) ?? art;
}
export const MOSSPROUT_NATURE_ISLAND_ART: Record<string, NatureArtSpec> = {
  // The Wander Trail: the bundled pack `data/content-packs/wanderling-trail.json`; one art for every level until bespoke stages exist.
  'wanderling-trail': {
    alphaBounds: KINGDOM_HEX_TILE_ALPHA_BOUNDS['shared_world_wanderling_trail_hex_tile_v1.webp'],
    coord: { q: -1, r: 0 },
    sources: {
      full: require('@incubator/art-world/hex/shared_world_wanderling_trail_hex_tile_v1.webp'),
      medium: require('@incubator/art-world/hex/shared_world_wanderling_trail_hex_tile_v1_512.webp'),
      thumb: require('@incubator/art-world/hex/shared_world_wanderling_trail_hex_tile_v1_256.webp'),
    },
  },
  // The Rush Track: the bundled pack `data/content-packs/rush-track.json` (Dashkit); one art for every level for now.
  'rush-track': {
    alphaBounds: KINGDOM_HEX_TILE_ALPHA_BOUNDS['shared_world_rush_track_hex_tile_v1.webp'],
    coord: { q: 2, r: -2 },
    sources: {
      full: require('@incubator/art-world/hex/shared_world_rush_track_hex_tile_v1.webp'),
      medium: require('@incubator/art-world/hex/shared_world_rush_track_hex_tile_v1_512.webp'),
      thumb: require('@incubator/art-world/hex/shared_world_rush_track_hex_tile_v1_256.webp'),
    },
  },
  'seed-nursery': {
    alphaBounds: KINGDOM_HEX_TILE_ALPHA_BOUNDS['mossprout_focused_v1_seed_nursery_hex_tile.webp'],
    coord: { q: -1, r: 1 },
    sources: {
      full: require('@incubator/art-world/hex/mossprout_focused_v1_seed_nursery_hex_tile.webp'),
      medium: require('@incubator/art-world/hex/mossprout_focused_v1_seed_nursery_hex_tile_512.webp'),
      thumb: require('@incubator/art-world/hex/mossprout_focused_v1_seed_nursery_hex_tile_256.webp'),
    },
  },
  'bloom-garden': {
    alphaBounds: KINGDOM_HEX_TILE_ALPHA_BOUNDS['mossprout_focused_v1_bloom_garden_hex_tile.webp'],
    coord: { q: 1, r: 0 },
    sources: {
      full: require('@incubator/art-world/hex/mossprout_focused_v1_bloom_garden_hex_tile.webp'),
      medium: require('@incubator/art-world/hex/mossprout_focused_v1_bloom_garden_hex_tile_512.webp'),
      thumb: require('@incubator/art-world/hex/mossprout_focused_v1_bloom_garden_hex_tile_256.webp'),
    },
    revealedArt: {
      alphaBounds: KINGDOM_HEX_TILE_ALPHA_BOUNDS['mossprout_bloom_garden_level_0_hex_tile.webp'],
      sources: {
        full: require('@incubator/art-world/hex/mossprout_bloom_garden_level_0_hex_tile.webp'),
        medium: require('@incubator/art-world/hex/mossprout_bloom_garden_level_0_hex_tile_512.webp'),
        thumb: require('@incubator/art-world/hex/mossprout_bloom_garden_level_0_hex_tile_256.webp'),
      },
    },
    levelArt: {
      1: {
        alphaBounds: KINGDOM_HEX_TILE_ALPHA_BOUNDS['mossprout_bloom_garden_level_1_hex_tile.webp'],
        sources: {
          full: require('@incubator/art-world/hex/mossprout_bloom_garden_level_1_hex_tile.webp'),
          medium: require('@incubator/art-world/hex/mossprout_bloom_garden_level_1_hex_tile_512.webp'),
          thumb: require('@incubator/art-world/hex/mossprout_bloom_garden_level_1_hex_tile_256.webp'),
        },
      },
      2: {
        alphaBounds: KINGDOM_HEX_TILE_ALPHA_BOUNDS['mossprout_bloom_garden_level_2_hex_tile.webp'],
        sources: {
          full: require('@incubator/art-world/hex/mossprout_bloom_garden_level_2_hex_tile.webp'),
          medium: require('@incubator/art-world/hex/mossprout_bloom_garden_level_2_hex_tile_512.webp'),
          thumb: require('@incubator/art-world/hex/mossprout_bloom_garden_level_2_hex_tile_256.webp'),
        },
      },
      3: {
        alphaBounds: KINGDOM_HEX_TILE_ALPHA_BOUNDS['mossprout_focused_v1_bloom_garden_hex_tile.webp'],
        sources: {
          full: require('@incubator/art-world/hex/mossprout_focused_v1_bloom_garden_hex_tile.webp'),
          medium: require('@incubator/art-world/hex/mossprout_focused_v1_bloom_garden_hex_tile_512.webp'),
          thumb: require('@incubator/art-world/hex/mossprout_focused_v1_bloom_garden_hex_tile_256.webp'),
        },
      },
      4: {
        alphaBounds: KINGDOM_HEX_TILE_ALPHA_BOUNDS['mossprout_bloom_garden_level_4_hex_tile.webp'],
        sources: {
          full: require('@incubator/art-world/hex/mossprout_bloom_garden_level_4_hex_tile.webp'),
          medium: require('@incubator/art-world/hex/mossprout_bloom_garden_level_4_hex_tile_512.webp'),
          thumb: require('@incubator/art-world/hex/mossprout_bloom_garden_level_4_hex_tile_256.webp'),
        },
      },
    },
  },
  'pond-sanctuary': {
    alphaBounds: KINGDOM_HEX_TILE_ALPHA_BOUNDS['mossprout_focused_v1_pond_sanctuary_hex_tile.webp'],
    coord: { q: -1, r: 2 },
    sources: {
      full: require('@incubator/art-world/hex/mossprout_focused_v1_pond_sanctuary_hex_tile.webp'),
      medium: require('@incubator/art-world/hex/mossprout_focused_v1_pond_sanctuary_hex_tile_512.webp'),
      thumb: require('@incubator/art-world/hex/mossprout_focused_v1_pond_sanctuary_hex_tile_256.webp'),
    },
  },
  'orchard-grove': {
    alphaBounds: KINGDOM_HEX_TILE_ALPHA_BOUNDS['mossprout_focused_v1_orchard_grove_hex_tile.webp'],
    coord: { q: 1, r: 1 },
    sources: {
      full: require('@incubator/art-world/hex/mossprout_focused_v1_orchard_grove_hex_tile.webp'),
      medium: require('@incubator/art-world/hex/mossprout_focused_v1_orchard_grove_hex_tile_512.webp'),
      thumb: require('@incubator/art-world/hex/mossprout_focused_v1_orchard_grove_hex_tile_256.webp'),
    },
  },
  'ancient-tree-grove': {
    alphaBounds: KINGDOM_HEX_TILE_ALPHA_BOUNDS['mossprout_focused_v1_ancient_tree_grove_hex_tile.webp'],
    coord: { q: -1, r: 3 },
    sources: {
      full: require('@incubator/art-world/hex/mossprout_focused_v1_ancient_tree_grove_hex_tile.webp'),
      medium: require('@incubator/art-world/hex/mossprout_focused_v1_ancient_tree_grove_hex_tile_512.webp'),
      thumb: require('@incubator/art-world/hex/mossprout_focused_v1_ancient_tree_grove_hex_tile_256.webp'),
    },
  },
  'wildgrowth-grove': {
    alphaBounds: KINGDOM_HEX_TILE_ALPHA_BOUNDS['mossprout_focused_v1_wildgrowth_grove_hex_tile.webp'],
    coord: { q: 1, r: 2 },
    sources: {
      full: require('@incubator/art-world/hex/mossprout_focused_v1_wildgrowth_grove_hex_tile.webp'),
      medium: require('@incubator/art-world/hex/mossprout_focused_v1_wildgrowth_grove_hex_tile_512.webp'),
      thumb: require('@incubator/art-world/hex/mossprout_focused_v1_wildgrowth_grove_hex_tile_256.webp'),
    },
  },
};

// Fill complete inner rings before starting an outer ring. Source coordinates
// remain content/save identities; only their presentation positions change.
// First ring: Nursery, Mossprout, Bloom/Petalimp, Baristabbit, Steppling, Feastle.
const coordKey = (coord: HexCoord) => `${coord.q},${coord.r}`;
const ringSources = [
  MOSSPROUT_NATURE_ISLAND_ART['seed-nursery'].coord,
  MAIN.coord,
  MOSSPROUT_NATURE_ISLAND_ART['bloom-garden'].coord,
  ...['baristabbit', 'steppling', 'feastle'].flatMap(id => {
    const definition = hatchableByCompanion(id);
    return definition ? [definition.tile.coord] : [];
  }),
  ...MOSSPROUT_NATURE_ISLANDS.map(island => natureIslandArt(island.id).coord),
  ...HATCHABLE_COMPANIONS.map(definition => definition.tile.coord),
  ...STORY_TILES.map(tile => tile.coord),
];
const uniqueRingSources = [...new Map(ringSources.map(coord => [coordKey(coord), coord])).values()];
const ringPositions = hexSpiral(uniqueRingSources.length);
const heartwoodPositions = new Map(uniqueRingSources.map((coord, index) => [coordKey(coord), ringPositions[index]]));

function layerFor(
  id: string,
  kind: KingdomTileArtLayer['kind'],
  spec: ArtSpec,
  layoutBounds = spec.alphaBounds,
): KingdomTileArtLayer {
  // Heartwood owns the centre; all other tiles occupy contiguous outer rings.
  const coord = id === 'structure:mossprout-hex-garden' ? spec.coord : heartwoodWorldCoord(spec.coord);
  const point = mossproutHexPoint(coord);
  const { frame, interactionFrame } = mossproutLayerGeometry(coord, layoutBounds);
  return {
    alphaBounds: spec.alphaBounds,
    coord,
    custom: true,
    depth: hexDrawDepth(point),
    fallbackSource: null,
    frame,
    interactionFrame,
    id,
    kind,
    source: spec.sources.full,
    sources: spec.sources,
    sourceSize: SOURCE_SIZE,
  };
}

/** Where the Hollow Tree stands: well past the outer ring, behind the clearing (up the screen). */
export const HOLLOW_TREE_COORD: HexCoord = { q: 0, r: -4 };
/** The Hollow Tree is a landmark, drawn larger than a tile. */
const HOLLOW_TREE_SCALE = 1.6;
const HOLLOW_TREE_ART = {
  full: require('@incubator/art-world/hex/shared_world_hollow_tree_hex_tile_v1.webp'),
  medium: require('@incubator/art-world/hex/shared_world_hollow_tree_hex_tile_v1_512.webp'),
  thumb: require('@incubator/art-world/hex/shared_world_hollow_tree_hex_tile_v1_256.webp'),
};

function hollowTreeLayer(): KingdomTileArtLayer {
  const bounds = hexAlphaBounds('shared_world_hollow_tree_hex_tile_v1.webp');
  const layer = layerFor('structure:hollow-tree', 'structure', { coord: HOLLOW_TREE_COORD, alphaBounds: bounds, sources: HOLLOW_TREE_ART });
  // Scaled about the bottom of its frame, so it stands on the same ground line as a tile would.
  const { left, top, width, height } = layer.frame;
  const scaled = { left: left + width / 2 - (width * HOLLOW_TREE_SCALE) / 2, top: top + height - height * HOLLOW_TREE_SCALE, width: width * HOLLOW_TREE_SCALE, height: height * HOLLOW_TREE_SCALE };
  return { ...layer, frame: scaled, interactionFrame: undefined };
}

export function heartwoodWorldCoord(coord: HexCoord): HexCoord {
  return heartwoodPositions.get(coordKey(coord)) ?? coord;
}

function natureLayerFor(
  islandId: MossproutNatureIslandId,
  level: MossproutNatureIslandLevel,
  revealed = false,
  heroSlot = 0,
): KingdomTileArtLayer {
  const fallback = natureIslandArt(islandId);
  // A friend's building on their island (the Bloom House) grows the island's art with it.
  const look = level > 0 || revealed ? heroTileLook(islandId, heroSlot) : null;
  const authored = look
    ? { ...fallback, alphaBounds: hexAlphaBounds(look.alphaBoundsKey), sources: look.art() }
    : level > 0 || revealed ? { ...fallback, ...natureIslandLevelArt(islandId, level) } : fallback;
  const locked = level === 0 && !revealed;
  const rendered = locked
    ? {
        alphaBounds: DREAM_MIST_LOCKED_NATURE_ALPHA_BOUNDS,
        coord: authored.coord,
        sources: DREAM_MIST_LOCKED_NATURE_SOURCES,
      }
    : authored;
  // Mist is a real upgrade target too. The shared offers/FTUE gate owns when
  // it can be pressed; don't remove its camera and interaction footprint.
  return layerFor(`nature:mossprout:${islandId}`, 'tile', rendered);
}

function shiftLayer(layer: KingdomTileArtLayer, dx: number, dy: number): KingdomTileArtLayer {
  const shift = (frame: { height: number; left: number; top: number; width: number }) => ({
    ...frame,
    left: frame.left + dx,
    top: frame.top + dy,
  });
  return {
    ...layer,
    frame: shift(layer.frame),
    interactionFrame: layer.interactionFrame ? shift(layer.interactionFrame) : undefined,
    residentAnchor: layer.residentAnchor
      ? { x: layer.residentAnchor.x + dx, y: layer.residentAnchor.y + dy }
      : undefined,
    restingAnchor: layer.restingAnchor
      ? { x: layer.restingAnchor.x + dx, y: layer.restingAnchor.y + dy }
      : undefined,
  };
}

export type MossproutSceneOptions = {
  /**
   * The opening keeps Mossprout's own tile under the same mist as the
   * islands until the player has made enough light. The veiled layer keeps
   * the unveiled frame, footprint and resident anchor, so the envelope and
   * every camera stay put; only its art and draw order change.
   */
  homeVeiled?: boolean;
  /** Opening and first conversation: only Mossprout's tile. The envelope is unchanged. */
  homeSolo?: boolean;
  revealWorldWithHome?: boolean;
};

export function buildMossproutHexNeighborhoodScene(
  companionSlots: KingdomHexCompanionSlot[],
  natureIslandLevels: Record<MossproutNatureIslandId, MossproutNatureIslandLevel>,
  gardenState: MossproutGardenSceneState = { level: 0, plantableMemories: [] },
  natureIslandReveals: Partial<Record<MossproutNatureIslandId, boolean>> = {},
  options: MossproutSceneOptions = {},
): KingdomHexScene {
  const mossprout = companionSlots.find((slot) => slot.familyId === 'mossprout')
    ?? { id: 'family:mossprout', familyId: 'mossprout', kind: 'locked' as const, coord: MAIN.coord };
  const unveiledMain = layerFor(mossprout.id, 'tile', MAIN);
  const mainLayer = options.homeVeiled
    ? layerFor(mossprout.id, 'tile', MOSSPROUT_VEILED, MAIN.alphaBounds)
    : unveiledMain;
  // The Last Clearing: Mossprout stands on the tile from the first frame, veiled or not, in the same art, so the lift
  // never swaps (and visibly rescales) him.
  mainLayer.residentSource = MAIN_RESIDENT_SOURCE;
  mainLayer.residentAnchor = sharedResidentAnchor(mainLayer.frame);
  // The old Garden ID remains the save/tutorial target, now hosted by Heartwood.
  const gardenLayer = layerFor('structure:mossprout-hex-garden', 'structure', {
    coord: { q: 0, r: 0 },
    alphaBounds: HEARTWOOD_BOUNDS[gardenState.heartwoodStage ?? 'dormant'],
    sources: HEARTWOOD_ART[gardenState.heartwoodStage ?? 'dormant'],
  }, Object.values(HEARTWOOD_BOUNDS).reduce((union, bounds) => ({
    left: Math.min(union.left, bounds.left), top: Math.min(union.top, bounds.top),
    right: Math.max(union.right, bounds.right), bottom: Math.max(union.bottom, bounds.bottom),
  }), { left: 1024, top: 1024, right: 0, bottom: 0 }));
  const plantLayers = gardenState.plantableMemories.flatMap((plant): KingdomTileArtLayer[] => {
    const preview = gardenState.previewMemoryId === plant.id && plant.status !== 'planted';
    const slotId = preview ? MOSSPROUT_FIRST_MEMORY_SLOT_ID : plant.slotId;
    if ((!preview && plant.status !== 'planted') || !slotId) return [];
    const definition = mossproutMemoryPlantById.get(plant.definitionId);
    const position = GARDEN_PLANT_SLOT_POSITIONS[slotId];
    if (!definition || !position) return [];
    const size = gardenLayer.frame.width * 0.145;
    const baseX = gardenLayer.frame.left + gardenLayer.frame.width * position.x;
    const baseY = gardenLayer.frame.top + gardenLayer.frame.height * position.y;
    return [{
      alphaBounds: { left: 0, top: 0, right: 384, bottom: 384 },
      coord: gardenLayer.coord,
      custom: true,
      depth: gardenLayer.depth + 1 + position.y,
      fallbackSource: null,
      frame: { left: baseX - size / 2, top: baseY - size * MEMORY_PLANT_ART_CONTACT_Y, width: size, height: size },
      interactionFrame: preview ? undefined : mossproutGardenPlantSlotFrame(gardenLayer.frame, slotId),
      id: `plant:${plant.id}`,
      kind: 'structure',
      source: definition.art[mossproutMemoryPlantStage(plant.growthPoints)],
      sourceSize: { width: 384, height: 384 },
    }];
  });
  // Every hatchable companion's tile, from its definition: full mist while locked, its own art once cleared.
  const hatchableTileState = (definition: HatchableCompanionDefinition): 'locked' | 'egg' | 'open' =>
    gardenState.hatchableTiles?.[definition.tile.id] ?? (definition.companion === 'steppling' ? gardenState.gateway : undefined) ?? 'locked';
  const hatchableLayer = (definition: HatchableCompanionDefinition, locked: boolean) => {
    // A friend's building grows their tile's art with it (`constants/hero-building-art.ts`).
    const look = locked ? null : heroTileLook(definition.tile.id, gardenState.heroTileLooks?.[definition.tile.id] ?? 0);
    const bounds = hexAlphaBounds(look?.alphaBoundsKey ?? definition.tile.alphaBoundsKey);
    // A tile with its own misted art (Steppling's trailhead) shows it while locked, on the cleared art's canvas.
    const misted = locked && definition.tile.mistedAlphaBoundsKey ? hatchableMistedTileArt(definition.tile.id) : null;
    const layer = misted
      ? layerFor(`structure:${definition.tile.id}`, 'structure', { coord: definition.tile.coord, alphaBounds: hexAlphaBounds(definition.tile.mistedAlphaBoundsKey!), sources: misted }, bounds)
      : layerFor(`structure:${definition.tile.id}`, 'structure', {
        coord: definition.tile.coord,
        alphaBounds: locked ? DREAM_MIST_LOCKED_NATURE_ALPHA_BOUNDS : bounds,
        sources: locked ? DREAM_MIST_LOCKED_NATURE_SOURCES : look?.art() ?? hatchableTileArt(definition.tile.id),
      });
    if (!locked) layer.residentAnchor = sharedResidentAnchor(layer.frame);
    return layer;
  };
  const hatchableLayers = HATCHABLE_COMPANIONS.map((definition) => {
    const locked = hatchableLayer(definition, true);
    const revealed = hatchableLayer(definition, false);
    // Where the friend will stand once the Mist lets go: a beacon on the misted tile shows them there.
    locked.restingAnchor = revealed.residentAnchor;
    return { definition, locked, revealed };
  });
  // Every story tile, from its definition: full mist until its episode reveals it, its own art after. No marker; a resident only where the tile names one.
  const storyTileLayer = (tile: StoryTileDefinition, revealed: boolean) => {
    // A story tile the story shows before it is cleared (the Lost Trail's tracks) keeps its own misted art.
    const mistedArt = !revealed && tile.mistedAlphaBoundsKey ? storyTileMistedArt(tile.id) : null;
    const layer = layerFor(storyTileStructureId(tile.id), 'structure', {
      coord: tile.coord,
      alphaBounds: revealed ? hexAlphaBounds(tile.alphaBoundsKey) : mistedArt ? hexAlphaBounds(tile.mistedAlphaBoundsKey!) : DREAM_MIST_LOCKED_NATURE_ALPHA_BOUNDS,
      sources: revealed ? storyTileArt(tile.id) : mistedArt ?? DREAM_MIST_LOCKED_NATURE_SOURCES,
    });
    if (revealed && tile.residentSkinId) layer.residentAnchor = sharedResidentAnchor(layer.frame);
    return layer;
  };
  const storyTileLayers = STORY_TILES.map((tile) => ({ tile, misted: storyTileLayer(tile, false), revealed: storyTileLayer(tile, true) }));
  // Keep the home Mist in front during non-solo reveal transitions too.
  if (options.homeVeiled) mainLayer.depth = Math.max(mainLayer.depth, gardenLayer.depth + 2);
  // The opening excludes neighbours without changing their reserved bounds.
  const solo = options.homeSolo && !options.revealWorldWithHome;
  const neighbourLayers = solo ? [] : [
    ...hatchableLayers.map(({ definition, locked, revealed }) => (hatchableTileState(definition) === 'locked' ? locked : revealed)),
    ...storyTileLayers.map(({ tile, misted, revealed }) => ((gardenState.storyTiles?.[tile.id] ?? 'misted') === 'revealed' ? revealed : misted)),
    ...MOSSPROUT_NATURE_ISLANDS.map((island) => natureLayerFor(
      island.id,
      natureIslandLevels[island.id] ?? 0,
      Boolean(natureIslandReveals[island.id]),
      gardenState.heroTileLooks?.[island.id] ?? 0,
    )),
  ];
  // The Hollow Tree: the far landmark over the Mist (`docs/cozy-4x-ftue-the-last-clearing.md`, beat 10), past the
  // outer ring and bigger than a tile. Always reserved in the envelope, so it never shifts the world when it shows.
  const hollowTree = hollowTreeLayer();
  // Reveal Heartwood and every neighbour in the same render, sharing the tile fade.
  const rawLayers = [
    ...(solo ? [] : [gardenLayer]), mainLayer, ...(options.homeVeiled || solo ? [] : plantLayers),
    ...neighbourLayers,
    ...(solo ? [] : [hollowTree]),
  ];
  // Reserve both art envelopes so changing mist to terrain never shifts the world.
  // Include every island's mist, fallback and authored stages in the bounds.
  // A reveal must never shift the scene origin (and every other island/camera).
  const natureBoundsLayers = MOSSPROUT_NATURE_ISLANDS.flatMap((island) =>
    [natureLayerFor(island.id, 0), natureLayerFor(island.id, 0, true), ...island.levels.map((level) => natureLayerFor(island.id, level.level, true))]);
  const boundsLayers = [...rawLayers, ...hatchableLayers.flatMap(({ locked, revealed }) => [locked, revealed]), ...storyTileLayers.flatMap(({ misted, revealed }) => [misted, revealed]), ...natureBoundsLayers];
  // Veiled or solo scenes leave layers out; their frames still shape the envelope.
  boundsLayers.push(unveiledMain, gardenLayer, hollowTree);
  const { dx, dy, width, height } = mossproutSceneEnvelope(boundsLayers.map(layer => layer.frame));
  const layers = rawLayers.map((layer) => shiftLayer(layer, dx, dy)).sort((a, b) => a.depth - b.depth);
  const mainCoord = heartwoodWorldCoord(MAIN.coord);
  const mainPoint = mossproutHexPoint(mainCoord);
  const centerTile: KingdomTileRender = {
    companion: mossprout,
    coord: mainCoord,
    cx: mainPoint.x + dx,
    cy: mainPoint.y + dy,
    depth: hexDrawDepth(mainPoint),
    id: mossprout.id,
    kind: 'companion',
  };
  const residentTiles: KingdomTileRender[] = Object.values(SHARED_WORLD_TILES).flatMap((entry) => {
    if (entry.companion === 'mossprout') return [];
    // A story tile is a friend's place, not their home: nobody stands on it unless it names a resident form (drawn below).
    if ('story' in entry && entry.story) return [];
    // Discovery-only tiles never inherit an owned/dev resident projection.
    const hatchable = hatchableByCompanion(entry.companion);
    if ('residentVisible' in entry && !entry.residentVisible && !(hatchable && hatchableTileState(hatchable) === 'open')) return [];
    const slot = companionSlots.find((candidate) => candidate.familyId === entry.companion && candidate.kind === 'owned');
    if (!slot) return [];
    const point = mossproutHexPoint(heartwoodWorldCoord(entry.coord));
    return [{ companion: slot, coord: heartwoodWorldCoord(entry.coord), cx: point.x + dx, cy: point.y + dy, depth: hexDrawDepth(point), id: slot.id, kind: 'companion' as const }];
  });
  // A story tile that names a resident form: once revealed, that form stands on it as its friend's owned slot.
  for (const resident of storyTileResidents(STORY_TILES, gardenState.storyTiles ?? {}, companionSlots, katchimeraSkinById)) {
    const point = mossproutHexPoint(heartwoodWorldCoord(resident.coord));
    residentTiles.push({ companion: resident.companion, coord: heartwoodWorldCoord(resident.coord), cx: point.x + dx, cy: point.y + dy, depth: hexDrawDepth(point), id: resident.companion.id, kind: 'companion' });
  }
  const tiles = [centerTile, ...(solo ? [] : residentTiles)];
  return {
    centerTile,
    height,
    tileArtLayers: layers,
    tileById: new Map(tiles.map((tile) => [tile.id, tile])),
    tiles,
    width,
  };
}
