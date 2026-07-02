import type { KingdomBuilding, KingdomBuildingId, KingdomState } from '@/types/kingdom';
import type { WorldObject, WorldObjectCategory, WorldPatch, WorldTile } from '@/types/world';
import { WORLD_STRUCTURE_POSITIONS, resolveStructureScale } from '@/utils/world-structures';

// deriveKingdomPatch — maps the derived KingdomState onto the existing
// WorldPatch/WorldObject render model, so the Kingdom scene reuses WorldCanvas
// (camera, taps, badges, layout tuning) unchanged. Purely presentational
// derivation: buildings at lifetime levels + the creature roster. Landmarks and
// decorations join when the scene work lands their placement model.

// Which render category each Kingdom building maps to — categories drive
// position + scale lookups in the world layout, and tap routing in the scene.
const BUILDING_CATEGORY: Record<KingdomBuildingId, WorldObjectCategory> = {
  home: 'chronicle',
  memoryLibrary: 'memory',
  crossroads: 'places',
  journeyHall: 'journey',
  sanctuary: 'reflection',
  study: 'studio',
  foodPavilion: 'food',
};

// Existing art, reused at Kingdom scale: leveled sets where they exist
// (Memory Vault, Journey), one iconic building + badge otherwise. The cozy
// re-skins swap in here when their assets land.
function buildingAssetKey(building: KingdomBuilding): string {
  switch (building.id) {
    case 'memoryLibrary':
      return building.level === 0 ? 'memory_vault_empty' : `memory_vault_${building.level}`;
    case 'journeyHall':
      return `steps_path_${Math.max(1, building.level)}`;
    case 'crossroads':
      return building.level === 0 ? 'observatory_empty' : 'observatory';
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

export function deriveKingdomPatch(kingdom: KingdomState): WorldPatch {
  const objects: WorldObject[] = [];

  for (const building of kingdom.buildings) {
    const category = BUILDING_CATEGORY[building.id];
    const pos = WORLD_STRUCTURE_POSITIONS[category];
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
    isoDate: newest?.isoDate ?? '',
    name: 'Your Kingdom',
    primaryArchetype: 'meaningful',
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
