import {
  BLOOM_COMMONS,
  CUISINE_FAMILIES,
  CUISINE_FAMILY_LABELS,
  DISCOVERY_TIER_KEEPSAKES,
  GROVE_MERGE_COUNT,
  MILESTONE_KEEPSAKES,
  SIGNATURE_KEEPSAKES,
  describeUnlockSpec,
  groveForSpecies,
  type WorldObjectDefinition,
} from '@/constants/world-objects';
import { WORLD_PROP_CATALOG } from '@/utils/world-props-catalog';

// The WORLD ASSET CATALOG — what the Dev Asset Lab renders: every bundled
// world asset, what it is, WHERE IT COMES FROM in a real life (its unlock
// provenance), and its variant family. Keys resolve through
// utils/world-visuals.ts (worldAssetSource / worldBaseSource).
//
// EARNABLE entries (signature keepsakes, bloom decor, discovery tiers) are
// DERIVED from constants/world-objects.ts — the earn rules and this catalog
// can no longer drift apart. Only non-earnable display metadata (buildings,
// bases, art-ready pools) is hand-authored below; keep that part in sync when
// new static art lands. Retired/legacy art stays bundled (old saves may still
// render it) but is deliberately NOT catalogued — the lab shows what the game
// uses today.

export type WorldAssetSectionId =
  | 'base'
  | 'buildings'
  | 'keepsakes'
  | 'decor'
  | 'artefacts'
  | 'milestones'
  | 'progression';

export const WORLD_ASSET_SECTIONS: { id: WorldAssetSectionId; title: string; blurb: string }[] = [
  { id: 'base', title: 'World base & tiles', blurb: 'The island grounds everything is planted on (worldBaseSource ids).' },
  { id: 'buildings', title: 'Buildings & structures', blurb: 'The permanent domain structures of the Kingdom.' },
  { id: 'keepsakes', title: 'Earned keepsakes', blurb: 'Daily signature earns + discovery keepsakes (kingdom-decor rules).' },
  { id: 'decor', title: 'Bloom decor', blurb: 'Common greens earned by everyday living (3 bloom points per gift).' },
  { id: 'artefacts', title: 'Discovery artefacts', blurb: 'Permanent monuments from life-milestone Discoveries.' },
  { id: 'milestones', title: 'Occasions (Big Moments)', blurb: 'One celebratory monument per Big Moment type.' },
  { id: 'progression', title: 'Progression sets', blurb: 'Level families that grow 1→4 with the day/lifetime.' },
];

// familyKind: how members of a variantFamily relate.
//   random — visually interchangeable; plant flow may pick one at random
//   level  — growth stages (1→4), picked by progress
//   state  — picked by a live state (mood, sleep quality)
export type WorldAssetFamilyKind = 'random' | 'level' | 'state';

export type WorldAssetEntry = {
  key: string; // worldAssetSource key — or worldBaseSource id when section is 'base'
  name: string;
  section: WorldAssetSectionId;
  // Where it comes from in a real life — the unlock/earn provenance.
  unlock: string;
  variantFamily?: string;
  familyKind?: WorldAssetFamilyKind;
  note?: string;
};

