# Territory battles, round two: the turn strip, sky wisps and bound pieces

Status: **spec, Sept 23 2026, not built.** It builds on `encounter-territory.md`: the Harmony pulse, nests, the Mist meter, looks, chains, the Spring, the bots and soft loss all stay.

## Why

Territory battles made the board the battlefield. Three things still stand between them and a game that feels turn-based and readable:

1. **You rarely see the enemy take a turn.** Countdowns tick silently, and a few merges later two wisps may act at once.
2. **The Mist spreads to cells nobody showed you.** A loss then feels like luck, not a choice you made.
3. **Every wisp is on the board, so they all play the same way.** The first boards had wisps floating over the island tile, and half-Misted pieces you could see but not use. Both are missing, and both are good.

## The one-line version

> You merge; one wisp acts, and before you merge you can see exactly who acts next and which cells it will take. Some wisps nest on the board; others float over the island and can only be reached from the board's top row. Some pieces start half-hidden under Mist and are freed by a pulse or by merging a twin into them.

---

## 1. The turn strip: one enemy action per turn

### Rules

- **Turn order.** A battle keeps an order of acting wisps, shown as a strip above the board, for example `Surger → Mender → Surger → Thief`.
- **One action per turn.** After every merge (unless it won the level), exactly one entry acts: the one at the front. That wisp plays its current intent, moves on to its next intent, and goes to the back of the strip. Its intents still cycle in order as they do today.
- **Who is in the strip:**
  - Plain Mistwisps (no intents) never enter it.
  - A hidden wisp joins at the back when it arrives, whether called or split off.
  - A fallen wisp leaves it.
  - A wisp authored with `slots: 2` (a boss) appears twice, spread evenly through the strip.
- **Rest turns.** A level can put Rest entries in the strip (`rest: n` adds n of them). A Rest turn does nothing and shows a calm Mist icon: "The Mist gathers itself." Calm levels use these so a lone wisp doesn't act on every turn.
- **Hits push back.** When a merge strikes a wisp (damage dealt or ward soaked), that wisp moves back one place in the strip, swapping with the entry behind it. This happens once per wisp per turn and replaces today's one knock-back per intent. You can see it happen, and it's easy to explain: "You pushed it back."
- **Dew Spring delay.** The Dew Spring's "the wisps wait N turns" still applies: the first N merges have no enemy action, and the strip shows a Calm token for each.

Intent `every` is no longer used in a territory battle, where the strip replaces it. Older boards that still count down keep working unchanged.

### Telegraph: the next action is shown exactly

The front entry's action is worked out when it reaches the front and shown on the board:

| Intent | What the board shows | What it locks in |
|---|---|---|
| Surge N | a pulsing Mist outline on each of the N target cells | those cells |
| Shroud / Root | a thick or root outline on the target cell | that cell |
| Devour | a bite marker on the piece | that piece |
| Burrow | an arrow from the nest to the target cell | that cell |
| Call / split | a faint wisp outline on the arrival cell | that cell |
| Spores | a spore outline on the target cell | that cell |
| Ward / Mend / Gather | a glow on the wisp itself | nothing on the board |

The plan is fixed when shown. During the player's turn:

- **Put a piece on a targeted cell.** When the Mist lands there it binds that piece (section 3) instead of eating it. A Plant or bigger holds the ground: that target fizzles. This is the main counterplay: block with something big, or accept losing a small piece to the Mist.
- **Clear a targeted cell with a pulse.** Nothing changes, because the Mist lands on a free cell anyway.
- **Move or merge the targeted piece away.** The Devour fizzles.
- **Strike the acting wisp.** It is pushed back one place. The wisp now at the front works out a new plan, which is shown at once.
- **A target has become impossible** (its cell turned to Mist, a nest moved): the action is worked out again when it plays. This is rare.

Working out the plan uses the same seeded randomness as the action itself (`run.seed` plus the turn), so what is shown and what happens always match. There is one pure function for it, `planWispTurn(mechanic, state, board, window)`, and both the preview and the action call it.

### Engine changes

- **`DarkWispsState`** gains:
  - `order: number[]` (wisp indices; `-1` is Rest);
  - `plan: { wisp: number; intent: WispIntent; cells: number[]; piece?: number } | null`;
  - `pushed: boolean[]` (pushed back this turn).
- `countdown` stays for older boards only; it is not used in territory mode.
- **Order at the start:** the order the wisps are authored in, each `slots` copy spread evenly, with Rest entries spaced between them.
- **`darkWispsAfterAction`** in territory mode:
  - spores ripen;
  - splits happen;
  - the front entry acts, using `plan` when it is still valid;
  - the entry goes to the back;
  - `pushed` resets;
  - the next plan is worked out.
- **`darkWispsStrike`** swaps the struck wisp one place back and works out a new plan when the front entry changed.
- **Normalizing saves:** a state saved without `order` gets a fresh strip.

### Presentation

