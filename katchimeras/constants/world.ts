import type { MemoryNodeKind, WorldArchetype } from '@/types/world';

export const WORLD_STORAGE_KEY = 'katchadeck.world-v1';

export const WORLD_ARCHETYPES: WorldArchetype[] = [
  'calm',
  'active',
  'social',
  'exploration',
  'focus',
  'meaningful',
];

// Per-archetype ground theming. The slab is drawn geometrically (Skia), so a
// theme is just colours + a decal set + naming vocabulary — adding a sixth
// archetype is a palette swap, not 16 new tiles. Colours follow the cozy
// cottagecore direction the asset spike locked in.
export type ArchetypeTheme = {
  label: string;
  groundTop: string;
  groundTopShade: string;
  groundSide: string;
  rim: string;
  accent: string;
  // The base ground tile (atlas key) every cell is floored with, plus the accent
  // tiles scattered on top. Both resolve through the decal sprite atlas.
  groundTile: string;
  decals: string[];
  adjectives: string[];
  nouns: string[];
};

export const ARCHETYPE_THEME: Record<WorldArchetype, ArchetypeTheme> = {
  calm: {
    label: 'Calm',
    groundTop: '#9BCB86',
    groundTopShade: '#7FB873',
    groundSide: '#4F7A4A',
    rim: '#D4ECB6',
    accent: '#7DE8CD',
    groundTile: 'grass',
    decals: ['flowers', 'moss'],
    adjectives: ['Quiet', 'Still', 'Soft', 'Hushed'],
    nouns: ['Hollow', 'Meadow', 'Nook', 'Glade'],
  },
  active: {
    label: 'Active',
    groundTop: '#CDB98A',
    groundTopShade: '#BBA577',
    groundSide: '#7A6A45',
    rim: '#EEDFAE',
    accent: '#FFC36B',
    groundTile: 'grass',
    decals: ['path', 'rock'],
    adjectives: ['Bright', 'Open', 'Sunlit', 'Roaming'],
    nouns: ['Trailhead', 'Run', 'Crossing', 'Field'],
  },
  social: {
    label: 'Social',
    groundTop: '#C7A98E',
    groundTopShade: '#B5977C',
    groundSide: '#73583F',
    rim: '#EAD3B8',
    accent: '#F49AC1',
    groundTile: 'cobble',
    decals: ['grass', 'flowers'],
    adjectives: ['Warm', 'Gathered', 'Lantern', 'Shared'],
    nouns: ['Circle', 'Plaza', 'Hearth', 'Commons'],
  },
  exploration: {
    label: 'Exploration',
    groundTop: '#A8B49B',
    groundTopShade: '#94A188',
    groundSide: '#5C6650',
    rim: '#D2DBC4',
    accent: '#A9D7FF',
    groundTile: 'grass',
    decals: ['rock', 'path'],
    adjectives: ['Far', 'Frontier', 'Wandering', 'Distant'],
    nouns: ['Lookout', 'Frontier', 'Ridge', 'Reach'],
  },
  focus: {
    label: 'Focus',
    groundTop: '#B79B7A',
    groundTopShade: '#A68A6A',
    groundSide: '#6B5238',
    rim: '#E0CAA8',
    accent: '#D5C4FF',
    groundTile: 'wood',
    decals: ['moss', 'grass'],
    adjectives: ['Steady', 'Quiet', 'Lamplit', 'Tucked'],
    nouns: ['Corner', 'Workshop', 'Study', 'Desk'],
  },
  meaningful: {
    label: 'Meaningful',
    groundTop: '#B9AFD6',
    groundTopShade: '#A79CC9',
    groundSide: '#5E5680',
    rim: '#E6DFFA',
    accent: '#A78BFA',
    groundTile: 'cobble',
    decals: ['glow', 'flowers'],
    adjectives: ['Sacred', 'Still', 'Golden', 'Held'],
    nouns: ['Shrine', 'Grove', 'Memory', 'Altar'],
  },
};

// Every patch MUST have exactly one anchor — it defines the patch's identity.
// `key` resolves to a bundled cutout (utils/world-visuals.ts); only a subset has
// real art so far (the spike anchors), the rest fall back to a placeholder.
export type CatalogEntry = { key: string; label: string };

export const ARCHETYPE_ANCHORS: Record<WorldArchetype, CatalogEntry[]> = {
  calm: [
    { key: 'calm_pond', label: 'Still Pond' },
    { key: 'calm_tree', label: 'Quiet Tree' },
    { key: 'calm_flower_grove', label: 'Flower Grove' },
  ],
  active: [
    { key: 'active_trail_marker', label: 'Trail Marker' },
    { key: 'active_bridge', label: 'Little Bridge' },
    { key: 'active_windmill', label: 'Windmill' },
  ],
  social: [
    { key: 'social_campfire', label: 'Campfire' },
    { key: 'social_plaza', label: 'Plaza' },
    { key: 'social_picnic_table', label: 'Picnic Table' },
  ],
  exploration: [
    { key: 'exploration_tower', label: 'Lookout Tower' },
    { key: 'exploration_signpost', label: 'Signpost' },
    { key: 'exploration_lookout', label: 'Lookout' },
  ],
  focus: [
    { key: 'focus_cafe', label: 'Café Corner' },
    { key: 'focus_workshop', label: 'Workshop' },
    { key: 'focus_library', label: 'Reading Nook' },
  ],
  meaningful: [
    { key: 'meaningful_shrine', label: 'Shrine' },
    { key: 'meaningful_crystal', label: 'Memory Crystal' },
    { key: 'meaningful_ancient_tree', label: 'Ancient Tree' },
  ],
};

// Props add richness around the anchor. A shared pool, lightly biased per
// archetype, keeps the asset budget small.
export const PROP_POOL: CatalogEntry[] = [
  { key: 'prop_flower', label: 'Flowers' },
  { key: 'prop_bush', label: 'Bush' },
  { key: 'prop_bench', label: 'Bench' },
  { key: 'prop_lantern', label: 'Lantern' },
  { key: 'prop_rock', label: 'Rock' },
  { key: 'prop_log', label: 'Log' },
  { key: 'prop_fence', label: 'Fence' },
  { key: 'prop_coffee_table', label: 'Coffee Table' },
];

export const ARCHETYPE_PROP_BIAS: Record<WorldArchetype, string[]> = {
  calm: ['prop_flower', 'prop_bush', 'prop_bench'],
  active: ['prop_fence', 'prop_log', 'prop_rock'],
  social: ['prop_lantern', 'prop_bench', 'prop_log'],
  exploration: ['prop_rock', 'prop_fence', 'prop_log'],
  focus: ['prop_coffee_table', 'prop_lantern', 'prop_bench'],
  meaningful: ['prop_lantern', 'prop_flower', 'prop_bush'],
};

export const MEMORY_NODE_ASSET: Record<MemoryNodeKind, CatalogEntry> = {
  photo_bloom: { key: 'memory_photo_bloom', label: 'Photo Bloom' },
  landmark_stone: { key: 'memory_landmark_stone', label: 'Landmark Stone' },
  monument: { key: 'memory_monument', label: 'Monument' },
  memory_crystal: { key: 'memory_crystal', label: 'Memory Crystal' },
  lantern_shrine: { key: 'memory_lantern_shrine', label: 'Lantern Shrine' },
};

// Slot template for a 4×4 patch. P=prop, A=anchor (single tile), K=creature,
// M=memory. Every object occupies exactly one tile. The field is here so
// archetype-specific layouts can be added without touching the generator.
export const PATCH_TEMPLATE: string[] = ['PPPP', 'PAPP', 'PKMP', 'PPPP'];