// Earnable entries derived from the world-objects registry — bloom commons,
// signature keepsakes, discovery-tier keepsakes. Rules that share an asset key
// (wildflowers = bloom AND 3-reflections; the birch = bloom AND the Discovery
// sapling) merge into ONE entry with the unlock lines combined.
function derivedEarnableEntries(): WorldAssetEntry[] {
  const entries = new Map<string, WorldAssetEntry>();

  for (const definition of BLOOM_COMMONS) {
    // EVERY variant becomes a browsable entry (they share the family id, so
    // the lab's family view groups them); variant 1 carries the plain name.
    definition.art.variants.forEach((key, index) => {
      entries.set(key, {
        key,
        name: index === 0 ? definition.name : `${definition.name} · v${index + 1}`,
        section: 'decor',
        unlock: 'Bloom gift — everyday living.',
        variantFamily: definition.art.variants.length > 1 ? definition.id : undefined,
        familyKind: definition.art.variants.length > 1 ? definition.art.pick : undefined,
      });
    });
  }

  for (const definition of BLOOM_COMMONS) {
    // The species' grove upgrade — the merge sink's uncommon reward.
    const grove = groveForSpecies(definition.id);
    if (grove) {
      entries.set(grove.assetKey, {
        key: grove.assetKey,
        name: grove.name,
        section: 'decor',
        unlock: `Merge ${GROVE_MERGE_COUNT} unplanted ${definition.name} keepsakes.`,
        variantFamily: definition.id,
        familyKind: 'level',
      });
    }
  }

  for (const definition of SIGNATURE_KEEPSAKES) {
    const key = definition.art.variants[0];
    const line = `Earn: ${definition.hint ?? definition.name}.`;
    const existing = entries.get(key);
    if (existing) {
      existing.unlock = `${existing.unlock} Also ${line}`;
      if (!existing.name.includes(definition.name)) existing.name = `${existing.name} · ${definition.name}`;
    } else {
      entries.set(key, {
        key,
        name: definition.name,
        section: 'keepsakes',
        unlock: line,
        variantFamily: definition.art.variants.length > 1 ? definition.id : undefined,
        familyKind: definition.art.variants.length > 1 ? definition.art.pick : undefined,
      });
    }
  }

  for (const definition of MILESTONE_KEEPSAKES) {
    const rarity = definition.rarity ? ` (${definition.rarity})` : '';
    const line = `Milestone${rarity}: ${definition.hint ?? definition.name}.${definition.artBatch ? ` Fallback art until batch ${definition.artBatch}.` : ''}`;
    if (definition.repeat === 'perSubject' && definition.art.variants.length > 1) {
      // Subject families (the Cuisine Lantern): every variant is a distinct
      // earn, indexed by CUISINE_FAMILIES order — browse them all.
      definition.art.variants.forEach((key, index) => {
        const subject = CUISINE_FAMILIES[index];
        const subjectName = subject ? (CUISINE_FAMILY_LABELS[subject] ?? subject) : `v${index + 1}`;
        entries.set(key, {
          key,
          name: `${definition.name} · ${subjectName}`,
          section: 'keepsakes',
          unlock: line,
          variantFamily: definition.id,
          familyKind: definition.art.pick,
        });
      });
      continue;
    }
    const key = definition.art.variants[0];
    const existing = entries.get(key);
    if (existing) {
      existing.unlock = `${existing.unlock} Also ${line}`;
      if (!existing.name.includes(definition.name)) existing.name = `${existing.name} · ${definition.name}`;
    } else {
      entries.set(key, {
        key,
        name: definition.name,
        section: 'keepsakes',
        unlock: line,
        variantFamily: definition.art.variants.length > 1 ? definition.id : undefined,
        familyKind: definition.art.variants.length > 1 ? definition.art.pick : undefined,
      });
    }
  }

  for (const [tier, definition] of Object.entries(DISCOVERY_TIER_KEEPSAKES)) {
    const key = definition.art.variants[0];
    const line = `Earn: a ${tier.toUpperCase()} Discovery (${definition.name}).`;
    const existing = entries.get(key);
    if (existing) {
      existing.unlock = `${existing.unlock} Also ${line}`;
      if (!existing.name.includes(definition.name)) existing.name = `${existing.name} · ${definition.name}`;
    } else {
      entries.set(key, {
        key,
        name: definition.name,
        section: 'keepsakes',
        unlock: line,
        variantFamily: definition.art.variants.length > 1 ? definition.id : undefined,
        familyKind: definition.art.variants.length > 1 ? definition.art.pick : undefined,
      });
    }
  }

  // Starter + earned world props (world-props-catalog — discoveries,
  // observations, mood unlocks): their lockedLabel IS the real unlock copy.
  for (const prop of WORLD_PROP_CATALOG) {
    const key = prop.assetKey;
    const line = prop.unlockKind === 'starter' ? `First Seed choice — ${prop.description}` : `Earn: ${prop.lockedLabel}`;
    const existing = entries.get(key);
    if (existing) {
      existing.unlock = `${existing.unlock} Also ${line}`;
      if (!existing.name.includes(prop.name)) existing.name = `${existing.name} · ${prop.name}`;
    } else {
      entries.set(key, {
        key,
        name: prop.name,
        section: key.startsWith('artefact_') ? 'artefacts' : 'keepsakes',
        unlock: line,
      });
    }
  }

  return [...entries.values()];
}

