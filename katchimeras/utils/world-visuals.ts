import type { ImageSourcePropType } from 'react-native';

import { CREATURE_LOD_SOURCES } from '@/constants/creature-lod-sources.gen';
import { homeCreatureVisuals } from '@/constants/home-mvp';
import { WORLD_OBJECT_LOD_SOURCES, type WorldObjectLod } from '@/constants/world-asset-lod-sources.gen';
import { PROMOTED_WORLD_SOURCES } from '@/constants/world-asset-sources.gen';
import { getDevAssetOverrideSource, getDevKingdomBaseId, getDevKingdomHexBaseTileId, getDevKingdomHexCenterTileId } from '@/utils/dev-asset-overrides';
import type { HomeVisualKey } from '@/types/home';

export type { WorldObjectLod };

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
  // B2 celebrations batch (2026-07) - milestone/calendar keepsake art + future-type pool.
  birthday_crown: require('../assets/images/katchimeras/world/objects/celebration/birthday_crown.webp'),
  cake_stand: require('../assets/images/katchimeras/world/objects/celebration/cake_stand.webp'),
  countdown_orb: require('../assets/images/katchimeras/world/objects/celebration/countdown_orb.webp'),
  desk_bell: require('../assets/images/katchimeras/world/objects/celebration/desk_bell.webp'),
  fireworks_fountain: require('../assets/images/katchimeras/world/objects/celebration/fireworks_fountain.webp'),
  garland_arch: require('../assets/images/katchimeras/world/objects/celebration/garland_arch.webp'),
  gift_stack: require('../assets/images/katchimeras/world/objects/celebration/gift_stack.webp'),
  harmony_wreath: require('../assets/images/katchimeras/world/objects/celebration/harmony_wreath.webp'),
  harvest_horn: require('../assets/images/katchimeras/world/objects/celebration/harvest_horn.webp'),
  housewarming_wreath: require('../assets/images/katchimeras/world/objects/celebration/housewarming_wreath.webp'),
  laurel_scroll: require('../assets/images/katchimeras/world/objects/celebration/laurel_scroll.webp'),
  light_string_pole: require('../assets/images/katchimeras/world/objects/celebration/light_string_pole.webp'),
  maypole: require('../assets/images/katchimeras/world/objects/celebration/maypole.webp'),
  reunion_table: require('../assets/images/katchimeras/world/objects/celebration/reunion_table.webp'),
  stork_lantern: require('../assets/images/katchimeras/world/objects/celebration/stork_lantern.webp'),
  vow_arbor: require('../assets/images/katchimeras/world/objects/celebration/vow_arbor.webp'),
  // B5 photo-subject + B9 body/rest/studio batches (2026-07).
  buskers_case: require('../assets/images/katchimeras/world/objects/photo/buskers_case.webp'),
  dusk_mirror: require('../assets/images/katchimeras/world/objects/photo/dusk_mirror.webp'),
  echo_shell: require('../assets/images/katchimeras/world/objects/photo/echo_shell.webp'),
  ember_ring: require('../assets/images/katchimeras/world/objects/photo/ember_ring.webp'),
  forest_heart: require('../assets/images/katchimeras/world/objects/photo/forest_heart.webp'),
  gathering_table: require('../assets/images/katchimeras/world/objects/photo/gathering_table.webp'),
  golden_frame: require('../assets/images/katchimeras/world/objects/photo/golden_frame.webp'),
  memory_prism: require('../assets/images/katchimeras/world/objects/photo/memory_prism.webp'),
  peak_banner: require('../assets/images/katchimeras/world/objects/photo/peak_banner.webp'),
  pet_pedestal: require('../assets/images/katchimeras/world/objects/photo/pet_pedestal.webp'),
  rainbow_arc: require('../assets/images/katchimeras/world/objects/photo/rainbow_arc.webp'),
  sea_glass: require('../assets/images/katchimeras/world/objects/photo/sea_glass.webp'),
  skyline_diorama: require('../assets/images/katchimeras/world/objects/photo/skyline_diorama.webp'),
  snow_globe: require('../assets/images/katchimeras/world/objects/photo/snow_globe.webp'),
  star_basin: require('../assets/images/katchimeras/world/objects/photo/star_basin.webp'),
  wheel_totem: require('../assets/images/katchimeras/world/objects/photo/wheel_totem.webp'),
  bound_volume: require('../assets/images/katchimeras/world/objects/body_studio/bound_volume.webp'),
  cairn_tower: require('../assets/images/katchimeras/world/objects/body_studio/cairn_tower.webp'),
  dawn_bell: require('../assets/images/katchimeras/world/objects/body_studio/dawn_bell.webp'),
  dream_bell: require('../assets/images/katchimeras/world/objects/body_studio/dream_bell.webp'),
  iron_boots: require('../assets/images/katchimeras/world/objects/body_studio/iron_boots.webp'),
  laurel_column: require('../assets/images/katchimeras/world/objects/body_studio/laurel_column.webp'),
  library_totem: require('../assets/images/katchimeras/world/objects/body_studio/library_totem.webp'),
  marquee_sign: require('../assets/images/katchimeras/world/objects/body_studio/marquee_sign.webp'),
  medal_display: require('../assets/images/katchimeras/world/objects/body_studio/medal_display.webp'),
  melody_chime: require('../assets/images/katchimeras/world/objects/body_studio/melody_chime.webp'),
  moonpetal_bed: require('../assets/images/katchimeras/world/objects/body_studio/moonpetal_bed.webp'),
  poseidon_buoy: require('../assets/images/katchimeras/world/objects/body_studio/poseidon_buoy.webp'),
  reel_lantern: require('../assets/images/katchimeras/world/objects/body_studio/reel_lantern.webp'),
  rest_hammock: require('../assets/images/katchimeras/world/objects/body_studio/rest_hammock.webp'),
  tea_service: require('../assets/images/katchimeras/world/objects/body_studio/tea_service.webp'),
  zen_fountain: require('../assets/images/katchimeras/world/objects/body_studio/zen_fountain.webp'),
  // B11 hero monuments batch (2026-07).
  aurora_column: require('../assets/images/katchimeras/world/objects/monuments/aurora_column.webp'),
  border_arch: require('../assets/images/katchimeras/world/objects/monuments/border_arch.webp'),
  century_pillar: require('../assets/images/katchimeras/world/objects/monuments/century_pillar.webp'),
  harmony_prism: require('../assets/images/katchimeras/world/objects/monuments/harmony_prism.webp'),
  leap_clock: require('../assets/images/katchimeras/world/objects/monuments/leap_clock.webp'),
  meridian_globe: require('../assets/images/katchimeras/world/objects/monuments/meridian_globe.webp'),
  mythic_perch: require('../assets/images/katchimeras/world/objects/monuments/mythic_perch.webp'),
  year_monument: require('../assets/images/katchimeras/world/objects/monuments/year_monument.webp'),
  // Grove merge upgrades — one denser cluster per bloom species (2026-07).
  grove_birch: require('../assets/images/katchimeras/world/objects/decor_plants/grove/birch.webp'),
  grove_bird_bath: require('../assets/images/katchimeras/world/objects/decor_plants/grove/bird_bath.webp'),
  grove_blossom: require('../assets/images/katchimeras/world/objects/decor_plants/grove/blossom.webp'),
  grove_butterfly_bush: require('../assets/images/katchimeras/world/objects/decor_plants/grove/butterfly_bush.webp'),
  grove_cattails: require('../assets/images/katchimeras/world/objects/decor_plants/grove/cattails.webp'),
  grove_fern: require('../assets/images/katchimeras/world/objects/decor_plants/grove/fern.webp'),
  grove_lavender: require('../assets/images/katchimeras/world/objects/decor_plants/grove/lavender.webp'),
  grove_mushrooms: require('../assets/images/katchimeras/world/objects/decor_plants/grove/mushrooms.webp'),
  grove_oak: require('../assets/images/katchimeras/world/objects/decor_plants/grove/oak.webp'),
  grove_pine: require('../assets/images/katchimeras/world/objects/decor_plants/grove/pine.webp'),
  grove_planter: require('../assets/images/katchimeras/world/objects/decor_plants/grove/planter.webp'),
  grove_pumpkin_patch: require('../assets/images/katchimeras/world/objects/decor_plants/grove/pumpkin_patch.webp'),
  grove_shrub: require('../assets/images/katchimeras/world/objects/decor_plants/grove/shrub.webp'),
  grove_snowdrops: require('../assets/images/katchimeras/world/objects/decor_plants/grove/snowdrops.webp'),
  grove_stone_lantern: require('../assets/images/katchimeras/world/objects/decor_plants/grove/stone_lantern.webp'),
  grove_wildflowers: require('../assets/images/katchimeras/world/objects/decor_plants/grove/wildflowers.webp'),
  // B7 food journey batch (2026-07).
  chefs_cloche: require('../assets/images/katchimeras/world/objects/food/chefs_cloche.webp'),
  cuisine_lantern_chinese: require('../assets/images/katchimeras/world/objects/food/cuisine_lantern_chinese.webp'),
  cuisine_lantern_french: require('../assets/images/katchimeras/world/objects/food/cuisine_lantern_french.webp'),
  cuisine_lantern_greek: require('../assets/images/katchimeras/world/objects/food/cuisine_lantern_greek.webp'),
  cuisine_lantern_indian: require('../assets/images/katchimeras/world/objects/food/cuisine_lantern_indian.webp'),
  cuisine_lantern_italian: require('../assets/images/katchimeras/world/objects/food/cuisine_lantern_italian.webp'),
  cuisine_lantern_japanese: require('../assets/images/katchimeras/world/objects/food/cuisine_lantern_japanese.webp'),
  cuisine_lantern_mexican: require('../assets/images/katchimeras/world/objects/food/cuisine_lantern_mexican.webp'),
  cuisine_lantern_middle_eastern: require('../assets/images/katchimeras/world/objects/food/cuisine_lantern_middle_eastern.webp'),
  grocers_stand: require('../assets/images/katchimeras/world/objects/food/grocers_stand.webp'),
  hearth_pot: require('../assets/images/katchimeras/world/objects/food/hearth_pot.webp'),
  orchard_crate: require('../assets/images/katchimeras/world/objects/food/orchard_crate.webp'),
  picnic_hamper: require('../assets/images/katchimeras/world/objects/food/picnic_hamper.webp'),
  spice_rack: require('../assets/images/katchimeras/world/objects/food/spice_rack.webp'),
  sugar_pagoda: require('../assets/images/katchimeras/world/objects/food/sugar_pagoda.webp'),
  teahouse_kettle: require('../assets/images/katchimeras/world/objects/food/teahouse_kettle.webp'),
  // B3 travel/tenure + B4 place-category batches (2026-07).
  camp_tent: require('../assets/images/katchimeras/world/objects/travel/camp_tent.webp'),
  chronicler_desk: require('../assets/images/katchimeras/world/objects/travel/chronicler_desk.webp'),
  city_key: require('../assets/images/katchimeras/world/objects/travel/city_key.webp'),
  founding_stone: require('../assets/images/katchimeras/world/objects/travel/founding_stone.webp'),
  hometown_plaque: require('../assets/images/katchimeras/world/objects/travel/hometown_plaque.webp'),
  journey_globe: require('../assets/images/katchimeras/world/objects/travel/journey_globe.webp'),
  map_table: require('../assets/images/katchimeras/world/objects/travel/map_table.webp'),
  milepost_50: require('../assets/images/katchimeras/world/objects/travel/milepost_50.webp'),
  month_ring: require('../assets/images/katchimeras/world/objects/travel/month_ring.webp'),
  pathfinder_post: require('../assets/images/katchimeras/world/objects/travel/pathfinder_post.webp'),
  pilgrim_stones: require('../assets/images/katchimeras/world/objects/travel/pilgrim_stones.webp'),
  striders_obelisk: require('../assets/images/katchimeras/world/objects/travel/striders_obelisk.webp'),
  thinkers_bench: require('../assets/images/katchimeras/world/objects/travel/thinkers_bench.webp'),
  travel_trunk: require('../assets/images/katchimeras/world/objects/travel/travel_trunk.webp'),
  voyager_compass: require('../assets/images/katchimeras/world/objects/travel/voyager_compass.webp'),
  waymarker_flags: require('../assets/images/katchimeras/world/objects/travel/waymarker_flags.webp'),
  cinema_marquee: require('../assets/images/katchimeras/world/objects/places/cinema_marquee.webp'),
  corner_cart: require('../assets/images/katchimeras/world/objects/places/corner_cart.webp'),
  court_hoop: require('../assets/images/katchimeras/world/objects/places/court_hoop.webp'),
  curio_obelisk: require('../assets/images/katchimeras/world/objects/places/curio_obelisk.webp'),
  encore_torch: require('../assets/images/katchimeras/world/objects/places/encore_torch.webp'),
  farm_windmill: require('../assets/images/katchimeras/world/objects/places/farm_windmill.webp'),
  garden_arch: require('../assets/images/katchimeras/world/objects/places/garden_arch.webp'),
  harbor_buoy: require('../assets/images/katchimeras/world/objects/places/harbor_buoy.webp'),
  market_awning: require('../assets/images/katchimeras/world/objects/places/market_awning.webp'),
  menagerie_topiary: require('../assets/images/katchimeras/world/objects/places/menagerie_topiary.webp'),
  neon_jar: require('../assets/images/katchimeras/world/objects/places/neon_jar.webp'),
  park_kite: require('../assets/images/katchimeras/world/objects/places/park_kite.webp'),
  temple_bell: require('../assets/images/katchimeras/world/objects/places/temple_bell.webp'),
  tidepool_basin: require('../assets/images/katchimeras/world/objects/places/tidepool_basin.webp'),
  whisper_archive: require('../assets/images/katchimeras/world/objects/places/whisper_archive.webp'),
  wonder_miniature: require('../assets/images/katchimeras/world/objects/places/wonder_miniature.webp'),
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
  town_hall: require('../assets/images/katchimeras/world/objects/town_hall_house/town_hall_house_hex_v2.webp'),
  // Quest Board: today's notice board; tapping it opens the day's Memory Quests.
  quest_board: require('../assets/images/katchimeras/world/objects/quest_board/quest_board_hex_v2.webp'),

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
  home: require('../assets/images/katchimeras/world/objects/home/home_hex_v2.webp'), // 🏠 the day's story (chronicle)
  // Round paver plaza — plantable centre platform matching base_garden_main
  // (the main tile has NO baked plaza; this object provides it).
  plaza_platform: require('../assets/images/katchimeras/world/objects/plaza_platform/plaza_platform_hex_v2.webp'),
  memory_vault: require('../assets/images/katchimeras/world/objects/memory_vault/memory_vault_hex_v2.webp'), // 📸 owns all captured media
  memory_vault_empty: require('../assets/images/katchimeras/world/objects/memory_vault/memory_vault_hex_v2.webp'),
  // Memory Vault GROWS 1→4 (same identity, richer): small safe → grand multi-tier vault.
  memory_vault_1: require('../assets/images/katchimeras/world/objects/memory_vault/memory_vault_hex_v2.webp'),
  memory_vault_2: require('../assets/images/katchimeras/world/objects/memory_vault/memory_vault_02.webp'),
  memory_vault_3: require('../assets/images/katchimeras/world/objects/memory_vault/memory_vault_03.webp'),
  memory_vault_4: require('../assets/images/katchimeras/world/objects/memory_vault/memory_vault_04.webp'),
  crossroads: require('../assets/images/katchimeras/world/objects/crossroads/crossroads_hex_v2.webp'), // 🗺 where did I go?
  journey_hall: require('../assets/images/katchimeras/world/objects/journey_hall/journey_hall_hex_v2.webp'), // 🛤 how did I move?
  // 🔭 Observatory tower (Places / where I went) — a proper structure with a telescope.
  observatory: require('../assets/images/katchimeras/world/objects/observatory/observatory_hex_v2.webp'),
  observatory_empty: require('../assets/images/katchimeras/world/objects/observatory/observatory_hex_v2.webp'),
  // 👣 Steps path (Journey / how I moved) — a small engraved stepping-stone trail that
  // GROWS its stone count by level (3 → 5 → 7 → winding path).
  steps_path_1: require('../assets/images/katchimeras/world/objects/steps_path/steps_path_01.webp'),
  steps_path_2: require('../assets/images/katchimeras/world/objects/steps_path/steps_path_02.webp'),
  steps_path_3: require('../assets/images/katchimeras/world/objects/steps_path/steps_path_03.webp'),
  steps_path_4: require('../assets/images/katchimeras/world/objects/steps_path/steps_path_04.webp'),
  sanctuary: require('../assets/images/katchimeras/world/objects/sanctuary/sanctuary_hex_v2.webp'), // 🌿 how today felt (mood)
  sanctuary_empty: require('../assets/images/katchimeras/world/objects/sanctuary/sanctuary_hex_v2.webp'),
  study: require('../assets/images/katchimeras/world/objects/study/study_hex_v2.webp'), // 📚 what inspired me
  food_pavilion: require('../assets/images/katchimeras/world/objects/food_pavilion/food_pavilion_hex_v2.webp'), // 🍽 what I savoured
  // Memory cluster satellites + the Featured Memory Board (the day's cover).
  featured_board: require('../assets/images/katchimeras/world/objects/featured_board/featured_board_hex_v2.webp'),
  photos_stack: require('../assets/images/katchimeras/world/objects/photos_stack/photos_stack_hex_v2.webp'),
  notes_stack: require('../assets/images/katchimeras/world/objects/notes_stack/notes_stack_hex_v2.webp'),
  // 😴 Sleep nook (Sanctuary satellite) — how the day began; cozy bed + moon by quality.
  sleep_nook_empty: require('../assets/images/katchimeras/world/objects/sleep_nook/sleep_nook_hex_v2.webp'),
  sleep_nook_good: require('../assets/images/katchimeras/world/objects/sleep_nook/sleep_nook_01.png'),
  sleep_nook_normal: require('../assets/images/katchimeras/world/objects/sleep_nook/sleep_nook_11.png'),
  sleep_nook_low: require('../assets/images/katchimeras/world/objects/sleep_nook/sleep_nook_04.png'),
  // Mood Monument states: one generated structure family with consistent frame
  // and state-specific face/emblem panels.
  mood_monument_empty: require('../assets/images/katchimeras/world/objects/mood_monument/mood_monument_hex_v2.webp'),
  mood_monument_radiant: require('../assets/images/katchimeras/world/objects/mood_monument/mood_monument_radiant.png'),
  mood_monument_light: require('../assets/images/katchimeras/world/objects/mood_monument/mood_monument_light.png'),
  mood_monument_meh: require('../assets/images/katchimeras/world/objects/mood_monument/mood_monument_meh.png'),
  mood_monument_heavy: require('../assets/images/katchimeras/world/objects/mood_monument/mood_monument_heavy.png'),
  mood_monument_stormy: require('../assets/images/katchimeras/world/objects/mood_monument/mood_monument_stormy.png'),

  // Decorate-your-day plant palette (earned blooms, planted freely on the patch).
  // Nature props use the hex-era style sheet; utility props stay on their original art.
  decor_1: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_style_v2_03.webp'), // cone pine
  decor_2: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_style_v2_01.webp'), // leafy tree
  decor_3: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_style_v2_06.webp'), // flowering shrub
  decor_4: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_style_v2_02.webp'), // small leafy tree
  decor_5: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_style_v2_05.webp'), // shrub
  decor_6: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_style_v2_14.webp'), // grass tuft
  decor_7: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_style_v2_13.webp'), // wildflowers
  decor_8: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_style_v2_12.webp'), // sapling
  decor_9: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_09.png'), // crate
  decor_10: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_10.png'), // crate stack
  decor_11: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_11.png'), // barrel
  decor_12: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_12.png'), // lantern post
  decor_13: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_13.png'), // signpost
  decor_14: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_style_v2_08.webp'), // rock cluster
  decor_15: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_style_v2_15.webp'), // mushrooms
  decor_16: require('../assets/images/katchimeras/world/objects/decor_plants/decor_plants_style_v2_11.webp'), // log
  // B1 bloom variant families (4x4 grid batch, 2026-07) - see BLOOM_COMMONS.
  bloom_birch_1: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/birch_v1.webp'),
  bloom_birch_2: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/birch_v2.webp'),
  bloom_birch_3: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/birch_v3.webp'),
  bloom_birch_4: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/birch_v4.webp'),
  bloom_bird_bath_1: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/bird_bath_v1.webp'),
  bloom_bird_bath_2: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/bird_bath_v2.webp'),
  bloom_bird_bath_3: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/bird_bath_v3.webp'),
  bloom_bird_bath_4: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/bird_bath_v4.webp'),
  bloom_blossom_1: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/blossom_v1.webp'),
  bloom_blossom_2: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/blossom_v2.webp'),
  bloom_blossom_3: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/blossom_v3.webp'),
  bloom_blossom_4: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/blossom_v4.webp'),
  bloom_butterfly_bush_1: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/butterfly_bush_v1.webp'),
  bloom_butterfly_bush_2: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/butterfly_bush_v2.webp'),
  bloom_butterfly_bush_3: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/butterfly_bush_v3.webp'),
  bloom_butterfly_bush_4: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/butterfly_bush_v4.webp'),
  bloom_cattails_1: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/cattails_v1.webp'),
  bloom_cattails_2: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/cattails_v2.webp'),
  bloom_cattails_3: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/cattails_v3.webp'),
  bloom_cattails_4: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/cattails_v4.webp'),
  bloom_fern_1: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/fern_v1.webp'),
  bloom_fern_2: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/fern_v2.webp'),
  bloom_fern_3: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/fern_v3.webp'),
  bloom_fern_4: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/fern_v4.webp'),
  bloom_lavender_1: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/lavender_v1.webp'),
  bloom_lavender_2: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/lavender_v2.webp'),
  bloom_lavender_3: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/lavender_v3.webp'),
  bloom_lavender_4: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/lavender_v4.webp'),
  bloom_mushrooms_1: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/mushrooms_v1.webp'),
  bloom_mushrooms_2: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/mushrooms_v2.webp'),
  bloom_mushrooms_3: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/mushrooms_v3.webp'),
  bloom_mushrooms_4: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/mushrooms_v4.webp'),
  bloom_oak_1: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/oak_v1.webp'),
  bloom_oak_2: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/oak_v2.webp'),
  bloom_oak_3: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/oak_v3.webp'),
  bloom_oak_4: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/oak_v4.webp'),
  bloom_pine_1: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/pine_v1.webp'),
  bloom_pine_2: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/pine_v2.webp'),
  bloom_pine_3: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/pine_v3.webp'),
  bloom_pine_4: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/pine_v4.webp'),
  bloom_planter_1: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/planter_v1.webp'),
  bloom_planter_2: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/planter_v2.webp'),
  bloom_planter_3: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/planter_v3.webp'),
  bloom_planter_4: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/planter_v4.webp'),
  bloom_pumpkin_patch_1: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/pumpkin_patch_v1.webp'),
  bloom_pumpkin_patch_2: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/pumpkin_patch_v2.webp'),
  bloom_pumpkin_patch_3: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/pumpkin_patch_v3.webp'),
  bloom_pumpkin_patch_4: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/pumpkin_patch_v4.webp'),
  bloom_shrub_1: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/shrub_v1.webp'),
  bloom_shrub_2: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/shrub_v2.webp'),
  bloom_shrub_3: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/shrub_v3.webp'),
  bloom_shrub_4: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/shrub_v4.webp'),
  bloom_snowdrops_1: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/snowdrops_v1.webp'),
  bloom_snowdrops_2: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/snowdrops_v2.webp'),
  bloom_snowdrops_3: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/snowdrops_v3.webp'),
  bloom_snowdrops_4: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/snowdrops_v4.webp'),
  bloom_stone_lantern_1: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/stone_lantern_v1.webp'),
  bloom_stone_lantern_2: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/stone_lantern_v2.webp'),
  bloom_stone_lantern_3: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/stone_lantern_v3.webp'),
  bloom_stone_lantern_4: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/stone_lantern_v4.webp'),
  bloom_wildflowers_1: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/wildflowers_v1.webp'),
  bloom_wildflowers_2: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/wildflowers_v2.webp'),
  bloom_wildflowers_3: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/wildflowers_v3.webp'),
  bloom_wildflowers_4: require('../assets/images/katchimeras/world/objects/decor_plants/bloom/wildflowers_v4.webp'), // hay bale
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
// Seamless world-space ground texture (baked from the velvet tile's lawn +
// wrap-blend tiling pass — scratchpad gen-grass-texture.py). Sampled by the
// Skia ground shader in world coordinates so adjacent cells/patches are
// continuous instead of per-cell repeats.
export const GRASS_GROUND_TEXTURE: ImageSourcePropType = require('../assets/images/katchimeras/world/textures/velvet_grass.webp');
// Tiny toy details the ground pass scatters sparsely over the lawn (matted
// from the nest/winding tile art) — NEVER baked into the repeating texture,
// so they never form a visible lattice.
export const GRASS_DETAIL_FLOWER: ImageSourcePropType = require('../assets/images/katchimeras/world/textures/detail_flower.webp');
export const GRASS_DETAIL_BERRIES: ImageSourcePropType = require('../assets/images/katchimeras/world/textures/detail_berries.webp');
// Seamless golden cobble for the crossroads ribbons the ground pass draws
// through the kingdom centre (from the plaza tile's paver material).
export const COBBLE_PATH_TEXTURE: ImageSourcePropType = require('../assets/images/katchimeras/world/textures/cobble_path.webp');
// Generated full-patch ground overlay for the main kingdom slab (guide-driven
// gpt render fitted to the slab's exact 2:1 geometry — scratch
// gen-kingdom-slab.py + fit-kingdom-slab.py). Drawn as ONE image in place of
// the procedural face layers.
export const KINGDOM_SLAB_OVERLAY: ImageSourcePropType = require('../assets/images/katchimeras/world/base/base_kingdom_slab.webp');
export type KingdomHexTileAlphaBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type KingdomHexTileLod = 'thumb' | 'medium' | 'full';
export type KingdomHexTileLodSources = Partial<Record<KingdomHexTileLod, ImageSourcePropType>>;

