import { MOSSPROUT_LAYOUT } from './mossprout-layout';
/** Optional art preset extracted from the Mossprout neighborhood. No game policy. */
export const MOSSPROUT_PRESET = {
  layout: MOSSPROUT_LAYOUT.layout,
  home: { ...MOSSPROUT_LAYOUT.home, source: require('@incubator/art-world/hex/mossprout_focused_v1_main_hex_tile_512.webp') },
  garden: { ...MOSSPROUT_LAYOUT.garden, levels: [
    require('@incubator/art-world/hex/mossprout_memory_garden_level_0_512.webp'),
    require('@incubator/art-world/hex/mossprout_memory_garden_level_1_512.webp'),
    require('@incubator/art-world/hex/mossprout_memory_garden_level_2_512.webp'),
  ] },
  gate: MOSSPROUT_LAYOUT.gate,
  mist: require('@incubator/art-world/hex/dream_mist_locked_hex_tile_v4_512.webp'),
} as const;
