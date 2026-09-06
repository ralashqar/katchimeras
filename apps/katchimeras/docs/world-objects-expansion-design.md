# World Objects Expansion — Design

**Status: DESIGN (nothing built).** Extends the proven registry in
`constants/world-objects.ts` (declarative `UnlockSpec` + one evaluator +
variant families + provenance labels). Everything here is data-first: adding
an object stays "add ONE definition"; adding an earn-source stays "add one
spec kind to one evaluator".

---

## 1. Vision & principles

- **Every object is a receipt for something lived.** Provenance is the
  product: the almanac line under each prop ("Kyoto · first time in Japan",
  "10 books finished") matters more than the sprite.
- **Rarity from living, not luck.** Rare objects come from rare *life events*
  (a new country, a 365th day, a summit), never from weighted dice.
- **One registry, many lanes.** Day-lane (today's record), lifetime-lane
  (streaks/counts/tenure), subject-lane (per-country, per-cuisine — dedup by
  subject key), event-lane (discoveries, social). All read the same
  definitions.
- **Art is batched, assigned by data.** Objects declare an `artBatch`; art is
  produced later in 4×4 (commons) or 2×2 (heroes) grid generations through the
  existing Asset Lab pipeline (iso guide + main-tile style ref + BiRefNet-heavy
  matte for props with gaps). Until a batch lands, objects fall back to their
  family's tier fallback — the catalog can ship data-complete before art.

## 2. Rarity model

| Tier | Feel | Earn class | Target count |
|---|---|---|---|
| `common` | everyday greens | daily bloom pool | ~20 |
| `uncommon` | "nice day" keepsakes | signature days, place categories | ~30 |
| `rare` | weeks of living / first-times | streaks, firsts, far travel, special photo subjects | ~25 |
| `epic` | chapters of a life | tenure 100, new country, big celebrations, 10× counts | ~15 |
| `legendary` | once-a-year-or-less | tenure 365, marathon week, leap day, mythic hatch | ~8 |

Visual language per tier (for the art batches): commons = plain planters;
uncommon = crafted objects; rare = glowing accents; epic = monuments with gold
trim; legendary = large multi-part monuments with light effects.

## 3. Earn-source taxonomy (lanes × signals)

| Lane | Signal source | Availability |
|---|---|---|
| A. Daily signature | day record metrics (exists) | ✅ now |
| B. Bloom commons | bloom points (exists) | ✅ now |
| C. Streaks & tenure | lifetime fold over days | 🔧 extend `deriveKingdom` fold |
| D. Places & geography | confirmedPlaces + coords + home anchor | 🔧 needs `place.category` + geo lookups |
| E. Big Moments & celebrations | bigMoments (exists) + calendar windows | ✅ / 🔧 calendar |
| F. Country & landmark souvenirs | reverse-geocoded country/POI | 🔧 geo plumbing |
| G. Photo-subject keepsakes | on-device Vision labels (exists) | ✅ (needs label → spec wiring) |
| H. Inspo / Studio | studioMoments + lifetime counts | ✅ / 🔧 counts |
| I. Food journey | foodMoments (+ cuisine tag) | 🔧 needs cuisine tag on food moment |
| J. Movement | steps, stepsInterpretation, workouts | ✅ now |
| K. Sleep & mornings | sleep log (exists) | ✅ now |
| L. Social & sharing | future event bus | 🔮 designed now, wired later |
| M. Calendar one-offs | date windows | 🔧 trivial |

## 4. Data model extensions

### 4.1 New day metrics (`DayMetricId`)
`voiceNotes`, `photosKept`, `moodLogged` (0/1), `sleepLogged` (0/1),
`goodSleep` (0/1), `newPlaces` (first-visit places today),
`distanceFromHomeKm` (max over day's confirmed places/geotags).

### 4.2 New spec kinds (`UnlockSpec`)

```ts
| { kind: 'placeCategory'; category: PlaceCategoryId }        // park, beach, museum…
| { kind: 'newGeo'; scope: 'place' | 'city' | 'country' }     // first-ever visit
| { kind: 'distanceFromHome'; gteKm: number }
| { kind: 'photoLabel'; label: string }                        // Vision concept id
| { kind: 'moodIs'; mood: MoodId }
| { kind: 'bigMomentType'; type: BigMomentTypeId }             // birthday, wedding…
| { kind: 'calendar'; window: CalendarWindowId }               // newYear, leapDay…
// LIFETIME lane (evaluated by the kingdom fold, not per-day):
| { kind: 'streak'; of: UnlockSpec; days: number }
| { kind: 'tenure'; daysLived: number }
| { kind: 'lifetimeCount'; of: UnlockSpec; gte: number }       // "10 books"
// EVENT lane (pushed, not derived):
| { kind: 'social'; event: SocialEventId }                     // future bus
```

`PlaceCategoryId` = `park | beach | mountain | museum | cafe | restaurant |
stadium | theatre | zoo | library | landmark | waterfront | market | temple |
nightlife | airport`. Source: MapKit POI category at confirm time, with a
manual category picker fallback in the place-confirm sheet (works offline,
zero-API).

### 4.3 New definition fields

```ts
rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
setId?: string;              // display grouping in the almanac ("Traveler's Set")
repeat?: 'daily' | 'once' | 'perSubject';  // perSubject dedup key from the spec
subjectKey?: 'country' | 'city' | 'cuisine' | 'photoLabel' | 'placeCategory';
artBatch?: string;           // which generation grid produces this art
footprintShape?: 'diamond' | 'circle';     // for the iso generation guide
```

New label tokens: `{countryLine}`, `{cityLine}`, `{distanceLine}`,
`{streakLine}`, `{cuisineLine}`, `{photoLabelLine}`, `{tenureLine}`,
`{socialLine}`.

### 4.4 Engines
- **Day lane** (exists): unchanged, evaluates non-lifetime specs on hatch.
- **Lifetime lane**: `deriveKingdom`'s fold gains streak/tenure/count
  counters; grants fire the day a threshold crosses (grant id =
  `objectId@dayId`, deterministic like today).
- **Subject lane**: `perSubject` grants dedup on `objectId@subject` (e.g.
  `country_souvenir@JP`) — one souvenir per country, per cuisine, etc.
- **Event lane**: discoveries (exists) + future `recordSocialEvent(event)`
  which appends to a persisted event log the fold reads. Social ships as data
  now, fires only when the bus exists.

## 5. THE CATALOG (≈115 objects)

Legend: rarity C/U/R/E/L · repeat d=daily o=once s=perSubject · batch = §7.

### A. Daily signature (existing 7 + 6 new) — uncommon, daily
| id | name | unlock | batch |
|---|---|---|---|
| *(existing 7: bunting, trail stone, wayfinder, picnic basket, book stack, wildflowers, keeper's lantern)* | | | — |
| dream_bell | Dream Bell | goodSleep ≥1 | B9 |
| sun_charm | Sun Charm | moodIs radiant | B9 |
| memory_prism | Memory Prism | capturedMeanings ≥1 | B5 |
| echo_shell | Echo Shell | voiceNotes ≥1 | B5 |
| harmony_wreath | Harmony Wreath | all: mood+sleep+food+note in one day | B2 |
| dusk_snapper | Golden Hour Frame | photosKept ≥3 | B5 |

### B. Bloom commons (existing 9 + 7 new) — common, daily pool
lavender_patch, cattail_cluster, bird_bath, butterfly_bush, stone_lantern,
pumpkin_patch *(autumn-weighted)*, snowdrop_bed *(winter-weighted)* — batch B1.

### C. Streaks & tenure — the "keep living" ladder
| id | name | R | unlock | repeat |
|---|---|---|---|---|
| thinkers_bench | Thinker's Bench | U | streak(reflections≥1, 3d) | o |
| striders_obelisk | Strider's Obelisk | R | streak(steps≥8000, 7d) | o |
| calm_weathervane | Weathervane of Calm | R | streak(moodLogged, 7d) | o |
| month_ring | Month Ring | R | streak(any log, 30d) | o |
| founding_stone | Founding Stone | U | tenure 30 | o |
| century_pillar | Century Pillar | E | tenure 100 | o |
| year_monument | Year Monument | L | tenure 365 | o |
| chronicler_desk | Chronicler's Desk | R | lifetimeCount(notes≥1, 100) | o |
*(batch B11 for E/L monuments, B3 otherwise)*

### D. Places & geography — uncommon-to-epic, mostly perSubject/once
| id | name | R | unlock |
|---|---|---|---|
| park_kite | Park Kite Bench | U | placeCategory park (d) |
| tidepool_basin | Tidepool Basin | U | placeCategory beach (s) |
| summit_flag | Summit Flag | R | placeCategory mountain + hike (o) |
| curio_obelisk | Curio Obelisk | U | placeCategory museum (s) |
| corner_cart | Corner Café Cart | U | streak(placeCategory cafe, 3d) (o) |
| encore_torch | Encore Torch | R | placeCategory stadium/theatre (s) |
| menagerie_topiary | Menagerie Topiary | U | placeCategory zoo (o) |
| whisper_archive | Whisper Archive | U | placeCategory library (o) |
| temple_bell | Quiet Temple Bell | R | placeCategory temple (s) |
| harbor_buoy | Harbor Buoy | U | placeCategory waterfront (s) |
| market_awning | Market Awning | U | placeCategory market (s) |
| neon_jar | Neon Firefly Jar | U | placeCategory nightlife (o) |
| wonder_miniature | Wonder Miniature | R | placeCategory landmark (s) |
| milepost_50 | Day-Tripper Milepost | U | distanceFromHome ≥50km (d) |
| voyager_compass | Voyager Compass | R | distanceFromHome ≥500km (o/yr) |
| meridian_globe | Meridian Globe | E | distanceFromHome ≥3000km (o) |
| city_key | City Key | R | newGeo city (s) |
| border_arch | Border Stamp Arch | E | newGeo country (o — first foreign country) |
*(batches B3 travel, B4 place categories)*

### E. Big Moments & celebrations (existing 7 milestones + new)
| id | name | R | unlock |
|---|---|---|---|
| stork_lantern | Stork Lantern | E | bigMomentType baby (o) |
| vow_arbor | Vow Arbor | E | bigMomentType wedding (o) |
| laurel_scroll | Laurel & Scroll | E | bigMomentType graduation (s) |
| housewarming_wreath | Housewarming Wreath | R | bigMomentType newHome (s) |
| desk_bell | Ribbon Desk Bell | R | bigMomentType newJob (s) |
| reunion_table | Reunion Long Table | R | bigMomentType reunion (d) |
| birthday_crown | Birthday Crown Pedestal | R | bigMomentType birthday (o/yr) |
| countdown_orb | Countdown Orb | R | calendar newYear (o/yr) |
| garland_arch | Winter Garland Arch | R | calendar winterLights (o/yr) |
| harvest_horn | Harvest Horn | U | calendar harvest (o/yr) |
| maypole | Spring Maypole | U | calendar firstSpring (o/yr) |
| leap_clock | Leap Day Clock | L | calendar leapDay (o) |
*(batch B2)*

### F. Country & landmark souvenirs — the travel crown jewels
- `country_souvenir` — **E, perSubject(country)**: a stylized plinth miniature
  evoking the country (landmark silhouette + national flower; no flags, no
  text). **Lazy art**: seeded wave for the 20 most-likely countries (JP FR IT
  ES UK US DE GR TR TH AE EG MA PT NL CH AT MX BR KR), each a single hero
  generation; unmatted countries fall back to `border_arch` art with the
  country provenance line until their art is generated (the pipeline makes
  per-country generation a one-command batch).
- `hometown_plaque` — R, once: 30 confirmed places inside home city.
- `pilgrim_stones` — R, once: 10 distinct cities visited.

### G. Photo-subject keepsakes (Vision labels; perSubject unless noted)
| id | name | R | label |
|---|---|---|---|
| pet_pedestal | Companion Statue | R | pet/dog/cat (first pet photo) |
| dusk_mirror | Dusk Mirror | U | sunset |
| snow_globe | Snow Day Globe | U | snow |
| rainbow_arc | Rainbow Arc | R | rainbow |
| gathering_table | Gathering Table | U | group of friends (d) |
| skyline_diorama | Skyline Diorama | U | cityscape |
| ember_ring | Ember Ring | U | campfire/bonfire |
| buskers_case | Busker's Case | U | musical instrument |
| wheel_totem | Wheel Totem | U | bicycle |
| bloom_bouquet | Bouquet Vase | C | flowers (d) |
| forest_heart | Forest Heart | U | forest/trees hike photo |
| sea_glass | Sea Glass Bowl | U | ocean/sea |
*(batches B5/B6)*

### H. Inspo / Studio milestones
| id | name | R | unlock |
|---|---|---|---|
| bound_volume | Bound Volume Plinth | U | first book finished (o) |
| library_totem | Stacked Library Totem | R | lifetimeCount(books, 10) (o) |
| reel_lantern | Reel Lantern | U | first film kept (o) |
| marquee_sign | Marquee Sign | R | lifetimeCount(films, 25) (o) |
| melody_chime | Melody Chime | U | music inspo kept (o) |
*(batch B8)*

### I. Food journey (needs `cuisine` tag on food moments — picker or FM guess)
| id | name | R | unlock |
|---|---|---|---|
| cuisine_lantern | Cuisine Lantern | U | perSubject(cuisine) first-time cuisine — 8 art variants by cuisine family |
| hearth_pot | Hearth Pot | R | streak(homeCooked, 7d) (o) |
| sugar_pagoda | Sugar Pagoda | U | lifetimeCount(desserts, 5) (o) |
| grocers_stand | Grocer's Stand | U | placeCategory market + foodMoment (o) |
*(batch B7)*

### J. Movement
| id | name | R | unlock |
|---|---|---|---|
| iron_boots | Iron Boots Statue | R | steps ≥20000 (o) |
| laurel_column | Laurel Column | E | week distance ≥42km (o) |
| cairn_tower | Cairn Tower | R | lifetimeCount(hikes, 10) (o) |
| poseidon_buoy | Poseidon Buoy | U | workout swim (o) |
*(batch B9)*

### K. Sleep & mornings
| id | name | R | unlock |
|---|---|---|---|
| moonpetal_bed | Moonpetal Bed | R | streak(goodSleep, 7d) (o) |
| dawn_bell | Dawn Bell | U | streak(earlyLog <8am, 5d) (o) |
*(batch B9)*

### L. Social & sharing (designed now, fires when the bus exists)
| id | name | R | event |
|---|---|---|---|
| postcard_stand | Postcard Stand | U | first day-card shared (o) |
| gallery_easel | Gallery Easel | R | 10 shares (o) |
| friendship_arch | Friendship Arch | R | invited friend joined (s) |
| gift_fountain | Gift Fountain | R | received friend gift (d) |
| festival_float | Festival Float | E | community event participated (s) |
| story_beacon | Beacon of Stories | E | 8-week share streak (o) |
*(batch B10)*

### M. Mythic one-offs
| id | name | R | unlock |
|---|---|---|---|
| mythic_perch | Mythic Perch | L | first legendary katchimera hatched (o) |
| harmony_prism | Harmony Prism | E | 7 harmony_wreath days (o) |
| aurora_column | Aurora Column | L | epic discovery ×5 (o) |

## 6. Economy guardrails
- Daily grants capped as today (2 signature) **plus at most 1 place-lane and
  1 photo-lane grant/day** — rarest wins ties.
- Lifetime/subject grants are uncapped (naturally rare) and land in the gift
  tray, never auto-planted.
- `perSubject` dedup keys stored in `KingdomState.earnedSubjects:
  Record<objectId, string[]>`.
- Nothing here spends Essence — this is the earn side; the shop
  (progression-customisation spec) remains separate.

## 7. Art production plan (4×4 / 2×2 batches)
Every batch: main-tile + one existing keepsake as style refs, iso prop guide
(diamond or circle per object), "each cell exactly ONE object on solid black,
same camera in every cell" — through the existing grid mode; per-cell
BiRefNet-heavy matte on Keep (props have gaps); promote via the optimizer.

| Batch | Grid | Contents |
|---|---|---|
| B1 bloom expansion | 4×4 | 7 new commons + 9 refresh variants |
| B2 celebrations | 4×4 | E-lane set |
| B3 travel & tenure | 4×4 | mileposts, compass, city key, founding/century… |
| B4 place categories | 4×4 | park→nightlife set |
| B5 photo subjects I | 4×4 | prism, shell, frame, mirror, globe, arc… |
| B6 photo subjects II | 4×4 | diorama, ember ring, case, totem… |
| B7 food journey | 4×4 | 8 cuisine lanterns + pot/pagoda/stand |
| B8 studio | 4×4 | volumes, totem, reel, marquee, chime + spares |
| B9 body & rest | 4×4 | movement + sleep sets |
| B10 social | 4×4 | postcard→beacon |
| B11 monuments | 2×2 ×3 | epic/legendary heroes at detail resolution |
| B12 country wave 1 | singles ×20 | country souvenirs (hero pipeline) |

## 9. Supply balance — the daily drip

**Rule zero: a hatched day NEVER yields nothing.** The bloom lane guarantees
plantable commons before any conditional lane runs.

### 9.1 Daily yield ladder (dialable in `data/world-economy.json`)
| Engagement | What happened | Commons | Conditional lanes | Total/day |
|---|---|---|---|---|
| Zero-input | day merely hatched | **1** (guaranteed day-bloom) | — | 1 |
| Light | any 1–2 logs (≥3 bloom pts) | 2 | 0–1 signature | 2–3 |
| Engaged | 3+ categories (≥6 bloom pts) | 3 | up to 2 signature + 1 place + 1 photo | 3–6 |

- Commons draw from the 16-object bloom pool, **each with ≥4 art variants**
  (deterministic per grant id) → a week of trees never looks repeated.
  This is what batch B1's 4×4 grids are for: 4 variants × 4 commons per grid.
- Everything lands in the **gift tray (inventory, uncapped)** — planting is
  the player's act; supply never blocks on placement.
- Expected weekly supply: casual ≈ 10 items, engaged ≈ 25.

### 9.2 Sinks (so late-game trays don't rot)
1. **Grove merge**: 3 identical commons → 1 uncommon "grove" variant of the
   same species (bigger, denser art — same batch, 1 extra cell per species).
2. **Essence conversion**: duplicate `perSubject`/`once` grants auto-convert
   to Essence (hooks into progression-customisation spec; until Essence
   ships, duplicates simply don't re-grant).
3. **Seasonal rotation**: commons can be re-styled per season later (variant
   families make this free).

## 10. Territory expansion — when the world grows a tile

### 10.1 Model
The Kingdom starts as 1 tile (`base_garden_main`). Expansion tiles attach at
edge-midpoint offsets (adjacency + road continuity already proven). Order,
sides and requirements are **authored data**, not code:

```jsonc
// data/world-expansion.json
{
  "capacityPerTile": 24,          // plantable slots per tile (lawn cells)
  "pressureGate": 0.6,            // must have planted ≥60% of current capacity
  "tiles": [
    { "index": 2, "side": "ne", "requires": { "daysLived": 5,  "propsPlanted": 8 } },
    { "index": 3, "side": "sw", "requires": { "daysLived": 14, "propsPlanted": 20, "discoveries": 1 } },
    { "index": 4, "side": "se", "requires": { "daysLived": 30, "propsPlanted": 40, "discoveries": 3 } },
    { "index": 5, "side": "nw", "requires": { "daysLived": 60, "propsPlanted": 70, "epicDiscoveries": 1 } }
  ],
  // Beyond the authored list (ring 2+), a formula takes over:
  "formula": { "daysPerTile": 30, "propsPerTile": 35 }
}
```

- **Two-condition trigger**: requirement thresholds (the *milestone feel* —
  readable in a "Land Deeds" progress sheet: "Next land: 12/20 props · 9/14
  days") **AND** the pressure gate (≥60% of current slots actually planted),
  so new land never arrives while the old land is empty.
- Requirement counters come from the existing lifetime fold: `daysLived`
  (= katchimeras hatched), `propsPlanted` (placements, not grants),
  `discoveries` / `epicDiscoveries`. All four are already derivable.
- At most **one pending expansion** at a time; conditions are checked at
  morning arrival (same moment the arrival ceremony already runs).

### 10.2 Balance check (supply vs capacity)
Engaged player plants ~2.5/day of a ~3.5/day supply:
| Tile unlock | ~day | capacity | planted by then |
|---|---|---|---|
| 2 | 5–7 | 48 | ~15 |
| 3 | 14–16 | 72 | ~38 |
| 4 | 30 | 96 | ~75 |
| 5 | 55–60 | 120 | ~110 |
| 6+ | every ~30d | +24 | supply ≈ capacity with sinks |

Cadence: first expansion inside week 1 (the hook), then a steady
every-2-to-4-weeks rhythm. Casual players hit the same gates ~2× slower —
the pressure gate keeps their world dense rather than sparse. Dial knobs:
`capacityPerTile`, `pressureGate`, per-tile `requires`, `formula`.

### 10.3 The announcement & ceremony
1. **Foreshadow**: when a requirement crosses 80%, the Land Deeds sheet and a
   Kingdom HUD chip show "New land soon — 18/20 props".
2. **Grant moment** (at morning arrival, reusing the K3 ceremony frame):
   banner "Your Kingdom grows 🌱" → camera pans to the target edge → the new
   tile **rises from below with a soft overshoot** (translateY + fade +
   scale 0.96→1, dust/sparkle motes at the seam), roads visibly connecting →
   confetti beat → camera returns. Skippable by tap.
3. **Persist**: `KingdomState.expansions: [{ index, side, unlockedDayId }]` —
   the ceremony replays never; the tile renders forever after via the
   (generalized) neighbor-tile mechanism, pan bounds already union all tiles.
4. **Empty-tile invitation**: the new tile spawns with a one-time "3 free
   plantings glow" hint so the player immediately claims it.

### 10.4 Build notes
- world-canvas: generalize `kingdomNeighbor` (one data-flagged tile) into
  `expansionTiles[]` rendered from KingdomState — same painter's order and
  bounds fold, list instead of single.
- Slot model: plantable cells per tile derived from the 8×8 lattice minus
  road/border cells (matches `capacityPerTile` ≈ 24); placement UX unchanged
  (customise mode), tiles addressed by (tileIndex, cell).

## 11. Phasing
1. **P0 — model:** spec kinds, metrics, definition fields, engines (no art);
   `world-economy.json` + `world-expansion.json` data files.
2. **P1 — daily drip + catalog data:** §9 yield ladder live; enter §5 into
   the registry with tier-fallback art → whole economy playable immediately.
3. **P2 — territory:** expansion evaluator + generalized expansion tiles in
   world-canvas + Land Deeds progress + grow ceremony (§10).
4. **P3 — signals:** place categories (MapKit + manual picker), cuisine tag,
   photo-label wiring, calendar windows.
5. **P4 — art batches:** B1–B9 through the lab; swap fallbacks as they land.
6. **P5 — heroes & sinks:** B11 monuments, B12 countries, grove merge.
7. **P6 — social:** event bus + L-lane wiring when sharing features ship.