export type KingdomHexTileSpec = {
  source: ImageSourcePropType;
  sources?: KingdomHexTileLodSources;
  alphaBounds: KingdomHexTileAlphaBounds;
};

export type KingdomHexTileVariant = {
  id: string;
  label: string;
  description: string;
  tile: KingdomHexTileSpec;
};

export type KingdomHexTileSelection = {
  center: KingdomHexTileSpec;
  default: KingdomHexTileSpec;
};

export function kingdomHexTileSourceForLod(
  tile: Pick<KingdomHexTileSpec, 'source' | 'sources'>,
  lod: KingdomHexTileLod
): ImageSourcePropType {
  return tile.sources?.[lod] ?? tile.sources?.full ?? tile.source;
}

export const KINGDOM_DEFAULT_HEX_TILE: ImageSourcePropType = require('../assets/images/katchimeras/world/hex/default_hex_tile.webp');
export const KINGDOM_EGG_HEX_TILE: ImageSourcePropType = require('../assets/images/katchimeras/world/hex/egg_hex_tile.webp');
export const KINGDOM_EGG_HEX_TILE_V2: ImageSourcePropType = require('../assets/images/katchimeras/world/hex/egg_hex_tile_v2.webp');
export const KINGDOM_EGG_HOME_HEX_TILE: ImageSourcePropType = require('../assets/images/katchimeras/world/hex/egg_home_hex_tile.webp');
export const KINGDOM_CENTER_PLAZA_HEX_TILE_V2: ImageSourcePropType = require('../assets/images/katchimeras/world/hex/center_plaza_hex_tile_v2.webp');
export const KINGDOM_GRASS_HEX_TILE_V2: ImageSourcePropType = require('../assets/images/katchimeras/world/hex/grass_hex_tile_v2.webp');
export const KINGDOM_GRASS_HEX_TILE_DENSE_V2: ImageSourcePropType = require('../assets/images/katchimeras/world/hex/grass_hex_tile_dense_v2.webp');
export const KINGDOM_GRASS_HEX_TILE_CROSSROAD_V2: ImageSourcePropType = require('../assets/images/katchimeras/world/hex/grass_hex_tile_crossroad_v2.webp');
export const KINGDOM_GRASS_HEX_TILE_PATH_VERTICAL_V2: ImageSourcePropType = require('../assets/images/katchimeras/world/hex/grass_hex_tile_path_vertical_v2.webp');
export const KINGDOM_GRASS_HEX_TILE_PATH_Y_V2: ImageSourcePropType = require('../assets/images/katchimeras/world/hex/grass_hex_tile_path_y_v2.webp');

