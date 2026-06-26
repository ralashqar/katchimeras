# Katchimera Discoveries System — Implementation Plan

**Status:** plan (not started) · **Companion:** [discoveries-system-design.md](./discoveries-system-design.md)

Phased so each phase is independently shippable, verifiable on Windows
(`tsc` + `eslint` + a `verify-*.cjs` harness), and JS-only where possible. Native
/ art dependencies are isolated to later phases and flagged.

Guiding constraints (match the existing codebase):
- **Pure engines + harnesses.** New logic goes in pure modules tested by a Node
  harness (`scripts/verify-discoveries.cjs`), like `verify-memory-quests` /
  `verify-scene-classify`. No `Date.now()`/`Math.random()` inside the engine — inject
  `now`.
- **Persistence via `utils/app-storage.ts`** (`getStoredJson`/`setStoredJson`), like
  `utils/processed-photos.ts`.
- **Read all history via `useAllDays()`** (`hydrateAllDays`) — the engine takes
  `HomeDayRecord[]`, never reaches into storage itself.
- **Optional fields degrade gracefully** — defs whose data isn't available yet simply
  never fire (no crashes), the pattern used for vision/health everywhere.

---

## Phase 0 — Engine + catalog + harness (no UI) ✅ pure, no build

**Goal:** the whole rules layer, fully tested, before any UI.

Files:
- `types/discoveries.ts` — `DiscoveryDef`, `DiscoveryRecord`, `DiscoveryState`,
  `DiscoveryContext`, `DiscoveryCategory`, `DiscoveryRarity` (per design §3).
- `utils/discoveries-context.ts` — `buildDiscoveryContext(days, health?)`: pure fold
  over `HomeDayRecord[]` producing the lifetime aggregates. Reuses existing helpers
  where possible (place counts from `confirmedPlaces`, voice from `notes` kind,
  meaningful from `capturedMeanings`/`promptAnswers`, calm from `scores`, finalised
  patches from hatched days).
- `utils/discoveries-catalog.ts` — the static `DISCOVERY_CATALOG: DiscoveryDef[]`
  (start with ~25–30 across all 6 categories from design §4; expand later).
- `utils/discoveries-engine.ts` — `evaluateDiscoveries(ctx, unlocked)` →
  `{ newlyUnlocked }`. Pure.
