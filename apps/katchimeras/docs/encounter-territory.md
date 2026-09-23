# Territory battles: merge to take the board back

Supersedes the Light, flames and lanes of `encounter-v2-light-and-intents.md`. Intents, looks, chains, the Spring, the fairness bots, soft loss and level tracks carry over.

**Where it lives:**
- **Pulse geometry:** `features/encounter/pulse.ts`.
- **Mist:** `features/encounter/mist.ts`: `harmonyPulse`, `mistCoverage`, `pullBackMist`.
- **Wisps:** `features/mission-mechanics/dark-wisps.ts`:
  - nests
  - `pulseTarget`
  - `wispRegion` and `wispFrontier`
  - the intents
- **Run:** `features/encounter/encounter-run.ts`:
  - `run.territory`
  - `territoryOverrun`
  - `recordCoverage`
  - `keepGoing`
  - loss `overrun`
- **Grades:** `outcome.ts`, stars by coverage.
- **Nests laid at start:** `create-state.ts`.
- **Levels:** `constants/island-campaigns/island-levels.ts`:
  - `OVERRUN_BY_DIFFICULTY`
  - `RING_BY_DIFFICULTY`
  - `withNests`
  - Petalimp, Fernip, the mist level, the patterns
- **Other content:** the Grove, Fernip's boss (`extra-rungs.ts`), the Daily Mist.
- **UI:**
  - the Mist meter, pulse preview and spores: `hatchable-mission-dock.tsx`
  - wisps drawn on their nest cells, above the board: `corruption-wisp-layer.tsx`
  - the held piece's landing: `features/encounter/pulse-aim.ts`
- **Bots:** `features/encounter/playtest.ts`.
- **Tests:** `tests/encounter-territory.test.ts`, plus the content checks in `sleeping-grove-region`, `daily-mist` and `region-ladder`.

## Rules

1. **Wisps nest on the board.** Each Dark Wisp sits on one cell, its nest, which is wisp-bound Mist. Nothing can go there, and the nest opens when the wisp falls. Levels ring each nest with Mist on the free cells beside it: light Mist on a calm level, thick Mist after that, none on a boss (bosses are laid out by hand).
2. **A merge sends a Harmony pulse from where its result lands.** A→B lands on B, so sliding a piece somewhere first is free and chooses the landing.

   | Result | Reach | Hits |
   |---|---|---|
   | Sprout (tier 2) | the four cells beside it | 1 |
   | Plant (tier 3) | the eight cells around it | 1 |
   | Flower (tier 4) | the eight cells around it | 2 |
   | Tier 5 and up | two cells out (a diamond) | 2 |

   **What the pulse does to Mist:**
   - Water doubles its hits on light and thick Mist.
   - Only Growth cuts roots; anything without a chain counts as a plant.
   - Nests never wear down.
3. **A pulse that reaches a nest strikes that wisp.** When several nests are in reach, it strikes the wisp acting soonest, then the weakest. Damage follows the tier table `[1, 1, 2, 3]`, plus the weakness bonus. A ward soaks hits first. The first hit on an intent pushes it back one turn, once.
4. **A turn is a merge.** Pod taps and slides are free: board space is their cost. The wisps act after every merge that did not just win the level. The Dew Spring holds them back for the first merge at levels 3 to 5, the first two at 6 to 8, and so on.
5. **Intents** (the chip shows the kind and its countdown):
   - **Surge N:** spread into the free cells nearest the nest, through the wisp's connected Mist. When every free cell is walled off by pieces, it swallows the smallest piece it touches, but never one of the last two pieces on the board.
   - **Shroud:** lay thick Mist on a frontier cell where the pieces crowd.
   - **Root:** lay root Mist on the frontier, spreading from existing roots first.
   - **Devour:** eat the smallest piece touching its Mist; with none in reach, surge 1 instead.
   - **Ward.**
   - **Mend.**
   - **Call:** a hidden wisp nests deep in the caller's Mist.
   - **Burrow:** move the nest to the most enclosed cell of its Mist, further from the player; the old nest becomes light Mist.
   - **Spores:** mark a free cell away from its Mist. The spore turns to Mist after 2 turns unless a piece is put on it, and it dies with its wisp.
   - **Gather N:** a heavy surge (default 3). Enough damage while it gathers (`stagger`, default 3) staggers it instead.
   - **Snuff:** old data, read as surge 1.
   - **Split** (`splitsInto` on the wisp, not an intent): struck to half health, the wisp breaks off its hidden twin.
6. **Losing:**
   - **Overrun:** the Mist, nests included, reaches `territory.overrun` of the board's cells. Calm 70%, thick 65%, dark 55%, boss 50%.
   - **Choked:** no free cell and no merge.
   - **Spent:** nothing to merge and no charge left, after the rescue cache has already been used.
7. **Stars:** the Mist left at the end is at most 25% of the board for a Perfect, at most 45% for a Bright.
   - **Keep going** (10 Glow) pulls back the 4 Mist cells furthest from any nest, adds 2 charges to every spawner, and caps the level at one star.

## Balance (bots, 10 seeds)

- **Careful bot:** reads intents, slides pieces to choose landings, and keeps Mist and room in check. It wins every territory level 10 of 10.
- **Careless bot:** takes any merge that strikes, else the first pair, and taps whenever it can. It wins most calm and thick levels and loses:
  - both island bosses, 0 of 10: Petalimp's by spending out, Fernip's to overrun
  - the last pattern level
  - some dark levels, 3 to 6 of 10
- **Tests pin:** careful wins at least 9 of 10 on every level, and careless wins at most 4 of 10 on each boss.
- **Known:** the 5×4 board keeps calm and thick levels short (6 to 10 merges); pressure lives in dark levels and bosses.

**Scratch tools for tuning:** `bots.ts` (every level, both bots) and `trace.ts` (turn-by-turn board print). Keep them out of the repo, or re-create them from `playtest`'s `onStep`.

## Not done yet

- **Guardian links:** a wisp that can't be struck while its partner stands. Add only if a level needs them.
- **New looks:** Surge, Burrow and Spores reuse the Snuffer, Creeper and Caller art.
- **Bloom:** doesn't send its own pulse yet.
- **The helper Wisp's `resolve` perk:** now also opens a Mist cell in a territory battle, but its label still reads "+1 Resolve".