const KINGDOM_DEFAULT_HEX_TILE_SOURCES: KingdomHexTileLodSources = {
  thumb: require('../assets/images/katchimeras/world/hex/default_hex_tile_256.webp'),
  medium: require('../assets/images/katchimeras/world/hex/default_hex_tile_512.webp'),
  full: KINGDOM_DEFAULT_HEX_TILE,
};
const KINGDOM_EGG_HEX_TILE_V2_SOURCES: KingdomHexTileLodSources = {
  thumb: require('../assets/images/katchimeras/world/hex/egg_hex_tile_v2_256.webp'),
  medium: require('../assets/images/katchimeras/world/hex/egg_hex_tile_v2_512.webp'),
  full: KINGDOM_EGG_HEX_TILE_V2,
};
const KINGDOM_EGG_HOME_HEX_TILE_SOURCES: KingdomHexTileLodSources = {
  thumb: require('../assets/images/katchimeras/world/hex/egg_home_hex_tile_256.webp'),
  medium: require('../assets/images/katchimeras/world/hex/egg_home_hex_tile_512.webp'),
  full: KINGDOM_EGG_HOME_HEX_TILE,
};
const KINGDOM_CENTER_PLAZA_HEX_TILE_V2_SOURCES: KingdomHexTileLodSources = {
  thumb: require('../assets/images/katchimeras/world/hex/center_plaza_hex_tile_v2_256.webp'),
  medium: require('../assets/images/katchimeras/world/hex/center_plaza_hex_tile_v2_512.webp'),
  full: KINGDOM_CENTER_PLAZA_HEX_TILE_V2,
};
const KINGDOM_GRASS_HEX_TILE_V2_SOURCES: KingdomHexTileLodSources = {
  thumb: require('../assets/images/katchimeras/world/hex/grass_hex_tile_v2_256.webp'),
  medium: require('../assets/images/katchimeras/world/hex/grass_hex_tile_v2_512.webp'),
  full: KINGDOM_GRASS_HEX_TILE_V2,
};
const KINGDOM_GRASS_HEX_TILE_DENSE_V2_SOURCES: KingdomHexTileLodSources = {
  thumb: require('../assets/images/katchimeras/world/hex/grass_hex_tile_dense_v2_256.webp'),
  medium: require('../assets/images/katchimeras/world/hex/grass_hex_tile_dense_v2_512.webp'),
  full: KINGDOM_GRASS_HEX_TILE_DENSE_V2,
};
const KINGDOM_GRASS_HEX_TILE_CROSSROAD_V2_SOURCES: KingdomHexTileLodSources = {
  thumb: require('../assets/images/katchimeras/world/hex/grass_hex_tile_crossroad_v2_256.webp'),
  medium: require('../assets/images/katchimeras/world/hex/grass_hex_tile_crossroad_v2_512.webp'),
  full: KINGDOM_GRASS_HEX_TILE_CROSSROAD_V2,
};
const KINGDOM_GRASS_HEX_TILE_PATH_VERTICAL_V2_SOURCES: KingdomHexTileLodSources = {
  thumb: require('../assets/images/katchimeras/world/hex/grass_hex_tile_path_vertical_v2_256.webp'),
  medium: require('../assets/images/katchimeras/world/hex/grass_hex_tile_path_vertical_v2_512.webp'),
  full: KINGDOM_GRASS_HEX_TILE_PATH_VERTICAL_V2,
};
const KINGDOM_GRASS_HEX_TILE_PATH_Y_V2_SOURCES: KingdomHexTileLodSources = {
  thumb: require('../assets/images/katchimeras/world/hex/grass_hex_tile_path_y_v2_256.webp'),
  medium: require('../assets/images/katchimeras/world/hex/grass_hex_tile_path_y_v2_512.webp'),
  full: KINGDOM_GRASS_HEX_TILE_PATH_Y_V2,
};

