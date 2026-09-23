# Encounter v2: Light, intents and lanes

> **Superseded (Sept 23 2026) by `encounter-territory.md`:** Light, flames and lanes are gone; wisps nest on the board and the Mist's coverage is what loses a level. Intents, looks, chains and the Spring below still hold.

Status: built Sept 23 2026 (uncommitted, device test pending). Replaces Resolve as the way a level is lost. Builds on the campaign merge pivot (`docs/campaign-merge-pivot.md`).

**Where it lives:** rules in `features/mission-mechanics/dark-wisps.ts` (intents, lanes, wards, gather, calls), `features/encounter/encounter-run.ts` (Light, `lossReason`), `settle.ts` (turns are merges); levels in `constants/island-campaigns/island-levels.ts` (Light by difficulty, lanes), the Grove and the Daily Mist moved over; fairness bots in `features/encounter/playtest.ts` (content tests: `tests/sleeping-grove-region.test.ts`, `tests/daily-mist.test.ts`; pack validation in `validate-encounter.ts`); dock flames and loss copy in `hatchable-mission-dock.tsx`; intent chips in `corruption-wisp-layer.tsx`; Keep going costs `GLOW.keepGoingCost` (10) through `payEncounterContinue`.

**Tuned by the bots, not by the table below:** hit points roughly doubled and threats count down from 2 or 3; a hit knocks an intent back once, and only when that moves it (a knock at the start of a countdown is not used up); a wisp called in starts counting on the next turn. The careful player wins every Light level on at least 9 of 10 seeds; Petalimp's calm levels keep every flame, her boss usually costs two.

