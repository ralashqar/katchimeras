# Hatch Engine v2 — End-to-End Design

> Status: **active design direction** (not yet built). This is the reference spec
> for the "your day is read, and it hatches into a creature you earned by living"
> loop. Companion docs: [katchimera-encounter-model.md](./katchimera-encounter-model.md),
> [katchimera-catalog-design.md](./katchimera-catalog-design.md),
> [katchimera-shareability-framework.md](./katchimera-shareability-framework.md).

---

## Mission

Complete the end-to-end **"your day is read, and it hatches into a creature you
earned by living"** loop, so Katchimeras reads as a living mirror of your real
day — not a daily reward toy. Every day grows a visible *field* of weighted
signals around the egg; at hatch, one katchimera is **drawn by weighted
probability** from that field, and the ones it beat surface as "almost caught"
echoes. **Rarity** is earned by how unusually the day was *lived*; **bond** is
earned by how often you *return*. The result is a collectible reflection of a
real life that is screenshot-worthy, status-bearing, and habit-forming.

## The spine

```
day inputs
  → day tags (weighted, visible, orbiting the egg)
    → candidate field (hidden)
      → probabilistic hatch
        → winner + echoes
          → Dex / bond / share
```

## Where today's engine stands (baseline)

The day already flows through two parallel reads, both worth keeping:

- **Inputs → Scores (5 axes)** — `computeDayScores` (`utils/home-engine.ts`):
  moments, prompt answers, captured camera energy, steps, places/new-places, and
  the chosen path sum into `energy / calm / social / exploration / focus`. This is
  the **mood** layer; it drives egg visuals and the fallback name/trait.
- **Inputs → Signals → Creature** — `extractEncounterSignals` +
  `matchEncounterForDay` (`utils/encounter-engine.ts`): the same day is read into
  discrete **seed signals** (`coffee_shop`, `museum`, `social_gathering`,
  `dog_companion`, `high_steps_day`…). This is the **identity** layer.

Rarity is resolved separately from how the day was *lived* (`computeLivingRarity`,
`utils/living-rarity.ts`); bond from how often you return (`encounterHistory`,
`utils/bond.ts`). Good architecture. The weaknesses are all in the selection step:

| Gap | Where | Effect |
|---|---|---|
| Selection is pure argmax — no probability, no variety | `matchEncounterForDay` picks `candidates[0]` | Same day-type → same creature forever. No surprise, no "almost." |
| `avoidProfileId` never wired into the live hatch | `finalizeDayHatch` calls `buildEncounterCreature` with no options | "Don't repeat yesterday" exists but **never runs** for today. |
| `repeatDepth` only ever *favors* repeats | `REPEAT_FAVOR_PER_VISIT` | A coffee regular gets Baristabbit endlessly; no counter-pull to discovery. |
| Mood and identity layers barely talk | `primaryTrait` only feeds name/visual fallback | The rich 5-axis read is wasted on the encounter path. |
| The candidate field is invisible | only `best` survives | "The set of katchimeras linked to the day" never reaches the user. |

## Locked design decisions (do not re-litigate)