export const KINGDOM_HEX_CENTER_TILE_VARIANTS: KingdomHexTileVariant[] = [
  {
    id: 'egg',
    label: 'Home nest',
    description: 'Home center hex tile with a centered wicker nest plaza.',
    tile: {
      source: KINGDOM_EGG_HOME_HEX_TILE,
      sources: KINGDOM_EGG_HOME_HEX_TILE_SOURCES,
      alphaBounds: { left: 14, top: 95, right: 1010, bottom: 929 },
    },
  },
  {
    id: 'egg_classic',
    label: 'Classic egg nest',
    description: 'Previous egg-center hex tile.',
    tile: {
      source: KINGDOM_EGG_HEX_TILE_V2,
      sources: KINGDOM_EGG_HEX_TILE_V2_SOURCES,
      alphaBounds: { left: 26, top: 157, right: 1002, bottom: 888 },
    },
  },
  {
    id: 'plaza',
    label: 'Plaza center',
    description: 'Three-path plaza center tile.',
    tile: {
      source: KINGDOM_CENTER_PLAZA_HEX_TILE_V2,
      sources: KINGDOM_CENTER_PLAZA_HEX_TILE_V2_SOURCES,
      alphaBounds: { left: 14, top: 142, right: 1010, bottom: 881 },
    },
  },
];

