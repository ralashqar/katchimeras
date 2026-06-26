# Katchimera Progression & Customisation — Design Approach

**Status:** design (recommended approach) · 2026-06-25
**Companion:** [progression-customisation-plan.md](./progression-customisation-plan.md)
**Builds on:** [discoveries-system-design.md](./discoveries-system-design.md) · Memory Quests · Cosmetics (Phase 4)

> The world is built from life. Cosmetics only change how that life is expressed.
> Users are rewarded for living, not grinding.

---

## 0. TL;DR — what this actually is

This spec is **~70% already built** and **~30% genuinely new**. The new pillar is
**Essence** (a cosmetic currency). The rest *extends* systems shipped this session:

| Spec pillar | Status in code today | This spec adds |
|---|---|---|
| Memory Quests | **Built** (`utils/memory-quests-engine.ts`, 6 types, derive-from-signals, ≤3/day, no-fail) | `namePatch` quest + an **Essence reward** per quest |
| Discoveries | **Built** (Phases 0–4: catalog, hook, Hall, reveal, on-world artefacts) | an **Essence reward** on unlock |
| Cosmetics | **Built** (`cosmetics-*`, lantern colours, discovery-gated) | **Essence purchase** path + many more types + a **shop** + **layered application** |
| Essence currency | **Does not exist** | the whole thing (earn / balance / spend) |
| World themes / object skins / decals / particles / egg skins / accessories | not built | a large (mostly art-bound) catalog |

**The single most important design decision** (section 3): model Essence as a
**derived-earned + persisted-spent ledger**, mirroring how Discoveries already work
(re-derive from history; persist only the delta). This makes it ungrindable,
reinstall-safe, and consistent with the codebase — and it's why this slots in
cleanly rather than bolting a mutable coin counter onto every action.

---

## 1. Reconcile, don't rebuild

The spec proposes fresh data models (`PatchQuest`, `Discovery`, `CosmeticItem`,
`UserCosmeticInventory`). We already have working equivalents. **Recommendation:
extend the existing types; do not migrate to the spec's verbatim shapes.**

- **Quests** — the spec's `PatchQuest` persists a `status` (`available/completed/
  dismissed`). Our `MemoryQuest` instead **derives completion from day signals**
  (a captured meaning, a voice note, a confirmed place…). The derived model is
  *strictly better* for this spec's own rules ("no failure state, no streak
  punishment, quests optional") because there's no status to fail and the existing
  capture flows' animations fire for free. **Keep derive-from-signals.** Add only
  `essenceReward` to the catalog and a `namePatch` type.
- **Discoveries** — add `essenceReward` to `DiscoveryDef`. The "Discovery Recorded"
  reveal (already built) becomes the spec's §17 modal; just add a "+N Essence" line.
- **Cosmetics** — extend `CosmeticDef` with `essenceCost?` + `unlockMethod`; extend
  the persisted state into the spec's `UserCosmeticInventory`.

---

## 2. The progression loop (as it maps to code)

```
Live the day → existing passive capture (photos/places/health/calendar)
   ↓
Capture / reflect / mark → existing flows (moment-capture, notes, place prompt, …)
   ↓
Memory Quests (optional, ≤3)         → memory-quests-engine (derive-from-signals)
   ↓
Earn Essence                          → NEW essence-engine (derived-earned ledger)
   ↓
Unlock Discoveries                    → discoveries-engine (built) + essence award
   ↓
Spend Essence on cosmetics            → NEW essence spend + cosmetics shop
   ↓
