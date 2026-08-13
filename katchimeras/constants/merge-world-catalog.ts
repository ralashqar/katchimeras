import type { IconSymbolName } from '@/components/ui/icon-symbol';
import type {
  MergeChainId,
  MergeCharacterId,
  MergeFamilyId,
  MergeItemDefinition,
  MergeOrderDifficulty,
  MergeReward,
} from '@/types/merge-world';

export const MERGE_WORLD_COLUMNS = 7;
export const MERGE_WORLD_ROWS = 9;
export const MERGE_WORLD_SIZE = MERGE_WORLD_COLUMNS * MERGE_WORLD_ROWS;

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

export const MERGE_CHAIN_IDS: readonly MergeChainId[] = [
  'food:table', 'food:dessert', 'drink:hot', 'drink:refresh',
  'adventure:trail', 'adventure:travel', 'nature:garden', 'nature:waterside',
  'comfort:rest', 'comfort:care', 'social:gathering', 'social:celebration',
  'mind:work', 'mind:books', 'creative:art', 'creative:screen',
];

const chain = (
  chainId: MergeChainId,
  icon: MergeItemDefinition['icon'],
  color: string,
  names: readonly string[],
) => {
  const [familyId, branchId] = chainId.split(':') as [MergeFamilyId, string];
  return names.map((name, index) => ({
    id: `${chainId}:${index + 1}`,
    familyId,
    chainId,
    branchId,
    tier: index + 1,
    name,
    icon,
    color,
    nextItemId: index + 1 < names.length ? `${chainId}:${index + 2}` : null,
    sellValue: Math.max(1, 2 ** index),
  } satisfies MergeItemDefinition));
};

export const MERGE_ITEM_CATALOG: readonly MergeItemDefinition[] = [
  ...chain('food:table', 'fork.knife', '#F0B870', ['Ingredient', 'Snack', 'Dish', 'Meal', 'Feast', 'Banquet']),
  ...chain('food:dessert', 'sparkles', '#F2A9B8', ['Flour Scoop', 'Cake Batter', 'Cupcake', 'Layer Cake', 'Celebration Cake', 'Dream Cake']),
  ...chain('drink:hot', 'sparkles', '#C98A66', ['Tea Leaf', 'Tea Cup', 'Teapot', 'Cocoa Tray', 'Café Service', 'Hearth Ceremony']),
  ...chain('drink:refresh', 'water.waves', '#70C9C6', ['Berry', 'Fruit Juice', 'Smoothie', 'Lemonade Pitcher', 'Garden Drinks Cart', 'Festival Fountain']),
  ...chain('adventure:trail', 'figure.walk', '#D6A66D', ['Sock', 'Shoe', 'Boot', 'Hiking Gear', 'Adventure Pack', 'Expedition Kit']),
  ...chain('adventure:travel', 'globe.americas.fill', '#A9A1E8', ['Ticket', 'Map', 'Travel Journal', 'Suitcase', 'Grand Journey', 'Memory Globe']),
  ...chain('nature:garden', 'leaf.fill', '#82C891', ['Seed', 'Sprout', 'Plant', 'Flower', 'Rare Flower', 'Magical Plant', 'Ancient Tree']),
  ...chain('nature:waterside', 'water.waves', '#77C8D0', ['Pebble', 'Shell', 'Tidepool', 'Water Lily', 'Moonlit Cove', 'Ocean Sanctuary']),
  ...chain('comfort:rest', 'sparkles', '#B7A5D8', ['Pillow Feather', 'Cushion', 'Pillow', 'Blanket Nest', 'Cosy Bed', 'Dream Room']),
  ...chain('comfort:care', 'sparkles', '#EEA49C', ['Bandage', 'Care Pouch', 'First Aid Kit', 'Comfort Basket', 'Healing Cabinet', 'Sanctuary Kit']),
  ...chain('social:gathering', 'fork.knife', '#E9A86F', ['Place Card', 'Shared Plate', 'Picnic Cloth', 'Gathering Table', 'Community Supper', 'Village Festival']),
  ...chain('social:celebration', 'sparkles', '#F2C85B', ['Ribbon', 'Wrapped Gift', 'Party Hat', 'Celebration Hamper', 'Joyful Parade', 'Grand Jubilee']),
  ...chain('mind:work', 'sparkles', '#79A9C7', ['Sticky Note', 'Checklist', 'Planner', 'Tidy Desk', 'Project Station', 'Calm Command Centre']),
  ...chain('mind:books', 'sparkles', '#9D7C69', ['Bookmark', 'Pocket Book', 'Story Stack', 'Reading Nook', 'Library Cart', 'Wonder Library']),
  ...chain('creative:art', 'sparkles', '#D88CBC', ['Pencil', 'Sketchbook', 'Paint Set', 'Easel', 'Studio Corner', 'Gallery of Dreams']),
  ...chain('creative:screen', 'sparkles', '#7E87D8', ['Game Token', 'Handheld Game', 'Console', 'Cosy Game Setup', 'Arcade Corner', 'Pixel Palace']),
  {
    id: 'hybrid:picnic-pack', familyId: 'adventure', chainId: 'adventure:travel', branchId: 'hybrid', tier: 1,
    name: 'Picnic Pack', icon: 'sparkles', color: '#F4C982', nextItemId: null, sellValue: 48,
  },
];