const HAND_WORLD_ASSETS: WorldAssetEntry[] = [
  // --- World base & tiles (ALL bundled tiles stay browsable — any can be set
  // as the live Kingdom base from its detail page) -----------------------------
  { key: 'base_garden_main', name: 'Garden Tile (default)', section: 'base', unlock: 'The default Kingdom tile — velvet lawns, plain crossing (plaza is a separate plantable object).' },
  { key: 'base_garden_toy', name: 'Garden Tile (toy 3D)', section: 'base', unlock: 'Alternate tile — plush lawn relief, beveled cobbles, dished plaza.' },
  { key: 'base_garden_grass', name: 'Grass Tile', section: 'base', unlock: 'Alternate tile — flat empty lawn, good clean canvas.' },
  { key: 'base_garden_uniform', name: 'Garden Tile (uniform)', section: 'base', unlock: 'Alternate tile — edge-midpoint paths on the canonical diamond.' },
  { key: 'base_garden_flat', name: 'Garden Tile (flat)', section: 'base', unlock: 'Alternate tile — path-lane-guide generation: flat lawns, roads continuous across tiles.' },
  { key: 'base_garden_wildflower', name: 'Garden Tile (wildflower)', section: 'base', unlock: 'Alternate tile — grid-guide generation with wildflower lawns.' },
  { key: 'base_garden_bricks', name: 'Toy Brick Tile', section: 'base', unlock: 'Alternate tile — user-supplied toy-brick garden, normalised to the canonical diamond.' },
  { key: 'base_garden_cobble', name: 'Cobble Garden Tile', section: 'base', unlock: 'Alternate tile — velvet lawns + sandy paths on a cobblestone skirt, normalised to the canonical diamond.' },
  { key: 'base_garden_velvet', name: 'Velvet Lawn Tile', section: 'base', unlock: 'Alternate tile — generated from the procedural canonical template: plush velvet lawn on a cobble skirt.' },
  { key: 'base_garden_velvet_roads', name: 'Velvet Crossroads Tile', section: 'base', unlock: 'Alternate tile — template-generated velvet lawn with sandy brick roads crossing at the middle (no plaza).' },
  { key: 'base_garden_nest', name: 'Nest Meadow Tile', section: 'base', unlock: 'Alternate tile — open flower meadow with a round paved plaza holding a wicker nest.' },
  { key: 'base_garden_winding', name: 'Winding Paths Tile', section: 'base', unlock: 'Alternate tile — organic winding paths meeting at a small roundabout crossing.' },
  { key: 'base_garden_brickcross', name: 'Brick Crossroad Tile', section: 'base', unlock: 'Alternate tile — straight paver crossroad with orange brick edging.' },
  { key: 'base_garden_diagonal', name: 'Diagonal Cross Tile', section: 'base', unlock: 'Alternate tile — corner-to-corner diagonal paths with a ring plaza and paved border.' },
  { key: 'base_garden_plaza', name: 'Plaza Crossroad Tile', section: 'base', unlock: 'Alternate tile — brick-edged roads crossing at a round paved plaza medallion.' },
  { key: 'base_garden_simple', name: 'Garden Island (simple)', section: 'base', unlock: 'Older centre-island candidate — diagonal paths + plaza only, no props.' },
  { key: 'base_garden', name: 'Garden Plaza Island', section: 'base', unlock: 'Older centre-island candidate — GPT recreation of the garden reference.' },
  { key: 'base_env3', name: 'Kingdom Island (previous)', section: 'base', unlock: 'Previous centre island — kept switchable.' },
  { key: 'base_env2', name: 'Cozy Island (backup)', section: 'base', unlock: 'Earlier base — kept as backup/style anchor.' },
  { key: 'base_meadow', name: 'Meadow Base (original)', section: 'base', unlock: 'The original base — kept as backup.' },
  { key: 'plot_base_1', name: 'Expansion Islet A', section: 'base', unlock: 'Kingdom expansion plot.' },
  { key: 'plot_base_2', name: 'Expansion Islet B', section: 'base', unlock: 'Kingdom expansion plot.' },

  // --- Buildings & structures -------------------------------------------------
  { key: 'home', name: 'Home', section: 'buildings', unlock: 'Always present — the day’s story (Chronicle).' },
  { key: 'plaza_platform', name: 'Plaza Platform', section: 'buildings', unlock: 'Plantable round paver platform — the centre plaza for base_garden_main (not baked into the tile).' },
  // B2 celebration pool — earn rules pending. (The six life-event pieces —
  // stork lantern, vow arbor, laurel scroll, housewarming wreath, desk bell,
  // reunion table — are LIVE milestone earns now, derived from the registry.)
  { key: 'light_string_pole', name: 'Lantern String Pole', section: 'keepsakes', unlock: 'Celebration pool — earn rule pending.' },
  { key: 'gift_stack', name: 'Gift Stack', section: 'keepsakes', unlock: 'Celebration pool — earn rule pending.' },
  { key: 'fireworks_fountain', name: 'Fireworks Fountain', section: 'keepsakes', unlock: 'Celebration pool — earn rule pending.' },
  { key: 'cake_stand', name: 'Celebration Cake Stand', section: 'keepsakes', unlock: 'Celebration pool — earn rule pending.' },
  // B3/B4 art-ready pool — earn rules pending signals (city geo, more categories).
  { key: 'city_key', name: 'City Key', section: 'keepsakes', unlock: 'Art ready — earns when new-city detection ships.' },
  { key: 'pilgrim_stones', name: 'Pilgrim Stones', section: 'keepsakes', unlock: 'Art ready — earns when city-count tracking ships.' },
  { key: 'encore_torch', name: 'Encore Torch', section: 'keepsakes', unlock: 'Art ready — earns with a stadium/concert place category.' },
  { key: 'temple_bell', name: 'Quiet Temple Bell', section: 'keepsakes', unlock: 'Art ready — earns with a temple place category.' },
  { key: 'menagerie_topiary', name: 'Menagerie Topiary', section: 'keepsakes', unlock: 'Art ready — earns with a zoo place category.' },
  { key: 'farm_windmill', name: 'Farm Windmill', section: 'keepsakes', unlock: 'Art ready — earns with a farm place category.' },
  { key: 'harbor_buoy', name: 'Harbor Buoy', section: 'keepsakes', unlock: 'Art ready — earns with a waterfront place category.' },
  { key: 'neon_jar', name: 'Neon Firefly Jar', section: 'keepsakes', unlock: 'Art ready — earns with a nightlife place category.' },
  { key: 'court_hoop', name: 'Court Hoop', section: 'keepsakes', unlock: 'Art ready — earns with a sports place category.' },
  { key: 'garden_arch', name: 'Garden Arch', section: 'keepsakes', unlock: 'Travel/leisure pool — earn rule pending.' },
  { key: 'travel_trunk', name: 'Travel Trunk', section: 'keepsakes', unlock: 'Travel pool — earn rule pending.' },
  { key: 'map_table', name: 'Map Table', section: 'keepsakes', unlock: 'Travel pool — earn rule pending.' },
  { key: 'camp_tent', name: 'Camp Tent', section: 'keepsakes', unlock: 'Travel pool — earn rule pending.' },
  { key: 'journey_globe', name: 'Journey Globe', section: 'keepsakes', unlock: 'Travel pool — earn rule pending.' },
  { key: 'waymarker_flags', name: 'Waymarker Flags', section: 'keepsakes', unlock: 'Travel pool — earn rule pending.' },
  // B5/B9 art-ready pool — earn rules pending signals (photo labels, cuisine/rest metrics).
  { key: 'rainbow_arc', name: 'Rainbow Arc', section: 'keepsakes', unlock: 'Art ready — earns with a rainbow photo label.' },
  { key: 'wheel_totem', name: 'Wheel Totem', section: 'keepsakes', unlock: 'Art ready — earns with a vehicle/bike photo label.' },
  { key: 'ember_ring', name: 'Ember Ring', section: 'keepsakes', unlock: 'Art ready — earns with a campfire photo label.' },
  { key: 'laurel_column', name: 'Laurel Column', section: 'keepsakes', unlock: 'Hero pool — big-achievement earn pending (B11 re-home candidate).' },
  { key: 'dawn_bell', name: 'Dawn Bell', section: 'keepsakes', unlock: 'Art ready — early-riser streak earn pending.' },
  { key: 'poseidon_buoy', name: 'Poseidon Buoy', section: 'keepsakes', unlock: 'Art ready — swim/open-water earn pending.' },
  { key: 'rest_hammock', name: 'Rest Hammock', section: 'keepsakes', unlock: 'Art ready — restful-day earn pending.' },
  { key: 'tea_service', name: 'Tea Service', section: 'keepsakes', unlock: 'Art ready — cozy-evening earn pending.' },
  { key: 'medal_display', name: 'Medal Display', section: 'keepsakes', unlock: 'Art ready — workout-milestone earn pending.' },
  { key: 'zen_fountain', name: 'Zen Fountain', section: 'keepsakes', unlock: 'Art ready — calm-streak earn pending.' },
  // B11 hero pool — epic/legendary earns pending signals.
  { key: 'border_arch', name: 'Border Stamp Arch', section: 'keepsakes', unlock: 'Art ready — earns when new-country detection ships.' },
  { key: 'mythic_perch', name: 'Mythic Perch', section: 'keepsakes', unlock: 'Art ready — earns with your first legendary katchimera.' },
  { key: 'aurora_column', name: 'Aurora Column', section: 'keepsakes', unlock: 'Art ready — earns at five epic discoveries.' },
  // B7 food pool — earn rules pending.
  { key: 'picnic_hamper', name: 'Picnic Hamper', section: 'keepsakes', unlock: 'Art ready — park + food day earn pending.' },
  { key: 'chefs_cloche', name: "Chef's Cloche", section: 'keepsakes', unlock: 'Art ready — fine-dining earn pending.' },
  { key: 'spice_rack', name: 'Spice Rack', section: 'keepsakes', unlock: 'Art ready — cuisine-collection earn pending.' },
  { key: 'teahouse_kettle', name: 'Teahouse Kettle', section: 'keepsakes', unlock: 'Art ready — cozy tea-day earn pending.' },
  { key: 'orchard_crate', name: 'Orchard Crate', section: 'keepsakes', unlock: 'Art ready — farm/harvest earn pending.' },
  { key: 'memory_vault_1', name: 'Memory Vault I', section: 'buildings', unlock: 'Always present — grows with captured media.', variantFamily: 'memory_vault', familyKind: 'level' },
  { key: 'memory_vault_2', name: 'Memory Vault II', section: 'buildings', unlock: 'Vault level 2 — more memories kept.', variantFamily: 'memory_vault', familyKind: 'level' },
  { key: 'memory_vault_3', name: 'Memory Vault III', section: 'buildings', unlock: 'Vault level 3.', variantFamily: 'memory_vault', familyKind: 'level' },
  { key: 'memory_vault_4', name: 'Memory Vault IV', section: 'buildings', unlock: 'Vault level 4 — a grand archive.', variantFamily: 'memory_vault', familyKind: 'level' },
  { key: 'crossroads', name: 'Crossroads', section: 'buildings', unlock: 'Always present — where did I go? (places).' },
  { key: 'journey_hall', name: 'Journey Hall', section: 'buildings', unlock: 'Always present — how did I move? (steps).' },
  { key: 'observatory', name: 'Observatory', section: 'buildings', unlock: 'Always present — what Katchimera noticed.' },
  { key: 'sanctuary', name: 'Sanctuary', section: 'buildings', unlock: 'Always present — how today felt (mood/reflections).' },
  { key: 'study', name: 'The Study', section: 'buildings', unlock: 'Always present — what inspired me (Inspo).' },
  { key: 'food_pavilion', name: 'Food Pavilion', section: 'buildings', unlock: 'Always present — what I savoured.' },
  { key: 'quest_board', name: 'Quest Board', section: 'buildings', unlock: 'Always present — today’s Memory Quests.' },
  { key: 'featured_board', name: 'Featured Memory Board', section: 'buildings', unlock: 'Shows the day’s cover photo.' },
  { key: 'photos_stack', name: 'Photo Stack', section: 'buildings', unlock: 'Memory cluster satellite — photos kept.' },
  { key: 'notes_stack', name: 'Note Stack', section: 'buildings', unlock: 'Memory cluster satellite — notes kept.' },
  { key: 'steps_path_1', name: 'Steps Path I', section: 'buildings', unlock: 'Steps trail — grows with movement.', variantFamily: 'steps_path', familyKind: 'level' },
  { key: 'steps_path_2', name: 'Steps Path II', section: 'buildings', unlock: 'Steps trail level 2.', variantFamily: 'steps_path', familyKind: 'level' },
  { key: 'steps_path_3', name: 'Steps Path III', section: 'buildings', unlock: 'Steps trail level 3.', variantFamily: 'steps_path', familyKind: 'level' },
  { key: 'steps_path_4', name: 'Steps Path IV', section: 'buildings', unlock: 'Steps trail level 4 — a winding path.', variantFamily: 'steps_path', familyKind: 'level' },
  { key: 'sleep_nook_good', name: 'Sleep Nook (rested)', section: 'buildings', unlock: 'Sleep logged: good.', variantFamily: 'sleep_nook', familyKind: 'state' },
  { key: 'sleep_nook_normal', name: 'Sleep Nook (steady)', section: 'buildings', unlock: 'Sleep logged: normal.', variantFamily: 'sleep_nook', familyKind: 'state' },
  { key: 'sleep_nook_low', name: 'Sleep Nook (low)', section: 'buildings', unlock: 'Sleep logged: low.', variantFamily: 'sleep_nook', familyKind: 'state' },
  { key: 'sleep_nook_empty', name: 'Sleep Nook (empty)', section: 'buildings', unlock: 'Sleep not logged yet.', variantFamily: 'sleep_nook', familyKind: 'state' },
  { key: 'mood_monument_empty', name: 'Mood Monument (unset)', section: 'buildings', unlock: 'Mood not logged yet.', variantFamily: 'mood_monument', familyKind: 'state' },
  { key: 'mood_monument_radiant', name: 'Mood Monument (radiant)', section: 'buildings', unlock: 'Mood: radiant.', variantFamily: 'mood_monument', familyKind: 'state' },
  { key: 'mood_monument_light', name: 'Mood Monument (light)', section: 'buildings', unlock: 'Mood: light.', variantFamily: 'mood_monument', familyKind: 'state' },
  { key: 'mood_monument_meh', name: 'Mood Monument (meh)', section: 'buildings', unlock: 'Mood: meh.', variantFamily: 'mood_monument', familyKind: 'state' },
  { key: 'mood_monument_heavy', name: 'Mood Monument (heavy)', section: 'buildings', unlock: 'Mood: heavy.', variantFamily: 'mood_monument', familyKind: 'state' },
  { key: 'mood_monument_stormy', name: 'Mood Monument (stormy)', section: 'buildings', unlock: 'Mood: stormy.', variantFamily: 'mood_monument', familyKind: 'state' },
  { key: 'sleep_tile_good', name: 'Sleep Tile (sundial)', section: 'buildings', unlock: 'Sleep atmosphere: good.', variantFamily: 'sleep_tile', familyKind: 'state' },
  { key: 'sleep_tile_normal', name: 'Sleep Tile (lantern)', section: 'buildings', unlock: 'Sleep atmosphere: normal.', variantFamily: 'sleep_tile', familyKind: 'state' },
  { key: 'sleep_tile_low', name: 'Sleep Tile (moon)', section: 'buildings', unlock: 'Sleep atmosphere: low.', variantFamily: 'sleep_tile', familyKind: 'state' },
  { key: 'studio_shelf', name: 'Studio Shelf', section: 'buildings', unlock: 'The inspiration archive nook.' },
  { key: 'food_market', name: 'Food Market', section: 'buildings', unlock: 'The food memories stall.' },
  { key: 'town_hall', name: 'Town Hall (cottage)', section: 'buildings', unlock: 'Keeps the day’s story — Chronicle reader.' },
  { key: 'egg_pedestal_01', name: 'Egg Pedestal', section: 'buildings', unlock: 'Seats the day’s egg at the island centre.' },

  // --- Earned keepsakes / bloom decor: DERIVED from world-objects (see below).
  // Only the non-rule extras are hand-kept here.
  { key: 'gift_crate', name: 'Gift Crate', section: 'keepsakes', unlock: 'Appears while keepsakes wait on the shelf.' },

  // --- Discovery artefacts -----------------------------------------------------
  { key: 'artefact_museum_banner', name: 'Museum Banner', section: 'artefacts', unlock: 'Discovery milestone (life patterns).' },
  { key: 'artefact_voice_crystal', name: 'Voice Crystal', section: 'artefacts', unlock: 'Discovery: voice reflections kept.' },
  { key: 'artefact_festival_tree', name: 'Festival Tree', section: 'artefacts', unlock: 'Discovery: celebrations lived.' },
  { key: 'artefact_golden_arch', name: 'Golden Arch', section: 'artefacts', unlock: 'Discovery milestone.' },
  { key: 'artefact_life_monument', name: 'Life Monument', section: 'artefacts', unlock: 'Discovery: a lifetime milestone.' },
  { key: 'artefact_journey_monument', name: 'Journey Monument', section: 'artefacts', unlock: 'Discovery: distance travelled.' },
  { key: 'artefact_trail_bridge', name: 'Trail Bridge', section: 'artefacts', unlock: 'Discovery: journeys taken.' },
  { key: 'artefact_memory_lantern', name: 'Memory Lantern', section: 'artefacts', unlock: 'Discovery: memories kept.' },

  // --- Occasions (Big Moment milestones — one per type) -------------------------
  { key: 'milestone_birthday', name: 'Birthday Cake', section: 'milestones', unlock: 'Big Moment: birthday.', variantFamily: 'milestone', familyKind: 'state' },
  { key: 'milestone_anniversary', name: 'Anniversary Rings', section: 'milestones', unlock: 'Big Moment: anniversary.', variantFamily: 'milestone', familyKind: 'state' },
  { key: 'milestone_firsttime', name: 'First-Time Star', section: 'milestones', unlock: 'Big Moment: a first time.', variantFamily: 'milestone', familyKind: 'state' },
  { key: 'milestone_holiday', name: 'Holiday Tree', section: 'milestones', unlock: 'Big Moment: holiday.', variantFamily: 'milestone', familyKind: 'state' },
  { key: 'milestone_trip', name: 'Trip Signpost', section: 'milestones', unlock: 'Big Moment: a trip.', variantFamily: 'milestone', familyKind: 'state' },
  { key: 'milestone_achievement', name: 'Achievement Trophy', section: 'milestones', unlock: 'Big Moment: an achievement.', variantFamily: 'milestone', familyKind: 'state' },
  { key: 'milestone_monument', name: 'Milestone Stone', section: 'milestones', unlock: 'Big Moment: a milestone.', variantFamily: 'milestone', familyKind: 'state' },

  // --- Progression sets (level families) ----------------------------------------
  { key: 'memory_photos_1', name: 'Photo Display I', section: 'progression', unlock: 'Photos kept — level 1.', variantFamily: 'memory_photos', familyKind: 'level' },
  { key: 'memory_photos_2', name: 'Photo Display II', section: 'progression', unlock: 'Photos kept — level 2.', variantFamily: 'memory_photos', familyKind: 'level' },
  { key: 'memory_photos_3', name: 'Photo Display III', section: 'progression', unlock: 'Photos kept — level 3.', variantFamily: 'memory_photos', familyKind: 'level' },
  { key: 'memory_photos_4', name: 'Photo Tree IV', section: 'progression', unlock: 'Photos kept — level 4.', variantFamily: 'memory_photos', familyKind: 'level' },
  { key: 'place_marker_1', name: 'Waypoint I', section: 'progression', unlock: 'Places visited — level 1.', variantFamily: 'place_marker', familyKind: 'level' },
  { key: 'place_marker_2', name: 'Waypoint II', section: 'progression', unlock: 'Places visited — level 2.', variantFamily: 'place_marker', familyKind: 'level' },
  { key: 'place_marker_3', name: 'Waypoint III', section: 'progression', unlock: 'Places visited — level 3.', variantFamily: 'place_marker', familyKind: 'level' },
  { key: 'place_marker_4', name: 'Lookout IV', section: 'progression', unlock: 'Places visited — level 4.', variantFamily: 'place_marker', familyKind: 'level' },
  { key: 'journey_1', name: 'Trail Marker I', section: 'progression', unlock: 'Movement — level 1.', variantFamily: 'journey', familyKind: 'level' },
  { key: 'journey_2', name: 'Trail Signpost II', section: 'progression', unlock: 'Movement — level 2.', variantFamily: 'journey', familyKind: 'level' },
  { key: 'journey_3', name: 'Footbridge III', section: 'progression', unlock: 'Movement — level 3.', variantFamily: 'journey', familyKind: 'level' },
  { key: 'journey_4', name: 'Journey Monument IV', section: 'progression', unlock: 'Movement — level 4.', variantFamily: 'journey', familyKind: 'level' },
  { key: 'notes_1', name: 'Open Diary I', section: 'progression', unlock: 'Notes kept — level 1.', variantFamily: 'notes_desk', familyKind: 'level' },
  { key: 'notes_2', name: 'Journal & Quill II', section: 'progression', unlock: 'Notes kept — level 2.', variantFamily: 'notes_desk', familyKind: 'level' },
  { key: 'notes_3', name: 'Writing Desk III', section: 'progression', unlock: 'Notes kept — level 3.', variantFamily: 'notes_desk', familyKind: 'level' },
  { key: 'notes_4', name: 'Desk Shrine IV', section: 'progression', unlock: 'Notes kept — level 4.', variantFamily: 'notes_desk', familyKind: 'level' },

];