Personalise expression                → cosmetics application layering (extend)
```

Nothing in this loop should ever touch hatch odds, rarity, scores, or feature
access — Essence is **cosmetic-only** (enforced by simply never wiring a spend path
to those systems; see invariants §7).

---

## 3. Essence — the core new system

### 3.1 Model: derived-earned + persisted-spent

```ts
// types/essence.ts (new)
export type EssenceState = {
  version: 1;
  spent: number;             // persisted; only ever increases on purchase
  purchases: string[];       // cosmeticIds bought with essence (the receipt)
};
// balance = earnedTotal(history) - spent
```

- **Earned is DERIVED** from history every evaluation — never a mutable counter.
  An `essence-engine` computes `earnedTotal(days, unlockedDiscoveryIds)` as a pure
  sum of per-event awards. Because it's derived once-per-event from immutable day
  records, it **cannot be farmed** (re-capturing the same photo doesn't re-pay) and
  it **survives reinstall** (history re-creates the balance). This is the exact
  pattern Discoveries use.
- **Spent is PERSISTED** (`essence-storage`, key `katchimera.essence.v1`): the only
  mutation is "user bought cosmetic X for N" → `spent += N`, `purchases.push(X)`.
- **Balance = earned − spent**, clamped ≥ 0.

### 3.2 Award table (per-event, once each)

Derived from existing day signals (mirrors `discoveries-context.ts`):

| Event (signal source) | Essence |
|---|---|
| Photo captured (`capturedMeanings` / heroPhoto) | +3 (+5 if it carries a meaning) |
| Voice memory (`notes` kind `voice`) | +8 |
| Reflection answer (`promptAnswers` reflection kinds) | +4 |
| Place confirmed (`confirmedPlaces`) | +6 (+10 if it was a new place) |
| Food memory (`foodMoments`) | +5 |
| Big moment (`bigMoments`) | +15 |
| Patch named (`namePatch`, new field) | +3 |
| Discovery unlocked (`DiscoveryDef.essenceReward`) | +20…+100 by rarity |
| Weekly world recap (7 finalised days in a week) | +25 |

`earnedTotal` = Σ over all days of the above. Quests don't pay *separately* — a
quest is just a prompt to do one of these events, so completing a quest pays via
its underlying event (no double-pay, no "quest grinding"). The quest card still
*shows* "+N Essence" as the incentive (the value of its target event).

### 3.3 Why not a mutable counter

A counter incremented on each action drifts, can be exploited (spam captures),
needs migration, and is lost on reinstall. Derived-earned avoids all four and keeps
Essence honest: **it literally equals the significance of what you've recorded.**

---

## 4. Memory Quests — the small additions

Keep the engine. Add:
- `namePatch` quest type (target `chronicle`/a new `story` cell; completion = the
  day has a user-set name). Needs a small `name?: string` on the day record (or
  reuse the `day_word` reflection — see open questions §9).
- `essenceReward` on the catalog entries (display only — the actual credit flows
  through the essence ledger's event awards).
- The completion animation (spec §17): quest glows → **essence motes fly to the
  balance** → patch object appears → discovery check → discovery modal if unlocked.
  We already have egg-feed/sprite-bounce animations; add the essence-mote flourish.

---

## 5. Cosmetics — from discovery-gated to a shop

Today cosmetics unlock **only** via Discovery (lantern colours). The spec wants
**three** unlock paths. Extend `CosmeticDef`:

```ts
export type CosmeticDef = {
  // …existing: id, type, name, description, swatch, value?, isDefault?
  unlockMethod: 'essencePurchase' | 'discoveryUnlock' | 'seasonal' | 'premium';
  essenceCost?: number;             // for essencePurchase
  unlockDiscoveryId?: string;       // for discoveryUnlock (existing)
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  seasonalTag?: string;
};
```

**Owned** = `isDefault` OR discovery-unlocked OR in `purchases[]`. The shop lists
all cosmetics with state (owned / buyable / locked-by-discovery / premium) + cost.
Buying = `spend(cost)` → add to `purchases`. Applying = set the active selection
(existing `cosmetics-storage` selection model, extended per §6).

### 5.1 Catalog scope is the real cost

The full spec catalog is **art-heavy**: 6 object types × ~6 skins, 8 world themes,
~10 decals, ~8 particles, ~7 storybook styles, ~6 egg skins, accessories. That's
~80 bespoke assets. **Recommendation: ship cheap, code-only cosmetics first**
(lantern colours ✓ done, world-theme *accent tints*, UI/storybook *style presets*),
and treat bespoke object skins / decals / particles / egg art as a long tail added
in waves via the katchimera-assets skill — exactly how artefact/sleep/food art was
phased. Don't gate the *system* on the *art*.

---

## 6. Cosmetic application layering

The spec's resolution order (§14) is good. Implement as a pure resolver:

```
resolveSkin(semanticType, inventory, worldTheme, season) =
   user override  ??  worldTheme skin  ??  default skin       (+ seasonal overlay)
