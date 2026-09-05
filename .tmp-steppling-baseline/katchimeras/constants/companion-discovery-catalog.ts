import type { MergeCharacterId } from '@/types/merge-world';

export type CompanionDiscoveryAffinity =
  | 'nature' | 'adventure' | 'social' | 'rest'
  | 'creativity' | 'discovery' | 'food' | 'home';

export type CompanionBoardRole = 'foundation' | 'expansion' | 'utility_founder' | 'utility_upgrade';

export type CompanionBoardAllocation = {
  characterId: MergeCharacterId;
  role: CompanionBoardRole;
  cells: readonly number[];
  permanentFeatureId: string | null;
  prerequisiteCharacterId: MergeCharacterId | null;
};

export type CompanionDiscoveryStageDefinition = {
  clue: string;
  boundDefinitionId: string;
};

export type CompanionDiscoveryDefinition = {
  id: string;
  gateId: string;
  characterId: MergeCharacterId;
  role: CompanionBoardRole;
  pathId: string;
  pathName: string;
  pathCells: readonly number[];
  entryDefinitionId: string;
  permanentGeneratorId: string | null;
  affinityWeights: Partial<Record<CompanionDiscoveryAffinity, number>>;
  stages: readonly CompanionDiscoveryStageDefinition[];
};

export const MERGE_STARTING_DIAMOND_CELLS = [17, 23, 24, 25, 29, 30, 31, 32, 33, 37, 38, 39, 45] as const;
export const COMPANION_BOARD_RESERVE_CELLS = [5, 34, 61] as const;
export const DISCOVERY_FORK_ANCHOR_CELL = 34;

export const COMPANION_BOARD_ALLOCATIONS: readonly CompanionBoardAllocation[] = [
  { characterId: 'mossprout', role: 'foundation', cells: [], permanentFeatureId: 'wild-garden', prerequisiteCharacterId: null },
  { characterId: 'steppling', role: 'foundation', cells: [18, 19, 20], permanentFeatureId: 'journey-locker', prerequisiteCharacterId: 'mossprout' },
  { characterId: 'feastle', role: 'foundation', cells: [16, 15, 14], permanentFeatureId: 'hearth-pantry', prerequisiteCharacterId: 'mossprout' },
  { characterId: 'baristabbit', role: 'foundation', cells: [10, 11, 12], permanentFeatureId: 'ritual-bar', prerequisiteCharacterId: 'mossprout' },
  { characterId: 'bedrotte', role: 'foundation', cells: [40, 41, 48], permanentFeatureId: 'comfort-chest', prerequisiteCharacterId: 'mossprout' },
  { characterId: 'gatherglow', role: 'foundation', cells: [46, 47, 54], permanentFeatureId: 'community-cart', prerequisiteCharacterId: 'mossprout' },
  { characterId: 'tasklet', role: 'foundation', cells: [22, 21, 28], permanentFeatureId: 'study-desk', prerequisiteCharacterId: 'mossprout' },
  { characterId: 'museling', role: 'foundation', cells: [36, 35, 42], permanentFeatureId: 'creative-playroom', prerequisiteCharacterId: 'mossprout' },

  { characterId: 'cheerlet', role: 'expansion', cells: [7, 8], permanentFeatureId: 'hearth-pantry:dessert', prerequisiteCharacterId: 'feastle' },
  { characterId: 'dawnle', role: 'expansion', cells: [13, 6], permanentFeatureId: 'ritual-bar:refresh', prerequisiteCharacterId: 'baristabbit' },
  { characterId: 'voyagle', role: 'expansion', cells: [9, 2], permanentFeatureId: 'journey-locker:travel', prerequisiteCharacterId: 'steppling' },
  { characterId: 'shellio', role: 'expansion', cells: [26, 27], permanentFeatureId: 'wild-garden:waterside', prerequisiteCharacterId: 'mossprout' },
  { characterId: 'mendle', role: 'expansion', cells: [43, 44], permanentFeatureId: 'comfort-chest:care', prerequisiteCharacterId: 'bedrotte' },
  { characterId: 'kindling', role: 'expansion', cells: [49, 50], permanentFeatureId: 'community-cart:celebration', prerequisiteCharacterId: 'gatherglow' },
  { characterId: 'pagelet', role: 'expansion', cells: [51, 52], permanentFeatureId: 'study-desk:books', prerequisiteCharacterId: 'tasklet' },
  { characterId: 'pixooka', role: 'expansion', cells: [53, 60], permanentFeatureId: 'creative-playroom:screen', prerequisiteCharacterId: 'museling' },
  { characterId: 'flexel', role: 'expansion', cells: [3, 4], permanentFeatureId: 'hybrid:recovery-kit', prerequisiteCharacterId: 'steppling' },

  { characterId: 'heartmote', role: 'utility_founder', cells: [1, 0], permanentFeatureId: 'resonance-nook', prerequisiteCharacterId: 'gatherglow' },
  { characterId: 'errandimp', role: 'utility_founder', cells: [55, 62], permanentFeatureId: 'dispatch-satchel', prerequisiteCharacterId: 'tasklet' },
  { characterId: 'relicoon', role: 'utility_founder', cells: [56, 57], permanentFeatureId: 'memory-cabinet', prerequisiteCharacterId: 'museling' },
  { characterId: 'skylo', role: 'utility_founder', cells: [58, 59], permanentFeatureId: 'dream-beacon', prerequisiteCharacterId: 'voyagle' },

  { characterId: 'snuglet', role: 'utility_upgrade', cells: [], permanentFeatureId: 'resonance-nook:upgrade', prerequisiteCharacterId: 'heartmote' },
  { characterId: 'waglet', role: 'utility_upgrade', cells: [], permanentFeatureId: 'dispatch-satchel:upgrade', prerequisiteCharacterId: 'errandimp' },
  { characterId: 'encora', role: 'utility_upgrade', cells: [], permanentFeatureId: 'memory-cabinet:upgrade', prerequisiteCharacterId: 'relicoon' },
  { characterId: 'flickerbun', role: 'utility_upgrade', cells: [], permanentFeatureId: 'dream-beacon:upgrade', prerequisiteCharacterId: 'skylo' },
] as const;

