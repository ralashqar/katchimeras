import type { IconSymbolName } from '@/components/ui/icon-symbol';
import type {
  MergeCharacterId,
  MergeFamilyId,
  MergeItemDefinition,
  MergeOrderDifficulty,
  MergeReward,
} from '@/types/merge-world';

export const MERGE_WORLD_COLUMNS = 7;
export const MERGE_WORLD_ROWS = 9;
export const MERGE_WORLD_SIZE = MERGE_WORLD_COLUMNS * MERGE_WORLD_ROWS;
export const MERGE_ENERGY_CAP = 100;
export const MERGE_ENERGY_REGEN_MS = 120_000;
export const MERGE_GENERATOR_CHARGES = 12;
export const MERGE_GENERATOR_COOLDOWN_MS = 18 * 60_000;

// A readable, contiguous 33-cell clearing. Expansion cells retain their authored
// blockers, so unlocking space changes the scene instead of revealing padlocks.
export const MERGE_STARTING_OPEN_CELLS = new Set([
  2, 3, 4,
  9, 10, 11,
  15, 16, 17, 18,
  22, 23, 24, 25,
  29, 30, 31, 32, 33,
  36, 37, 38, 39, 40,
  44, 45, 46, 47,
  51, 52, 53,
  59, 60,
]);

const chain = (
  familyId: MergeFamilyId,
  branchId: string,
  icon: MergeItemDefinition['icon'],
  color: string,
  names: string[],
) => names.map((name, index) => ({
  id: `${familyId}:${branchId}:${index + 1}`,
  familyId,
  branchId,
  tier: index + 1,
  name,
  icon,
  color,
  nextItemId: index + 1 < names.length ? `${familyId}:${branchId}:${index + 2}` : null,
  sellValue: Math.max(1, 2 ** index),
} satisfies MergeItemDefinition));

export const MERGE_ITEM_CATALOG: readonly MergeItemDefinition[] = [
  ...chain('food', 'table', 'fork.knife', '#F0B870', ['Ingredient', 'Snack', 'Dish', 'Meal', 'Feast', 'Banquet']),
  ...chain('nature', 'garden', 'leaf.fill', '#82C891', ['Seed', 'Sprout', 'Plant', 'Flower', 'Rare Flower', 'Magical Plant', 'Ancient Tree']),
  ...chain('nature', 'waterside', 'water.waves', '#77C8D0', ['Pebble', 'Shell', 'Tidepool', 'Water Lily', 'Moonlit Cove']),
  ...chain('adventure', 'trail', 'figure.walk', '#D6A66D', ['Sock', 'Shoe', 'Boot', 'Hiking Gear', 'Adventure Pack', 'Expedition Kit']),
  ...chain('adventure', 'travel', 'globe.americas.fill', '#A9A1E8', ['Ticket', 'Map', 'Travel Journal', 'Suitcase', 'Grand Journey']),
  {
    id: 'hybrid:picnic-pack', familyId: 'adventure', branchId: 'hybrid', tier: 1,
    name: 'Picnic Pack', icon: 'sparkles', color: '#F4C982', nextItemId: null, sellValue: 48,
  },
];

export const MERGE_ITEMS_BY_ID = new Map(MERGE_ITEM_CATALOG.map((item) => [item.id, item]));

export type FeastleStoryRequestPreview = { title: string; definitionId: string; quantity: number };

export const FEASTLE_STORY_REQUESTS: Readonly<Record<number, readonly FeastleStoryRequestPreview[]>> = {
  2: [{ title: 'The First Snack', definitionId: 'food:table:2', quantity: 1 }],
  3: [{ title: 'A Pantry Pair', definitionId: 'food:table:2', quantity: 2 }],
  4: [
    { title: 'A Welcoming Snack', definitionId: 'food:table:2', quantity: 1 },
    { title: 'Something Warm', definitionId: 'food:table:3', quantity: 1 },
    { title: 'The Table Centrepiece', definitionId: 'food:table:4', quantity: 1 },
  ],
};