export const KINGDOM_HEX_BASE_TILE_VARIANTS: KingdomHexTileVariant[] = [
  {
    id: 'classic_grass',
    label: 'Classic grass',
    description: 'Original empty grass resident tile.',
    tile: {
      source: KINGDOM_DEFAULT_HEX_TILE,
      sources: KINGDOM_DEFAULT_HEX_TILE_SOURCES,
      alphaBounds: { left: 14, top: 147, right: 1010, bottom: 876 },
    },
  },
  {
    id: 'smooth_grass',
    label: 'Smooth grass',
    description: 'Open smooth grass tile.',
    tile: {
      source: KINGDOM_GRASS_HEX_TILE_V2,
      sources: KINGDOM_GRASS_HEX_TILE_V2_SOURCES,
      alphaBounds: { left: 14, top: 148, right: 1010, bottom: 875 },
    },
  },
  {
    id: 'dense_grass',
    label: 'Detailed grass',
    description: 'Denser tufted grass base tile.',
    tile: {
      source: KINGDOM_GRASS_HEX_TILE_DENSE_V2,
      sources: KINGDOM_GRASS_HEX_TILE_DENSE_V2_SOURCES,
      alphaBounds: { left: 14, top: 142, right: 1010, bottom: 882 },
    },
  },
  {
    id: 'crossroad_path',
    label: 'Crossroad path',
    description: 'Four-way cobble path resident tile.',
    tile: {
      source: KINGDOM_GRASS_HEX_TILE_CROSSROAD_V2,
      sources: KINGDOM_GRASS_HEX_TILE_CROSSROAD_V2_SOURCES,
      alphaBounds: { left: 25, top: 159, right: 1001, bottom: 888 },
    },
  },
  {
    id: 'vertical_path',
    label: 'Curved path',
    description: 'Single winding cobble path resident tile.',
    tile: {
      source: KINGDOM_GRASS_HEX_TILE_PATH_VERTICAL_V2,
      sources: KINGDOM_GRASS_HEX_TILE_PATH_VERTICAL_V2_SOURCES,
      alphaBounds: { left: 25, top: 159, right: 1002, bottom: 888 },
    },
  },
  {
    id: 'y_path',
    label: 'Forked path',
    description: 'Three-way forked cobble path resident tile.',
    tile: {
      source: KINGDOM_GRASS_HEX_TILE_PATH_Y_V2,
      sources: KINGDOM_GRASS_HEX_TILE_PATH_Y_V2_SOURCES,
      alphaBounds: { left: 26, top: 159, right: 1004, bottom: 889 },
    },
  },
];

