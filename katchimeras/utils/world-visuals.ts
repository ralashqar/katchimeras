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
  fence_strip: require('../assets/images/katchimeras/world/props/fence_strip.webp'),
  prop_coffee_table: require('../assets/images/katchimeras/world/props/prop_coffee_table.png'),
  // Seed-object reward (Daily Seeds, Today Patch V2).
  seed_water_lily: require('../assets/images/katchimeras/world/props/seed_water_lily.png'),
  // Sleep Atmosphere tile — graphic varies by how the day began.
  sleep_good: require('../assets/images/katchimeras/world/props/sleep_good.webp'),
  sleep_normal: require('../assets/images/katchimeras/world/props/sleep_normal.png'),
  sleep_low: require('../assets/images/katchimeras/world/props/sleep_low.png'),
  // Food Vault tile — a little food stall; grows as food memories are saved.
  food_stall: require('../assets/images/katchimeras/world/props/food_stall.webp'),
  // Discovery artefacts — permanent monuments unlocked by life milestones (cozy
  // collectible re-skin; --ref base_env2, auto-split 4×4).
  artefact_museum_banner: require('../assets/images/katchimeras/world/objects/artefact/artefact_01.png'),
  artefact_voice_crystal: require('../assets/images/katchimeras/world/objects/artefact/artefact_02.png'),
  artefact_festival_tree: require('../assets/images/katchimeras/world/objects/artefact/artefact_03.png'),
  artefact_golden_arch: require('../assets/images/katchimeras/world/objects/artefact/artefact_04.png'),
  artefact_life_monument: require('../assets/images/katchimeras/world/objects/artefact/artefact_05.png'),
  artefact_journey_monument: require('../assets/images/katchimeras/world/objects/artefact/artefact_06.png'),
  artefact_trail_bridge: require('../assets/images/katchimeras/world/objects/artefact/artefact_07.png'),
  artefact_memory_lantern: require('../assets/images/katchimeras/world/objects/artefact/artefact_08.png'),
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
  // Big Moment landmarks (Today Patch V3) — legacy, superseded by milestone_* below.
  landmark_festival: require('../assets/images/katchimeras/world/props/landmark_festival.png'),
  landmark_arch: require('../assets/images/katchimeras/world/props/landmark_arch.png'),
  landmark_gate: require('../assets/images/katchimeras/world/props/landmark_gate.png'),
  // Big Moment MILESTONES — cozy collectible celebratory monuments (one per type).
  milestone_birthday: require('../assets/images/katchimeras/world/objects/milestone/milestone_01.png'), // 🎂 cake
  milestone_anniversary: require('../assets/images/katchimeras/world/objects/milestone/milestone_02.png'), // 💍 heart + rings
  milestone_firsttime: require('../assets/images/katchimeras/world/objects/milestone/milestone_03.png'), // ⭐ gold star
  milestone_holiday: require('../assets/images/katchimeras/world/objects/milestone/milestone_04.png'), // 🎄 festive tree
  milestone_trip: require('../assets/images/katchimeras/world/objects/milestone/milestone_05.png'), // 🧳 suitcase + signpost
  milestone_achievement: require('../assets/images/katchimeras/world/objects/milestone/milestone_06.png'), // 🏆 trophy
  milestone_monument: require('../assets/images/katchimeras/world/objects/milestone/milestone_07.png'), // 🗿 standing stone
  // Restyled level sets (scripts/generate-world-object-grid.py, --mode progression).
  // Image-memories: photo display growing into a full photo tree (1→4).
  memory_photos_1: require('../assets/images/katchimeras/world/objects/memory_photos/memory_photos_01.png'),
  memory_photos_2: require('../assets/images/katchimeras/world/objects/memory_photos/memory_photos_02.webp'),
  memory_photos_3: require('../assets/images/katchimeras/world/objects/memory_photos/memory_photos_03.webp'),
  memory_photos_4: require('../assets/images/katchimeras/world/objects/memory_photos/memory_photos_04.webp'),
  // Locations: waypoint marker growing signpost → tall signpost → tower → lookout (1→4).
  place_marker_1: require('../assets/images/katchimeras/world/objects/place_marker/place_marker_01.png'),
  place_marker_2: require('../assets/images/katchimeras/world/objects/place_marker/place_marker_02.png'),
  place_marker_3: require('../assets/images/katchimeras/world/objects/place_marker/place_marker_03.webp'),
  place_marker_4: require('../assets/images/katchimeras/world/objects/place_marker/place_marker_04.webp'),
  // Journey/steps: trail marker → signpost → footbridge → journey monument (1→4).
  journey_1: require('../assets/images/katchimeras/world/objects/journey_marker/journey_marker_01.png'),
  journey_2: require('../assets/images/katchimeras/world/objects/journey_marker/journey_marker_02.webp'),
  journey_3: require('../assets/images/katchimeras/world/objects/journey_marker/journey_marker_03.webp'),
  journey_4: require('../assets/images/katchimeras/world/objects/journey_marker/journey_marker_04.webp'),
  // Notes: open diary → journal+quill → writing desk → writing-desk shrine (1→4).
  notes_1: require('../assets/images/katchimeras/world/objects/notes_desk/notes_desk_01.webp'),
  notes_2: require('../assets/images/katchimeras/world/objects/notes_desk/notes_desk_02.webp'),
  notes_3: require('../assets/images/katchimeras/world/objects/notes_desk/notes_desk_03.webp'),
  notes_4: require('../assets/images/katchimeras/world/objects/notes_desk/notes_desk_04.webp'),
  // Food: a cozy market food stall (square scene tile).
  food_market: require('../assets/images/katchimeras/world/objects/food_market/food_market_02.webp'),
  // Studio: the inspiration archive — a library/easel nook; tapping opens the reader.
  studio_shelf: require('../assets/images/katchimeras/world/objects/studio_shelf/studio_shelf_01.webp'),
  // Town Hall: keeps the day's story; tapping it opens the Chronicle reader.
  // User-supplied house cottage (BiRefNet-matted + tight-framed from world/house.png).
  town_hall: require('../assets/images/katchimeras/world/objects/town_hall_house/town_hall_house_01.webp'),
  // Quest Board: today's notice board; tapping it opens the day's Memory Quests.
  quest_board: require('../assets/images/katchimeras/world/objects/quest_board/quest_board_01.png'),

  // --- Kingdom keepsakes (K5 wave 2 — earned decorations, kingdom-decor.ts) ---
  trail_stone: require('../assets/images/katchimeras/world/objects/trail_stones/trail_stone_pick.png'), // 👣 journeys
  picnic_basket: require('../assets/images/katchimeras/world/objects/picnic_set/picnic_basket_pick.png'), // 🍽 food days
  book_stack: require('../assets/images/katchimeras/world/objects/keepsake_set/book_stack_pick.png'), // 📚 inspirations
  festival_bunting: require('../assets/images/katchimeras/world/objects/festival_set/festival_bunting_pick.png'), // 🎉 big moments
  gift_crate: require('../assets/images/katchimeras/world/objects/gift_crate/gift_crate_pick.png'), // 🎁 keepsakes waiting
  monument_stone: require('../assets/images/katchimeras/world/objects/monument_shard/monument_stone_pick.png'), // epic discovery
  monument_shard: require('../assets/images/katchimeras/world/objects/monument_shard/monument_shard_pick.png'), // legendary discovery

  // --- Cozy Collectible buildings (docs/world-structures-cozy-direction.md) ---
  // The 7 domains in one designer-toy style, on the new base_env2 island.
  home: require('../assets/images/katchimeras/world/objects/home/home_01.webp'), // 🏠 the day's story (chronicle)
  memory_vault: require('../assets/images/katchimeras/world/objects/memory_vault/memory_vault_01.png'), // 📸 owns all captured media
  memory_vault_empty: require('../assets/images/katchimeras/world/objects/memory_vault/memory_vault_01.png'),
  // Memory Vault GROWS 1→4 (same identity, richer): small safe → grand multi-tier vault.
  memory_vault_1: require('../assets/images/katchimeras/world/objects/memory_vault/memory_vault_01.png'),
  memory_vault_2: require('../assets/images/katchimeras/world/objects/memory_vault/memory_vault_02.webp'),
  memory_vault_3: require('../assets/images/katchimeras/world/objects/memory_vault/memory_vault_03.webp'),
  memory_vault_4: require('../assets/images/katchimeras/world/objects/memory_vault/memory_vault_04.webp'),
  crossroads: require('../assets/images/katchimeras/world/objects/crossroads/crossroads_01.png'), // 🗺 where did I go? (cozy signpost + lantern)
  journey_hall: require('../assets/images/katchimeras/world/objects/journey_hall/journey_hall_01.png'), // 🛤 how did I move? (cozy footprint stele)
  // 🔭 Observatory tower (Places / where I went) — a proper structure with a telescope.
  observatory: require('../assets/images/katchimeras/world/objects/observatory/observatory_01.png'),
  observatory_empty: require('../assets/images/katchimeras/world/objects/observatory/observatory_01.png'),
  // 👣 Steps path (Journey / how I moved) — a small engraved stepping-stone trail that
  // GROWS its stone count by level (3 → 5 → 7 → winding path).
  steps_path_1: require('../assets/images/katchimeras/world/objects/steps_path/steps_path_01.webp'),
  steps_path_2: require('../assets/images/katchimeras/world/objects/steps_path/steps_path_02.webp'),
  steps_path_3: require('../assets/images/katchimeras/world/objects/steps_path/steps_path_03.webp'),
  steps_path_4: require('../assets/images/katchimeras/world/objects/steps_path/steps_path_04.webp'),
  sanctuary: require('../assets/images/katchimeras/world/objects/sanctuary/sanctuary_01.png'), // 🌿 how today felt (mood)
  sanctuary_empty: require('../assets/images/katchimeras/world/objects/sanctuary/sanctuary_01.png'),
  study: require('../assets/images/katchimeras/world/objects/study/study_01.png'), // 📚 what inspired me
  food_pavilion: require('../assets/images/katchimeras/world/objects/food_pavilion/food_pavilion_01.png'), // 🍽 what I savoured
  // Memory cluster satellites + the Featured Memory Board (the day's cover).
  featured_board: require('../assets/images/katchimeras/world/objects/featured_board/featured_board_01.png'),
  photos_stack: require('../assets/images/katchimeras/world/objects/photos_stack/photos_stack_01.png'),
  notes_stack: require('../assets/images/katchimeras/world/objects/notes_stack/notes_stack_01.png'),
  // 😴 Sleep nook (Sanctuary satellite) — how the day began; cozy bed + moon by quality.
  sleep_nook_empty: require('../assets/images/katchimeras/world/objects/sleep_nook/sleep_nook_empty.png'),
  sleep_nook_good: require('../assets/images/katchimeras/world/objects/sleep_nook/sleep_nook_01.png'),
  sleep_nook_normal: require('../assets/images/katchimeras/world/objects/sleep_nook/sleep_nook_11.png'),
  sleep_nook_low: require('../assets/images/katchimeras/world/objects/sleep_nook/sleep_nook_04.png'),
  // Mood Monument states: one generated structure family with consistent frame
  // and state-specific face/emblem panels.
  mood_monument_empty: require('../assets/images/katchimeras/world/objects/mood_monument/mood_monument_empty.png'),
  mood_monument_radiant: require('../assets/images/katchimeras/world/objects/mood_monument/mood_monument_radiant.png'),
  mood_monument_light: require('../assets/images/katchimeras/world/objects/mood_monument/mood_monument_light.png'),
  mood_monument_meh: require('../assets/images/katchimeras/world/objects/mood_monument/mood_monument_meh.png'),
  mood_monument_heavy: require('../assets/images/katchimeras/world/objects/mood_monument/mood_monument_heavy.png'),
  mood_monument_stormy: require('../assets/images/katchimeras/world/objects/mood_monument/mood_monument_stormy.png'),

  // Decorate-your-day plant palette (earned blooms, planted freely on the patch).
  // 16-prop decoration set (trees incl. cone pine, shrubs, flowers, crates, barrel,
  // lantern, signpost, boulder, mushrooms, hay bale) — planted freely in Decorate mode.
  decor_1: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_01.png'), // cone pine
  decor_2: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_02.png'), // oak
  decor_3: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_03.png'), // blossom tree
  decor_4: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_04.png'), // birch
  decor_5: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_05.png'), // shrub
  decor_6: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_06.png'), // fern
  decor_7: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_07.png'), // wildflowers
  decor_8: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_08.png'), // potted plant
  decor_9: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_09.png'), // crate
  decor_10: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_10.png'), // crate stack
  decor_11: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_11.png'), // barrel
  decor_12: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_12.png'), // lantern post
  decor_13: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_13.png'), // signpost
  decor_14: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_14.png'), // boulder
  decor_15: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_15.png'), // mushrooms
  decor_16: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_16.png'), // hay bale
  // Sleep atmosphere by quality: sundial garden (good) · stone lantern (normal) · moon (low).
  sleep_tile_good: require('../assets/images/katchimeras/world/objects/sleep_tile/sleep_tile_01.webp'),
  sleep_tile_normal: require('../assets/images/katchimeras/world/objects/sleep_tile/sleep_tile_02.webp'),
  sleep_tile_low: require('../assets/images/katchimeras/world/objects/sleep_tile/sleep_tile_03.webp'),
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
export const DECAL_ATLAS: ImageSourcePropType = require('../assets/images/katchimeras/world/decals/_atlas.webp');
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

