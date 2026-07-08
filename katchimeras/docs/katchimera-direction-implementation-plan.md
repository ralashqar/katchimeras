# Katchimeras — Direction Implementation Plan

Status: execution plan for `katchimera-product-direction-2026-06.md`. Ordered so each milestone ships value on its own and later milestones build on earlier ones. Written to be followed top-to-bottom.

## Ground truth this plan is built on

- Live hatch logic: `utils/home-engine.ts` → `finalizeDayHatch()` (~line 1327). Currently trait-score based: hash → `homeVisualPools` (14 hardcoded visuals), name from root/suffix pools, highlight/reflection from template strings (`buildHatchedHighlight`, `buildReflectionLine`).
- Encounter data is ready to consume: `data/katchimeras/encounter-katchimeras.json` (104 profiles) with full copy layers (`caption`, `identityInsight`, `unlockLine`, `repeatLine`, `rareLine`, `restorativeLine`, `storySeed`) and `variantSupport: [timeOfDay, repeatDepth, novelty]`. Types in `types/katchimera.ts`.
- Location data is raw lat/lng samples (`StoredHomeLocationPoint`) — **no place categories**. Day-map clustering (`utils/day-map-engine.ts`) gives dwell-ranked clusters. Semantic encounter signals must come from moments + steps + cluster shape first; POI lookup is a later enrichment.
- `HOME_HATCH_HOUR = 20` hardcoded in `constants/home-mvp.ts`; gate at `home-engine.ts:1170`.
- `expo-notifications` is **not** in package.json yet. `react-native-view-shot` is present; share destination unfinished.
- Art pipeline (Supabase edge fn `generate-katchimera-art` + FAL) works from the art lab; 13 hero renders exist.
- Stored state is at `version: 4` with a working migration chain.

---

## Milestone 1 — Encounter engine in the live hatch

Pure code, no new assets required (reuses the 13 existing renders + trait fallback). This is priority zero.

### 1.1 Encounter signal extraction — new `utils/encounter-engine.ts`
- Input: `StoredHomeDayRecord` (+ clusters from `day-map-engine`). Output: ranked `EncounterSignal[]` = `{ category, subtype, timeOfDay, intensity, sourceMomentIds }`.
- v1 signal sources (no POI data needed):
  - Manual moments → categories: `coffee → coffee_shop`, `walk → park/run`, `social → social`, `calm/focus → home_evening/workspace`, `new_place → exploration`, inspiration category, photo-linked locations.
  - Steps bands → `run_session` / movement intensity.
  - Cluster shape → home-anchored vs multi-stop vs one-long-dwell day; `newPlaceCount` → novelty.
- Keep it a pure module (no storage, no React) so it's testable from a dev screen.

### 1.2 Encounter matching + selection
- Bundle the encounter profiles into the app (slim them: id, seed, category, copy layers, motifs — strip `imagePrompt`/`promptHooks` to keep bundle light; small build script or a trimmed JSON).
- Define the **live cast subset** (see 2.1) — matching prefers flagship characters, then category fillers, then the existing trait-based creature as final fallback. Thin passive days must always hatch something warm (route them to the home/recovery character, never a "nothing happened" feel).
- Deterministic: reuse the `stableHash` signature approach so re-hatching is stable across relaunch.
- Rewire `finalizeDayHatch()` to: signals → match → build creature from profile (name, motifs, copy) with trait path as fallback.

### 1.3 Repeat depth — the relationship mechanic
- Add per-profile encounter history to stored state: `{ profileId: { count, lastSeenIsoDate } }`.
- Selection uses it two ways: (a) returning characters are *favored* when the same category repeats (relationship > novelty), (b) copy layer picks `unlockLine` (first), `repeatLine` (returning), `rareLine` (pattern break / high intensity), `restorativeLine` (thin recovery days).
- Extend `LocalCreatureRecord` with `encounterProfileId`, `repeatDepth` → **state version 5 + migration** (old creatures keep working untouched).

### 1.4 Demote the path-picker
- Remove the energy/calm path selection panel from the default Home flow (keep the code path; show only as fallback enrichment for sensor-thin days, or behind the dev flag). It conflicts with "reflection over configuration" and its score-bias role is superseded by encounter signals.

**Acceptance:** a day with a coffee tag hatches a coffee character with encounter copy; the same pattern three days running surfaces the repeat line; a moment-less, low-step day still hatches the recovery character with the restorative line; hatch is identical after relaunch; v4 → v5 migration preserves archived days.

---

## Milestone 2 — Flagship cast assets (runs in parallel with M1; needs human QA)

### 2.1 Lock the live cast (~12–16)
Each maps to encounter coverage of *common* days — coverage matters more than coolness:

| Character | Covers | Note |
|---|---|---|
| Baristabbit (or Lattelet) | coffee_shop | flagship |
| Crumbun | bakery / food stop | flagship |
| Mossprout | park / green walk | flagship |
| Signalhop | city / commute / night out | flagship |
| Sprintail | run / high-step day | flagship |
| Hushling | home evening / recovery | **critical: the thin-day default** |
| Bedrotte | rest / weekend-in | meme potential |
| Errandimp | multi-stop errand day | fills adult-life gap |
| Shelfself | bookstore / focus / study | |
| Doggoblin | dog park / social outdoor | |
| Hayhorn | market / wholesome outing | |
| Ironette | landmark / travel rare | the "rare" slot |
| + 2–3 fillers | social_meal, waterside, museum | from encounter seeds |