- **Turn strip.** It sits in the dock header beside the Mist meter and shows the next 4 entries as small look portraits. The front one is larger, with its intent icon and amount. It slides left after each enemy action, and a pushed-back wisp visibly trades places.
- **Intent chip over each wisp.** It keeps the icon and amount and drops the countdown number. The acting wisp's chip glows warm and shows "Next".
- **The beat.** After your merge's pulse resolves:
  1. the acting wisp flares (about 150ms);
  2. its action plays on the targeted cells (about 400ms);
  3. the strip slides;
  4. the next targets fade in.

  Input stays open throughout. A merge made mid-beat queues visually but settles at once, so the engine never waits.
- **Target overlays** are drawn in the dock's board overlay, like the pulse preview and spores. They fade in and out; nothing snaps.
- **Friend lines.** One line for "It will take that cell next. Block it with a Plant, or clear around it." It is said the first time a targeted cell holds a piece, and follows the Mist voice rules.

---

## 2. Sky wisps: floating over the island tile

The first mini boards had wisps floating over the island's hex tile. They come back as a second kind of Dark Wisp.

### Rules

- **Where they float.** A sky wisp floats over the island tile, not on a board cell. It is authored with `placement: { kind: 'sky', column: 1-5, fx?, fy?, size? }`. The column ties it to the board below: the wisp above column 3 floats roughly over the middle of the tile. `fx` and `fy` default from the column (left to right across the tile, alternate columns staggered up and down) so neighbours never overlap.
- **How it is struck: from the top row.** The pulse treats the space above the board as a row above the top row:
  - a Sprout or Plant landing on the top row reaches it in its own column (a Plant also reaches the columns either side);
  - a tier 5+ merge on the second row reaches it too.

  The strike flies up from the merge cell to the wisp over the tile, using the old tile-wisp flight. So the rule reads naturally: build up to the top of the board, then strike upwards.
- **No nest, no Mist of its own.** It acts on the board from above, through its column:

| Intent | What it does |
|---|---|
| Rain N | Mist falls into the top N free cells of its column |
| Bind | binds the smallest loose piece in its column (section 3) |
| Spores | as today, but in its column |
| Shield | puts a 2-hit ward on a nest wisp |
| Call | drops a hidden wisp into the Mist below it (as a nest wisp) |
| Mend / Ward | as today |

- **Guarded.** A sky wisp authored with `guardedBy: [ids]` can't be damaged while any of those nest wisps stand. Its chip shows a lock. This is how bosses work: clear the ground, then strike the sky.
- **Fallen.** When a sky wisp falls it plays the old death burst over the tile. No Mist is freed.
- **Telegraph.** The plan works the same way. Rain outlines the column cells it will fill.

### Engine changes

- **`WispPlacement`** gains `{ kind: 'sky'; column: number; fx?; fy?; size? }`.
- **`pulse.ts`:** `pulseReachesSky(cell, tier, window) → columns[]`, which reuses the pulse area with a virtual row above the top row.
- **`pulseTarget`:** when a merge's pulse reaches both, a nest in reach is struck first; otherwise the sky wisp over a reached column. Two sky wisps over the same column: the one acting soonest.
- **New intent kinds** `rain`, `bind`, `shield`, plus the `guardedBy` check in the strike.
- **Validation:**
  - a sky wisp's column is 1 to 5;
  - `guardedBy` names nest wisps;
  - a level with a sky wisp has room to reach the top row (not all Mist from the start).

### Presentation

- **Mixed layout in `wispLayout`:** sky views are placed against the tile frame (the old `tile` branch, measured once the camera has settled). Nest views are placed against the board metrics (once the dock has settled). Each group appears when its own frame is ready and scales in at its place, never jumping.
- **Aim:** holding a piece over a twin on the top row rings the sky wisp it would strike, and draws a faint beam up the column from the board's top edge.
- **Layer:** sky wisps sit over the map, under the docked board, as the old tile wisps did (layer 58). Nest wisps stay over the board (61).

---

## 3. Bound pieces: half-hidden under Mist

The first FTUE boards showed items under a low Mist (the half-Mist overlay, `DREAM_MIST_LOWER`): you could see what was there, but it was locked. Bound pieces bring that look into battles.

### Rules

- **What it is.** A bound piece is a real merge piece caught in Mist. It is new encounter Mist, type `bound`, with `holds: { item }` and 1 or 2 hits. It counts toward the Mist meter. It can't be moved, merged away or eaten.
- **Two ways to free it:**
  - **Pulse:** a pulse hit wears it, the same way it wears light or thick Mist (Water washes it twice as hard). At zero, the piece is loose on its cell.
  - **Wake:** merge a matching loose piece onto it. It frees, merges on the spot, and that counts as your merge, with the pulse starting from there. This is the sleeper rule the first boards taught.
