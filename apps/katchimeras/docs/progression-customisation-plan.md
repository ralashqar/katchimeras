# Katchimera Progression & Customisation — Implementation Plan

**Status:** plan (not started) · **Companion:** [progression-customisation-design.md](./progression-customisation-design.md)

Phased like the Discoveries build: each phase ships independently, is verifiable on
Windows (`tsc` + `eslint` + a `verify-*.cjs` harness), and is JS-only where possible.
Art/native/IAP work is isolated to later phases and flagged. MVP follows spec §19.

Conventions (match the codebase):
- Pure engines + Node harness (`scripts/verify-*.cjs`), inject `now`, no
  `Date.now()` inside engines.
- Persist via `utils/app-storage.ts`; read history via `useAllDays()`.
- **Reuse, don't rebuild**: extend `memory-quests-engine`, `discoveries-*`,
  `cosmetics-*` rather than introducing the spec's verbatim types.

---

## Phase A — Essence engine (earn/balance, derived) ✅ pure, no build · **MVP**

The foundation: balance with no spending yet.

- `types/essence.ts` — `EssenceState { version, spent, purchases[] }`.
- `utils/essence-engine.ts` — `essenceAwardsForDay(day)` (pure per-day award sum
  from existing signals, per design §3.2) + `earnedTotal(days, unlockedDiscoveryIds,
  discoveryEssence)` + `essenceBalance(earned, spent)`. Reuses the same day fields
  `discoveries-context.ts` already reads.
- Add `essenceReward` to `DiscoveryDef` (catalog) — drives discovery-unlock awards.
- Add `essenceReward` to the Memory Quest catalog (display value).
- `utils/essence-storage.ts` — load/save `EssenceState` (`katchimera.essence.v1`),
  `recordSpend(state, cosmeticId, cost)`.
- `hooks/use-essence.ts` — `useAllDays()` + discoveries → `{ earned, spent, balance }`.
- `scripts/verify-essence.cjs` — award table correctness; **idempotent earned**
  (same history ⇒ same total, the anti-farm guard); balance = earned−spent ≥ 0;
  discovery essence folds in.

**Exit:** balance computes from real history; `tsc`/`lint`/`verify-essence` green.

---

## Phase B — Essence in the UI + earn feedback ✅ JS, no build · **MVP**

- **Balance chip** on the World/Today dashboard.
- Memory Quest cards show **"+N Essence"** (from the catalog value).
- **Earn feedback**: essence-mote flourish (soft motes → balance) on a qualifying
  capture; reuse the egg-feed/`captureFly` animation primitives. Keep it "memory
  droplets," never coins (design §7 / spec §18).
- Extend the **Discovery reveal** (built) with a "+N Essence" line.
- `namePatch` quest: add the day-name field + a "name today" flow + Story Banner
  object (small; reuses the big-moment/landmark rendering path).

**Exit:** users see Essence accrue from living; `tsc`/`lint`/harnesses green.

---

## Phase C — Cosmetics as a shop (essence purchase) ✅ JS, no build · **MVP**

Turn the discovery-only cosmetics into a dual-unlock shop.

- Extend `CosmeticDef`: `unlockMethod`, `essenceCost?`, `rarity?`, `seasonalTag?`
  (keep `unlockDiscoveryId`).
- Extend `cosmetics-engine`: `isCosmeticOwned(def, unlockedDiscoveryIds, purchases)`
  (default OR discovery OR purchased); `canAfford(def, balance)`.
- `cosmetics-storage`: add `purchases[]` (or reuse essence `purchases`); `buy` =
  `essence.recordSpend` + own it.
- **Shop sheet**: balance header, category tabs, cards (preview + cost + owned/
  buyable/locked-by-discovery state + provenance). Grow `cosmetics-sheet.tsx` into
  picker+shop, or add a sibling shop sheet.
- Seed the catalog with **code-only** purchasable cosmetics first: more lantern
  colours + **world-theme accent presets** (see Phase D) so the shop has stock
  without an art dependency.
