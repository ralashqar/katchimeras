import type { IconSymbolName } from '@/components/ui/icon-symbol';
import type {
  MergeChainId,
  MergeCharacterId,
  MergeFamilyId,
  MergeItemDefinition,
  MergeOrderDifficulty,
  MergeReward,
  MossproutRootReward,
  MossproutRootRewardPreview,
} from '@/types/merge-world';

export const MERGE_WORLD_COLUMNS = 7;
export const MERGE_WORLD_ROWS = 9;
export const MERGE_WORLD_SIZE = MERGE_WORLD_COLUMNS * MERGE_WORLD_ROWS;

export const MOSSPROUT_FTUE_OPEN_CELLS = new Set([
  17,
  23, 24, 25,
  29, 30, 31, 32, 33,
  37, 38, 39,
  45,
]);

export const MOSSPROUT_DREAM_ECHOES = [
  { cell: 23, id: 'mossprout-seed-echo', definitionId: 'nature:garden:1' },
  { cell: 25, id: 'mossprout-sprout-echo', definitionId: 'nature:garden:2' },
  { cell: 37, id: 'mossprout-plant-echo', definitionId: 'nature:garden:3' },
  { cell: 39, id: 'mossprout-flower-echo', definitionId: 'nature:garden:4' },
  { cell: 45, id: 'mossprout-garden-echo', definitionId: 'nature:garden:5' },
] as const;

export const MOSSPROUT_STORY_AWAKENINGS = {
  'mossprout:chapter-0:first-sprout': { id: 'mossprout-first-order-clear', cells: [] },
  'mossprout:chapter-0:home-plant': { id: 'mossprout-second-order-clear', cells: [] },
  'mossprout:chapter-0:energy-plant': { id: 'mossprout-final-order-clear', cells: [] },
} as const;

export const MERGE_STARTING_OPEN_CELLS = new Set([
  17,
  23, 24, 25,
  29, 30, 31, 32, 33,
  37, 38, 39,
  45,
]);

