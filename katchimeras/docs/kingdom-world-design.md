# The Kingdom — one expanding world, decorated by living

**Status:** design + build plan (2026-07-02). Successor to the per-day world patch.
Builds on: `types/kingdom.ts` + `utils/kingdom-engine.ts` (lifetime fold, BUILT),
`utils/kingdom-patch.ts` (KingdomState → WorldPatch mapper, BUILT),
[world-structures-cozy-direction.md](world-structures-cozy-direction.md) (art
language + 7-building consolidation — still authoritative for art).

---

## 1. Principles

1. **One world, forever.** The WORLD tab stops being a browser of near-identical
   day patches and becomes a single Kingdom that only accumulates. Days remain
   revisitable as *readers* (calendar/journal, Life Map) — not as dioramas.
2. **Life earns, Essence styles.** Everything that appears in the Kingdom was
   earned by living (captures, places, steps, discoveries, big moments). Essence
   only ever buys *styles/variants* of things already earned — never progression.
3. **Every day leaves a visible mark.** At minimum the day's creature arrives;
   most days also deliver an earned decoration. A user who opens the Kingdom any
   morning sees something that wasn't there yesterday.
4. **Provenance over inventory.** A planted thing always knows where it came
   from ("Cherry Blossom — First trip to Japan, April 2027"). Tapping decor
   shows its origin; nothing is an anonymous shop item.
5. **Derived where possible, owned where necessary.** Buildings/creatures/
   landmarks stay pure derivations of the day archive (`deriveKingdom`) — free
   backfill, no drift. Only *user placements* (where things were planted) are
   owned state.

## 2. The Kingdom scene (replaces the day-switcher world)

Rendered through the existing `WorldCanvas` — camera, taps, badges, layout JSON
all reused via `deriveKingdomPatch(kingdom)`:

- **Centre island** (`base_env2`): the 7 buildings at *lifetime* levels
  (Memory Library 1→4 by total memories kept, Journey Hall by lifetime steps, …
  thresholds in `kingdom-engine.ts` `LEVEL_THRESHOLDS`), the artefact ring
  (already persistent), Legacy Landmarks, and the creature roster
  (`CREATURE_SLOTS`, newest centre-stage).
- **No egg, no day switcher.** The egg lives on Today; the Kingdom is the noun
  surface. Building taps open aggregate readers (v1: the existing readers — the
  Library opens the vault over recent days; day-level detail stays in
  calendar/journal).
- **Expansion = new ground, not a bigger image.** The multi-patch grid renderer
  already places patches adjacent to each other — expansion reuses it:
  milestone-earned **plots** (small cozy islets/gardens, 2–3 base-plate
  variants) dock around the centre island. Each plot is itself earned
  (e.g. every 30 days lived, or a legendary discovery) and becomes new
  plantable ground. `KingdomState` gains `plots: KingdomPlot[]` derived from
  totals — so expansion is also pure derivation.

## 3. Decoration pivot — from per-day planting to earned accumulation

### 3.1 Data model

Today decor is per-day (`katchadeck.world-decor-v1`, keyed by dayId, discarded
from view when the day scrolls away). It becomes one Kingdom-wide store:

```ts
// storage key: katchadeck.kingdom-decor-v1
type KingdomDecorItem = {
  id: string;
  propId: string;            // -> WorldPropDef
  assetKey: string;          // chosen style variant (Essence may unlock others)
  col: number; row: number;  // Kingdom ground (centre island or a plot)
  plotId: string | null;     // null = centre island
  provenance: {
    kind: 'day' | 'discovery' | 'bigMoment' | 'observation' | 'starter';
    label: string;           // "A 12k-step day", "First Museum", "Trip to Japan"
    isoDate: string;         // when it was earned
    dayId?: string;          // tap-through to the day reader
  };
};
type KingdomDecorState = {
  version: 1;
  placed: KingdomDecorItem[];
  // Earned but not yet planted — the "gifts" queue, newest first.
  unplanted: { propId: string; provenance: KingdomDecorItem['provenance'] }[];
};
```

`DecorItem` already carries `propId/sourceLabel/earnedFrom` — the migration is
a one-time hoist: every legacy per-day placement becomes a Kingdom item with
`provenance.kind='day'` + its day's date (placed items keep their positions on
the centre island; overflow beyond sensible density goes to `unplanted`).

### 3.2 Earning engine (evolves `world-props-engine`)

The prop catalog keeps its unlock kinds and grows a fifth:

- `starter` / `discovery` / `observation` / `mood` — as today, but each unlock
  now *emits an earned prop with provenance* instead of just flipping
  availability.
