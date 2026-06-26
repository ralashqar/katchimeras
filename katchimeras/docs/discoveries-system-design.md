# Katchimera Discoveries System — Design Spec

**Status:** design (not yet built) · **Author:** 2026-06-25
**Companion doc:** [discoveries-implementation-plan.md](./discoveries-implementation-plan.md)

> Life Milestones & World Artefacts — a long-term progression layer built around
> real-life experience, not game grinding. *"Users are rewarded for living, not
> grinding."*

---

## 1. Overview & philosophy

A **Discovery** is a permanent record of something the user genuinely experienced
— a first museum, a 20k-step day, a first voice memory, 100 meaningful moments.
Discoveries do three things:

1. **Celebrate** life milestones.
2. **Enrich** the user's world permanently (a visible artefact).
3. **Unlock** cosmetic expression (no gameplay advantage).

The feel target: *"I never realised my life was becoming a collection."* — closer
to collecting pages in a life journal than earning trophies.

### Non-negotiable principles
- **Permanent.** Once unlocked, a Discovery never disappears.
- **Meaningful, never grindy.** Triggers are real experiences ("First museum",
  "First sunrise captured"), never "complete 5 quests" / "spend 100 coins".
- **Reward exploration, not optimisation.** Surprise > checklists. Some are hidden.
- **Cosmetics only.** No reward ever affects hatch odds, scores, or progression.

This aligns with the product's existing stance (see
[[product-direction-definitive]] / `docs/katchimera-product-direction-2026-06.md`):
creature-led, zero-input, rarity-from-living.

---

## 2. How this fits what already exists

The app **already captures** nearly every signal a Discovery needs. The Discoveries
system is mostly a *reading* layer over data we already persist — not new capture.

| Discovery source | Already-captured signal (where it lives) |
|---|---|
| Exploration (places) | `StoredHomeDayRecord.confirmedPlaces[]` (category + meaning), `dayMap` nodes, `newPlaceCount`, `place-categories.ts` (Apple Maps categories), home anchor |
| Memory (photos/voice) | `heroPhoto`, `capturedMeanings[]`, `moments[]`, `notes[]` (kind `voice`), `vision` concepts, `foodMoments[]`, `usedPhotoAssetIds[]` |
| Life (milestones) | `bigMoments[]` (+ calendar once `expo-calendar` is activated — currently a build-safe stub in `utils/calendar-events.ts`) |
| Journey (movement) | `stepsCount`, HealthKit routes (`katchimera-health-routes` → `importRoutesForDayAsync`), sleep (`getSleepForDayAsync`) |
| Reflection | `promptAnswers[]` (feeling / inner_weather / day_word / gratitude / highlight), `notes` (voice), `bigMoments`, day `scores` (calm) |
| World | `WorldState.patches[]` (finalised dioramas), patch `rarity`, `status` |

**Source of truth:** every persisted day is hydratable to a `HomeDayRecord` via
`hydrateAllDays()` / `useAllDays()`. Lifetime aggregates are derivable by folding
over all days — we do **not** need a new capture pipeline.

**Pure-engine fit:** the codebase has no event bus; state is re-normalised on every
mutation and engines are pure + harness-tested (`scripts/verify-*.cjs`). Discoveries
follow the same shape: a **pure evaluator** that derives the unlocked set from all
days, diffed against what was previously unlocked to detect *new* unlocks.

---

## 3. Data model