export const MERGE_ITEMS_BY_ID = new Map(MERGE_ITEM_CATALOG.map((item) => [item.id, item]));

export type FeastleStoryRequestPreview = { title: string; definitionId: string; quantity: number; secondaryDefinitionId?: string };
export const FEASTLE_STORY_REQUESTS: Readonly<Record<number, readonly FeastleStoryRequestPreview[]>> = {
  2: [{ title: 'The First Snack', definitionId: 'food:table:2', quantity: 1 }],
  3: [{ title: 'The First Bake', definitionId: 'food:dessert:2', quantity: 2 }],
  4: [
    { title: 'A Welcoming Dish', definitionId: 'food:table:3', quantity: 1 },
    { title: 'A Sweet Finish', definitionId: 'food:dessert:3', quantity: 1 },
    { title: 'The Table Centrepiece', definitionId: 'food:table:4', quantity: 1, secondaryDefinitionId: 'food:dessert:3' },
  ],
};

export type MergeGeneratorDefinition = {
  id: string;
  name: string;
  icon: IconSymbolName;
  color: string;
  initialCell: number;
  chainIds: [MergeChainId, MergeChainId];
  tierOneDropDefinitionIds: [string, string];
  unlockDescription: string;
};

const generator = (
  id: string,
  name: string,
  icon: IconSymbolName,
  color: string,
  initialCell: number,
  chainIds: [MergeChainId, MergeChainId],
  unlockDescription: string,
): MergeGeneratorDefinition => ({
  id, name, icon, color, initialCell, chainIds,
  tierOneDropDefinitionIds: [`${chainIds[0]}:1`, `${chainIds[1]}:1`],
  unlockDescription,
});

export const MERGE_GENERATORS: readonly MergeGeneratorDefinition[] = [
  generator('hearth-pantry', 'Hearth Pantry', 'fork.knife', '#C97847', 31, ['food:table', 'food:dessert'], 'Ingredients and baking basics for savoury tables and sweet finishes.'),
  generator('ritual-bar', 'Ritual Bar', 'water.waves', '#A76E58', 32, ['drink:hot', 'drink:refresh'], 'Warm rituals and bright refreshments, chosen one small ingredient at a time.'),
  generator('journey-locker', 'Journey Locker', 'figure.walk', '#967044', 33, ['adventure:trail', 'adventure:travel'], 'Walking gear and travel keepsakes for journeys near and far.'),
  generator('wild-garden', 'Wild Garden', 'leaf.fill', '#5E9E69', 38, ['nature:garden', 'nature:waterside'], 'Seeds and waterside treasures from one shared patch of wildness.'),
  generator('comfort-chest', 'Comfort Chest', 'sparkles', '#A889B8', 39, ['comfort:rest', 'comfort:care'], 'Restful comforts and practical care for difficult or tender days.'),
  generator('community-cart', 'Community Cart', 'sparkles', '#D88762', 40, ['social:gathering', 'social:celebration'], 'Everything needed to welcome people and mark a joyful moment.'),
  generator('study-desk', 'Study Desk', 'sparkles', '#668EAA', 46, ['mind:work', 'mind:books'], 'Small tools for focus, planning, stories, and thoughtful curiosity.'),
  generator('creative-playroom', 'Creative Playroom', 'sparkles', '#9A72C4', 47, ['creative:art', 'creative:screen'], 'Art materials and playful screens for making and imagining.'),
];

export const MERGE_GENERATORS_BY_ID = new Map(MERGE_GENERATORS.map((item) => [item.id, item]));
export const MERGE_GENERATOR_MIGRATION_ALIASES: Readonly<Record<string, string>> = {
  'starter-pantry': 'hearth-pantry',
  'nature-pot': 'wild-garden',
  'waterside-pail': 'wild-garden',
  'adventure-pack': 'journey-locker',
  'travel-trunk': 'journey-locker',
};

