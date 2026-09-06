# World Structures — Cozy Collectible Direction

**Status:** Direction + asset plan (Phase 0). Base island swapped to the new cozy
style (`base_env2`). Structure art + consolidation NOT built yet — this doc is the
brief the build follows. **§9 is the FINAL recommended design** (storage-vs-meaning
architecture + Memory cluster + Featured Board); it refines §3's storage stance.

Supersedes the dark-fantasy / premium-3D-CG structure look in
[world-base-pipeline.md](world-base-pipeline.md) and the memory note
`world-iso-graphics-redesign`. The base + objects move to a single, coherent
**Cozy Collectible Diorama** language.

---

## 1. Why this shift

The structures grew piecemeal (a user house cottage, a dark-fantasy studio/library,
a quest board, etc.) in different looks. We're consolidating to **one premium,
readable, cozy collectible style** — closer to Monument Valley / Travel Town / Merge
Mansion / Royal Match and designer-toy figurines than to medieval fantasy. Goals:
instantly readable on a phone, App-Store-premium, Instagrammable, timeless, cozy,
iconic, animatable, and scalable from thumbnail to full screen.

We also **consolidate the building set** from the current sprawl (photos, notes,
places, steps, sleep, food, studio, chronicle/town-hall, quests) down to **7 clear
buildings**, each answering one human question.

---

## 2. The base island (done)

`assets/.../world/env2.png` (updated to the cozy style: cream/honey paths, soft
green lawns, rounded stones, gentle waterfalls, a central circular plaza + radiating
garden lobes) → resized to 2048² → `base/base_env2.png`. `IMAGE_BASE_ID = 'base_env2'`
in `world-canvas.tsx`; registered in `world-visuals.ts` `WORLD_BASE_SOURCES`. The old
`base_meadow` is kept as a backup (flip `IMAGE_BASE_ID` to revert).

The island's **central plaza** anchors the egg → creature. Its **radiating lobes**
are the natural plots for the 7 buildings (placement is tunable per cell).

> Tune in `world-canvas.tsx` if POIs don't sit on the new ground: `BASE_FACTOR`,
> `BASE_OFFSET_X/Y`, `BASE_DEFAULT_ZOOM`.

---

## 3. The 7 buildings (consolidation)

| Building | Human question | Maps to (data) | Replaces (current asset) | New asset key |
|---|---|---|---|---|
| 🏠 **Home** | What was today really about? (the day's story) | chronicle + notes | `town_hall` (house) | `home` |
| 📸 **Memory Vault** | What do I want to remember? (photos) | memory / capturedMeanings / heroPhoto | `memory_photos_1..4` | `memory_vault` |
| 🗺 **Crossroads** | Where did I go? (locations) | confirmedPlaces / dayMap | `place_marker_1..4` (currently folded into Journey) | `crossroads` |
| 🛤 **Journey Hall** | How did I move through the world? (steps) | stepsCount + stepsInterpretation | `journey_1..4` | `journey_hall` |
| 🌿 **Sanctuary** | How did today feel? (mood) | reflection/feeling prompts + sleep | **NEW** (no structure today) | `sanctuary` |
| 📚 **Study** | What inspired or changed me? (books/films…) | studioMoments | `studio_shelf` | `study` |
| 🍽 **Food Pavilion** | What did I savour? (food) | foodMoments | `food_market` | `food_pavilion` |

### Consolidation decisions
- **Notes** has no standalone building — notes feed **Home** (the day's story /
  chronicle, which already reads notes) and the relevant vaults (a note about a book
  → Study, food → Food Pavilion). Drop the standalone `notes_desk` structure.
- **Sleep** folds into **Sanctuary** ("how today felt", incl. how it began). Drop the
  standalone `sleep_tile`.
- **Reflection / feeling prompts** are **Sanctuary**'s primary content (it's the new
  mood building). Sanctuary needs a small reader (mood + sleep + reflections).
