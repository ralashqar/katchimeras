import type { ImageSourcePropType } from 'react-native';
import { natureIslandArt } from '@/components/katchadeck/world/mossprout-hex-neighborhood-scene';
import { LANTERN_LEVEL_ART } from '@/constants/wisp-lantern-art';
import type { MossproutNatureIslandId } from '@/types/merge-world';
import { KINGDOM_DREAM_MIST_LOCKED_HEX_TILE_V1, havenHexTileSpec, kingdomHexTileSourceForLod } from '@/utils/world-visuals';

/**
 * The picture of a tile at a level, for the upgrade panel's hero frame and
 * level slots: the same art the world draws, at its smallest size. A subject
 * with no art of its own (a mist tile) returns null and the panel shows a glyph.
 */
export function tileLevelArt(offerId: string, level: number, misted = false): ImageSourcePropType | null {
  // Clearing the mist must not show what is under it.
  if (misted) return KINGDOM_DREAM_MIST_LOCKED_HEX_TILE_V1;
  const split = offerId.indexOf(':');
  const [kind, id] = [offerId.slice(0, split), offerId.slice(split + 1)];
  if (kind === 'haven') {
    const spec = havenHexTileSpec(id, level);
    return spec ? kingdomHexTileSourceForLod(spec, 'thumb') : null;
  }
  if (kind === 'nature') {
    const art = natureIslandArt(id as MossproutNatureIslandId);
    const levelSources = art.levelArt?.[level as 1 | 2 | 3 | 4]?.sources;
    return (levelSources?.thumb ?? art.sources.thumb ?? art.sources.medium ?? art.sources.full) as ImageSourcePropType;
  }
  return null;
}

export function lanternLevelArt(level: number): ImageSourcePropType | null {
  return (LANTERN_LEVEL_ART as Record<number, ImageSourcePropType>)[level] ?? null;
}