export const MERGE_CHARACTER_NAMES: Record<MergeCharacterId, string> = {
  baristabbit: 'Baristabbit', feastle: 'Feastle', steppling: 'Steppling', flexel: 'Flexel', bedrotte: 'Bedrotte',
  dawnle: 'Dawnle', mendle: 'Mendle', gatherglow: 'Gatherglow', heartmote: 'Heartmote', kindling: 'Kindling',
  snuglet: 'Snuglet', waglet: 'Waglet', tasklet: 'Tasklet', errandimp: 'Errandimp', pagelet: 'Pagelet',
  relicoon: 'Relicoon', museling: 'Museling', encora: 'Encora', flickerbun: 'Flickerbun', pixooka: 'Pixooka',
  mossprout: 'Mossprout', shellio: 'Shellio', skylo: 'Skylo', voyagle: 'Voyagle', cheerlet: 'Cheerlet',
};

export const MERGE_CHAPTER_LANDMARKS: Partial<Record<MergeCharacterId, { id: string; title: string }>> = {
  feastle: { id: 'feastle-first-table', title: "Feastle's First Table" },
  baristabbit: { id: 'baristabbit-pause-table', title: "Baristabbit's Pause Table" },
  steppling: { id: 'steppling-path-outside', title: "Steppling's Path Outside" },
  voyagle: { id: 'voyagle-blank-map', title: "Voyagle's Map with Blank Spaces" },
  flexel: { id: 'flexel-rhythm-garden', title: "Flexel's Rhythm That Holds" },
  bedrotte: { id: 'bedrotte-quiet-room', title: "Bedrotte's Room That Asks Nothing" },
};

export type KatchimeraMergeProfile = {
  characterId: MergeCharacterId;
  coreChains: [MergeChainId, MergeChainId];
  guestChains: readonly MergeChainId[];
  narrativeTheme: string;
};

const profile = (
  characterId: MergeCharacterId,
  coreChains: [MergeChainId, MergeChainId],
  guestChains: readonly MergeChainId[],
  narrativeTheme: string,
): KatchimeraMergeProfile => ({ characterId, coreChains, guestChains, narrativeTheme });

export const KATCHIMERA_MERGE_PROFILES: Record<MergeCharacterId, KatchimeraMergeProfile> = {
  baristabbit: profile('baristabbit', ['drink:hot', 'drink:refresh'], ['food:dessert', 'social:gathering'], 'notice the rituals that make a pause feel restorative'),
  feastle: profile('feastle', ['food:table', 'food:dessert'], ['drink:hot', 'drink:refresh', 'social:gathering'], 'turn food memories into warmth, welcome, and shared tables'),
  steppling: profile('steppling', ['adventure:trail', 'adventure:travel'], ['drink:refresh', 'nature:waterside'], 'honour small steps and the places they gradually open'),
  flexel: profile('flexel', ['adventure:trail', 'comfort:care'], ['drink:refresh'], 'find a sustainable rhythm between movement and recovery'),
  bedrotte: profile('bedrotte', ['comfort:rest', 'comfort:care'], ['drink:hot', 'mind:books'], 'remove shame from rest and listen for what the body needs'),
  dawnle: profile('dawnle', ['comfort:rest', 'drink:hot'], ['food:table'], 'build a gentle beginning instead of a perfect morning'),
  mendle: profile('mendle', ['comfort:care', 'comfort:rest'], ['nature:garden'], 'notice repair, tenderness, and the care already happening'),
  gatherglow: profile('gatherglow', ['social:gathering', 'social:celebration'], ['drink:refresh', 'food:dessert'], 'remember the moments when belonging felt real'),
  heartmote: profile('heartmote', ['social:gathering', 'comfort:care'], ['social:celebration', 'drink:hot'], 'name the ways connection and care showed up today'),
  kindling: profile('kindling', ['social:celebration', 'social:gathering'], ['nature:garden', 'mind:work'], 'protect sparks of enthusiasm by sharing them'),
  snuglet: profile('snuglet', ['comfort:care', 'comfort:rest'], ['food:table', 'mind:books'], 'collect tiny comforts without needing to earn them'),
  waglet: profile('waglet', ['comfort:care', 'adventure:trail'], ['social:gathering', 'nature:garden'], 'follow curiosity while staying close to safety and care'),
  tasklet: profile('tasklet', ['mind:work', 'mind:books'], ['drink:hot'], 'turn pressure into one visible, humane next step'),
  errandimp: profile('errandimp', ['mind:work', 'adventure:travel'], ['comfort:care'], 'make everyday logistics feel lighter and more intentional'),
  pagelet: profile('pagelet', ['mind:books', 'mind:work'], ['drink:hot'], 'save useful thoughts before they disappear'),
  relicoon: profile('relicoon', ['mind:books', 'creative:art'], ['adventure:travel'], 'find meaning in objects, stories, and remembered details'),
  museling: profile('museling', ['creative:art', 'mind:books'], ['drink:hot', 'drink:refresh'], 'follow inspiration without demanding an outcome'),
  encora: profile('encora', ['creative:art', 'social:gathering'], ['creative:screen'], 'give unfinished ideas a welcoming audience'),
  flickerbun: profile('flickerbun', ['creative:screen', 'mind:books'], ['drink:refresh'], 'notice which stories and play truly replenish attention'),
  pixooka: profile('pixooka', ['creative:screen', 'mind:work'], ['social:gathering'], 'shape digital play into curiosity, craft, and momentum'),
  mossprout: profile('mossprout', ['nature:garden', 'nature:waterside'], ['comfort:care'], 'notice slow growth and the conditions that support it'),
  shellio: profile('shellio', ['nature:waterside', 'adventure:travel'], ['drink:refresh'], 'keep small discoveries from the edges of the day'),
  skylo: profile('skylo', ['adventure:travel', 'mind:books'], ['drink:hot'], 'make room for perspective, wonder, and faraway possibilities'),
  voyagle: profile('voyagle', ['adventure:travel', 'adventure:trail'], ['drink:refresh'], 'turn journeys into stories worth keeping'),
  cheerlet: profile('cheerlet', ['social:celebration', 'social:gathering'], ['food:dessert', 'drink:refresh'], 'spot reasons for joy without forcing positivity'),
};