- `scripts/verify-discoveries.cjs` — transpile the engine + catalog (stub any `@/`
  imports it can't resolve, à la `verify-scene-classify`). Assert:
  - first-museum fires at 1, curator at 50, not before;
  - monotonicity (a passing def stays unlocked when re-evaluated with `unlocked`);
  - hidden defs evaluate the same as visible;
  - empty history unlocks nothing;
  - `buildDiscoveryContext` counts (places/voice/photos/calm/patches) on a fixture.

**Exit:** `npx tsc --noEmit`, `npm run lint`, `node scripts/verify-discoveries.cjs`
green. No app wiring yet.

---

## Phase 1 — Persistence + evaluation hook + Hall reader ✅ JS, no build

**Goal:** discoveries actually unlock and are browsable.

- `utils/discoveries-storage.ts` — `loadDiscoveryState()` / `saveDiscoveryState()`
  over `app-storage` key `katchimera.discoveries.v1`; `markDiscoveryUnlocked(...)`,
  `markAnimationSeen(id)`.
- `hooks/use-discoveries.ts` — on focus + after mutations, build context from
  `useAllDays()`, evaluate, persist new `DiscoveryRecord`s (stamp `unlockedAt`,
  resolve `sourcePatchId`/`sourceMomentIds` from the tipping day), expose:
  `discoveries` (all defs + unlocked records merged for display), `counts`,
  `pendingCelebrations` (unlocked with `seenAnimation=false`).
- `components/katchadeck/world/discoveries-hall-sheet.tsx` — the Hall reader (reuse
  the `food-vault-sheet` shell): sections per category, locked = silhouette (hidden =
  "???"), unlocked = icon/name/date/patch + world-reward label. Tap → detail
  (description, date, related day via `getDayById`, related photo thumbs, share btn).
- `app/(tabs)/world.tsx` + `world-dashboard.tsx` — a **Discoveries card**
  ("Discoveries · N found") opening the Hall. (Mirror the Chronicle/Food card.)

**Exit:** unlock by doing the real action (e.g., confirm a museum place) → it appears
in the Hall. `tsc`/`lint`/harness green. No celebration yet (Phase 2).

---

## Phase 2 — Unlock celebration + backfill + share ✅ JS, no build

- `components/katchadeck/world/discovery-reveal.tsx` — "Discovery Recorded" overlay,
  rarity-scaled, queue-safe (show highest rarity / compact stack; never a barrage).
  Driven by `pendingCelebrations`; mark `seenAnimation` on dismiss. Reuse
  reanimated/moti; reference `HatchReveal` cadence.
- **Backfill:** first evaluation over existing history marks everything earned as
  unlocked but **`seenAnimation: true`** (no retro-barrage); show ONE quiet summary
  ("12 discoveries from your past are in your Hall").
- **Share card:** add a discovery variant to the existing share/Day-Card flow
  (`docs/katchimera-shareability-framework.md`) — title, name, description, world
  reward, CTA (design §8).

**Exit:** doing a *new* qualifying action shows the celebration once; sharing
produces a card. `tsc`/`lint`/harness green.

---

## Phase 3 — World artefacts on the map 🎨 art + maybe native

- Extend `WorldState` with a `worldArtefacts` layer (artefact id → placement) OR a
  sibling store; render artefacts around the patch ring in `world-canvas`.
- Generate artefact art via the **`katchimera-assets`** skill (museum banner, journey
  monument, festival tree, voice crystal, legendary landmarks), matte, register in
  `world-visuals.ts` (same flow used for the sleep/food props).
- Map `worldRewardId` → asset + placement; a tappable **Hall of Discoveries
  building** on the world opens the Phase-1 sheet.
- Harness: extend `verify-world.cjs` for artefact placement; visual QA on device.

**Exit:** unlocked discoveries leave visible, permanent artefacts. (Metro reload for
art; native rebuild only if placement touches native.)

---

## Phase 4 — Cosmetics 🎨 (separate track)

- A cosmetics registry (tile/vault/trail/lantern/particle/storybook skins) keyed by
  `cosmeticUnlockIds`; a picker UI; apply at render. **Cosmetics only — never affects
  hatch/scores/progression.** Pure-data registry + harness for "unlocked ⇒
  selectable".

---

## Cross-cutting data dependencies (sequence these in)

| Need | Status | Action |
|---|---|---|
| Place categories (museum/cafe/park…) | partial — `place-categories.ts` Apple Maps cats + `confirmedPlaces.category` | ship defs for categories we already detect; **"First Country/Airport"** need reverse-geocode → defer those defs |
| Big-moment Life discoveries | available now (`bigMoments[]`) | ship |
| Calendar Life discoveries | blocked — `expo-calendar` stubbed | unblock per [[patch-systems-v3]] (install + plugin + paste real impl), then add defs |
| Steps / max-steps / calm days | available now (day records) | ship |
| Total distance / walking streak | needs HealthKit aggregate | small native add to `katchimera-health-routes` (sum distances / streak) → **rebuild**; phase those defs in after |
| World patch count / rarity | available now (`WorldState`) | ship |

---

## Risks & mitigations

- **Double-celebration / un-unlock:** the diff-from-derived model + persisted
  `unlocked` map + monotonic rules prevent both; harness asserts monotonicity.
- **Retro-barrage on first ship:** backfill marks history as `seenAnimation:true`
  with one summary (Phase 2).
- **Grindy drift:** keep rules milestone/first/threshold-based; PR review against the
  design's "never grindy" principle. No coin/quest-count rules.
- **Performance:** evaluation folds all days on focus — fine at current archive sizes
  (cap ~120 days, memoised); if it grows, cache the context by a day-count+signature
  key (same trick as `todaySignature`).
- **Artefact home:** world is single-patch today — Phase 1 surfaces artefacts in the
  Hall (no on-world placement) so the system ships value before the graphics phase.

---

## Suggested build order (smallest valuable slices)

1. **Phase 0** (engine + catalog + harness) — pure, fast, de-risks the rules.
2. **Phase 1** (storage + hook + Hall card/sheet) — discoveries become real & visible.
3. **Phase 2** (celebration + backfill + share) — the emotional payoff + virality.
4. **Phase 3** (world artefacts) — the "world enriched by living" promise (art phase).
5. **Phase 4** (cosmetics) — expression layer, independent.

Each phase ends green on `tsc` + `eslint` + `verify-discoveries.cjs` (+
`verify-world.cjs` from Phase 3). Native/art work is isolated to Phases 3–4 and the
distance/streak/calendar defs; everything else ships on a Metro reload.
