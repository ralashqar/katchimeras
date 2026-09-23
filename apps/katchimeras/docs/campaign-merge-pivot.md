# Campaign Merge Pivot (v1)

**Status: Sept 22 2026.** Phases 0–4 built, uncommitted, device test pending. Phase 5 (first session re-flow, Region 1 authoring, Petalimp re-author) is the next piece of work. Design and the full plan: `~/.claude/plans/study-the-game-we-shimmering-lemon.md`.

## The loop

Choose a Katchimera → enter the Mist → merge under a Resolve budget → outsmart Dark Wisps → earn Glow, experience and Wisps → upgrade Katchimeras and the Haven → harder rungs → rescue new friends.

The persistent merge page and its orders are gone. Every board is a self-contained **encounter** docked under a tile on the Haven.

## An encounter (`types/encounter.ts`)

- A 5×3 or 5×4 window on the canonical grid, a seed of items / sleepers / veiled cells (the mission shape every friend's clearing had), plus:
- **Mist of its own** (`encounter` mist kind): light (one hit beside a merge), dense (two), root (plant merges only), wisp-bound (falls with its wisp). A cleared cell gives up what it held (an item, a spawner).
- **Spawners** with charges on the board (engine `tapGenerator` with `enforceCharges` + `dropProfile`; they never rest). Recharge every N merges, or when a wisp falls. Drops are seeded per attempt.
- **Resolve**: merge and spawner tap cost 1, slides and abilities 0. Cleared is checked before the budget. At 0 → "The Mist is still too thick." → Try again (fresh seed) / Keep going (+5).
- **Dark Wisps** (`features/mission-mechanics/dark-wisps.ts`, the `afterAction` door in `mechanic.ts`): hp, damage by result tier, behaviours `plain | shrouder | hungry | rootbound | mender`, acting every K costed actions.
- **Cache / rescue** (`features/encounter/cache.ts`): opens once on a stuck board; authored contents or twins of the highest loose pieces. The legacy Main-Board delivery became this.
- **Abilities** (`constants/companion-abilities.ts`): Bloom (Mossprout), Trailfinder (Steppling), Focus (Baristabbit); charge per merge; tiers by level.
- **Helper Wisp** perk by rarity (`constants/helper-wisps.ts`).
- **Grades** cleared / bright / perfect by Resolve left; capped at Cleared after Keep going or a cache.
- **Solver** (`features/encounter/solvability.ts`): the pack validator refuses a budget under the shortest play + safety margin.

Everything a command does on an encounter settles through `features/encounter/settle.ts`; the store (`useMissionBoard`) and the solver use the same function.

## Meta

- Engine commands: `startEncounter`, `completeEncounter` (receipt-idempotent: Glow, XP, ledger, island level on a chapter's last rung), `abandonEncounter`, `ackEncounterOutcome`, `upgradeKatchimera`. Ledger on `MergeWorldState.encounters`; levels on `katchimeraProgress`. Save v25.
- Regions = island campaigns whose chapters own `missions[]` (`constants/island-campaigns/ladder.ts`: authored ?? restoration board adapted ?? template). Statuses `mission_available | in_encounter`, actions `enter_mist | resume_mist`; chapters are free.
- The pre-mission screen is the island's upgrade panel: mission card, ladder, Katchimera picker, helper Wisp (`upgrade-mission-rows.tsx`).
- Katchimera level-ups on the tile panel ("Train X"), `katchimera-upgrade-panel.tsx`.
- Buildings: Dew Spring → starting Resolve, Seed Nursery → spawner drops, Root Cellar → open cells, Garden Stall → Glow from missions. Lantern gates on Mist clears. `tree_stage` wake condition.
- Bond `mist_cleared` and the friend-spark source `mist`.
- Daily Mist: three seeded patches a day (`features/encounters/daily-mist.ts`), from the progress sheet, docked under Mossprout's tile.

## Developer Tools

"Mist board: Dark Wisps encounter" lays a full encounter over any docked mission board (Resolve, Seed Pod, Mist, two Dark Wisps, Bloom), saved apart from the real boards.

## Content (Phase 5)

- **The Sleeping Grove** (`constants/regions/sleeping-grove.ts`): Mossprout's own region, ten rungs. Rung 1 is the first session, rungs 2 to 8 are encounters (8 is the boss, the Keeper), rung 9 is Steppling's rescue at his clearing, rung 10 needs Steppling. It opens after the first session from its marker on Mossprout's tile or the progress sheet (state in `features/encounters/grove-progress.ts`) and docks under Mossprout's tile. Budgets are pinned.
- **Extra rungs** (`constants/island-campaigns/extra-rungs.ts`) come after a chapter's own board. Petalimp gets a night rung in chapter 3 and a boss in chapter 4. Fernip gets a boss in chapter 4. The chapter still grows the island on its last rung.
- **Budgets**: a rung without a pinned Resolve takes shortest clear + max(3, 40 %) (`features/encounter/budget.ts`), read from `constants/encounters/budgets.generated.ts`. Run `npm run encounters:budgets` after changing a bundled board; `tests/sleeping-grove-region.test.ts` fails when the table is stale. A board that would dead-end gets a refill spawner. The solver falls back to a beam search on spawner boards.
- **First session**: no Merge page anywhere. The rest at the end of the first session closes Mossprout's page and hands over to Steppling's clearing. His day one ends on the Kingdom goal (no Garden lesson). Every old way into the Merge page stops on the Haven.

## Friend tiles as campaigns

- **The rule.** Glow is earned in the Mist and spent on your own Katchimeras: Mossprout's stages, a hatchable's home tile (Steppling 20, Baristabbit 60), Heartwood buildings, level-ups, the Lantern, Keep going. A friend's island never costs Glow: its reveal, its restoration boards and its levels are all free (engine `revealMossproutNatureIsland`, `activateIslandCampaignChapter`, `upgradeMossproutNatureIsland` for campaign islands).
- **The Mist level.** Every island's ladder starts with "Lift the Mist" (`mistLevel`, `chapterLevel` 0, id `<campaignId>:mist`). Winning it runs the island's free reveal through the usual reveal flow (Kingdom `liftIslandMist`), so the discovery and first conversation follow. An island revealed before this counts the Mist level as done.
- **Level tracks** (`features/level-tracks/`). One model per tile: `islandTrack`, `groveTrack`, `dailyTrack` give levels (state, stars, reward), chapter story rows, stars, milestone chests and the one next thing. `LevelTrackSheet` shows any of them on the upgrade stage; a friend's island opens its track (a reveal still waiting on its discovery keeps the old panel). Stepping-stones (`level-track-stones.tsx`, anchors in `constants/level-track-anchors.ts`) sit on the tile while its track is open; tapping one plays it.
- **Levels, not boards.** A chapter's levels come from, in order: the campaign's own `missions`, the bundled authored levels (`constants/island-campaigns/island-levels.ts`; Petalimp has nine: Lift the Mist, then two a chapter, the Colour Thief last), a board with a clock or a mechanic of its own (Wisp Rush, the Wanderling column), else two from `patternLevelSpecs`. Every level has a Seed Pod; no piece ever arrives by itself. The old restoration boards, their deliveries and caches, and the request/return flow are no longer played: an old save mid-board or mid-request reads as its chapter's levels, and a chapter closes once its levels have grown the island.
- **Stories play inline.** There is no story button: a chapter's first level carries `opensStory`, and pressing Play runs the chapter's opening conversation, then starts that level (`levelAfterStory` in the Kingdom). A chapter's last level grows the island and its closing conversation plays on its own; the track comes back after it.
- **Badges.** Island markers show levels cleared ("3/9"); Mossprout's tile carries one marker for the Grove, then today's Daily Mist ("1/3 today").
- **Rewards.** Stars are the grade (1 to 3). Milestone chests at a quarter, half and all of a track's stars pay 20/40/80 Glow and a friend pack (`claimTrackMilestone`, `constants/level-track-milestones.ts`). A boss's first clear names a `bright` friend pack. Replays pay 40 % for the first three per tile per day, then 10 % (ledger `replays`, today only).
- **Order.** Petalimp stays open from the Kingdom goal (the goal points at her). The Daily Mist opens at Grove level 5; Baristabbit's window wakes once Petalimp is home. Content packs can gate an island on a cleared level (`rung_cleared` wake).

## Not yet

FTUE flow v57 (rungs 2 and 3 inside the first session; for now the Grove starts after it), Steppling gated behind the Grove boss (he stays `after_ftue`), hand-placed stepping-stones per island, a separate region map, Keep going charging Glow, deletion of the dead daily-garden / journey-garden / Glow-lesson modules, the `'merge'` nav surface.
