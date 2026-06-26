import type { ImageSourcePropType } from 'react-native';

import { homeCreatureVisuals } from '@/constants/home-mvp';
import type { HomeVisualKey } from '@/types/home';

// Bundled world cutouts produced by the generate → matte → verify pipeline
// (scripts/generate-world-assets.py). Keys match the assetKeys the patch engine
// emits (constants/world.ts). Any key missing here falls back to a themed
// placeholder in the renderer, so the world stays playable if art is incomplete.
const WORLD_OBJECT_SOURCES: Record<string, ImageSourcePropType> = {
  // Anchors — Calm
  calm_pond: require('../assets/images/katchimeras/world/anchors/calm_pond.png'),
  calm_tree: require('../assets/images/katchimeras/world/anchors/calm_tree.png'),
  calm_flower_grove: require('../assets/images/katchimeras/world/anchors/calm_flower_grove.png'),
  // Anchors — Active
  active_trail_marker: require('../assets/images/katchimeras/world/anchors/active_trail_marker.png'),
  active_bridge: require('../assets/images/katchimeras/world/anchors/active_bridge.png'),
  active_windmill: require('../assets/images/katchimeras/world/anchors/active_windmill.png'),
  // Anchors — Social
  social_campfire: require('../assets/images/katchimeras/world/anchors/social_campfire.png'),
  social_plaza: require('../assets/images/katchimeras/world/anchors/social_plaza.png'),
  social_picnic_table: require('../assets/images/katchimeras/world/anchors/social_picnic_table.png'),
  // Anchors — Exploration
  exploration_tower: require('../assets/images/katchimeras/world/anchors/exploration_tower.png'),
  exploration_signpost: require('../assets/images/katchimeras/world/anchors/exploration_signpost.png'),
  exploration_lookout: require('../assets/images/katchimeras/world/anchors/exploration_lookout.png'),
  // Anchors — Focus
  focus_cafe: require('../assets/images/katchimeras/world/anchors/focus_cafe.png'),
  focus_workshop: require('../assets/images/katchimeras/world/anchors/focus_workshop.png'),
  focus_library: require('../assets/images/katchimeras/world/anchors/focus_library.png'),
  // Anchors — Meaningful
  meaningful_shrine: require('../assets/images/katchimeras/world/anchors/meaningful_shrine.png'),
  meaningful_crystal: require('../assets/images/katchimeras/world/anchors/meaningful_crystal.png'),
  meaningful_ancient_tree: require('../assets/images/katchimeras/world/anchors/meaningful_ancient_tree.png'),
  // Props
  prop_flower: require('../assets/images/katchimeras/world/props/prop_flower.png'),
  prop_bush: require('../assets/images/katchimeras/world/props/prop_bush.png'),
  prop_bench: require('../assets/images/katchimeras/world/props/prop_bench.png'),
  prop_lantern: require('../assets/images/katchimeras/world/props/prop_lantern.png'),
  prop_rock: require('../assets/images/katchimeras/world/props/prop_rock.png'),
  prop_log: require('../assets/images/katchimeras/world/props/prop_log.png'),
  prop_fence: require('../assets/images/katchimeras/world/props/prop_fence.png'),
  // Front-facing fence strip; the renderer skews it onto each 2:1 perimeter edge.
  fence_strip: require('../assets/images/katchimeras/world/props/fence_strip.png'),
  prop_coffee_table: require('../assets/images/katchimeras/world/props/prop_coffee_table.png'),
  // Seed-object reward (Daily Seeds, Today Patch V2).
  seed_water_lily: require('../assets/images/katchimeras/world/props/seed_water_lily.png'),
  // Sleep Atmosphere tile — graphic varies by how the day began.
  sleep_good: require('../assets/images/katchimeras/world/props/sleep_good.png'),
  sleep_normal: require('../assets/images/katchimeras/world/props/sleep_normal.png'),
  sleep_low: require('../assets/images/katchimeras/world/props/sleep_low.png'),
  // Food Vault tile — a little food stall; grows as food memories are saved.
  food_stall: require('../assets/images/katchimeras/world/props/food_stall.png'),
  // Discovery artefacts — permanent monuments unlocked by life milestones.
  artefact_museum_banner: require('../assets/images/katchimeras/world/props/artefact_museum_banner.png'),
  artefact_voice_crystal: require('../assets/images/katchimeras/world/props/artefact_voice_crystal.png'),
  artefact_festival_tree: require('../assets/images/katchimeras/world/props/artefact_festival_tree.png'),
  artefact_golden_arch: require('../assets/images/katchimeras/world/props/artefact_golden_arch.png'),
  artefact_life_monument: require('../assets/images/katchimeras/world/props/artefact_life_monument.png'),
  artefact_journey_monument: require('../assets/images/katchimeras/world/props/artefact_journey_monument.png'),
  artefact_trail_bridge: require('../assets/images/katchimeras/world/props/artefact_trail_bridge.png'),
  artefact_memory_lantern: require('../assets/images/katchimeras/world/props/artefact_memory_lantern.png'),
  // Memory Vault chest stages (Diorama Time Capsule).
  vault_chest_small: require('../assets/images/katchimeras/world/props/vault_chest_small.png'),
  vault_chest: require('../assets/images/katchimeras/world/props/vault_chest.png'),
  vault_chest_treasure: require('../assets/images/katchimeras/world/props/vault_chest_treasure.png'),
  vault_crystal_archive: require('../assets/images/katchimeras/world/props/vault_crystal_archive.png'),
  vault_notes_chest: require('../assets/images/katchimeras/world/props/vault_notes_chest.png'),
  // Photos object — a cozy "memory tree" hung with glowing framed photos (levels).
  memory_tree_1: require('../assets/images/katchimeras/world/props/memory_tree_1.png'),
  memory_tree_2: require('../assets/images/katchimeras/world/props/memory_tree_2.png'),
  memory_tree_3: require('../assets/images/katchimeras/world/props/memory_tree_3.png'),
  memory_tree_4: require('../assets/images/katchimeras/world/props/memory_tree_4.png'),
  // Notes object — a journaling family growing into a little writing-desk shrine.
  notes_journal_1: require('../assets/images/katchimeras/world/props/notes_journal_1.png'),
  notes_journal_2: require('../assets/images/katchimeras/world/props/notes_journal_2.png'),
  notes_journal_3: require('../assets/images/katchimeras/world/props/notes_journal_3.png'),
  notes_journal_4: require('../assets/images/katchimeras/world/props/notes_journal_4.png'),
  // Big Moment landmarks (Today Patch V3).
  landmark_festival: require('../assets/images/katchimeras/world/props/landmark_festival.png'),
  landmark_arch: require('../assets/images/katchimeras/world/props/landmark_arch.png'),
  landmark_gate: require('../assets/images/katchimeras/world/props/landmark_gate.png'),
  // Memory nodes
  memory_photo_bloom: require('../assets/images/katchimeras/world/memory-nodes/memory_photo_bloom.png'),
  memory_landmark_stone: require('../assets/images/katchimeras/world/memory-nodes/memory_landmark_stone.png'),
  memory_monument: require('../assets/images/katchimeras/world/memory-nodes/memory_monument.png'),
  memory_crystal: require('../assets/images/katchimeras/world/memory-nodes/memory_crystal.png'),
  memory_lantern_shrine: require('../assets/images/katchimeras/world/memory-nodes/memory_lantern_shrine.png'),
};

