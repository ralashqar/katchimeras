# Wisp Rush: Dashkit's time-trial tile

Status: September 2026. Built, waiting for a device test. Not built: a `3/10` marker on the tile, sound and haptics,
sparks for Steppling from heats, the trial's host as pack data (it is the constant `WISP_RUSH_HOST`).

## What it is

A friend tile tied to Steppling whose whole life is a race against a clock. The friend is **Dashkit**, the sprint form
Steppling's family already had. The tile wakes as soon as Steppling is home (it never waits for Wanderling).

**A run (a "heat") is always the same thing:**

- A **clock counts down** (40 to 90 seconds). It starts on the first move.
- **Wisps hang over the tile**, a few at once, and **keep appearing**: on their own clock while there is a free perch,
  and at once if the tile is ever empty. Later wisps take more hits; some are Thick (half as much again). A pip under a
  wisp says how many hits it still takes.
- **Pieces keep arriving** on the mini board: it starts half full, a piece drifts in every second or two up to a cap,
  and a cell freed by a merge refills after a beat. No item maker, no orders, no deliveries. The dealer never leaves
  fewer than two merges on the board when it deals, so a run is never stuck.
- **Every merge shoots the nearest wisp**: the one hanging closest to the column the merge was made in (not straight
  up). Bigger pieces hit harder; every third merge of a quick combo hits one harder.
- **The score is how many wisps fell before the clock ran out.** A run has a goal; short of it, run it again, free.

**Two places it is played:**

1. **Dashkit's story.** The tile is an ordinary island campaign (reveal, restore, mist cleared, narrative overlay, friend
   card, four chapters, payoff), but every chapter's board is a run instead of a puzzle with a delivery: six wisps in 40
   seconds for the Start Line, up to twelve in 90 for the Finish Arch. Dashkit's lines are about the clock: how you run
   it (flat out, paced, side by side), what the goal is, beating it. Nothing is asked of the Main Board.
2. **The daily ladder.** Once Dashkit is home (island level 1), tapping the tile opens today's ten heats: the same run,
   harder each rung (tougher wisps that toughen faster, more chains sharing the board, fewer free tier-twos). Medals are
   wisp counts: Silver is what a steady bot scores on that exact heat, Gold a quarter more, Bronze a little over half.
   Bronze clears the heat and opens the next. Glow once per heat per day; a finished day's chest is a Steppling friend
   pack (the better one with five Golds); records are best score per rung, best day total, streak, Golds. Free of
   energy, unlimited retries, one ladder for everyone each day (it is generated from the date).

## The rule it follows

Nothing of its own where the game already has one. The tile comes in through a content pack. A run is played on the
docked board every friend's board uses, under the Kingdom's own wisp layer, with the same Glow flights, mission camera
and faded map. What a time trial adds: a clock, a dealer, wisps that keep coming, and one sheet on the shared upgrade
dock for the ladder.

## Where it lives

- **Pack**: `data/content-packs/rush-track.json` (built by a script from the Wander Trail's frame; bundled in
  `features/content-packs/bundled-packs.ts`). A chapter's `restoration.rush` holds the run's rules and `goal`
  (`RestorationBoardDefinition.rush` in `constants/island-campaigns/types.ts`; validated in
  `normalize-content-pack.ts`: no pieces, echoes, delivery cells or request, `merges` = `goal`). Any friend's chapter
  can be a rush by authoring that field. Tile art `shared_world_rush_track_hex_tile_v1`
  (`scripts/open-hex-tile-gaps.py` re-opens the arch the pipeline had filled black).
- **Rules** (pure, seeded, time passed in): `features/time-trial/heat.ts` (`HeatRules`, `startHeat`, `tickHeat`,
  `mergeHeat`, `strikeHeat`, nearest-wisp targeting, perch rest, the roster of every wisp that has appeared).
- **Ladder**: `features/time-trial/ladder.ts` (`RUSH_LADDER` table, `heatFor(dayId, index)`, `heatFromRules`, the par
  bot, `heatPars`, `medalFor`).
- **Results**: `features/time-trial/trial-world.ts` in the world save (`timeTrials`); repository
  `recordStoredTimeTrialHeat({ dayId, index, score })`, `claimStoredTimeTrialChest`. Boards are never saved; a killed
  app or leaving the app mid-run means the run did not happen.
- **Real board**: `features/time-trial/heat-board.ts` (every move through `reduceMergeWorld`), live hook
  `use-wisp-rush-heat.ts` (monotonic foreground clock).
- **Mechanic**: kind `wisp-rush` behind the one door (`features/mission-mechanics/mechanic.ts`, `wisp-rush.ts`). Its
  state is a roster that only grows. The dock publishes the heat through `createRushLive()`
  (`features/time-trial/heat-mechanic.ts`); the wisp layer subscribes (`CorruptionWispTarget.live`,
  `syncMechanicState`) and takes each new wisp without the Kingdom screen re-rendering; damage is added as each flight
  lands, so a wisp falls when the player sees it hit. A struck-down wisp's perch rests 1.5 s so the fall plays before
  the next arrives there.
- **Dock**: `components/katchadeck/world/wisp-rush-dock.tsx` = `MistMissionDock` plus a countdown and the score.
- **Arrivals**: `animateArrivals` on the board (`FeastlePersistentMergeBoard` → `MergePlaySurface` →
  `MistMissionDock`): an item that appears without a move of the player's pops in with the sprite entrance and a
  `spawn-settle` puff. Any board that receives pieces on its own should turn it on.
- **Sheet**: `components/katchadeck/world/wisp-rush-sheet.tsx` on `UpgradeDock` with the shared `UpgradeActionRow`.
- **Kingdom screen**: `activeRush` is either the daily heat or the open chapter's rush; one `WispRushDock`, one wisp
  target (`rushWispTarget`, first in the chain). A chapter made at goal records its progress and completes the
  restoration, and the campaign carries on as usual; short of goal, the run restarts with the shortfall in the bar's
  title.
- **Developer Tools → Wisp Rush**: the board alone, any heat, nothing saved.
- **Tests**: `tests/time-trial.test.ts` (rules, targeting, dealer never stuck, thirty days of ladders, results, the
  real-board bridge, the mechanic through the door, and every chapter's goal against the bot).

## Tuning

Everything is a table: `RUSH_LADDER` for the day, `restoration.rush` in the pack for the story. The tests hold the
numbers honest (a steady bot always has a merge, makes each chapter goal with 30% to spare, and a fast bot reaches
Gold), so change a row and run the test.