export const STEPPLING_DISCOVERY_ID = 'discovery:ftue-steppling';
export const STEPPLING_DISCOVERY_GATE_ID = 'gate-2-steppling';
export const STEPPLING_DISCOVERY_ANCHOR_CELL = 20;

export const COMPANION_DISCOVERY_CATALOG: readonly CompanionDiscoveryDefinition[] = [
  {
    id: STEPPLING_DISCOVERY_ID, gateId: STEPPLING_DISCOVERY_GATE_ID, characterId: 'steppling', role: 'foundation',
    pathId: 'overgrown-trail', pathName: 'Overgrown Trail', pathCells: [18, 19, 20], entryDefinitionId: 'adventure:trail:1',
    permanentGeneratorId: 'journey-locker', affinityWeights: { adventure: 1, nature: 0.7, discovery: 0.5 },
    stages: [
      { clue: 'Mist-tossed Sock', boundDefinitionId: 'adventure:trail:1' },
      { clue: 'Half-seen Shoe', boundDefinitionId: 'adventure:trail:2' },
      { clue: 'Dreambound Boot', boundDefinitionId: 'adventure:trail:3' },
    ],
  },
  {
    id: 'discovery:feastle-warm-table', gateId: 'gate-3-first-choice', characterId: 'feastle', role: 'foundation',
    pathId: 'warm-table', pathName: 'Warm Table', pathCells: [16, 15, 14], entryDefinitionId: 'food:table:1',
    permanentGeneratorId: 'hearth-pantry', affinityWeights: { food: 1, home: 0.7, social: 0.45 },
    stages: [
      { clue: 'Scattered Ingredient', boundDefinitionId: 'food:table:1' },
      { clue: 'Covered Snack', boundDefinitionId: 'food:table:2' },
      { clue: 'Dreambound Dish', boundDefinitionId: 'food:table:3' },
    ],
  },
  {
    id: 'discovery:baristabbit-warm-light', gateId: 'gate-3-first-choice', characterId: 'baristabbit', role: 'foundation',
    pathId: 'warm-light', pathName: 'Warm Light', pathCells: [10, 11, 12], entryDefinitionId: 'drink:hot:1',
    permanentGeneratorId: 'ritual-bar', affinityWeights: { food: 0.65, social: 0.55, rest: 0.45, home: 0.35 },
    stages: [
      { clue: 'Faint Tea Leaf', boundDefinitionId: 'drink:hot:1' },
      { clue: 'Half-seen Tea Cup', boundDefinitionId: 'drink:hot:2' },
      { clue: 'Dreambound Teapot', boundDefinitionId: 'drink:hot:3' },
    ],
  },
  {
    id: 'discovery:bedrotte-quiet-hollow', gateId: 'gate-3-first-choice', characterId: 'bedrotte', role: 'foundation',
    pathId: 'quiet-hollow', pathName: 'Quiet Hollow', pathCells: [40, 41, 48], entryDefinitionId: 'comfort:rest:1',
    permanentGeneratorId: 'comfort-chest', affinityWeights: { rest: 1, home: 0.6 },
    stages: [
      { clue: 'Soft Feather', boundDefinitionId: 'comfort:rest:1' },
      { clue: 'Half-seen Cushion', boundDefinitionId: 'comfort:rest:2' },
      { clue: 'Dreambound Pillow', boundDefinitionId: 'comfort:rest:3' },
    ],
  },
] as const;

export const COMPANION_DISCOVERIES_BY_ID = new Map(COMPANION_DISCOVERY_CATALOG.map((definition) => [definition.id, definition]));

export const EARLY_COMPANION_DISCOVERY_POOLS: Readonly<Record<string, readonly MergeCharacterId[]>> = {
  'gate-3-first-choice': ['feastle', 'baristabbit', 'bedrotte'],
  'gate-4-expanding-world': ['feastle', 'baristabbit', 'bedrotte'],
  'gate-5-complete-foundations': ['feastle', 'baristabbit', 'bedrotte'],
};