// Flat ground decals are packed into ONE sprite atlas (scripts/build-decal-atlas.py)
// so the GPU uploads a single texture instead of 16. The renderer shows each
// decal as a clipped sub-region using its cell coords below. Two variants per
// type (suffix _2) come free from the 4×4 grid generation, so the ground reads
// less repetitively. Cell coords MUST match the atlas builder's LAYOUT.
export const DECAL_ATLAS: ImageSourcePropType = require('../assets/images/katchimeras/world/decals/_atlas.png');
export const DECAL_ATLAS_COLS = 4;
export const DECAL_ATLAS_ROWS = 4;

const DECAL_ATLAS_CELLS: Record<string, { col: number; row: number }> = {
  grass: { col: 0, row: 0 }, flowers: { col: 1, row: 0 }, moss: { col: 2, row: 0 }, path: { col: 3, row: 0 },
  cobble: { col: 0, row: 1 }, rock: { col: 1, row: 1 }, wood: { col: 2, row: 1 }, glow: { col: 3, row: 1 },
  grass_2: { col: 0, row: 2 }, flowers_2: { col: 1, row: 2 }, moss_2: { col: 2, row: 2 }, path_2: { col: 3, row: 2 },
  cobble_2: { col: 0, row: 3 }, rock_2: { col: 1, row: 3 }, wood_2: { col: 2, row: 3 }, glow_2: { col: 3, row: 3 },
};

export function worldDecalCell(decal: string): { col: number; row: number } | null {
  return DECAL_ATLAS_CELLS[decal] ?? null;
}

const CREATURE_PREFIX = 'creature:';

// Resolve an object's assetKey to a bundled image, or null when there is no art
// (the caller draws a placeholder). Creatures reuse the existing cutouts.
export function worldAssetSource(assetKey: string): ImageSourcePropType | null {
  if (assetKey.startsWith(CREATURE_PREFIX)) {
    const key = assetKey.slice(CREATURE_PREFIX.length) as HomeVisualKey;
    return homeCreatureVisuals[key]?.source ?? null;
  }
  return WORLD_OBJECT_SOURCES[assetKey] ?? null;
}
