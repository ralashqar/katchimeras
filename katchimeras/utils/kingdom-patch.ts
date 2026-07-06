import type { KingdomBuilding, KingdomBuildingId, KingdomPlot, KingdomState } from '@/types/kingdom';
import type { WorldObject, WorldObjectCategory, WorldPatch, WorldTile } from '@/types/world';
import { resolveStructurePosition, resolveStructureScale } from '@/utils/world-structures';

// deriveKingdomPatch — maps the derived KingdomState onto the existing
// WorldPatch/WorldObject render model, so the Kingdom scene reuses WorldCanvas
// (camera, taps, badges, layout tuning) unchanged. Purely presentational
// derivation: buildings at lifetime levels + the creature roster. Landmarks and
// decorations join when the scene work lands their placement model.

// Which render category each Kingdom building maps to — categories drive
// position + scale lookups in the world layout, and tap routing in the scene.
export const BUILDING_CATEGORY: Record<KingdomBuildingId, WorldObjectCategory> = {
  home: 'chronicle',
  memoryLibrary: 'memory',
  crossroads: 'places',
  journeyHall: 'journey',
  sanctuary: 'reflection',
  study: 'studio',
  foodPavilion: 'food',
};

// Reverse lookup for the scene's tap routing: a tapped render category → the
// Kingdom building standing there.
export function buildingIdForCategory(category: WorldObjectCategory): KingdomBuildingId | null {
  for (const [id, cat] of Object.entries(BUILDING_CATEGORY) as [KingdomBuildingId, WorldObjectCategory][]) {
    if (cat === category) return id;
  }
  return null;
}

// Existing art, reused at Kingdom scale: leveled sets where they exist
// (Memory Vault, Journey), one iconic building + badge otherwise. The cozy
// re-skins swap in here when their assets land.
function buildingAssetKey(building: KingdomBuilding): string {
  switch (building.id) {
    case 'memoryLibrary':
      return building.level === 0 ? 'memory_vault_empty' : `memory_vault_${building.level}`;
    case 'journeyHall':
      return 'journey_hall';
    case 'crossroads':
      return 'crossroads';
    case 'sanctuary':
      return building.level === 0 ? 'sanctuary_empty' : 'sanctuary';
    case 'study':
      return 'study';
    case 'foodPavilion':
      return 'food_pavilion';
    case 'home':
      return 'home';
  }
}

// Where the roster stands: the newest creature takes the plaza centre, the
// rest settle onto surrounding spots (newest first). Positions are in patch
// cell coordinates, matching WORLD_STRUCTURE_POSITIONS' space.
const CREATURE_SLOTS: { col: number; row: number; sizeScale: number }[] = [
  { col: 1.5, row: 1.5, sizeScale: 2.1 },
  { col: 0.7, row: 2.2, sizeScale: 1.35 },
  { col: 2.3, row: 0.8, sizeScale: 1.35 },
  { col: 0.9, row: 0.7, sizeScale: 1.25 },
  { col: 2.4, row: 2.3, sizeScale: 1.25 },
  { col: 1.7, row: 2.6, sizeScale: 1.2 },
  { col: 2.7, row: 1.6, sizeScale: 1.2 },
  { col: 0.4, row: 1.4, sizeScale: 1.2 },
];

function groundTiles(size: number): WorldTile[] {
  const tiles: WorldTile[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      tiles.push({ col, row, kind: 'ground' });
    }
  }
  return tiles;
}

// Where earned plots dock around the centre island (patch-grid offsets, in
// unlock order) and which islet base each draws.
const PLOT_DOCKS: { col: number; row: number }[] = [
  { col: 1, row: 0 },
  { col: 0, row: 1 },
  { col: -1, row: 0 },
  { col: 0, row: -1 },
  { col: 1, row: 1 },
  { col: -1, row: 1 },
  { col: 1, row: -1 },
  { col: -1, row: -1 },
];
// Islet art (plot_base_1/2) is parked until it matches the cozy style —
// plots reuse the main island base for cohesion meanwhile.
const PLOT_BASES = ['base_env2'];

