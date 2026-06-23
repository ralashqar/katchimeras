import type { ImageSourcePropType } from 'react-native';

import { homeCreatureVisuals } from '@/constants/home-mvp';
import type { HomeVisualKey } from '@/types/home';

// Bundled world cutouts (generate → matte → verify pipeline). Only the spike
// anchors exist so far; every other catalog key falls back to a themed
// placeholder in the renderer, so the world is fully playable before the art is.
const WORLD_OBJECT_SOURCES: Record<string, ImageSourcePropType> = {
  calm_pond: require('../assets/images/katchimeras/world/anchors/calm_pond.png'),
  social_campfire: require('../assets/images/katchimeras/world/anchors/social_campfire.png'),
  focus_cafe: require('../assets/images/katchimeras/world/anchors/focus_cafe.png'),
};

const CREATURE_PREFIX = 'creature:';

// Resolve an object's assetKey to a bundled image, or null when there is no art
// yet (the caller draws a placeholder). Creatures reuse the existing cutouts.
export function worldAssetSource(assetKey: string): ImageSourcePropType | null {
  if (assetKey.startsWith(CREATURE_PREFIX)) {
    const key = assetKey.slice(CREATURE_PREFIX.length) as HomeVisualKey;
    return homeCreatureVisuals[key]?.source ?? null;
  }
  return WORLD_OBJECT_SOURCES[assetKey] ?? null;
}