- **new `daily`** — signal-driven rules evaluated at hatch (one pass per day,
  deterministic, in the same place the day folds into history):
  | day signal | earned prop family |
  |---|---|
  | 8k+ steps / hike interpreted | trail stone / cairn |
  | a confirmed new place | wayfinder post |
  | food moment | picnic / market basket |
  | studio moment | bookstand / film reel |
  | 3+ reflections | meditation stone / wind chime |
  | night owl / dawn signals | lantern / sunrise banner |
  | big moment | its Legacy Landmark (already modelled) |
  Cap: max 2 daily props/day so the Kingdom doesn't turn into clutter;
  `bloomBudget` (per-day cap) retires — accumulation replaces the daily reset.
- Earned props land in `unplanted` (the gift queue). **Essence never earns a
  prop; it unlocks alternate `assetKey` styles** for prop families you already
  hold (blossom colour, stone material, lantern shape).

### 3.3 Planting UX

- Customise/Decorate mode moves to the Kingdom scene (same drag/place gestures,
  `getCenterCellRef` drop). The tray shows `unplanted` gifts first (with their
  provenance line), then placed-prop styles.
- **Gift arrival:** when yesterday earned props, the morning Kingdom shows a
  small crate/gift by the Home building; tapping opens the tray at the gift.
- Tapping any planted decor shows its provenance card (label + date + link to
  the day).

## 4. The daily mark + morning ceremony (Milestone C, unchanged)

Morning open of the Kingdom: yesterday's creature walks in (camera pans to it),
gift crate if props were earned, building level-ups called out ("Memory Library
grew"). Hatch stays on Today. Kingdom tab shows a badge until witnessed.

## 5. Migration & retirement

1. Kingdom buildings/creatures/landmarks/plots: derived — backfills instantly.
2. Decor: one-time hoist (§3.1) on first launch of the Kingdom scene.
3. `WorldPatch` build/read retired; `world_v6` blob left on disk untouched.
4. Tabs: **Today (default) · Kingdom · Collection**; day dioramas gone, day
   readers stay.

## 6. Art plan (start with what exists)

**Reused as-is (day one):** `base_env2` island · 7 buildings incl. leveled
`memory_vault_1..4` + `steps_path_1..4` · 16-prop decor palette · 8 artefacts ·
big-moment landmark set · egg pedestal (unused in Kingdom) · creature renders.

**Production list (existing pipeline: `scripts/generate-world-object-grid.py`
`--style collectible --ref base_env2`, per the cozy doc §4–6):**
1. **Cozy re-skins of the 7 buildings** — already specced in the cozy doc; now
   they're *Kingdom* buildings, so the leveled sets matter more (Library 1→4 is
   the marquee progression; add 1→4 for Crossroads + Journey Hall).
2. **Expansion plot bases** — 2–3 small islet/garden base plates (½ the centre
   island's footprint) in the same cream/honey language, via the world-base
   pipeline.
3. **Daily-prop families** — 4 new families × 3–4 variants: trail stones/cairns,
   picnic/food props, study/keepsake props, lanterns/banners. (The existing
   nature palette covers trees/flowers.)
4. **Gift crate** — one sprite + a subtle glow state.
5. **Style variants** (Essence): 2–3 recolour/reshape variants for the two most
   planted families first; expand by usage.

## 7. Build phases

- **K1 — Scene swap:** Kingdom scene renders `deriveKingdomPatch` on the WORLD
  tab (no day switcher); building taps → existing readers; tab renames; Today
  becomes default route; `WorldPatch` reads retired. *Exit: open Kingdom, see
  lifetime buildings + roster + artefacts; nothing day-scoped remains there.*
- **K2 — Decor pivot:** `KingdomDecorState` + migration hoist; earning engine
  (`daily` rules + provenance emission); Customise mode on Kingdom; provenance
  card on tap. *Exit: live a day → gift appears → plant it → survives forever;
  legacy decor visible.*
- **K3 — Ceremony:** morning arrival (creature walk-in + gifts + level-up
  callouts) + Kingdom tab badge. *Exit: every morning shows yesterday's mark.*
- **K4 — Expansion:** `plots` derivation + plot bases render + planting on
  plots. *Exit: 30-day (or milestone) users see their first islet.*
- **K5 — Art waves:** building re-skins → prop families → style variants,
  swapped in behind stable asset keys (no code churn).

K1 and K2 are independent enough to build in either order, but K1 first makes
K2 testable in its real home. Each phase is a shippable slice.

## 8. Open decisions

- **Plot cadence:** every N days lived (steady) vs milestone-driven (spiky)?
  Default proposal: first plot at 30 days, then per 60, plus one per legendary
  discovery.
- **Kingdom centre:** newest creature holds the plaza (current mapper) vs a
  rotating "creature of the day". Default: newest.
- **Density cap** on the centre island before plots unlock early (a full island
  could fast-track the first plot).
- **Daily prop rules tuning** (§3.2 table is a starting proposal).