- **Crossroads is un-consolidated from Journey.** Today `places` is merged into the
  `journey` cell (places cell not rendered). The new direction separates *where I
  went* (Crossroads) from *how I moved* (Journey Hall) — restore a distinct Crossroads
  structure + tap → the places reader / day map.
- **Quest Board** is not one of the 7 "buildings" — it's a utility surface. Keep it
  as a lighter prop (or fold the quest entry into Home). Decision: keep a small
  `quest_board` prop in the cozy style for now; revisit.
- **Egg pedestal + creature** get re-skinned to the cozy style too (see §6), and the
  **decor set** (trees/props) is already close — re-skin only if it clashes.

### Category/code mapping
Current `WorldObjectCategory`: `memory | places | journey | reflection | notes | sleep
| food | studio | chronicle | quests | decor`. Target:
- `chronicle` → **Home** (asset `home`)
- `memory` → **Memory Vault** (`memory_vault`)
- `places` → **Crossroads** (`crossroads`) — re-rendered as its own structure
- `journey` → **Journey Hall** (`journey_hall`)
- **new `mood`** category → **Sanctuary** (`sanctuary`)
- `studio` → **Study** (`study`)
- `food` → **Food Pavilion** (`food_pavilion`)
- retire `notes`, `sleep`, `reflection` as standalone structures (data still read by
  the readers above).

---

## 4. Master art direction — Cozy Collectible Diorama

> This is the canonical style block. Use it verbatim as the `STYLES['collectible']`
> entry in `scripts/generate-world-object-grid.py` (see §6).

Premium stylized 3D isometric game art, modern collectible designer-toy aesthetic,
cozy and minimalist, inspired by premium mobile games rather than medieval fantasy.
Soft rounded geometry with chunky silhouettes and excellent readability from a
distance — every object built from a few large clean shapes, not many tiny details.
Materials are smooth ceramic, soft matte plastic, polished painted wood, subtle
rubber and satin finishes with gentle bevels; no rough realism or noisy textures.
Warm cream, caramel, honey, oat, light walnut and muted pastel accent colours, with
small touches of soft blue, sage green or warm orange for identity. Large glowing
windows, oversized doors, thick frames, rounded roofs, simplified foliage, smooth
stones, oversized props and icons. Readable silhouettes are the priority; each asset
instantly communicates its function via ONE iconic feature. Very few decorative
props — no tiny ropes, railings, banners, signs, clutter, bricks or micro-detail
noise. Soft global illumination, warm interior glow, subtle ambient occlusion,
beautiful rim lighting, premium clean studio render. Cute but sophisticated — an
expensive collectible figurine / Apple-quality designer toy, not a children's toy.
Isometric top-down camera (~35°), orthographic, suitable for placement on an
isometric map. Modular game asset with a transparent background that fits a shared
world base.

**Palette anchors:** cream `#F3E7D2`, caramel `#D9A86B`, honey `#E8C272`, oat
`#EADBC0`, light walnut `#9C6B43`; accents soft blue `#92D7FF`, sage `#A8C99A`, warm
orange `#F2A65A`. (Match the `base_env2` lighting — warm, soft, daylight.)

---

## 5. Asset design rule

For **every** building, exactly:

> **One dominant silhouette + one iconic object + one warm light source + one accent colour.**

| Building | Dominant silhouette | Iconic object | Warm light | Accent |
|---|---|---|---|---|
| 🏠 Home | rounded cottage, soft roof | oversized front door | glowing windows | warm orange |
| 📸 Memory Vault | soft rounded vault/safe | oversized lock/dial | glowing crystal inside | soft blue |
| 🗺 Crossroads | low signpost monument / map pavilion at a path junction | oversized signpost arrows / compass rose | small glowing lantern | caramel |
| 🛤 Journey Hall | low monument pedestal / soft archway | giant embossed footprint icon | glowing inlay crystal | sage |
| 🌿 Sanctuary | rounded grove / gazebo | a stylised tree + a small fountain | soft water glow | sage / soft blue |
| 📚 Study | compact rounded library kiosk | oversized stacked books | reading-lamp glow | honey |
| 🍽 Food Pavilion | rounded café kiosk / counter | giant bowl or cup on top | warm serving window | warm orange |