**Chains as tools and the Spring (Sept 23 2026):** Growth (the Garden chain) is the only chain that cuts root Mist; Water (the waterside chain: Pebble, Shell, Tidepool) washes the light and dense Mist beside a merge twice as hard; a wisp may be `weakTo` a chain and takes one more from it (a small leaf or water badge beside it). `features/encounter/chains.ts`. The Mist Spring (`mist-spring`, an encounter-only item maker kept off the player's own board, art by `scripts/generate-mist-spring.py`) makes the Water chain; a level may hide it under Mist (`spring.under`), so clearing that cell finds it. Fernip's island teaches it: eight authored levels (`FERNIP_LEVEL_SPECS`), the Spring hidden in the first, and the Overgrowth boss weak to Growth. The careful player wins every Fernip level; they are gentle and want a tuning pass.

**Looks:** every Dark Wisp wears art for what it is (`constants/dark-wisp-looks.ts`: snuffer, shrouder, nibbler, creeper, warden, mender, caller, mistling, and the bosses keeper, thief, overgrowth). A wisp's look is read off its first intent (a called one is a Mistling; a plain Mistwisp keeps the corruption wisp); a boss names its own with `look`. Cutouts in `art/.../cutouts/dark-wisps/`, generated from the corruption wisp as reference by `scripts/generate-dark-wisp-looks.py` (fal nano-banana edit, BiRefNet matte; sources, record and contact sheet under design/dark-wisp-looks-v1). The art table (`dark-wisp-look-art.ts`) is kept apart so the engine never loads an image.

**Also built:** a held piece aims up its lane and the wisp it would hit is ringed (`features/encounter/lane-aim.ts`, the board's `onHoverCell`); a flame puffs out with a warning buzz when snuffed and grows back on Keep going (`LightFlame` in the dock); when wisps act, a line says what happened for a beat (`WISP_ACT_LINES`). Bosses are won by reading them: a boss's Gather puts out every Light unless it is staggered, with a Snuffer beside it (the careful player wins Petalimp's and Fernip's bosses on every seed, the careless one at most four in ten, enforced in `tests/sleeping-grove-region.test.ts`).

## Why

Today a level is lost when Resolve runs out, and every merge and every spawner tap spends one. So a player who fills the board first and plans merges after loses without a single bad move. The wisps' behaviours (re-mist, eat, root, mend) fire every few actions, but they never threaten the player, so nothing but the action count makes a level hard.

v2 gives the wisps the threat. They say what they will do next and when; they put out the friend's Light and choke the board. The player's puzzle is reading those threats, choosing which wisp to hit and where to merge to hit it, and keeping room on the board.

## The rules

1. **A turn is a merge.** Waking a sleeper is a merge. Tapping the Seed Pod, sliding a piece, using the ability and opening a cache take no turn. The Pod's charges stay limited (it gets one back every few merges), so filling the board is a risk the player chooses, not a mistake the game punishes.
2. **Light.** The Katchimera the player brought carries a Light, shown as small flames on the dock (3 on most levels). Wisps put it out. At 0 the level is lost.
3. **Intents.** Every wisp shows its next move and a countdown in turns, over its head. Each merge counts every wisp down by one; at 0 the wisp acts, then shows its next intent from its own cycle. The player always knows what is coming and when.
4. **Hits push back.** A wisp that takes a hit has its countdown pushed back by one turn (never past where it started). So the wisp about to act is the one to hit.
5. **Lanes.** Wisps hover in lanes over the board's five columns. What a merge makes flies straight up its column and hits the wisp in that lane; a column with no wisp over it sends the shot to the nearest one. Damage is by the result's tier (Sprout 1, Plant 2, higher 3). This is the Wanderling column-shot rule, made the default.
6. **The board can choke.** Corruption turns free cells into Mist. If there is no free cell and no merge left, the level is lost ("The Mist has closed in").
7. **Stuck, once.** No merge, no Pod charge and free cells left: the rescue cache opens once per attempt (as today). Stuck again after it: lost.
8. **Win.** Every wisp down, or the named one (a boss). The finishing merge counts even if a wisp would have acted on that turn.

Losing keeps the offer it has today: **Try again** (fresh start, free), **Keep going** (Light back to 2, once, for Glow), **Leave**. Nothing in the world is ever lost.

## Intents

Numbers are defaults; a level can override any of them.

| Intent | Shown as | What it does | How the player answers |
|---|---|---|---|
| **Snuff** | a dark flame, "2" | Puts out 1 Light (a boss's heavy snuff: 2) | Hit it to push the countdown, or bring it down first |
| **Shroud** | a curl of Mist | Turns one free cell into light Mist (a cell next to the most pieces) | Merge next to it to clear it; keep a spare cell |
| **Root** | a root | Turns a free cell into root Mist; each cycle it spreads to one neighbour | Only Plants (and higher) merged next to it cut it |
| **Devour** | a mouth | Eats the lowest piece on the board (Seeds first) | Merge low pieces up before it acts |
| **Ward** | a shield, with a number | Absorbs the next N damage | Hit it with small merges first, or hit something else |
| **Mend** | a leaf | Heals 1 (never above its start) | Bring it down in one burst, or ignore it |
| **Call** | a spark | A Mistling (1 hit point, Snuff every 3) joins in a free lane | One Sprout merge in its lane |
| **Gather** (boss) | a swirl, "4" | After 4 turns a heavy Snuff (2 Light), unless it took 3 damage while gathering (then it is **staggered** and the Gather is lost) | Hit it hard in time: a Plant and a Sprout |

A wisp's cycle is a short list, for example `['shroud', 'snuff']` or `['ward', 'gather']`. Countdowns start at 2 to 4 turns.

Today's behaviours map onto intents without re-authoring: `shrouder` becomes Shroud, `hungry` becomes Devour, `rootbound` becomes Root, `mender` becomes Mend, `plain` has no intent.

## Wisp kinds

Named kinds keep levels readable. A kind is a hit-point range and an intent cycle.

| Kind | Hit points | Cycle | Countdown |
|---|---|---|---|
| Mistwisp | 2 | none (it only takes hits) | none |
| Shrouder | 3-4 | Shroud | 3 |
| Nibbler | 3-4 | Devour | 3 |
| Creeper | 4-5 | Root | 3 |
| Snuffer | 3 | Snuff | 3 |
| Warden | 4 | Ward 2, Snuff | 3, 2 |
| Mender | 3 | Mend | 3 |
| Caller | 4 | Call, Shroud | 4, 3 |
| Boss | 8-12 | its own, always ending in Gather | 2 to 4 |

## Where difficulty comes from

| Knob | Calm | Thick | Dark | Boss |
|---|---|---|---|---|
| Light | 4 | 3 | 3 | 3 |
| Wisps | 2 | 2-3 | 3 | boss + 1-2 |
| Threatening intents (Snuff, Devour, Root, Gather) | none | one wisp | two | the boss and one more |
| Fastest countdown | 4 | 3 | 2 | 2 |
| Starting Mist cells | 1-2 | 2-3 | 3 | 3-4 |
| Pod charges | 5 | 4 | 4 | 4 |
| Pod gives one back every | 3 merges | 3 | 4 | 4 |

Stars: 1 cleared, 2 cleared having lost at most 1 Light, 3 cleared with every Light still lit. Keep going caps the level at 1 star.

## The Katchimera and the Haven

- **Bloom** (Mossprout): unchanged (a piece up one tier), and from level 4 it also clears the Mist cell next to its target.
- **Trailfinder** (Steppling): reveals hidden Mist, and pushes back every wisp's countdown by one.
- **Focus** (Baristabbit): the Pod's next three pieces are Sprouts.
- **Helper Wisps**: common +1 Light; rare +1 Pod charge; epic every wisp starts one turn later; signature +10 % Glow (unchanged).
- **Dew Spring**: +1 Light at levels 3, 6 and 9 (it gave starting Resolve).
- **Root Cellar**: unchanged (open cells at the start).

## Petalimp's levels, re-authored

Lanes are columns 1-5 left to right. Light 4 on calm levels, 3 after.

| # | Level | Wisps (lane, hit points, cycle) | Mist | Pod | Teaches |
|---|---|---|---|---|---|
| 1 | Lift the Mist | Mistwisp (2, 2), Mistwisp (4, 2) | 2 light | 5, every 3 | Lanes: merge under a wisp |
| 2 | Seeds Under the Mist | Mistwisp (2, 2), Shrouder (4, 3, Shroud) | 2 light | 5, every 3 | Intents: a threat you can see coming |
| 3 | The First Bed | Shrouder (3, 3), Snuffer (5, 3, Snuff) | 1 light, 1 dense | 4, every 3 | Light: hit the one about to act |
| 4 | Colour in the Rows | Mender (2, 3), Snuffer (4, 3) | 1 dense, 1 root holding a Sprout | 4, every 3 | Burst a mender down |
| 5 | Pollinators | Warden (3, 4, Ward 2 / Snuff), Mistwisp (1, 2) | 3 light | 4, every 3 | Break a ward with small hits |
| 6 | The Trellis | Nibbler (2, 4, Devour), Shrouder (4, 3) | 1 light, 1 dense | 4, every 3 | Merge low pieces up in time |
| 7 | They Came Back at Night | Nibbler (1, 4), Snuffer (3, 3), Caller (5, 4, Call / Shroud) | 1 light, 1 dense, 1 root | 4, every 4 | Three threats, one turn at a time |
| 8 | The Long Border | Creeper (3, 5, Root), Mender (5, 3) | 2 root, 1 light | 4, every 4 | Plants cut roots; don't let them choke you |
| 9 | The Colour Thief (boss) | Thief (3, 10, Ward 2 / Shroud / Gather), Mender (5, 3) | 1 light, 1 dense, 1 root | 4, every 4 | Stagger a Gather |

The Grove's rungs, the pattern levels and the Daily Mist templates move to the same rules (each rung keeps its title and teaching beat; `shrouder`/`hungry`/`rootbound`/`mender` data maps as above).

## What the player sees

- **The dock header:** the Light flames (one goes out with a puff when snuffed), the turn count small beside it, the ability button as today. Resolve goes.
- **Over each wisp:** an intent chip (icon and countdown). At 1 it pulses; when it acts, a short line from the wisp's lines table ("The Mist leans in." for Shroud, never an exclamation near the Mist).
- **On the board:** a lane marker under the wisp a drag would hit, shown while a piece is held. Corrupted cells use the existing Mist visuals; a root shows its spread direction.
- **The friend's line** before a threat: "It's about to put a light out. Hit it first." when a Snuff reaches 1 and the player has a merge in that lane.
- **Lose sheet:** "The Light went out." or "The Mist has closed in.", then Try again / Keep going / Leave.

## Making sure a level is fair

The Resolve solver no longer fits (it searched for the fewest actions). Instead a level is checked by playing it:

- **A careful bot** (hit the wisp with the lowest countdown, merge low pieces first, keep one free cell) must win with at least 1 Light left, on at least 9 of 10 seeds.
- **A careless bot** (merge the first pair it finds, tap the Pod whenever it can) should lose calm levels rarely and boss levels usually.
- Both run in the content tests and on pack import (`validate-encounter.ts`), and the generated budget table (`npm run encounters:budgets`) is retired.

## Data

- `EncounterDefinition`: `light: number` replaces `resolve`; wisps gain `lane` (1-5) and `intents` (a cycle of `{ kind, every, amount? }`); `grades` becomes star rules. Old fields read on load and are mapped (`resolve` dropped, `behaviour` mapped to one intent).
- `EncounterRunState`: `light`, `turns`, per-wisp `countdown`, `cycleIndex`, `ward`, `gathered`; `resolve` goes.
- Mechanic: `dark-wisps` gains lanes and intents (its `afterAction` door already runs after every action; it now runs its countdowns on merges only). `column-shot`'s lane targeting moves into it.
- Saves: a run saved under v1 rules restarts the level (the board's store key gets a `.v3` suffix). Clears, stars and ledger are kept.

## Build plan

1. **Rules engine.** Types, run state, turn counting on merges only, intents and countdowns in `features/mission-mechanics/dark-wisps.ts`, lanes, Light, choke and stuck in `features/encounter/encounter-run.ts` and `settle.ts`. Pure; unit tests per intent.
2. **Dock and wisp layer.** Light flames, intent chips with countdowns, lane marker on drag, Snuff and Gather effects, lose sheet copy (`hatchable-mission-dock.tsx`, `corruption-wisp-layer.tsx`, `encounter-copy.ts`).
3. **Fairness bots.** A careful and a careless player in `features/encounter/playtest.ts`, wired into the content tests and pack validation; retire the Resolve solver and budget table.
4. **Content.** Petalimp's nine levels as above; the Grove, the pattern levels and the Daily Mist templates mapped and retuned against the bots.
5. **Haven.** Dew Spring, helper Wisp perks, abilities as above; Keep going priced in Glow.
6. **Device pass.** A fresh save through the Grove and Petalimp: every intent seen once, one loss on purpose (both ways), Keep going once, stars.

## Open questions

- Light count: 3 feels right for a phone session; 4 on calm levels keeps the early game gentle. Tune on device.
- Should the Pod ever cost a turn on hard levels (a "heavy Pod")? Proposed: no, never; board space is its cost.
- Boss staggers: 3 damage in the window, or a hit from a Plant or better? Proposed: 3 damage, shown on the chip as a small bar.