export function kingdomHexTileSet(): KingdomHexTileSelection {
  const centerId = getDevKingdomHexCenterTileId();
  const baseId = getDevKingdomHexBaseTileId();
  const center = KINGDOM_HEX_CENTER_TILE_VARIANTS.find((variant) => variant.id === centerId) ?? KINGDOM_HEX_CENTER_TILE_VARIANTS[0];
  const base = KINGDOM_HEX_BASE_TILE_VARIANTS.find((variant) => variant.id === baseId) ?? KINGDOM_HEX_BASE_TILE_VARIANTS[0];
  return { center: center.tile, default: base.tile };
}

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
export function worldAssetSource(assetKey: string, lod: WorldObjectLod = 'full'): ImageSourcePropType | null {
  // Dev-only: an Asset Lab draft override wins (no-op in production builds).
  const override = getDevAssetOverrideSource(assetKey);
  if (override) {
    return override;
  }
  if (assetKey.startsWith(CREATURE_PREFIX)) {
    const key = assetKey.slice(CREATURE_PREFIX.length) as HomeVisualKey;
    if (lod !== 'full') {
      const exact = CREATURE_LOD_SOURCES[lod][key];
      if (exact) return exact;
      if (lod === 'thumb') {
        const medium = CREATURE_LOD_SOURCES.medium[key];
        if (medium) return medium;
      }
    }
    return homeCreatureVisuals[key]?.source ?? null;
  }
  if (lod !== 'full') {
    const exact = WORLD_OBJECT_LOD_SOURCES[lod][assetKey];
    if (exact) return exact;
    if (lod === 'thumb') {
      const medium = WORLD_OBJECT_LOD_SOURCES.medium[assetKey];
      if (medium) return medium;
    }
  }
  // Promoted Asset Lab variants (generated manifest) extend the hand map.
  return WORLD_OBJECT_SOURCES[assetKey] ?? PROMOTED_WORLD_SOURCES[assetKey] ?? null;
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
  // Garden plaza island (GPT Image 2 edit recreation of the user's reference,
  // flood-fill matted) — selectable as the Kingdom base from the Asset Lab.
  base_garden: require('../assets/images/katchimeras/world/base/base_garden.webp'),
  // Simplified sibling: two diagonal paths + plaza only, big empty lawns —
  // a clean canvas for planting our own props.
  base_garden_simple: require('../assets/images/katchimeras/world/base/base_garden_simple.webp'),
  // Tessellation unit: a PERFECT diamond silhouette (no waterfalls/stairs/
  // corner chips), paths meeting each edge's midpoint — for multi-tile worlds.
  base_garden_uniform: require('../assets/images/katchimeras/world/base/base_garden_uniform.webp'),
  // Sibling tessellation unit born from the grid-guide template (wildflower
  // patches + bushes in the lawns); same canonical diamond, same offsets.
  base_garden_wildflower: require('../assets/images/katchimeras/world/base/base_garden_wildflower.webp'),
  // User-supplied toy-brick tile (gpt 2K re-render + BiRefNet + pure diamond
  // warp — scratchpad brick-tile-pure.py).
  base_garden_bricks: require('../assets/images/katchimeras/world/base/base_garden_bricks.webp'),
  // User-supplied cobble-skirt velvet tile (same pure pipeline —
  // scratchpad cobble-tile.py).
  base_garden_cobble: require('../assets/images/katchimeras/world/base/base_garden_cobble.webp'),
  // Generated FROM the procedural canonical template (design/proc-tile-green
  // + style anchor — scratchpad styled-from-template.py): velvet lawn, cobble
  // skirt, geometry converged to 4.2px.
  base_garden_velvet: require('../assets/images/katchimeras/world/base/base_garden_velvet.webp'),
  // Same template pipeline, roads variant (proc-tile-roads: two crossing
  // lanes to the edge midpoints, no plaza).
  base_garden_velvet_roads: require('../assets/images/katchimeras/world/base/base_garden_velvet_roads.webp'),
  // User-supplied variant set, all via scripts/tile-pipeline.py (2K re-render
  // + BiRefNet + hole fill + canonical warp — docs/tile-pipeline.md).
  base_garden_nest: require('../assets/images/katchimeras/world/base/base_garden_nest.webp'),
  base_garden_winding: require('../assets/images/katchimeras/world/base/base_garden_winding.webp'),
  base_garden_brickcross: require('../assets/images/katchimeras/world/base/base_garden_brickcross.webp'),
  base_garden_diagonal: require('../assets/images/katchimeras/world/base/base_garden_diagonal.webp'),
  base_garden_plaza: require('../assets/images/katchimeras/world/base/base_garden_plaza.webp'),
  // Best tessellation unit: generated FROM the path-lane guide alone (lanes +
  // plaza drawn into the template), flat lawns — path crossings within ~13px
  // of edge midpoints, roads continue seamlessly across tiles.
  base_garden_flat: require('../assets/images/katchimeras/world/base/base_garden_flat.webp'),
  // Grass-only canonical tile (no roads/plaza) — the GROUND tile. Roads are
  // stamped at RUNTIME as path_cell sprites from a layout JSON (world-canvas
  // kingdomNeighbor), never baked into base art.
  base_garden_grass: require('../assets/images/katchimeras/world/base/base_garden_grass.webp'),
  // Pixar-toy restyle of the uniform tile: plush lawn relief, beveled cobble
  // paths, dished plaza, cobbled border frame. Same canonical diamond.
  base_garden_toy: require('../assets/images/katchimeras/world/base/base_garden_toy.webp'),
  // THE main Kingdom tile (user-picked fal generation, normalized): soft
  // velvet lawns, plain path crossing (no baked plaza — the plaza is a
  // separate plantable object), cobble border + wall.
  base_garden_main: require('../assets/images/katchimeras/world/base/base_garden_main.webp'),
  // Nest meadow II (user-supplied render → tile pipeline): clean lawn with a
  // thin gold brick border, central paved circle holding a wicker nest.
  base_garden_nest2: require('../assets/images/katchimeras/world/base/base_garden_nest2.webp'),
  // Full-patch Skia slab overlay (guide-driven generation, TRUE 2:1 slab
  // geometry — NOT the canonical 0.8-slope diamond the other bases use).
  base_kingdom_slab: require('../assets/images/katchimeras/world/base/base_kingdom_slab.webp'),
};