No second iconic object, no clutter. If it doesn't read as its function from a
phone thumbnail, simplify.

---

## 6. Asset production pipeline

Reuse `scripts/generate-world-object-grid.py` (generate → BiRefNet matte → split →
tight square frame). Changes needed:

1. **Add the style:** `STYLES['collectible'] = "<§4 master block>"`. Make it the
   default (or pass `--style collectible`).
2. **Style-reference the new base:** default `--ref base_env2` so structures inherit
   env2's lighting/palette (the script already feeds the base tile to the edit
   endpoint as a style ref; optionally also pass `--style-ref` a hero structure once
   we have one we love, to lock consistency across the set).
3. **Per building:** run a 4×4 **variants** grid (`--mode variants --frame square
   --grid 4`), review, pick the best cell as `_01`. One run per building:

   ```
   python scripts/generate-world-object-grid.py --name home --style collectible \
     --ref base_env2 --frame square --mode variants --grid 4 --force \
     --subject "a cozy rounded collectible cottage HOME, one warm oversized front door, big glowing windows, soft rounded roof, smooth ceramic + painted-wood materials, one warm-orange accent, very few props"
   # repeat with --name memory_vault | crossroads | journey_hall | sanctuary | study | food_pavilion
   ```

   Subjects follow §5 (one silhouette + one icon + one light + one accent). Keep the
   `NO_GROUND` + flat chroma backdrop the script already enforces.
4. **Sizing:** structures bottom-anchored at `OBJECT_BOTTOM_FRAC` (0.96) like today;
   per-building `sizeScale` in `today-patch-engine` (Home/Sanctuary largest ~1.8–2.1,
   vaults ~1.4–1.6).
5. **Egg pedestal + creature:** re-skin the pedestal to a soft cream/ceramic dais
   (`--name egg_pedestal --style collectible`). Verify the creature reads on it.
6. **QA each cutout:** content bottom ≈ 0.96 of frame; clean alpha; reads at
   thumbnail size.

Naming: `assets/.../world/objects/<key>/<key>_NN.png`, default `_01`. Wire in
`world-visuals.ts`.

---

## 7. Code migration plan (phased — build later)

**Phase 1 — art:** generate the 7 building assets (+ pedestal) in the cozy style;
add to `world-visuals.ts` (`home`, `memory_vault`, `crossroads`, `journey_hall`,
`sanctuary`, `study`, `food_pavilion`).

**Phase 2 — patch wiring** (`today-patch-engine.ts`):
- Rename objects to the 7 buildings; point `assetKey`s at the new art.
- `chronicle` object → `home`. `food`→`food_pavilion`. `studio`→`study`.
- Restore a distinct **Crossroads** object (category `places`, `crossroads` asset)
  on its own cell; stop folding places into journey.
- `journey` → `journey_hall` art.
- Add a **Sanctuary** object (new category `mood`, `sanctuary` asset) shown once the
  day has mood signal (a reflection/feeling prompt or sleep); badge = reflections.
- Retire `notes_desk` + `sleep_tile` structures (data still feeds Home/Sanctuary).
- Re-place all 7 on env2's lobes; set per-building `sizeScale`.

**Phase 3 — types + readers:**
- `types/world.ts`: add `'mood'` to `WorldObjectCategory` (keep retired ones for
  back-compat of archived patches).
- `world.tsx`: tap `mood` → new **Sanctuary reader** (mood + sleep + reflections);
  tap `places` → existing places/day-map reader; Home reader = existing Chronicle.
- `world-canvas.tsx`: update tag pills + the alert anchors (steps "!" on Journey
  Hall, photos "!" on Memory Vault, places "!" on Crossroads).