export const GENERATOR_BY_CHAIN = Object.fromEntries(MERGE_GENERATORS.flatMap((item) => item.chainIds.map((chainId) => [chainId, item.id]))) as Record<MergeChainId, string>;

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
  maximumFriendshipLevel?: number;
};

const familyOrderTemplates = (entry: KatchimeraMergeProfile): MergeOrderTemplate[] => {
  const name = MERGE_CHARACTER_NAMES[entry.characterId];
  const [first, second] = entry.coreChains;
  return [
    { key: `${entry.characterId}:first-step`, characterId: entry.characterId, title: `${name}'s first request`, difficulty: 'small', requirements: [{ definitionId: `${first}:2`, quantity: 1 }], reward: { coins: 20, mergeXp: 18, friendshipXp: 12, energy: 2 }, maximumFriendshipLevel: 2 },
    { key: `${entry.characterId}:second-thread`, characterId: entry.characterId, title: 'A second thread', difficulty: 'small', requirements: [{ definitionId: `${second}:2`, quantity: 1 }], reward: { coins: 22, mergeXp: 18, friendshipXp: 12, energy: 2 }, maximumFriendshipLevel: 2 },
    { key: `${entry.characterId}:two-parts`, characterId: entry.characterId, title: 'Two parts of today', difficulty: 'medium', requirements: [{ definitionId: `${first}:3`, quantity: 1 }, { definitionId: `${second}:2`, quantity: 1 }], reward: { coins: 48, mergeXp: 38, friendshipXp: 22, energy: 3 }, minimumFriendshipLevel: 3 },
    { key: `${entry.characterId}:deeper-pattern`, characterId: entry.characterId, title: 'A pattern taking shape', difficulty: 'medium', requirements: [{ definitionId: `${second}:3`, quantity: 1 }, { definitionId: `${first}:2`, quantity: 1 }], reward: { coins: 52, mergeXp: 42, friendshipXp: 24, energy: 3 }, minimumFriendshipLevel: 4 },
    { key: `${entry.characterId}:signature`, characterId: entry.characterId, title: `${name}'s signature moment`, difficulty: 'major', requirements: [{ definitionId: `${first}:4`, quantity: 1 }, { definitionId: `${second}:4`, quantity: 1 }], reward: { coins: 100, mergeXp: 80, friendshipXp: 50, energy: 5 }, signature: true, chapterId: `${entry.characterId}-merge-chapter-1`, minimumFriendshipLevel: 6 },
  ];
};

export const MERGE_ORDER_TEMPLATES: readonly MergeOrderTemplate[] = Object.values(KATCHIMERA_MERGE_PROFILES).flatMap(familyOrderTemplates);

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