// Assembly: derived earnables lead; when a derived key collides with a
// hand entry (an artefact/milestone/legacy prop that ALSO has an earn rule),
// the hand entry keeps its section/family and gains the derived unlock line —
// one entry per asset, no duplicates.
export const WORLD_ASSET_CATALOG: WorldAssetEntry[] = (() => {
  const derived = new Map(derivedEarnableEntries().map((entry) => [entry.key, entry]));
  const merged = HAND_WORLD_ASSETS.map((hand) => {
    const extra = derived.get(hand.key);
    if (!extra) return hand;
    derived.delete(hand.key);
    return { ...hand, unlock: `${hand.unlock} Also ${extra.unlock}` };
  });
  return [...derived.values(), ...merged];
})();

// Entries grouped by section, in section order — the shape the lab renders.
export function catalogBySection(): { section: (typeof WORLD_ASSET_SECTIONS)[number]; entries: WorldAssetEntry[] }[] {
  return WORLD_ASSET_SECTIONS.map((section) => ({
    section,
    entries: WORLD_ASSET_CATALOG.filter((entry) => entry.section === section.id),
  }));
}

// All members of an entry's variant family (itself included), catalog order.
export function familyMembers(entry: WorldAssetEntry): WorldAssetEntry[] {
  if (!entry.variantFamily) return [entry];
  return WORLD_ASSET_CATALOG.filter((candidate) => candidate.variantFamily === entry.variantFamily);
}