### 2.2 Render + QA
- Generate via the existing art-lab → FAL pipeline: 1 hero portrait per character + 2 mood/state variants (e.g. first-meet vs returning). Judge against the art bible's five gates (thumbnail read, silhouette, glow core, one motif, eyes). **Human approval per render** — flag for review, don't auto-accept.

### 2.3 Asset delivery
- Bundle approved renders (webp, ~512px) under `assets/images/katchimeras/`, with an `encounterProfileId → asset` map in `constants/`. CDN delivery can come later; bundling ~16 images is fine and keeps the app offline-true.
- Wire `creature-hero`, timeline cards, and the postcard to encounter art, falling back to the existing trait visuals when no asset matches.

**Acceptance:** every category in 2.1 resolves to a bundled render; no hatch ever shows a missing image.

---

## Milestone 3 — Real reflections (LLM at hatch)

Depends on M1 (the matched character provides the voice).

### 3.1 Edge function `generate-day-reflection` (Supabase, like the art fns)
- Input: anonymized day summary — moment types/labels, **place categories only (never raw coordinates)**, steps band, matched character + repeatDepth, optional note text, tone preference.
- Calls the Anthropic API (`claude-haiku-4-5` — one short call/user/day; upgradeable later). Returns `{ highlight, reflection }` (1–3 sentences, character voice).
- Per-character voice snippets sourced from the production sheets / flagship roster docs.

### 3.2 Client integration
- Call at hatch with a short timeout; on failure/offline, fall back to the data-driven copy layers from M1.3 (the experience must never block on network).
- Persist the result into the creature record so the hatch stays stable across relaunch; never regenerate.
- Privacy: documented contract — categories and counts only, no identifiers, no coordinates; later a visible "private mode" toggle that keeps reflections fully on-device (fallback copy).

**Acceptance:** hatch with network → unique, accurate-feeling reflection naming a real detail of the day; airplane mode → graceful data-copy fallback; relaunch → same text.

---

## Milestone 4 — Ritual mechanics: hatch hour + the one notification

### 4.1 User-set hatch hour
- Add `hatchHour` to stored state (default 20); replace `HOME_HATCH_HOUR` reads in `home-engine.ts`; small setting UI (Home overflow or onboarding step 4 addition).

### 4.2 Hatch notification
- Add `expo-notifications`; schedule a daily **local** notification at hatch hour: "Your day is ready to hatch." Reschedule on hatch-hour change; skip if the day already hatched.
- Ask notification permission at the *right* moment: right after the user's first manual hatch ("want to be told when tomorrow is ready?"), not during onboarding.

**Acceptance:** notification fires at the chosen hour, deep-links to Home, never fires for an already-hatched day, and denial degrades silently.

---

## Milestone 5 — Close the loop: postcard + note

### 5.1 Memory postcard share
- Compose the share card per the shareability framework: portrait, name, reflection line, encounter cue tag, subtle wordmark. Render off-screen → `captureRef` → native share sheet (`expo-sharing` or RN `Share`).
- This is the only viral surface — polish it (correct safe-area, 4:5 ratio for feeds, dark premium look).

### 5.2 One-line note moment
- Add `note` to `HomeMomentType` + radial flow (per the rotary capture doc's planned state machine); single line, optional. Feeds directly into the M3 reflection input — this is the cheapest accuracy multiplier in the whole plan.

**Acceptance:** share produces a clean image in the share sheet with no UI chrome; a note written during the day visibly shapes that night's reflection.

---

## Milestone 6 — Compounding (after 1–5 are live)

In rough order: weekly recap artifact ("your week's habitat") → collection grid that *emerges* from hatched days (simple, no deck mechanics) → rarity events for pattern-breaks → POI enrichment (reverse-geocode/places lookup in the edge function to upgrade signal quality) → HealthKit route import completion → premium scaffolding only once D30 retention data exists.

## Explicitly parked (from the direction doc)
Avatar studio (keep behind dev flag, no further work) · 300-permutation rendering · evolution/fusion · streaks · World tab as user surface · billing.

## Working practices
- Each milestone = its own branch + PR; M1 lands before M3 starts; M2 runs alongside.
- `home-engine.ts` is ~1700 lines and load-bearing — extract new logic into new pure modules (`encounter-engine.ts`) rather than growing it; touch `finalizeDayHatch` surgically.
- Stored-state changes always bump version + add a migration; never mutate the meaning of existing fields.
- No test infra exists: keep engine code pure and add a dev-screen scenario harness (seeded fake days: coffee day, run day, thin day, repeat-week) behind `DEV_DEBUG_NAV_ENABLED` to verify hatches deterministically.
- Anything needing human taste (cast approval, render QA, voice copy) is flagged for review rather than auto-decided.

## Dependencies / inputs needed from you
1. FAL + Supabase secrets working for batch generation (art-lab flow suggests they exist).
2. An Anthropic API key as a Supabase function secret for M3.
3. Cast approval (2.1 table) and render sign-off (2.2).
4. Apple Developer push/notification entitlement is *not* needed (local notifications only).
