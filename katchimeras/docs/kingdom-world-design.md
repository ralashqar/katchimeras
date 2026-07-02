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

### 3.2 Earning economy — three lanes (v2, replaces the single daily-rules lane)

Everything still lands in `unplanted` (the gift shelf) with provenance, and
**Essence never earns a prop** — it only unlocks alternate styles of families
already held. What changes: earning now flows through THREE lanes so the shelf
fills from everyday living, from distinctive days, AND from achievements — with
the early days deliberately generous.

**Grant timing: live.** All three lanes grant the moment they're earned — the
still-forming day grants as it goes (deterministic grant ids make the later
hatch pass a no-op), so anything unlocked today is plantable today. Live gifts
land on the shelf silently; the morning ceremony only parades what arrived with
a hatch (live-granted gifts left unplanted are held out of the witnessed
snapshot so they still join tomorrow's parade).

**Lane A — Everyday blooms (commons: trees, shrubs, flowers).**
Every real signal earns bloom points; every **3 points → 1 common green gift**
(first 7 days: every **2 points** — the founding boost). Cap **3 gifts/day**.
| signal | points |
|---|---|
| photo given meaning | 1 |
| note (voice/text) | 1 |
| place confirmed | 2 |
| reflection answered | 1 |
| food / studio moment | 1 each |
| 4k steps / 8k steps | 1 / 2 |
| quest completed · sleep answered | 1 each |
The gift is drawn deterministically (seeded by dayId) from the commons pool —
`decor_1` pine, `decor_2` oak, `decor_4` birch, `decor_3` blossom, `decor_5`
shrub, `decor_6` fern, `decor_7` wildflowers, `decor_15` mushrooms, `decor_8`
planter — biased by the day's mood (calm→wildflowers, active→pine, social→oak,
meaningful→blossom; same leads as `decorPalette`). Provenance: "A day of N
moments · <date>". A typical engaged day (4–8 pts) yields 1–2 commons.

**Lane B — Signature day earns (uncommons, themed).** The existing
`DAILY_RULES` unchanged: big moment→blossom tree, 8k/hike→trail stone,
place→wayfinder post, food→market crate, studio→study planter, 3
reflections→wildflowers, 2 notes→keeper's lantern. Priority order, cap
**2/day**. (Bespoke prop families replace the `decor_*` stand-ins in art wave 2
behind the same rule ids.)

**Lane C — Achievement earns (discoveries + observations + moods).** Every
Discovery unlock grants its prop gift, reusing `EARNED_WORLD_PROPS`' existing
`unlockSourceId` mappings (first_memory→Memory Flowers, first_voice→Voice
Crystal, first_museum→Museum Banner, cafes_3→Cafe Table, food_10→Feast Stall,
steps_20k→Trail Marker, walk_streak_7→Trail Bridge, goal_achieved→Trophy
Stone, first_week_village→Village Lantern…). Discoveries without an explicit
mapping fall back by rarity tier: common→a nature prop, rare→a ritual/ornament
prop, epic→a landmark piece, legendary→a monument shard (new art, wave 2).
Observation/mood unlocks (Quiet Ferns, Sunbud, Breezegrass, Ritual Table,
Walking Signpost…) grant **once each** when their pattern first fires.
Historical backfill: achievement props ARE granted as shelf gifts on first sync
(achievements feel owed; the catalog bounds it at ~46) — only lanes A/B
baseline silently. Because the discovery catalog is front-loaded with
`first_*` entries, week one naturally showers 3–5 achievement gifts without
any special-casing.

**No planting cap (retired 2026-07-02).** Planting is limited only by what the
shelf holds — the earning caps above are the pacing lever; placing is always
free, as is unplanting/rearranging. The shelf is unlimited and nothing expires.
Density guard: ~80 placed items on the centre island; past that, planting
nudges toward expansion plots (K4).

**First-week feel (simulated):** day 1 = First Seed + 2–3 `first_*` discovery
gifts + 1–2 blooms → plant them all, or shelve some. Days 2–7 ≈ 2–3 earns/day
(boosted lane A + trickling firsts). Steady state (month 3+) ≈ 1–2/day on
engaged days, a signature or achievement gift a few times a week, quiet days
earn nothing — restful, never punished.

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
   nature palette covers trees/flowers.) Plus a **monument-shard set** (3
   tiers) for epic/legendary discovery earns that lack bespoke art.
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