// ---------------------------------------------------------------------------
// Per-asset earn rules — the SPECIFIC unlock breakdown the detail page shows.
// Resolved live from the registry (spec → describeUnlockSpec sentence), so the
// lab always states exactly what the evaluator checks.
// ---------------------------------------------------------------------------

export type AssetEarnRule = {
  lane: string; // "Daily signature", "Milestone", "Bloom gift", …
  name: string; // owning definition's display name
  rule: string; // the precise condition, human-readable
  rarity?: string;
  repeat?: string; // "returns every year" / "one per subject" — absent = once
  hint?: string;
};

const REPEAT_PHRASES: Record<string, string> = {
  perYear: 'returns every year',
  perSubject: 'one per subject (first time each)',
};

function ruleFromDefinition(definition: WorldObjectDefinition, lane: string, assetKey: string): AssetEarnRule {
  let rule = definition.unlock ? describeUnlockSpec(definition.unlock) : definition.name;
  // Subject families: say which subject THIS variant is (the lantern's family).
  if (definition.repeat === 'perSubject' && definition.art.variants.length > 1) {
    const index = definition.art.variants.indexOf(assetKey);
    const subject = index >= 0 ? CUISINE_FAMILIES[index] : undefined;
    if (subject) rule = `${rule} — this variant: ${CUISINE_FAMILY_LABELS[subject] ?? subject}`;
  }
  return {
    lane,
    name: definition.name,
    rule,
    rarity: definition.rarity,
    repeat: definition.repeat ? REPEAT_PHRASES[definition.repeat] : undefined,
    hint: definition.hint,
  };
}

