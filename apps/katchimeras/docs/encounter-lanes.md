# Lanes: wisps come down, pieces shoot up

Status: **built Sept 24 2026, uncommitted, device test pending.** Every Petalimp level plays it: Lift the Mist (every friend's first level) and chapters 1–4, the Colour Thief included. It replaced Merge vs Mist (`encounter-tactics.md`). Territory battles (`encounter-territory.md`) still play Fernip, the Grove and the Daily Mist.

## The rules

1. **Real time.** The level runs on its own clock (`state.clock`, ms of play). It pauses whenever the board is not being played: the loss card, the dock put away, the app in the background.
2. **Wisps drift down the columns.**
   - Each wisp arrives four rows over one board column at its time, and new ones keep arriving through the level.
   - It drifts down steadily, a row every `stepMs` (its row is fractional; its cell is the one its centre is in).
   - Every few cells (`dropEvery`) it leaves light Mist on the free cell it has just left.
3. **Pieces shoot up their own column, always,** on their own beat: at the lowest wisp over them, or, with none, straight off the top of the board, fading. A Seed does not fire:

   | Piece | Fires every | Damage |
   |---|---|---|
   | Seed | never | — |
   | Sprout | 2.5 s | 1 |
   | Plant | 2.0 s | 2 |
   | Flower | 1.6 s | 3 |
   | Tier 5 and up | 1.3 s | 5 |

   Moving pieces is free and is how the player aims. A merged piece fires 120 ms after it is made.
4. **A wisp that reaches a piece puts it under Mist.**
   - The piece is bound, not lost; merging beside it frees it.
   - The wisp holds at that cell's edge for a beat, then drifts on through the Mist.
   - A piece put where a wisp already is goes under Mist at once.
5. **Merges still clear Mist with Glow.** A merge's Glow flies at the nearest Mist, reaching farther by tier (`glowShots`, as in Merge vs Mist). The Mist holds until each shot lands.
6. **Win:** every wisp down. **Lose:** a wisp comes down past the bottom row.
   - **Keep going** pushes every standing wisp back up 3 rows.
   - The rescue brings pieces whenever the board runs dry.

## Where it lives

- **Rules (pure):** `features/mission-mechanics/lanes.ts`.
  - `lanesTick` is the clock: shots land, wisps step, pieces fire.
  - `lanesAfterMerge` and `lanesCrash` run from `settleAction`.
  - It is a mechanic kind (`'lanes'`) behind the same door as every other (`mechanic.ts`).
- **Levels:** `islandLevel` builds a Lanes level when its spec has `lanes: [{ id, column (1-5), at (s), hp, step (s), drop?, look? }]`. Specs are in `constants/island-campaigns/island-levels.ts`.
- **Store:** `useMissionBoard().tick(dt)`.
  - Only a tick where something happened is committed and saved.
  - The clock alone moves in the ref, so a quiet tick never re-renders the screen.
- **Dock:** `hatchable-mission-dock.tsx` runs a 100 ms interval once the dock has risen and the level is playing.
  - Each fired shot flies as a Glow bolt through the Glow store (`launchBolts`): the same Glow icon, landing with the wisp strike burst and a flinch, for exactly the flight time the level resolves it on.
  - Clear screen: no pills over the board (no Wisps count, no ability), no progress bar, no friend's lines, and the Kingdom's top bar steps out while a Lanes battle is played (`laneBattleActive`). The space over the board is where the wisps come from.
  - A merge's Glow reaches the Mist it clears as the Egg's lightning drawn over the board (`MistLightning`): a zigzag gold bolt from the merged piece to each cell, staggered. On impact the held Mist lets go (the board's own puff plays), and a ring and motes pulse out while the bolt flickers away.
- **Drift:** each tick's new wisp rows go to the wisp layer alone, through the live store (`useMistMission` wraps the tick). The screen re-renders only when the store commits (a hit, Mist, a piece bound, a breach). Lane wisps are drawn over the docked board. Each wisp is laid out once and moved only by transform on the UI thread: it aims 350 ms ahead of its latest place at its own drift speed (`MissionWispView.drift`), so it moves at one steady pace between ticks instead of jittering.
- **Dim:** while any mini board is docked, `BoardSessionDim` (in the Kingdom screen, layer 50) darkens the island and map behind it, easing in (420 ms) and out (520 ms).
- **Wisp layer:** `lane` placements sit over the board's columns at the board's row pitch (`laneWispPoint`); above the top row they float over the island.

## Balance (bots, `features/encounter/lanes-playtest.ts`)

- **The bots:**
  - careful acts every 1.2 s;
  - the novice acts every 3 s and misjudges two times in five;
  - idle does nothing.
- **Over 15 seeds (three level ids):**
  - careful wins 14–15/15 on calm and thick levels, 12–14/15 on dark ones and the boss;
  - the novice wins most calm levels, a few thick ones, almost never the boss;
  - idle always loses.
- **The middle column has the Pod in its bottom cell,** one row less to defend from, so `stream` makes its wisps 30% weaker; every early loss came down that column.
- **Pinned by** `tests/encounter-lanes.test.ts`.

## Next

- Move Fernip, the Grove and the Daily Mist over, and give bosses something of their own (a wisp that splits, one that speeds up).
- A countdown ring on each wisp for its next step.
- Measure frame rate on device: every tick with an event commits the store, which re-renders the Kingdom screen (a few times a second at most).