1. **Tags swirl, creatures hidden.** Weighted `DayTag` orbiters are visible all
   day; candidate creatures stay secret until the reveal. Echoes ("Ironette was
   12% — this close") appear only on the reveal/share.
2. **Always drawn.** A seeded softmax always decides the hatch. No user picking,
   no re-roll. The drawn-ness is surfaced as a feature (`pickProbability`).
3. **Balanced variety.** Gentle bond reward for regulars + recency/avoid-previous
   penalties against back-to-back dupes + novelty pull for unseen day-types.
4. **Two independent axes kept.** Rarity = fixed at birth from living conditions
   ∨ species floor (`computeLivingRarity`, unchanged). Bond = return visits
   (`encounterHistory`, `BOND_STAGE_THRESHOLDS`).

---

## Systems to complete (end-to-end)

### A. Hatch Selection Engine v2

New **pure** module `utils/hatch-selection.ts`:

```ts
selectHatch(day, history, yesterday, rng) → { winner, echoes, probabilities }
```

Per-candidate weight (one candidate per extracted signal, after seed → species):

```
base(c)  = signal.intensity                         // 0..1, already computed
spec(c)  = SPECIFICITY[c.category]                  // subject/place/social = 1.0
                                                    // generic activity = 0.7
score(c) = base(c) × spec(c)
         + NOVELTY      +0.22   if never hatched this species
         + INTENT       +0.15   if signal came from an explicit tag/prompt
         + BOND         min(repeatDepth × 0.04, 0.16)
         + SEASONAL     +0.12   if species in its seasonal window
         + RARITY_LURE  0–0.10  scaled by species rarity floor
         − RECENCY      recencyPenalty(daysSinceLastHatch)
         − AVOID_PREV   −0.15   if c.species == yesterday's species
score(c) = clamp(score, 0.02, 1.5)
```

`recencyPenalty`: `1d → −0.35, 2d → −0.22, 3d → −0.12, 4d → −0.05, ≥5d → 0`.

Then top-**4** by score → **softmax τ≈0.18** → **sample** with an RNG seeded by
`hash(isoDate | inputSignature | storedNonce)`. The leader wins ~70–85%; #2 pulls
a real upset ~10–25%. The K−1 losers become `fieldEchoes`.

Wire into `finalizeDayHatch` (replacing the argmax in `matchEncounterForDay` for
the live path) and **actually pass the avoid/recency/history context**, which is
dead code today.

Tension by design: **BOND** quietly favors regulars; **RECENCY + AVOID_PREV** stop
identical back-to-back hatches; **NOVELTY** ensures a new day-type reveals
something unseen. **INTENT + SPECIFICITY** are how a candidate "wins by being
weighted in" — an explicit `Family` tag or a high-coverage museum read dominates
the softmax over a generic `high_steps_day`.

Hatch is a one-shot persisted event, so seeded randomness is safe **and**
reproducible/testable — matching the pure re-derivation architecture.

### B. Data model split

Formalize three shapes (all already implicit):

```ts
// STATIC — the catalog (formalize encounter-cast + profiles)
type KatchimeraSpecies = {
  id; name; seedIds: string[]; visualKey;
  category: 'place'|'subject'|'activity'|'landmark'|'season';
  baseRarityFloor: HomeRarityTier;          // a landmark is never 'common'
  seasonalWindow?: { from: MMDD; to: MMDD };
  voice; lines;
};

// PER-DAY — persisted (extend LocalCreatureRecord)
type KatchimeraInstance = LocalCreatureRecord & {
  pickProbability: number;                  // NEW — % chance this had
  fieldEchoes: { speciesId; rarity; reason }[];  // NEW — the ones it beat
  birthSignals: string[];                   // NEW — seedIds that formed it
};

// AGGREGATE — collection state (enrich encounterHistory)
type DexEntry = {
  speciesId; totalHatches; firstHatchedDate; lastSeenDate;
  bondStage: BondStage; highestRaritySeen: HomeRarityTier;
};
```

Add `storedNonce` per forming day. `version: 7` migration in
`upgradeStoredHomeState`.

### C. Day-tag field

Unify moments + prompts + vision + places + steps + capture + weather into one
stream:

```ts
type DayTag = {
  id; label; icon; accentColor;
  weight: number;            // 0..1 → orbit radius + size + glow
  feedsSpecies: string[];    // which candidate(s) this tag pushes
  source: 'moment'|'prompt'|'vision'|'place'|'steps'|'capture'|'weather';
};
```

Render as weighted orbiters around the egg; tapping a tag glows the candidate(s)
it feeds — selection becomes legible. Candidate **creatures stay hidden**
pre-hatch (locked).

### D. Meta-loops

- **Dex** — grid of all live-cast species; locked silhouette → first-hatch
  reveal; highest-rarity-seen + bond stage; category completion % ("Seasons 3/6").
- **Bond milestones** (`10 / 30 / 75`) — stage-up art evolution + history-aware
  reflection + "one visit from Familiar" nudge.
- **Rarity flex** — gem + `rarityReason` ("a place you'd never set foot in, in
  the small hours") as a status object; hero of the share card.

### E. Sharing / virality

- Reveal + share card lead with **winner + its 2–3 echoes + the rarity-reason
  line**.
- "Almost caught" re-engagement push on the highest-rarity missed echo after N
  days ("A summit day could call Peakle back").
- Keep the existing Day Card + Comic; make winner + echoes + rarity line the
  standard layout.

### F. UX unification

- One **"Add to today"** affordance feeding the single `DayTag` stream (moments,
  prompts, capture).
- Pre-hatch egg copy tied to the leading hidden candidate ("something with coffee
  is forming…").
- Creature card shows **both axes** — rarity gem (+ reason) + bond ring (+ next
  milestone).
- **"Plant tomorrow"** exposed once today hatches (uses existing `state.tomorrow`;
  no dead-end).

## Non-goals (explicitly out of scope)

- Pre-hatch creature reveal or rarity halos on orbiters (tags-only is locked).
- User-picked or re-rollable hatches.
- Server/cloud sync of the engine (stays on-device, pure).
- New creature art beyond what the live cast already supports.
- Monetization mechanics.

---

## Goal completion criteria

Done = every box below is checkable as true. **Status: built & verified** at the
logic + bundle layer (Node harnesses + `tsc` + a clean iOS Metro export). The one
item that needs the user's simulator (a visual hatch run) is flagged.

### Engine (A) — `utils/hatch-selection.ts`
- [x] **Pure** function (RNG + clock injected; no `Date.now`/`Math.random`),
  mirroring `living-rarity.ts`.
- [x] **Probabilistic**: distribution over seeds; leader wins ~79% at τ=0.18
  (asserted: rate ∈ [0.70, 0.85] over 4000 seeds).
- [x] **Reproducible**: same `(day, seed)` → identical winner + echoes.
- [x] **Variety holds**: recency + avoidPrev measurably suppress yesterday's
  species; novelty favors unseen; bond favors returns (all asserted in isolation).
- [x] **Intent/specificity win**: family tag and museum read each outrank a
  generic high-steps day (leader p > 0.6).
- [x] The dead `avoidProfileId` path is now live — `finalizeDayHatch` passes real
  yesterday + history context (`resolveYesterdayProfileId`).

### Data & persistence (B)
- [x] `LocalCreatureRecord` carries `pickProbability`, `fieldEchoes[]`,
  `birthSignals[]`; each forming day carries `storedNonce`.
- [x] `version: 7` migration upgrades v6 losslessly (shared body, optional-only
  fields); older versions still ladder up; hatched creatures untouched.
- [x] Rarity and bond remain independent and unchanged (existing
  `verify-encounter-engine` checks still green).

### Day-tag field (C)
- [x] A single `DayTag[]` is derived from every source (`utils/day-tags.ts`),
  weighted, rendered as the orbiting `EggTagField`, sized by contribution.
- [x] Candidate creatures are **not** shown pre-hatch (only the *kind of day*).
- [x] Tapping a tag glows the candidate(s) it feeds (`feedsSpecies` wired,
  asserted: coffee→Baristabbit, steps→Steppling, museum→Relicoon).

### Reveal & sharing (E)
- [x] Reveal (`CreatureHero`) shows the winner, its draw % (`pickProbability`),
  and the top echo(es) it beat with rarity.
- [x] Rarity-reason line is on the hero/card; echoes flow into the share surface
  via `CreatureHero showField`. *(Visual layout of the rendered share image
  needs a device pass.)*
- [x] An "almost caught" notification fires on the highest-rarity missed echo
  ~3 days later (`buildAlmostCaughtReminder` + `syncHatchNotification`).

### Meta-loops (D)
- [x] The Dex (`utils/dex.ts` + rewritten `collection.tsx`) lists all live-cast
  species: locked silhouette until first hatch, highest-rarity-seen + bond stage,
  category completion %.
- [x] Bond stages (10/30/75) surface as labels (new/familiar/devoted/kindred) on
  each Dex entry. *(Stage-up art-evolution animation is a later art pass.)*
- [x] Creature card shows rarity (+ reason) and bond depth.

### UX unification (F)
- [x] All input sources (moments, prompts, capture, vision, places, steps,
  weather) feed the one `DayTag` stream the egg view renders.
- [x] Pre-hatch egg copy references the leading hidden candidate's theme
  (`previewLeadingCandidate` → `buildEggForecast`).
- [x] "Plant tomorrow" remains reachable once today has hatched (`state.tomorrow`).

### Quality bar
- [x] Engine + day-systems unit tests cover distribution, reproducibility,
  recency/novelty/intent, rarity/bond independence, tag linkage, Dex aggregation,
  almost-caught — all green (`verify-hatch-selection.cjs`, `verify-day-systems.cjs`).
- [x] App **bundles** end-to-end through v2 — clean `tsc --noEmit` and a
  successful `expo export -p ios` (6.56 MB Hermes bundle, no resolution errors),
  with all existing harnesses still green (no regression to egg/day-map/cards).
- [ ] **Pending the user's device**: a visual hatch run in the iOS simulator to
  eyeball the tag field, reveal echoes, and Dex rendering.

---

## Build order

The first slice everything hangs off:

> **`utils/hatch-selection.ts`** + tests (Criterion A): weight → top-4 softmax
> τ≈0.18 → seeded sample, pure and deterministic under an injected RNG. Then wire
> into `finalizeDayHatch`, persist `fieldEchoes` + `pickProbability` (`version: 7`
> migration), and feed echoes into the reveal/share card. Everything in C–F builds
> on that one function.
