import type { ImageSourcePropType } from 'react-native';

export const WORLD_TILE_ATLAS_SIZE = 2048;
export const WORLD_TILE_ATLAS_COLUMNS = 4;
export const WORLD_TILE_ATLAS_ROWS = 4;
export const WORLD_TILE_ATLAS_CELL_SIZE = 512;
export const WORLD_TILE_ATLAS_GUTTER = 4;
export const WORLD_TILE_ATLAS_INNER_SIZE =
  WORLD_TILE_ATLAS_CELL_SIZE - WORLD_TILE_ATLAS_GUTTER * 2;
export const WORLD_TILE_ATLAS_PAGE_CAPACITY =
  WORLD_TILE_ATLAS_COLUMNS * WORLD_TILE_ATLAS_ROWS;
export const WORLD_TILE_ATLAS_MAX_PAGES = 2;
export const WORLD_TILE_ATLAS_MAX_ENTRIES =
  WORLD_TILE_ATLAS_PAGE_CAPACITY * WORLD_TILE_ATLAS_MAX_PAGES;

export type WorldTileAtlasDescriptor = {
  fallbackSource?: ImageSourcePropType | null;
  id: string;
  source: ImageSourcePropType;
};

export type PackedWorldTileAtlasEntry = {
  column: number;
  descriptor: WorldTileAtlasDescriptor;
  pageIndex: number;
  row: number;
  sourceKey: string;
  x: number;
  y: number;
};

export type WorldTileAtlasPacking = {
  entries: PackedWorldTileAtlasEntry[];
  overflow: WorldTileAtlasDescriptor[];
  pageCount: number;
  signature: string;
};

export function worldTileImageSourceKey(source: ImageSourcePropType): string {
  if (typeof source === 'number') return `module:${source}`;
  try {
    return `source:${JSON.stringify(source)}`;
  } catch {
    return `source:${String(source)}`;
  }
}

/**
 * Packs unique medium-LOD tile textures in stable first-seen order. Multiple
 * residents can share one bitmap without consuming another atlas cell.
 */
export function packWorldTileAtlasDescriptors(
  descriptors: readonly WorldTileAtlasDescriptor[],
): WorldTileAtlasPacking {
  const unique = new Map<string, WorldTileAtlasDescriptor>();
  for (const descriptor of descriptors) {
    const sourceKey = worldTileImageSourceKey(descriptor.source);
    if (!unique.has(sourceKey)) unique.set(sourceKey, descriptor);
  }

  const packedDescriptors = [...unique.entries()].slice(0, WORLD_TILE_ATLAS_MAX_ENTRIES);
  const overflow = [...unique.entries()]
    .slice(WORLD_TILE_ATLAS_MAX_ENTRIES)
    .map(([, descriptor]) => descriptor);
  const entries = packedDescriptors.map(([sourceKey, descriptor], index) => {
    const pageIndex = Math.floor(index / WORLD_TILE_ATLAS_PAGE_CAPACITY);
    const pageCellIndex = index % WORLD_TILE_ATLAS_PAGE_CAPACITY;
    const column = pageCellIndex % WORLD_TILE_ATLAS_COLUMNS;
    const row = Math.floor(pageCellIndex / WORLD_TILE_ATLAS_COLUMNS);
    return {
      column,
      descriptor,
      pageIndex,
      row,
      sourceKey,
      x: column * WORLD_TILE_ATLAS_CELL_SIZE + WORLD_TILE_ATLAS_GUTTER,
      y: row * WORLD_TILE_ATLAS_CELL_SIZE + WORLD_TILE_ATLAS_GUTTER,
    };
  });
  const signature = [...unique.entries()]
    .map(([sourceKey, descriptor]) => (
      `${descriptor.id}:${sourceKey}:${descriptor.fallbackSource ? worldTileImageSourceKey(descriptor.fallbackSource) : ''}`
    ))
    .join('|');

  return {
    entries,
    overflow,
    pageCount: entries.length === 0
      ? 0
      : Math.ceil(entries.length / WORLD_TILE_ATLAS_PAGE_CAPACITY),
    signature,
  };
}