**Phase 4 — polish:** re-skin decor/egg if they clash; revisit the Quest Board;
optional per-building idle animation.

---

## 8. Open decisions
- Quest Board: keep as a small cozy prop, or fold the quest entry into Home? (Default:
  keep small for now.)
- Sanctuary trigger: show always (every day has a feeling) or only once a mood signal
  exists? (Default: once a reflection/feeling/sleep exists, like the other vaults.)
- Do we keep level-based growth (1..4) for Memory Vault / Journey Hall / Crossroads,
  or one iconic building per type? (Default: one iconic building; convey "more" via
  the badge count, matching Food/Study.) — refined in §9 (Memory Vault DOES grow 1→4).

---

## 9. FINAL recommended design — Storage vs Meaning

This is the authoritative model. It reconciles "I still want small structures
(quest board, sleep, photos stack, notes stack) + a Featured Memory Board" with the
"simplify — don't make the village a database with buildings" guidance. The resolution:
**one building OWNS the data; the small structures are VIEWS/satellites of it, not
separate data domains.** Refines §3's storage stance (§4 art direction + §5 design
rule still stand).

### 9.1 Principle — three layers
- **Media layer (storage):** the day owns the raw captures — photos, voice notes,
  text notes — in ONE store. (Code today: `capturedMeanings` / `heroPhoto` / `notes`
  + day-map node photos.)
- **Knowledge layer (meaning):** AI/rules extract tags — place, mood, people,
  book/film, food, movement. (`vision-signals`, `studio-detect`, `food-detect`,
  `reflection-context`, …)
- **World layer (visualization):** buildings + creature + decor. The world does NOT
  own data — it surfaces the SAME memory through whichever building best explains it.
  One memory, many views (macOS Finder: one file, many folders). A British-Museum
  photo shows in Memory Vault (owner) + Crossroads (where) + Chronicle (when) +
  Journey (if a hike) + Study (if it sparked an idea) — same asset, no copies.

### 9.2 The village (domain buildings)
1. 🏠 **Home / Chronicle** — the day's story; a timeline that REFERENCES all captures.
2. 📸 **Memory Vault** — OWNS all captured media. Tap → tabbed reader
   **Featured · Photos · Voice · Notes · Albums** (Apple Photos + Notes + Voice
   Memos, merged). Transforms across **4 levels** as the day's memory count grows.
3. 🗺 **Crossroads / Places** — the map; below it the photos/voice/notes taken there
   (referenced, not copied).
4. 🛤 **Journey Hall / Steps** — movement + interpretation; a "View memories" link to
   captures from the active stretch.
5. 🌿 **Sanctuary / Reflection** — mood/feeling; references the day's reflective captures.
6. 📚 **Study** — the only OTHER store: EXTERNAL inspiration (books/films/podcasts).
   Each entry GROUPS its attached voice/notes (still owned by the Vault).
7. 🍽 **Food Pavilion** — what you savoured. **Recommended keep** (a real domain +
   already built); it GROUPS food-tagged memories via the same reference model.
   *Purist option: drop it; let food be a knowledge tag surfaced in Chronicle/Vault.*

### 9.3 The Memory cluster — where the requested small structures live
The photos/notes "structures" become **satellites of the Memory Vault that are VIEWS,
not data owners** — so the village stays a place, not a database:
- 🖼️ **Featured Memory Board** — a billboard/easel beside the Vault showing the
  **day's cover**: one user-chosen photo (or an illustrated card when there's no
  photo). Tap → pick/replace from the day's captures. New field `featuredMemory`.
- 📷 **Photos stack** (left of the Vault) — framed photos that **change shape as they
  grow** (1 → a few → a tall stack/album), count-driven art. Tap → Vault › Photos.
- 📝 **Notes stack** (right of the Vault) — paper/cards that grow the same way (covers
  text + voice). Tap → Vault › Notes/Voice.