export type MergeGeneratorDefinition = {
  id: string;
  familyId: MergeFamilyId;
  name: string;
  icon: IconSymbolName;
  color: string;
  initialCell: number;
  baseBranches: string[];
  unlockDescription: string;
};

export const MERGE_GENERATORS: readonly MergeGeneratorDefinition[] = [
  { id: 'starter-pantry', familyId: 'food', name: 'Feastle’s Picnic Pantry', icon: 'fork.knife', color: '#C97847', initialCell: 31, baseBranches: ['table'], unlockDescription: 'Tap it to unpack cosy ingredients for Feastle’s table.' },
  { id: 'nature-pot', familyId: 'nature', name: 'Mossprout’s Sprouting Pot', icon: 'leaf.fill', color: '#5E9E69', initialCell: 38, baseBranches: ['garden'], unlockDescription: 'A pocket garden of seeds and sprouts for Mossprout’s requests.' },
  { id: 'waterside-pail', familyId: 'nature', name: 'Shellio’s Waterside Pail', icon: 'water.waves', color: '#4E9EAE', initialCell: 39, baseBranches: ['waterside'], unlockDescription: 'Tap it for pebbles, shells, and little waterside treasures.' },
  { id: 'adventure-pack', familyId: 'adventure', name: 'Steppling’s Trail Satchel', icon: 'figure.walk', color: '#967044', initialCell: 32, baseBranches: ['trail'], unlockDescription: 'Trail basics for boots, packs, and bigger walking adventures.' },
  { id: 'travel-trunk', familyId: 'adventure', name: 'Voyagle’s Travel Trunk', icon: 'globe.americas.fill', color: '#8172BD', initialCell: 33, baseBranches: ['travel'], unlockDescription: 'Maps, tickets, and travel keepsakes for Voyagle’s journeys.' },
];

export const MERGE_GENERATORS_BY_ID = new Map(MERGE_GENERATORS.map((item) => [item.id, item]));

export const MERGE_CHARACTER_NAMES: Record<MergeCharacterId, string> = {
  feastle: 'Feastle', mossprout: 'Mossprout', steppling: 'Steppling', shellio: 'Shellio', voyagle: 'Voyagle',
};

export type MergeOrderTemplate = {
  key: string;
  characterId: MergeCharacterId;
  title: string;
  difficulty: MergeOrderDifficulty;
  requirements: Array<{ definitionId: string; quantity: number }>;
  reward: MergeReward;
  signature?: boolean;
  chapterId?: string;
  minimumFriendshipLevel?: number;
};