```ts
// types/discoveries.ts (new)
export type DiscoveryCategory =
  | 'exploration' | 'memory' | 'life' | 'journey' | 'reflection' | 'world';

export type DiscoveryRarity = 'common' | 'rare' | 'epic' | 'legendary';

// A STATIC definition (the catalog). Pure data + a pure predicate.
export type DiscoveryDef = {
  id: string;
  category: DiscoveryCategory;
  name: string;
  description: string;
  rarity: DiscoveryRarity;
  hidden: boolean;                 // silhouette until unlocked
  icon: string;                    // emoji or asset key for the Hall + share card
  worldRewardId?: string;          // a permanent world artefact (Phase 3 art)
  cosmeticUnlockIds?: string[];    // tile/vault/trail/lantern skins (Phase 4)
  // Pure rule over derived lifetime aggregates (see DiscoveryContext).
  test: (ctx: DiscoveryContext) => boolean;
};

// A PERSISTED unlock record (what actually happened).
export type DiscoveryRecord = {
  id: string;                      // matches DiscoveryDef.id
  unlockedAt: number;              // epoch ms (stamped by the hook, not the engine)
  sourcePatchId?: string;          // the day/patch that tipped it over
  sourceMomentIds: string[];       // contributing moment/note/place ids (best-effort)
  seenAnimation: boolean;          // has the "Discovery Recorded" celebration shown
};

export type DiscoveryState = {
  version: 1;
  unlocked: Record<string, DiscoveryRecord>;  // id → record
};
```

This is intentionally close to the user's proposed `Discovery` type, split into a
**static def** (catalog, code) and a **persisted record** (storage) so we never
store names/descriptions/rules in user data (they evolve with the app).

### Derived context (what rules read)
```ts
export type DiscoveryContext = {
  now: Date;
  dayCount: number;
  // Exploration
  uniquePlaceCount: number;            // distinct confirmed places (lifetime)
  placeCategoryCounts: Record<string, number>;  // 'museum' → 3, 'cafe' → 11, …
  firstPlaceByCategory: Record<string, string>; // category → isoDate
  countryCount?: number;               // when geocoding/country is available
  // Memory
  photoCount: number;                  // hero + captured meanings + photo moments
  meaningfulMomentCount: number;       // capturedMeanings + answered photo prompts
  voiceMemoryCount: number;            // notes where kind === 'voice'
  foodMemoryCount: number;
  // Life
  bigMomentCount: number;
  bigMomentTypes: Set<string>;
  // Journey
  maxStepsInADay: number;
  walkingStreak: number;               // consecutive days with a walk/steps≥threshold
  totalDistanceMeters?: number;        // from HealthKit routes (when available)
  // Reflection
  reflectionCount: number;
  calmDayCount: number;
  // World
  finalisedPatchCount: number;
  legendaryPatchCount: number;
};
```

`buildDiscoveryContext(days, health)` folds `useAllDays()` output (+ optional
HealthKit aggregates) into this once per evaluation — pure, harness-testable.

---

## 4. The catalog (rules)

Definitions live in `utils/discoveries-catalog.ts` as a static array. Each is a
pure predicate. Examples (illustrative, not exhaustive):

```ts
// Exploration
{ id: 'first_museum', category: 'exploration', rarity: 'common', hidden: false,
  name: 'Museum Explorer', description: 'Visited your first museum.', icon: '🏛',
  worldRewardId: 'artefact_museum_banner',
  test: (c) => (c.placeCategoryCounts.museum ?? 0) >= 1 },

{ id: 'fifty_museums', category: 'exploration', rarity: 'legendary', hidden: false,
  name: 'Curator', description: 'Visited 50 museums.', icon: '🏛',
  test: (c) => (c.placeCategoryCounts.museum ?? 0) >= 50 },

{ id: 'places_25', category: 'exploration', rarity: 'rare', hidden: false,
  name: 'Wanderer', description: '25 unique places.', icon: '🗺',
  test: (c) => c.uniquePlaceCount >= 25 },

// Memory
{ id: 'first_voice_memory', category: 'memory', rarity: 'common', hidden: false,
  name: 'First Words', description: 'Recorded your first voice memory.', icon: '🎙',
  worldRewardId: 'artefact_voice_crystal',
  test: (c) => c.voiceMemoryCount >= 1 },

{ id: 'photos_100', category: 'memory', rarity: 'epic', hidden: false,
  name: 'Chronicler', description: 'Captured 100 photos.', icon: '📸',
  test: (c) => c.photoCount >= 100 },

// Life
{ id: 'first_birthday', category: 'life', rarity: 'rare', hidden: false,
  name: 'Another Year', description: 'Marked a birthday.', icon: '🎂',
  worldRewardId: 'artefact_festival_tree',
  test: (c) => c.bigMomentTypes.has('birthday') },

// Journey
{ id: 'steps_20k', category: 'journey', rarity: 'rare', hidden: false,
  name: 'Marathoner', description: 'A 20,000-step day.', icon: '🚶',
  worldRewardId: 'artefact_journey_monument',
  test: (c) => c.maxStepsInADay >= 20000 },

{ id: 'walk_streak_7', category: 'journey', rarity: 'epic', hidden: true,
  name: 'Seven Days On', description: 'Seven consecutive walking days.', icon: '🌉',
  test: (c) => c.walkingStreak >= 7 },

// Reflection
{ id: 'first_reflection', category: 'reflection', rarity: 'common', hidden: false,
  name: 'First Pause', description: 'Your first reflection.', icon: '🌿',
  test: (c) => c.reflectionCount >= 1 },

{ id: 'calm_30', category: 'reflection', rarity: 'epic', hidden: false,
  name: 'Still Water', description: '30 calm days.', icon: '🕯',
  test: (c) => c.calmDayCount >= 30 },

// World
{ id: 'patches_100', category: 'world', rarity: 'legendary', hidden: false,
  name: 'A Hundred Days', description: '100 finished days in your world.', icon: '🌎',
  test: (c) => c.finalisedPatchCount >= 100 },
```

