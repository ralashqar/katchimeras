import type { StoryTileDefinition } from './registry';

/**
 * The Lost Trail (`docs/cozy-4x-ftue-the-last-clearing.md`, beats 11 to 14): the old path that went all the way to the
 * sea, half swallowed by the Mist at the clearing's edge. Small footprints lead in and none come out; Steppling is
 * lost inside. The first session finds its tracks; the Lost Trail's levels (step 5) clear it and bring Steppling home.
 */
export const LOST_TRAIL: StoryTileDefinition = {
  id: 'lost-trail',
  coord: { q: -2, r: 2 },
  unlockId: 'steppling:lost-trail',
  name: 'The Lost Trail',
  companion: 'steppling',
  revealPreset: 'mist-clear',
  alphaBoundsKey: 'shared_world_lost_trail_hex_tile_v1.webp',
  mistedAlphaBoundsKey: 'shared_world_lost_trail_tracks_hex_tile_v1.webp',
  lostSkinId: 'steppling',
  lines: {
    reveal: 'That path used to go all the way to the sea.',
  },
};