export const MERGE_CHAIN_IDS: readonly MergeChainId[] = [
  'food:table', 'food:dessert', 'drink:hot', 'drink:refresh',
  'adventure:trail', 'adventure:travel', 'nature:garden', 'nature:waterside',
  'nature:keepsake', 'nature:root-memory',
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
  ...chain('nature:keepsake', 'sparkles', '#79AA76', ['Dew Bead', 'Pressed Leaf', 'Memory Sprig', 'Field Journal', 'Memory Terrarium', 'Living Archive']),
  ...chain('comfort:rest', 'sparkles', '#B7A5D8', ['Pillow Feather', 'Cushion', 'Pillow', 'Blanket Nest', 'Cosy Bed', 'Dream Room']),
  ...chain('comfort:care', 'sparkles', '#EEA49C', ['Bandage', 'Care Pouch', 'First Aid Kit', 'Comfort Basket', 'Healing Cabinet', 'Sanctuary Kit']),
  ...chain('social:gathering', 'fork.knife', '#E9A86F', ['Place Card', 'Shared Plate', 'Picnic Cloth', 'Gathering Table', 'Community Supper', 'Village Festival']),
  ...chain('social:celebration', 'sparkles', '#F2C85B', ['Ribbon', 'Wrapped Gift', 'Party Hat', 'Celebration Hamper', 'Joyful Parade', 'Grand Jubilee']),
  ...chain('mind:work', 'sparkles', '#79A9C7', ['Sticky Note', 'Checklist', 'Planner', 'Tidy Desk', 'Project Station', 'Calm Command Centre']),
  ...chain('mind:books', 'sparkles', '#9D7C69', ['Bookmark', 'Pocket Book', 'Story Stack', 'Reading Nook', 'Library Cart', 'Wonder Library']),
  ...chain('creative:art', 'sparkles', '#D88CBC', ['Pencil', 'Sketchbook', 'Paint Set', 'Easel', 'Studio Corner', 'Gallery of Dreams']),
  ...chain('creative:screen', 'sparkles', '#7E87D8', ['Game Token', 'Handheld Game', 'Console', 'Cosy Game Setup', 'Arcade Corner', 'Pixel Palace']),
  { id: 'mossprout:root-memory:returning-seed', familyId: 'nature', chainId: 'nature:root-memory', branchId: 'quiet_patch', tier: 1, name: 'Returning Seed', icon: 'leaf.fill', color: '#8DB34B', nextItemId: null, sellValue: 0, progressionOnly: true },
  { id: 'mossprout:root-memory:rain-kept-acorn', familyId: 'nature', chainId: 'nature:root-memory', branchId: 'returning_pond', tier: 1, name: 'Rain-Kept Acorn', icon: 'water.waves', color: '#78B8A8', nextItemId: null, sellValue: 0, progressionOnly: true },
  { id: 'mossprout:root-memory:nursery-keepsake', familyId: 'nature', chainId: 'nature:root-memory', branchId: 'memory_nursery', tier: 1, name: 'Nursery Keepsake', icon: 'sparkles', color: '#A4B85F', nextItemId: null, sellValue: 0, progressionOnly: true },
  { id: 'mossprout:root-memory:heartseed', familyId: 'nature', chainId: 'nature:root-memory', branchId: 'heartwood', tier: 1, name: 'Heartseed', icon: 'leaf.fill', color: '#C5A746', nextItemId: null, sellValue: 0, progressionOnly: true },
  {
    id: 'hybrid:picnic-pack', familyId: 'adventure', chainId: 'adventure:travel', branchId: 'hybrid', tier: 1,
    name: 'Picnic Pack', icon: 'sparkles', color: '#F4C982', nextItemId: null, sellValue: 48,
  },
  { id: 'hybrid:memory-bloom', familyId: 'nature', chainId: 'nature:keepsake', branchId: 'hybrid', tier: 1, name: 'Memory Bloom', icon: 'sparkles', color: '#EEA7B8', nextItemId: null, sellValue: 56 },
  { id: 'hybrid:rain-mirror', familyId: 'nature', chainId: 'nature:keepsake', branchId: 'hybrid', tier: 1, name: 'Rain Mirror', icon: 'water.waves', color: '#87CBCD', nextItemId: null, sellValue: 64 },
  { id: 'hybrid:heartwood-sanctuary', familyId: 'nature', chainId: 'nature:keepsake', branchId: 'hybrid', tier: 1, name: 'Heartwood Sanctuary', icon: 'leaf.fill', color: '#D9B85F', nextItemId: null, sellValue: 256 },
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
  generator('memory-nursery', 'Memory Nursery', 'sparkles', '#79AA76', 45, ['nature:keepsake', 'nature:keepsake'], 'Living keepsakes grown from the small nature moments Mossprout remembers with you.'),
  generator('comfort-chest', 'Comfort Chest', 'sparkles', '#A889B8', 39, ['comfort:rest', 'comfort:care'], 'Restful comforts and practical care for difficult or tender days.'),
  generator('community-cart', 'Community Cart', 'sparkles', '#D88762', 40, ['social:gathering', 'social:celebration'], 'Everything needed to welcome people and mark a joyful moment.'),
  generator('study-desk', 'Study Desk', 'sparkles', '#668EAA', 46, ['mind:work', 'mind:books'], 'Small tools for focus, planning, stories, and thoughtful curiosity.'),
  generator('creative-playroom', 'Creative Playroom', 'sparkles', '#9A72C4', 47, ['creative:art', 'creative:screen'], 'Art materials and playful screens for making and imagining.'),
];

export const MERGE_GENERATORS_BY_ID = new Map(MERGE_GENERATORS.map((item) => [item.id, item]));

// One authored Dream Echo for every shared generator tier-one drop. The Seed
// is deliberately omitted because Mossprout's FTUE already authors and clears
// that Echo. Cells avoid all FTUE Echoes and Chapter 0 story-clearing clusters.
const MERGE_LOCKED_TIER_ONE_ECHO_CELLS = [
  0, 1,   // Hearth Pantry
  5, 6,   // Ritual Bar
  7, 8,   // Journey Locker
  12, 13, // Wild Garden
  14, 21, // Comfort Chest
  28, 35, // Community Cart
  42, 43, // Study Desk
  49, 50, // Creative Playroom
] as const;

export const MERGE_LOCKED_TIER_ONE_ECHOES = MERGE_GENERATORS.filter((generator) => generator.id !== 'memory-nursery').flatMap((generator, generatorIndex) => (
  generator.tierOneDropDefinitionIds.map((definitionId, branchIndex) => ({
    cell: MERGE_LOCKED_TIER_ONE_ECHO_CELLS[generatorIndex * 2 + branchIndex],
    definitionId,
    generatorId: generator.id,
    id: `shared-echo:${definitionId}`,
  }))
)).filter((echo) => echo.definitionId !== 'nature:garden:1');

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
  mossprout: { id: 'mossprout-little-rain-garden', title: "Mossprout's Little Rain Garden" },
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
  requirements: { definitionId: string; quantity: number }[];
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
  [['nature:garden:4', 'nature:keepsake:2'].sort().join('+'), 'hybrid:memory-bloom'],
  [['nature:waterside:3', 'nature:keepsake:1'].sort().join('+'), 'hybrid:rain-mirror'],
  [['nature:garden:7', 'nature:keepsake:6'].sort().join('+'), 'hybrid:heartwood-sanctuary'],
]);