**Hidden discoveries** (`hidden: true`) appear as silhouettes in the Hall and only
reveal on unlock (extra surprise). Examples: 5 museums, sunrise 3 days running,
visit every biome.

**Rarity** is per-def (drives the celebration intensity, Hall styling, share-card
frame). Common → Legendary.

### Rule guardrails
- Rules read ONLY the derived `DiscoveryContext` (no side effects, no `Date.now()`
  inside — `now` is injected, matching the harness rules).
- A def's `test` must be **monotonic** (once true, stays true for the same history)
  so a Discovery never "un-unlocks".
- Counts that need data we don't yet have (country, total distance, biomes) are
  **optional** in the context; their defs simply never fire until the source lands.

---

## 5. Evaluation model

No event bus. Instead, a **pure evaluator** diffed against persisted state:

```ts
// utils/discoveries-engine.ts
export function buildDiscoveryContext(days: HomeDayRecord[], health?: HealthAggregates): DiscoveryContext
export function evaluateDiscoveries(ctx: DiscoveryContext, unlocked: Record<string, DiscoveryRecord>):
  { newlyUnlocked: DiscoveryDef[] }   // defs whose test passes but aren't in `unlocked`
```

**When it runs** (the hook layer, `hooks/use-discoveries.ts`):
- On app/World focus (`useFocusEffect`) and after any day-mutating action
  (capture, note, place confirm, big moment, sleep, food, hatch).
- It builds the context from `useAllDays()`, evaluates, and for each newly-unlocked
  def writes a `DiscoveryRecord` (stamping `unlockedAt = Date.now()`, resolving
  `sourcePatchId`/`sourceMomentIds` best-effort from the day that tipped it) into
  `app-storage` under `katchimera.discoveries.v1`.
- Returns `newlyUnlocked` so the UI can queue the celebration.

**Why diff-from-derived (not push events):** it's idempotent, survives backfill
(Hatch-Your-Past style retro-unlocks), can't double-fire, and re-deriving from days
means a reinstalled/restored history re-creates the collection. Only `unlockedAt`
and `seenAnimation` are truly persisted.