Read together: **Board + Vault + Photos stack + Notes stack** = a little "memory
plaza", all surfacing the one store. (`notes_desk` art is reused as the Notes-stack.)

### 9.4 The Sanctuary cluster
- 😴 **Sleep** — kept as a small satellite beside Sanctuary (you want it visible).
  Tap → Sanctuary reader (mood + how the day began). A view, not a domain.
  (`sleep_tile` art is reused here.)

### 9.5 Utility
- 📋 **Quest Board** — kept as a small cozy utility prop (the day's quests). Not a
  domain building.

### 9.6 Exclamation marks (something new to evaluate)
The golden "!" anchors on the building that owns the pending action, as today:
- new phone photos → **Memory Vault** (or its Photos-stack satellite),
- a place to confirm → **Crossroads**,
- a steps spike to interpret → **Journey Hall**,
- a new inspiration to rate → **Study**,
- food detected → **Food Pavilion**,
- mood/feeling unanswered → **Sanctuary**.
One "!" per pending evaluation, cleared when handled (as already built for
places/steps).

### 9.7 Growth / transformation
- **Memory Vault:** 4-level building set — generate via `--mode progression --grid 2`
  (4 stages) in the cozy style.
- **Photos stack / Notes stack:** 3–4 shape stages by count.
- **Crossroads / Journey Hall:** optional 1→4 growth; **Study / Food / Sanctuary**
  stay one iconic building + badge count. Per-building choice at build time.

### 9.8 Delta vs current code
- KEEP & re-skin (cozy): Memory Vault (`memory`), Crossroads (un-merge `places` from
  journey), Journey Hall (`journey`), Study (`studio`), Food Pavilion (`food`), Home
  (`chronicle`/town_hall), Quest Board, egg pedestal.
- NEW: **Sanctuary** building + `mood` category + reader; **Featured Memory Board** +
  `featuredMemory` field + picker; **Photos-stack** + **Notes-stack** satellites
  (count-leveled) routing into Vault tabs; **Memory Vault tabbed reader** (merge
  photos/voice/notes/albums) + 4-level art; **Sleep** becomes a Sanctuary satellite.
- A unified accessor `dayMemories(day)` → `{photos, voice, notes}` so every reader can
  `dayMemories(day).filter(...)` to SHOW (not copy) the relevant captures — the media-
  layer API the reference model needs.

### 9.9 Data-model sketch (no build yet)
- `featuredMemory?: { kind: 'photo' | 'card'; assetId?: string; thumbnailUri?: string;
  createdAt: string }` on the day record; `setFeaturedMemoryForToday`; picker sheet.
- `dayMemories(day)` selector (pure) over `capturedMeanings` + `heroPhoto` +
  day-map photos + `notes` (text/voice), tagged by knowledge layer for filtering.

### 9.10 Phasing (build order)
1. **Art:** Memory Vault (4 levels) + Featured Board + Photos/Notes stacks + Sanctuary
   + re-skin Crossroads/Journey/Study/Food/Home + pedestal (all cozy, `--ref base_env2`).
2. **Memory cluster + media layer:** layout the plaza; add `dayMemories`; Vault tabbed
   reader.
3. **Featured Memory Board:** field + picker + render on the board.
4. **Sanctuary:** building + reader (mood + sleep + reflection); Sleep → satellite.
5. **Wire-through:** re-anchor all "!" alerts; add "View memories" reference-views in
   Crossroads / Journey / Study / Chronicle.

### 9.11 Open decisions
- **Food Pavilion:** keep as the 7th domain (recommended) or drop to a knowledge tag
  (purist 6-building set: Memory · Journey · Crossroads · Sanctuary · Study · Home)?
- **Per-building growth:** which domains get 1→4 art vs iconic+badge (§9.7)?
- **Featured fallback:** when there's no photo, generate an illustrated "day card"
  for the board, or show a soft placeholder until one exists?