export type MossproutRootGateDefinition = {
  id: string;
  cell: number;
  chapter: import('@/types/merge-world').MossproutBoardChapter;
  title: string;
  story: string;
  kind: import('@/types/merge-world').MossproutRootGateKind;
  target: number;
  revealDay: number;
  fallbackDelay: number;
  rootMemoryDefinitionId: string;
  rewardPreview: MossproutRootRewardPreview;
  rewards: readonly MossproutRootReward[];
};

/** Authored over the existing shared Echo reservations so future companion paths keep their cells. */
export const MOSSPROUT_ROOTBOUND_GATES: readonly MossproutRootGateDefinition[] = [
  { id: 'root:day-5-first-return', cell: 0, chapter: 'quiet_patch', title: 'The First Returning Root', story: 'A root remembers each day you choose to return.', kind: 'journey_day', target: 5, revealDay: 5, fallbackDelay: 3, rootMemoryDefinitionId: 'mossprout:root-memory:returning-seed', rewardPreview: 'space', rewards: [] },
  { id: 'root:day-7-two-shores', cell: 1, chapter: 'quiet_patch', title: 'Two Shores', story: 'The garden reaches toward lives beyond its edge.', kind: 'journey_day', target: 7, revealDay: 7, fallbackDelay: 3, rootMemoryDefinitionId: 'mossprout:root-memory:returning-seed', rewardPreview: 'garden_growth', rewards: [{ kind: 'generator_level', generatorId: 'wild-garden', level: 2 }] },
  { id: 'root:memory-first', cell: 5, chapter: 'returning_pond', title: 'A Memory Took Root', story: 'A kept nature moment glows beneath the soil.', kind: 'memory', target: 1, revealDay: 8, fallbackDelay: 3, rootMemoryDefinitionId: 'mossprout:root-memory:rain-kept-acorn', rewardPreview: 'space', rewards: [] },
  { id: 'root:friendship-4', cell: 6, chapter: 'returning_pond', title: 'Familiar Rain', story: 'Mossprout trusts this patch enough to let the rain in.', kind: 'friendship', target: 4, revealDay: 10, fallbackDelay: 3, rootMemoryDefinitionId: 'mossprout:root-memory:rain-kept-acorn', rewardPreview: 'space', rewards: [] },
  { id: 'root:memory-two-days', cell: 7, chapter: 'returning_pond', title: 'A Place Revisited', story: 'Two separate nature memories have begun to recognise one another.', kind: 'memory', target: 2, revealDay: 12, fallbackDelay: 3, rootMemoryDefinitionId: 'mossprout:root-memory:rain-kept-acorn', rewardPreview: 'wisp_nest', rewards: [{ kind: 'wisp', wispId: 'fern' }] },
  { id: 'root:focus-first', cell: 8, chapter: 'returning_pond', title: 'A Direction for Growing', story: 'Choosing a nature direction gives this root somewhere to grow.', kind: 'focus', target: 1, revealDay: 14, fallbackDelay: 3, rootMemoryDefinitionId: 'mossprout:root-memory:rain-kept-acorn', rewardPreview: 'garden_growth', rewards: [{ kind: 'generator_level', generatorId: 'wild-garden', level: 3 }] },
  { id: 'root:nursery-key', cell: 12, chapter: 'memory_nursery', title: 'The Nursery Key', story: 'Living keepsakes are ready to grow from remembered days.', kind: 'journey_day', target: 15, revealDay: 15, fallbackDelay: 3, rootMemoryDefinitionId: 'mossprout:root-memory:nursery-keepsake', rewardPreview: 'nursery', rewards: [{ kind: 'generator_unlock', generatorId: 'memory-nursery' }] },
  { id: 'root:memory-three-days', cell: 13, chapter: 'memory_nursery', title: 'Three Living Days', story: 'The Nursery has learned the shape of your attention.', kind: 'memory', target: 3, revealDay: 17, fallbackDelay: 3, rootMemoryDefinitionId: 'mossprout:root-memory:nursery-keepsake', rewardPreview: 'keepsake', rewards: [{ kind: 'merge_item', definitionId: 'nature:keepsake:2' }] },
  { id: 'root:friendship-8', cell: 14, chapter: 'memory_nursery', title: 'Trusted Roots', story: 'A deeper bond lets the garden hold more complicated things.', kind: 'friendship', target: 8, revealDay: 19, fallbackDelay: 3, rootMemoryDefinitionId: 'mossprout:root-memory:nursery-keepsake', rewardPreview: 'garden_growth', rewards: [{ kind: 'generator_level', generatorId: 'memory-nursery', level: 2 }] },
  { id: 'root:focus-second', cell: 21, chapter: 'memory_nursery', title: 'A Rhythm Remembered', story: 'Returning to nearby nature has become a pattern, not a task.', kind: 'focus', target: 2, revealDay: 21, fallbackDelay: 3, rootMemoryDefinitionId: 'mossprout:root-memory:nursery-keepsake', rewardPreview: 'memory_card', rewards: [{ kind: 'memory_card', poolId: 'small-wonders', rarityFloor: 'rare' }] },
  { id: 'root:wisp-companion', cell: 28, chapter: 'heartwood', title: 'A Small Light Nearby', story: 'A Mossprout Wisp has noticed the same path through the green.', kind: 'wisp', target: 1, revealDay: 24, fallbackDelay: 3, rootMemoryDefinitionId: 'mossprout:root-memory:heartseed', rewardPreview: 'garden_growth', rewards: [{ kind: 'generator_level', generatorId: 'memory-nursery', level: 3 }] },
  { id: 'root:heartwood', cell: 35, chapter: 'heartwood', title: 'The Heartwood Root', story: 'Every return, memory, and shared garden day gathers here.', kind: 'mastery', target: 28, revealDay: 28, fallbackDelay: 3, rootMemoryDefinitionId: 'mossprout:root-memory:heartseed', rewardPreview: 'heartwood', rewards: [{ kind: 'wisp', wispId: 'grovelight' }, { kind: 'landmark', landmarkId: 'mossprout-heartwood', title: 'Mossprout’s Heartwood' }] },
] as const;