- `scripts/verify-cosmetics.cjs` (extend): ownership via each unlock path; purchase
  rejected when `cost > balance`; every `unlockDiscoveryId`/`essenceCost` valid.

**Exit:** earn essence → buy a cosmetic → it applies. `tsc`/`lint`/harness green.

---

## Phase D — World themes + application layering ✅ mostly JS · **MVP (themes only)**

- `utils/cosmetics-skin.ts` — pure `resolveSkin(semanticType, inventory, worldTheme,
  season)` = override ?? theme ?? default (+ seasonal overlay), per design §6.
- Extend inventory toward `UserCosmeticInventory` (`activeWorldThemeId`,
  `objectSkinOverrides`, `activeEggSkinId`, `patchDecals`, …).
- **World themes as accent/tint presets** (cheap, no art): a theme sets ground/
  accent/lighting tints applied in `world-canvas` + UI accent. Ship ~4 themes.
- Wire `resolveSkin` into today-patch-engine / world-canvas object rendering (egg +
  lantern colour already done as the proof).
- Harness for `resolveSkin` layering precedence.

**Exit:** picking a world theme restyles the world (tints); object-skin overrides
resolve (art lands in Phase E). Needs **device QA** for look.

---

## Phase E — Art-heavy cosmetics (waves) 🎨 art track · **deferred**

Add bespoke assets in waves via the katchimera-assets skill, each wave = generate →
matte → register in `world-visuals` → add catalog entries → `resolveSkin` picks them
up (no engine change):
- Object skins (Memory Vault, Reflection, Places, Journey, Chronicle, Food — ~6 each)
- Egg skins (~6), tile decals (~10), particle effects (~8), storybook styles (~7)

Each wave is independently shippable; the *system* (Phases A–D) doesn't wait on it.

---

## Phase F — Seasonal, accessories, premium 🎨/💳 · **deferred**

- Seasonal collections (time-boxed catalog subsets + overlays).
- Creature accessories (one slot; new render layer on the creature sprite — art).
- Premium packs / IAP (`unlockMethod: 'premium'`) — store + entitlement plumbing;
  **must not** gate memories, hatching, core progression, or core quests (spec §15).

---

## Cross-cutting dependencies (sequence in)

| Need | Status | Action |
|---|---|---|
| Quest/discovery/cosmetic engines | **built** | extend in place |
| Essence award signals | available (day records) | Phase A |
| `namePatch` storage | not present | add `dayName?` field (Phase B) |
| Weekly recap notion | derivable from finalised days | Phase A/B |
| World-theme tints | code-only | Phase D |
| Object-skin / decal / particle / egg art | not present | Phase E art waves |
| Premium / IAP | not present | Phase F |

---

## Risks & mitigations

- **Grind drift** → derived-earned ledger (Phase A) makes farming impossible;
  harness asserts idempotency. No mutable counter anywhere.
- **Art budget blowout** → ship cheap (colour/tint/theme) cosmetics first; bespoke
  skins are independent art waves (Phase E), never blocking the economy.
- **Pay-to-progress creep** → invariant: no spend path touches hatch/scores/history/
  features; premium reserved for *cosmetics only* (spec §15). PR-review rule + doc.
- **Balance exploits** → purchases validate `cost ≤ balance`; spent only increases;
  balance clamped ≥ 0.
- **Device-only visuals** (themes/skins/motes) → can't QA on Windows; land behind
  tsc/lint/harness and flag for device review (same caveat as artefact placement).

---

## Suggested build order (MVP = A→D)

1. **Phase A** — essence engine + storage + harness (pure; balance from history).
2. **Phase B** — balance chip + quest essence display + earn motes + namePatch.
3. **Phase C** — cosmetics shop (essence purchase, dual unlock).
4. **Phase D** — world themes + `resolveSkin` layering (cheap cosmetics applied).
5. **Phase E/F** — art waves, seasonal, accessories, premium (deferred).

Phases A–D are the spec's MVP (§19) and ship **Metro-reload, no native build**.
Every phase ends green on `tsc` + `eslint` + the relevant `verify-*.cjs`.