**Backfill:** on first run after shipping, evaluation over existing history unlocks
everything already earned at once — surfaced quietly (a single "X discoveries from
your past" summary, not N celebrations). See plan Phase 2.

---

## 6. World integration (artefacts)

Most discoveries grant a **permanent world artefact** (`worldRewardId`):

| Discovery | Artefact |
|---|---|
| First Museum | Museum Banner |
| 20k Steps | Journey Monument |
| Birthday | Festival Tree |
| First Voice Memory | Voice Crystal |
| Legendary discoveries | Unique landmarks |

**Architecture note:** today `WorldState` is **per-day patches** only (`patches[]`
+ `builtDayIds[]`). Artefacts are **not** tied to a single day, so they need a new
home. Proposed: a `worldArtefacts: WorldArtefactPlacement[]` layer on `WorldState`
(or a sibling store) rendered above/around the patch ring.

Given the world currently renders a **single selected-day patch** (see
[[world-as-home-redesign]]), full on-world artefact placement is a **graphics-phase
follow-up** (needs art via the `katchimera-assets` skill, like the sleep/food
props). **Phase 1 surfaces artefacts inside the Hall of Discoveries** (each unlocked
discovery shows its artefact icon + "World Reward"), exactly how Chronicle/Food were
surfaced as readers before becoming on-patch objects.

---

## 7. The Hall of Discoveries

A new building / reader: the collection home.

- **Entry point (Phase 1):** a dashboard card on the World tab ("Discoveries · N
  found") → opens the Hall sheet. (Phase 3: a tappable Hall building on the world.)
- **Layout:** sections per category (🌍 Exploration · 📸 Memories · ❤️ Life ·
  🚶 Journey · 🌿 Reflection · 🌎 World).
- **Each shelf:** locked defs render as **silhouettes** (hidden ones show only "???"
  + rarity tint); unlocked show icon, name, unlocked date, related patch/day, and
  the world reward.
- **Tap a discovery →** detail: name, description, unlocked date, related patch
  (deep-link to that day), related photos (`sourceMomentIds` → thumbnails), world
  reward, share button.
- Reuse the existing full-screen sheet pattern (`food-vault-sheet` / `chronicle-sheet`
  shells) + `useAllDays()` to resolve `sourcePatchId` → day.

---

## 8. Unlock UX & sharing

**Celebration (on new unlock):**
- A "Discovery Recorded" overlay: the artefact/icon appears with a small celebration
  scaled by rarity (legendary = bigger). Copy: **"Discovery Recorded — {name}"** or
  **"A New Chapter Begins"**. For hidden ones: **"✨ New Discovery Found"**.
- **Avoid** "Achievement Unlocked" framing.
- Queue-safe: if several unlock at once, show the highest-rarity one (or a compact
  stack), never a barrage. Mark `seenAnimation: true` so it never re-shows.
- Build on existing animation primitives (reanimated/moti; the `HatchReveal` cadence
  is a good reference for a tasteful in-place reveal).

**Share card:** reuse the share/Day-Card infra (see
[[day-card-built]] / `docs/katchimera-shareability-framework.md`):
```
✨ Discovery Recorded
Museum Explorer
Visited your first museum.
World Reward: Museum Banner
→ What discoveries will your world unlock?
```

---

## 9. Cosmetics (later phase)

Some discoveries unlock cosmetics: tile skins, vault skins, trail styles, lantern
colours, particles, storybook covers, seasonal decorations. **Cosmetics only — no
gameplay advantage.** Deferred to Phase 4; the data model already carries
`cosmeticUnlockIds` so catalog entries can declare them ahead of the UI.

---

## 10. Open questions / decisions to confirm

1. **Place granularity** — "First Country" / "First Airport" need place categories we
   may not fully resolve yet (`place-categories.ts` rounds coords to Apple Maps
   categories; country needs reverse-geocoding). Ship the categories we *can* detect
   now; gate country/airport defs behind that data.
2. **Journey aggregates** — max-steps and calm-day counts are in day records, but
   *total distance* and *walking streaks* may need a small HealthKit aggregate
   addition (native → rebuild). Phase those defs in once the read exists.
3. **Calendar-driven Life discoveries** — depend on activating `expo-calendar`
   (currently stubbed). Big-moment-driven Life discoveries work today.
4. **Artefact placement** — confirm whether artefacts render on the single-day world
   view, a dedicated "home region", or only in the Hall for v1 (recommended: Hall
   first).

---

## 11. Success criteria

Users feel: *"My world is full of things I've genuinely experienced."* The system
nudges explore / capture / reflect / remember **without ever feeling like grinding**.
A Discovery should read like a page in a life journal, not a trophy.