export const MERGE_ORDER_TEMPLATES: readonly MergeOrderTemplate[] = [
  { key: 'starter-snack', characterId: 'feastle', title: 'A little something', difficulty: 'small', requirements: [{ definitionId: 'food:table:2', quantity: 1 }], reward: { coins: 20, mergeXp: 18, friendshipXp: 12, energy: 2 } },
  { key: 'warm-dish', characterId: 'feastle', title: 'Warm the table', difficulty: 'medium', requirements: [{ definitionId: 'food:table:3', quantity: 1 }], reward: { coins: 38, mergeXp: 32, friendshipXp: 20, energy: 4 } },
  { key: 'table-for-two', characterId: 'feastle', title: 'Something for the Table', difficulty: 'major', requirements: [{ definitionId: 'food:table:3', quantity: 1 }], reward: { coins: 80, mergeXp: 64, friendshipXp: 70, energy: 10 }, signature: true, chapterId: 'feastle-chapter-4', minimumFriendshipLevel: 4 },
  { key: 'first-feast', characterId: 'feastle', title: 'Feastle’s First Feast', difficulty: 'major', requirements: [{ definitionId: 'food:table:5', quantity: 1 }], reward: { coins: 130, mergeXp: 110, friendshipXp: 76, energy: 12 }, signature: true, chapterId: 'feastle-chapter-8', minimumFriendshipLevel: 8 },
  { key: 'village-table', characterId: 'feastle', title: 'The Village Table', difficulty: 'major', requirements: [{ definitionId: 'food:table:4', quantity: 1 }, { definitionId: 'food:table:3', quantity: 1 }], reward: { coins: 145, mergeXp: 124, friendshipXp: 80, energy: 13 }, signature: true, chapterId: 'feastle-chapter-12', minimumFriendshipLevel: 12 },
  { key: 'celebration-spread', characterId: 'feastle', title: 'A Celebration Spread', difficulty: 'major', requirements: [{ definitionId: 'food:table:5', quantity: 1 }, { definitionId: 'food:table:3', quantity: 1 }], reward: { coins: 165, mergeXp: 138, friendshipXp: 85, energy: 14 }, signature: true, chapterId: 'feastle-chapter-16', minimumFriendshipLevel: 16 },
  { key: 'grand-feast', characterId: 'feastle', title: 'The Grand Feast', difficulty: 'major', requirements: [{ definitionId: 'food:table:6', quantity: 1 }], reward: { coins: 180, mergeXp: 150, friendshipXp: 90, energy: 15, wispId: 'crumb' }, signature: true, chapterId: 'feastle-chapter-20', minimumFriendshipLevel: 20 },
  { key: 'first-garden', characterId: 'mossprout', title: 'My First Garden', difficulty: 'medium', requirements: [{ definitionId: 'nature:garden:3', quantity: 1 }], reward: { coins: 45, mergeXp: 38, friendshipXp: 24, energy: 5 } },
  { key: 'moonflower', characterId: 'mossprout', title: 'A flower after rain', difficulty: 'major', requirements: [{ definitionId: 'nature:garden:5', quantity: 1 }], reward: { coins: 150, mergeXp: 120, friendshipXp: 75, energy: 12, wispId: 'bloom' }, signature: true },
  { key: 'trail-boots', characterId: 'steppling', title: 'Ready for the trail', difficulty: 'medium', requirements: [{ definitionId: 'adventure:trail:3', quantity: 1 }], reward: { coins: 45, mergeXp: 38, friendshipXp: 24, energy: 5 } },
  { key: 'tidepool', characterId: 'shellio', title: 'A tiny tidepool', difficulty: 'medium', requirements: [{ definitionId: 'nature:waterside:3', quantity: 1 }], reward: { coins: 55, mergeXp: 44, friendshipXp: 26, energy: 5 } },
  { key: 'travel-notes', characterId: 'voyagle', title: 'Notes from the road', difficulty: 'medium', requirements: [{ definitionId: 'adventure:travel:3', quantity: 1 }], reward: { coins: 55, mergeXp: 44, friendshipXp: 26, energy: 5 } },
  { key: 'picnic-adventure', characterId: 'voyagle', title: 'Picnic Adventure', difficulty: 'major', requirements: [{ definitionId: 'hybrid:picnic-pack', quantity: 1 }], reward: { coins: 180, mergeXp: 140, friendshipXp: 85, energy: 15, wispId: 'wander' }, signature: true },
];

export const MERGE_HYBRID_RECIPES = new Map([
  [['adventure:trail:5', 'food:table:4'].sort().join('+'), 'hybrid:picnic-pack'],
]);

export const MERGE_EXPANSIONS = [
  { id: 'clearing-east', title: 'Clear the eastern vines', cells: [26, 27, 34, 41], requiredLevel: 3, coinCost: 120 },
  { id: 'clearing-west', title: 'Move the old stones', cells: [14, 21, 28, 35], requiredLevel: 6, coinCost: 300 },
] as const;

export const MERGE_LEVEL_THRESHOLDS = [0, 40, 100, 190, 310, 470, 680, 950, 1_280, 1_680, 2_160, 2_730, 3_400, 4_180, 5_080, 6_100, 7_250, 8_540, 9_980, 11_580] as const;

export function mergeLevelForXp(xp: number) {
  let level = 1;
  for (let index = 0; index < MERGE_LEVEL_THRESHOLDS.length; index += 1) {
    if (xp >= MERGE_LEVEL_THRESHOLDS[index]) level = index + 1;
  }
  return level;
}