// An expansion plot as a render patch: an empty islet (its decor merges in at
// the screen, same as the centre island's).
export function deriveKingdomPlotPatch(plot: KingdomPlot): WorldPatch {
  const dock = PLOT_DOCKS[plot.index % PLOT_DOCKS.length];
  return {
    id: plot.id,
    dayId: plot.id,
    baseId: PLOT_BASES[plot.index % PLOT_BASES.length],
    isoDate: '',
    name: plot.label,
    primaryArchetype: 'calm',
    secondaryArchetype: null,
    creatureId: null,
    creatureVisualKey: null,
    creatureName: null,
    rarity: null,
    size: 4,
    tiles: groundTiles(4),
    objects: [],
    memoryNodes: [],
    gridCol: dock.col,
    gridRow: dock.row,
    connectorSides: [],
  };
}

// A territory expansion tile as a render patch: same-size plantable ground in
// the Kingdom's own base art, docked at the exact tessellation offset. Decor
// merges in at the screen via kingdomDecorObjects(state, `exp-<index>`).
export function deriveKingdomExpansionPatch(expansion: { index: number; side: 'ne' | 'se' | 'sw' | 'nw'; ring: number }): WorldPatch {
  return {
    id: `exp-${expansion.index}`,
    dayId: `exp-${expansion.index}`,
    baseId: null, // canvas default = the Kingdom's own tile art
    isoDate: '',
    name: 'New land',
    primaryArchetype: 'calm',
    secondaryArchetype: null,
    creatureId: null,
    creatureVisualKey: null,
    creatureName: null,
    rarity: null,
    size: 4,
    tiles: groundTiles(4),
    objects: [],
    memoryNodes: [],
    gridCol: 0,
    gridRow: 0,
    expansionDock: { side: expansion.side, ring: expansion.ring },
    connectorSides: [],
  };
}

export function deriveKingdomPatch(kingdom: KingdomState): WorldPatch {
  const objects: WorldObject[] = [];

  for (const building of kingdom.buildings) {
    const category = BUILDING_CATEGORY[building.id];
    // Placement comes from the Base Lab webtool layout (world-structure-layout
    // .json) first, falling back to the hardcoded defaults — same resolution the
    // day patch used, so tuned positions carry straight over to the Kingdom.
    const pos = resolveStructurePosition(category);
    if (!pos) continue;
    const assetKey = buildingAssetKey(building);
    objects.push({
      id: `kingdom-building-${building.id}`,
      kind: 'anchor',
      assetKey,
      label: building.label,
      col: pos.col,
      row: pos.row,
      footprint: 1,
      sourceLabel: building.countLabel,
      category,
      badge: building.count > 0 ? building.count : undefined,
      sizeScale: resolveStructureScale(category, assetKey, 1.6),
    });
  }

  kingdom.creatures.slice(0, CREATURE_SLOTS.length).forEach((creature, index) => {
    const slot = CREATURE_SLOTS[index];
    objects.push({
      id: `kingdom-creature-${creature.dayId}`,
      kind: 'creature',
      assetKey: `creature:${creature.visualKey}`,
      label: creature.name,
      col: slot.col,
      row: slot.row,
      footprint: 1,
      sourceLabel: creature.isoDate,
      sizeScale: slot.sizeScale,
    });
  });

  const newest = kingdom.creatures[0] ?? null;
  return {
    id: 'kingdom',
    dayId: 'kingdom',
    baseId: 'base_env3',
    isoDate: newest?.isoDate ?? '',
    name: 'Your Kingdom',
    // 'calm' = the grass ground theme — matches the expansion/plot patches so
    // the whole Kingdom reads as one continuous lawn ('meaningful' floored the
    // main island in stone).
    primaryArchetype: 'calm',
    secondaryArchetype: null,
    creatureId: newest?.creatureId ?? null,
    creatureVisualKey: newest?.visualKey ?? null,
    creatureName: newest?.name ?? null,
    size: 4,
    tiles: groundTiles(4),
    objects,
    memoryNodes: [],
    rarity: 'common',
    gridCol: 0,
    gridRow: 0,
    connectorSides: [],
  };
}