// Large isometric ground-island BASES (Phase 0 of the iso-graphics redesign): the
// whole patch ground is ONE image, and POI objects get planted on top via the
// normalised anchors in utils/world-base-layout.ts. Produced by
// scripts/generate-world-base.py (generate → matte → alpha verify).
const WORLD_BASE_SOURCES: Record<string, ImageSourcePropType> = {
  base_meadow: require('../assets/images/katchimeras/world/base/base_meadow.webp'), // original (kept as backup)
  base_env2: require('../assets/images/katchimeras/world/base/base_env2.webp'), // cozy island (kept as backup)
  // Kingdom iso set: diamond islands aligned to the isometric axes, cream paths
  // along both iso diagonals (docs/kingdom-world-design.md §2).
  base_env3: require('../assets/images/katchimeras/world/base/base_env3.webp'), // Kingdom centre island (current)
  plot_base_1: require('../assets/images/katchimeras/world/base/plot_base_1.webp'), // expansion islet A
  plot_base_2: require('../assets/images/katchimeras/world/base/plot_base_2.webp'), // expansion islet B
};

export function worldBaseSource(baseId: string): ImageSourcePropType | null {
  return WORLD_BASE_SOURCES[baseId] ?? null;
}

// Egg pedestal variants (scripts/generate-world-object-grid.py splits a 4×4 grid
// into objects/egg_pedestal/egg_pedestal_NN.png). The egg/creature is layered ON
// TOP of this; the default sits under the egg at the base-tile centre. Only the
// default is bundled for now; add more keys here to offer them as drag/customise
// variants later.
const EGG_PEDESTAL_SOURCES: Record<string, ImageSourcePropType> = {
  egg_pedestal_01: require('../assets/images/katchimeras/world/objects/egg_pedestal/egg_pedestal_01.png'),
};
export const DEFAULT_EGG_PEDESTAL = 'egg_pedestal_01';
export function eggPedestalSource(id: string = DEFAULT_EGG_PEDESTAL): ImageSourcePropType | null {
  return EGG_PEDESTAL_SOURCES[id] ?? null;
}