export const MOSSPROUT_ROOTBOUND_GATES_BY_ID = new Map(MOSSPROUT_ROOTBOUND_GATES.map((gate) => [gate.id, gate]));

/**
 * The eighteen non-Rootbound cells Mossprout grows back into the playable
 * board. Three cells open at each authored chapter beat; no currency purchase
 * or unexplained permanent fog is involved.
 */
export const MOSSPROUT_GARDEN_GROWTH_CLEARINGS = [
  { id: 'seedbed-edge', title: 'Seedbed Edge', revealDay: 3, cells: [19, 20, 26] },
  { id: 'rainwater-bend', title: 'Rainwater Bend', revealDay: 7, cells: [27, 34, 41] },
  { id: 'nursery-verge', title: 'Nursery Verge', revealDay: 12, cells: [42, 43, 48] },
  { id: 'living-border', title: 'Living Border', revealDay: 15, cells: [49, 50, 54] },
  { id: 'lantern-bank', title: 'Lantern Bank', revealDay: 21, cells: [55, 56, 57] },
  { id: 'heartwood-rim', title: 'Heartwood Rim', revealDay: 28, cells: [58, 61, 62] },
] as const;

export const MOSSPROUT_GARDEN_GROWTH_BY_CELL: ReadonlyMap<number, (typeof MOSSPROUT_GARDEN_GROWTH_CLEARINGS)[number]> = new Map(
  MOSSPROUT_GARDEN_GROWTH_CLEARINGS.flatMap((clearing) => clearing.cells.map((cell) => [cell, clearing] as const)),
);

export const MERGE_EXPANSIONS = [
  { id: 'clearing-east', title: 'Clear the eastern vines', cells: [26, 27, 34, 41], requiredLevel: 3, coinCost: 120 },
  { id: 'clearing-west', title: 'Move the old stones', cells: [14, 21, 28, 35], requiredLevel: 6, coinCost: 300 },
  { id: 'clearing-north-heart', title: 'Part the northern mist', cells: [7, 8, 12, 13], requiredLevel: 9, coinCost: 520 },
  { id: 'clearing-north-rim', title: 'Unseal the high clearing', cells: [0, 1, 5, 6, 19, 20], requiredLevel: 12, coinCost: 820 },
  { id: 'clearing-south-garden', title: 'Wake the forgotten garden', cells: [42, 43, 48, 49, 50], requiredLevel: 15, coinCost: 1_200 },
  { id: 'clearing-south-rim', title: 'Dissolve the last dream mist', cells: [54, 55, 56, 57, 58, 61, 62], requiredLevel: 18, coinCost: 1_800 },
] as const;

export const MERGE_LEVEL_THRESHOLDS = [0, 40, 100, 190, 310, 470, 680, 950, 1_280, 1_680, 2_160, 2_730, 3_400, 4_180, 5_080, 6_100, 7_250, 8_540, 9_980, 11_580] as const;

export function mergeLevelForXp(xp: number) {
  let level = 1;
  for (let index = 0; index < MERGE_LEVEL_THRESHOLDS.length; index += 1) {
    if (xp >= MERGE_LEVEL_THRESHOLDS[index]) level = index + 1;
  }
  return level;
}