export function earnRulesForAssetKey(assetKey: string): AssetEarnRule[] {
  const rules: AssetEarnRule[] = [];

  SIGNATURE_KEEPSAKES.forEach((definition, index) => {
    if (!definition.art.variants.includes(assetKey)) return;
    rules.push({
      ...ruleFromDefinition(definition, 'Daily signature', assetKey),
      lane: `Daily signature · priority ${index + 1} (max 2 fire per day)`,
    });
  });

  for (const definition of MILESTONE_KEEPSAKES) {
    if (!definition.art.variants.includes(assetKey)) continue;
    rules.push(ruleFromDefinition(definition, 'Milestone (lifetime lane)', assetKey));
  }

  for (const definition of BLOOM_COMMONS) {
    if (definition.art.variants.includes(assetKey)) {
      rules.push({
        lane: 'Bloom gift (daily drip)',
        name: definition.name,
        rule: 'Guaranteed daily earn — species picked per day (mood-biased), this variant per grant.',
      });
    }
    const grove = groveForSpecies(definition.id);
    if (grove && grove.assetKey === assetKey) {
      rules.push({
        lane: 'Grove merge (sink)',
        name: grove.name,
        rule: `Merge ${GROVE_MERGE_COUNT} unplanted ${definition.name} keepsakes from the tray.`,
        rarity: 'uncommon',
      });
    }
  }

  for (const [tier, definition] of Object.entries(DISCOVERY_TIER_KEEPSAKES)) {
    if (!definition.art.variants.includes(assetKey)) continue;
    rules.push({
      lane: 'Discovery keepsake',
      name: definition.name,
      rule: `Granted with any ${tier} Discovery that has no bespoke prop mapped.`,
      rarity: tier,
    });
  }

  for (const prop of WORLD_PROP_CATALOG) {
    if (prop.assetKey !== assetKey) continue;
    rules.push({
      lane: prop.unlockKind === 'starter' ? 'Starter seed' : 'World prop unlock',
      name: prop.name,
      rule: prop.unlockKind === 'starter' ? `First Seed choice — ${prop.description}` : prop.lockedLabel,
    });
  }

  return rules;
}