// Bases authored directly in the Skia slab's 2:1 guide space; every other
// base is canonical (slope 0.8) and gets y-squashed 0.625 at draw time.
const SLAB_GUIDE_BASES = new Set(['base_kingdom_slab']);

// Resolver for the Skia ground's full-patch overlay (docs/kingdom-residents-plan.md):
// the CAPITAL (centre slab) is the nest tile — the egg sits on its paved
// circle — while RING (expansion) tiles use the Garden Tile. The Asset Lab
// dev override restyles the ring tiles; the capital's nest identity is fixed.
const KINGDOM_CAPITAL_BASE = 'base_garden_nest2';
const KINGDOM_RING_BASE = 'base_garden_main';
export type KingdomOverlayRole = 'capital' | 'ring';
export function kingdomSlabOverlay(role: KingdomOverlayRole): { source: ImageSourcePropType; guide: 'slab' | 'canonical' } {
  const overrideId = getDevKingdomBaseId();
  const baseId =
    role === 'ring' && overrideId && WORLD_BASE_SOURCES[overrideId]
      ? overrideId
      : role === 'capital'
        ? KINGDOM_CAPITAL_BASE
        : KINGDOM_RING_BASE;
  return {
    source: WORLD_BASE_SOURCES[baseId],
    guide: SLAB_GUIDE_BASES.has(baseId) ? 'slab' : 'canonical',
  };
}

// The centre island's canonical id.
const KINGDOM_BASE_ID = 'base_env3';

// Literal per-id lookup — used by the dev labs to browse SPECIFIC arts, so the
// dev override must never hijack it.
export function worldBaseSource(baseId: string): ImageSourcePropType | null {
  return WORLD_BASE_SOURCES[baseId] ?? null;
}

// Default art for every Kingdom tile.
const KINGDOM_DEFAULT_ART = 'base_garden_main';

// Kingdom-view resolver: ONE art for EVERY tile in the Kingdom — centre
// island, expansion plots, and the preview neighbor — so the world reads as a
// uniform tessellation. The Asset Lab dev override wins over the default.
export function kingdomBaseSource(baseId?: string | null): ImageSourcePropType | null {
  const overrideId = getDevKingdomBaseId();
  if (overrideId && WORLD_BASE_SOURCES[overrideId]) {
    return WORLD_BASE_SOURCES[overrideId];
  }
  return WORLD_BASE_SOURCES[KINGDOM_DEFAULT_ART] ?? WORLD_BASE_SOURCES[baseId ?? KINGDOM_BASE_ID] ?? null;
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
