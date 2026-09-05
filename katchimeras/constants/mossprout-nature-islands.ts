import type { HavenStoryGate } from '@/constants/haven-catalog';
import type {
  MossproutNatureIslandId,
  MossproutNatureIslandLevel,
} from '@/types/merge-world';

export type MossproutNatureIslandLevelDefinition = {
  coinCost: number;
  description: string;
  level: Exclude<MossproutNatureIslandLevel, 0>;
  name: string;
  storyGate: HavenStoryGate;
};

export type MossproutNatureIslandDefinition = {
  accent: string;
  id: MossproutNatureIslandId;
  levels: readonly MossproutNatureIslandLevelDefinition[];
  name: string;
  shortName: string;
  theme: string;
};

function levels(
  names: readonly [string, string, string, string],
  descriptions: readonly [string, string, string, string],
  costs: readonly [number, number, number, number],
): readonly MossproutNatureIslandLevelDefinition[] {
  return [
    { coinCost: costs[0], description: descriptions[0], level: 1, name: names[0], storyGate: 'chapter_zero_complete' },
    { coinCost: costs[1], description: descriptions[1], level: 2, name: names[1], storyGate: 'story_level_2' },
    { coinCost: costs[2], description: descriptions[2], level: 3, name: names[2], storyGate: 'story_level_3' },
    { coinCost: costs[3], description: descriptions[3], level: 4, name: names[3], storyGate: 'story_level_4' },
  ];
}

export const MOSSPROUT_NATURE_ISLANDS: readonly MossproutNatureIslandDefinition[] = [
  {
    accent: '#B9DB77',
    id: 'seed-nursery',
    name: 'Seed Nursery',
    shortName: 'Nursery',
    theme: 'Beginnings, planting, sprouts, and propagation.',
    levels: levels(
      ['Seed Bed', 'Sprout Shelves', 'Trellis Nursery', 'Propagation Haven'],
      [
        'A simple seed bed with a few hopeful pots.',
        'Fresh shoots gather around new planters and seed shelves.',
        'Trellises and labelled beds turn the patch into a true nursery.',
        'Rare glowing seedlings fill a lush propagation haven.',
      ],
      [40, 60, 150, 300],
    ),
  },
  {
    accent: '#F59CC4',
    id: 'bloom-garden',
    name: 'Bloom Garden',
    shortName: 'Bloom',
    theme: 'Flowers, colour, beauty, and pollinators.',
    levels: levels(
      ['First Flowers', 'Colour Beds', 'Floral Walk', 'Magical Bloom'],
      [
        'A few flower clumps brighten the grass.',
        'Arranged beds bring richer colour and variety.',
        'A winding path and floral arch welcome butterflies.',
        'Layered flowers and glowing blossoms cover the garden.',
      ],
      [40, 60, 150, 300],
    ),
  },
  {
    accent: '#70C9D0',
    id: 'pond-sanctuary',
    name: 'Pond Sanctuary',
    shortName: 'Pond',
    theme: 'Calm water, reflection, and ecosystem richness.',
    levels: levels(
      ['Stone Pool', 'Lily Pond', 'Waterfall Garden', 'Lotus Sanctuary'],
      [
        'A tiny clear pool rests between smooth stones.',
        'Lily pads and reeds gather around a wider pond.',
        'A waterfall and small stream bring the island to life.',
        'Lotus blooms and gentle glow fill a lush water sanctuary.',
      ],
      [40, 65, 150, 300],
    ),
  },
  {
    accent: '#F0B65B',
    id: 'orchard-grove',
    name: 'Orchard Grove',
    shortName: 'Orchard',
    theme: 'Abundance, fruit, blossoms, and harvest.',
    levels: levels(
      ['Young Sapling', 'Berry Orchard', 'Harvest Grove', 'Abundant Orchard'],
      [
        'One small sapling grows beside a berry bush.',
        'Young trees and berry patches begin to fill the island.',
        'Mature fruit trees gather around baskets and harvest crates.',
        'Oversized fruit and blossom canopies crown a magical grove.',
      ],
      [40, 65, 150, 300],
    ),
  },
  {
    accent: '#E3C96F',
    id: 'ancient-tree-grove',
    name: 'Ancient Tree Grove',
    shortName: 'Spirit Tree',
    theme: 'Deep nature, wisdom, and Mossprout’s living spirit.',
    levels: levels(
      ['Sacred Sapling', 'Lantern Roots', 'Elder Tree', 'Heart Tree'],
      [
        'A sacred sapling marks a quiet patch of moss.',
        'Growing roots and tiny lanterns shape a sheltered grove.',
        'An old tree rises above mushrooms and hanging ornaments.',
        'A majestic glowing canopy reveals the soul of the biome.',
      ],
      [40, 75, 150, 300],
    ),
  },
  {
    accent: '#C58BD8',
    id: 'wildgrowth-grove',
    name: 'Wildgrowth Grove',
    shortName: 'Wildgrowth',
    theme: 'Mushrooms, moss, ferns, vines, and untamed nature.',
    levels: levels(
      ['Moss Patch', 'Fungal Hollow', 'Fantasy Thicket', 'Enchanted Wilds'],
      [
        'Moss and a few mushrooms gather on the forest floor.',
        'Fallen logs and clustered fungi deepen the undergrowth.',
        'Fantasy mushrooms, vines, and layered foliage take over.',
        'Luminous fungi fill a dense enchanted wildgrowth zone.',
      ],
      [40, 75, 150, 300],
    ),
  },
] as const;

export const MOSSPROUT_NATURE_ISLAND_IDS = MOSSPROUT_NATURE_ISLANDS.map((island) => island.id);

export const mossproutNatureIslandById = new Map(
  MOSSPROUT_NATURE_ISLANDS.map((island) => [island.id, island]),
);

export function mossproutNatureIslandLevelDefinition(
  islandId: MossproutNatureIslandId,
  level: MossproutNatureIslandLevel,
) {
  return mossproutNatureIslandById.get(islandId)?.levels.find((candidate) => candidate.level === level) ?? null;
}

export function emptyMossproutNatureIslandLevels(
  level: MossproutNatureIslandLevel = 0,
): Record<MossproutNatureIslandId, MossproutNatureIslandLevel> {
  return Object.fromEntries(MOSSPROUT_NATURE_ISLAND_IDS.map((id) => [id, level])) as Record<
    MossproutNatureIslandId,
    MossproutNatureIslandLevel
  >;
}