```

Extend the persisted inventory toward the spec's `UserCosmeticInventory`
(`activeWorldThemeId`, `objectSkinOverrides: Record<semanticType, cosmeticId>`,
`activeEggSkinId`, `patchDecals`, `activeParticleEffectId`, `activeStorybookStyleId`).
The renderer (today-patch-engine / world-canvas / share card) calls `resolveSkin`
per object. **MVP applies only the cheap layers** (world-theme accent + egg/lantern
colour); object-skin overrides light up as their art lands.

---

## 7. Invariants (enforce + harness)

These encode the spec's "Do Not" list as testable rules:

1. **Essence is cosmetic-only.** There is no function anywhere that spends Essence
   on hatch odds, speed, creatures, history, or features. (No code path = can't
   regress. Add a doc note + PR-review rule.)
2. **No double-pay / no farming.** `earnedTotal` is a pure function of immutable
   history; harness asserts re-evaluating identical history yields identical earned.
3. **No failure / no streak punishment.** Quests stay derive-from-signals (no
   status, no expiry penalty).
4. **Cosmetics never change meaning.** Skins map a *semantic type* → a *visual*;
   the semantic type is immutable. Harness asserts every skin declares a real
   semantic target and never alters the underlying object's category.
5. **Balance ≥ 0**; a purchase is rejected if `cost > balance`.

---

## 8. UI surfaces (extend existing)

- **Today / World dashboard** — Essence balance chip; quest cards show "+N Essence";
  earn feedback (motes). (Dashboard already hosts the Discoveries + Customize cards.)
- **Cosmetic Shop** — a new sheet: balance header, category tabs (World Themes /
  Object Skins / Decals / Particles / Storybook / Egg), cards with preview + cost +
  owned/locked state + "unlocked by \<Discovery\>" provenance. The existing
  `cosmetics-sheet.tsx` (the picker) grows into this, or a sibling "shop" sheet
  feeds the picker.
- **Hall of Discoveries** (built) — already shows unlocked discoveries + world
  reward; add the essence reward + any cosmetic it unlocked.
- **Discovery reveal** (built) — add "+N Essence" + "X skin unlocked" lines (§17).

---

## 9. Open questions / decisions to confirm

1. **Patch naming** — `namePatch` needs somewhere to store the name. Reuse the
   existing `day_word` reflection (a one-word day label) as the patch name, or add a
   dedicated `dayName?: string`? (Recommend a dedicated field + a "Story Banner"
   object; `day_word` stays a reflection.)
2. **Weekly recap essence** — needs a "week complete" notion (7 finalised days in an
   ISO week). Cheap to derive; confirm the threshold (7 vs "any 5").
3. **Object-skin art budget** — confirm we ship cheap cosmetics first and add
   bespoke skins in art waves (recommended), vs. blocking on the full catalog.
4. **Premium** — deferred (spec §19). The `unlockMethod: 'premium'` field reserves
   it; no store/IAP work now.
5. **Essence visual language** — "memory droplets / crystal shards / glowing motes",
   never casino coins (spec §18). Pick one motif for the mote animation + balance
   icon.

---

## 10. Success criteria (unchanged from spec §20)

Wins if users feel: *"I want to capture something today,"* *"my world is becoming
more personal,"* *"my discoveries are things I actually lived."* Fails if it feels
like grinding currency, doing chores, or a game shop. The derived-earned ledger +
derive-from-signals quests + cosmetic-only spend are precisely the guards against
those failure modes.