- **Where bound pieces come from:**
  - **Authored:** a level can start with bound pieces, for example a bound Plant beside a nest. Freeing it hands you a strong strike.
  - **Surge onto a piece:** when the Mist spreads onto a loose piece, it binds that piece instead of destroying it. This replaces today's "swallow", so the Mist covering your pieces costs tempo, not material. It also reduces "spent" losses.
  - **Bind (a sky intent)** and a targeted cell you blocked with a small piece.
- **The Mist feeds on them.** Mend heals 1 more for each bound piece touching the mending wisp's Mist. That gives you a reason to free pieces before a Mend comes round in the strip.

### Engine changes

- **`EncounterMistType`** gains `'bound'`, with `holds` required as an item.
- **`harmonyPulse`** wears bound Mist like light or thick Mist. `openMistCell` already puts the held item on the cell.
- **`reduceMissionMove`:** dropping a piece onto bound Mist holding the same `definitionId` is a merge. The Mist is cleared, and the result (the next tier) lands on that cell with `mergedCell` set. This needs a small extension of the engine's move code, alongside the existing `echo` wake.
- **Surge's swallow** becomes bind: `setMist(cell, { type: 'bound', holds: item })`.
- **Validation:** the held item is known and has a next tier.

### Presentation

- **Board cell.** The item art is drawn under the half-Mist overlay, reusing the existing echo drawing: item art, then `DREAM_MIST_LOWER`. Hit pips sit in the corner when it takes 2.
- **Match hint.** Holding a twin lights it with the existing match-hint wobble.
- **Freed.** The half-Mist slides down and fades, and the piece gets a small settle bounce and a mote puff (`mist-burst`), reusing the dream-Mist dissipation effect. Nothing snaps.
- **Bound by the Mist.** The half-Mist rises over the piece (the reverse of freeing), with the puff.
- **Inspector line:** "A piece caught in the Mist. A pulse frees it, or merge its twin into it."

---

## 4. Bots and tuning

- **The careful bot** reads the plan:
  - value down for pieces or cells the plan will take;
  - value up for blocking a targeted cell with a Plant or bigger;
  - value for pushing the acting wisp back;
  - value for freeing bound pieces before a Mend;
  - value for top-row merges when a sky wisp is open.
- **The careless bot** is unchanged: it takes any merge that strikes, else the first pair, and taps whenever it can. It ignores plans.
- **Targets, pinned in tests:**
  - careful wins at least 9 of 10 on every level;
  - careless wins at most 4 of 10 on bosses;
  - calm levels let careless win at least 7 of 10, so the start stays gentle.
- **Retuning.** With one action per turn, surges become 1-cell actions again. Calm levels get Rest entries in the strip, and bosses get `slots: 2`.

## 5. Content

Levels use each new idea once it has been introduced.

**Petalimp:**
- **Chapter 1:** the strip and targets only, with Rest entries. The objective line teaches "Block it, or clear around it."
- **Chapter 2:** bound pieces. Level 2-1 opens with a bound Plant beside a nest.
- **Chapter 3:** the first sky wisp. Level 3-1 has a Rain wisp over column 4 and teaches striking from the top row.
- **Chapter 4:** the Colour Thief becomes a sky boss (`slots: 2`), guarded by two nest wisps. Struck to half, it drops its shard into the Mist.

**Fernip:** Water and Rain on the same levels; the Overgrowth stays a nest boss, with a Bind sky wisp over it.

**Other content:**
- **Grove:** rung 3 introduces the strip. Rung 8's Keeper becomes a sky boss guarded by its root wisp.
- **Daily Mist:** templates gain `rest`. The dark slot may add a sky wisp.
- **Unauthored islands' generated levels:** the second level of chapter 3 and later adds a sky wisp.

## 6. Build order

1. **Turn strip and telegraph.** Engine (order, plan, pushback), the strip UI, target overlays, bots, and the retune of every level. This comes first because it is the biggest change to feel.
2. **Bound pieces.** The Mist type, the wake-merge in the move code, the half-Mist drawing and its animations, and Surge binding instead of swallowing.
3. **Sky wisps.** The placement, reaching above the top row, the sky intents, guards, mixed layout and flights.
4. **Content pass.** Petalimp, Fernip, the Grove, the Daily Mist and the patterns, with bot targets pinned.

Each phase ends with typecheck, the territory suite plus the level suites, a bots table in the doc, and a device check.

## 7. Decisions with a default (say if you want them different)

1. **A targeted cell holding a piece:** the Mist binds it; a Plant or bigger holds the ground. Alternative: any piece blocks.
2. **Rest turns on calm levels:** yes. Alternative: a lone wisp acts every turn.
3. **Sky reach:** the top row, plus tier 5+ from the second row. Alternative: any Flower or bigger anywhere reaches the sky.
4. **Surge onto a piece:** binds it instead of destroying it. Alternative: keep swallowing as a harsher boss-only rule.
5. **Board size:** stays 5×4 for now. 5×5 is a later, separate decision once the strip is felt on a device.
