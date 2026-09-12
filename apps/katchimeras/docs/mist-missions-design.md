# Mist Missions: the opening board as a repeatable mini-game

Status: partly built (Sept 2026). Built: the opening plays on its own mission board (`features/onboarding/opening-mission-state.ts`, `use-opening-mission-board.ts`), and Steppling's misted clearing is cleared the same way (`features/onboarding/steppling-mission.ts`, `components/katchadeck/world/steppling-mission-dock.tsx`): tapping the bubble at `gateway.offer` frames the tile with the opening's camera and docks a 5×4 board with three Socks, a sleeper and five veiled cells (see the revised section below); eight strikes fill the bar, the final item flies into the mist, and its impact records `glow.mission.cleared`, after which the paid reveal, the Egg and the hatch run unchanged. The shared dock is `MistMissionDock` in `kingdom-opening-merge-dock.tsx`; each mission keeps its own store with its own merge count. Not built: parcel rewards, a data-authored mission catalogue, missions for the six island campaigns.

This spec turns the opening beat into its own small board, a *mission*, whose reward arrives on the persistent board as a parcel, and makes the mission the template for clearing every misted island.

## The causal chain the product teaches

> I merge things → the mist disappears → I discover something magical → what I discover becomes part of my permanent game.

- **Missions** answer *what am I exploring for*: a misted tile, a small board, one bar, one reward.
- **The persistent board** answers *how do I get enough to keep exploring*: orders, Glow, Energy.
- **The Katchimeras** answer *why I care*: each mission wakes a friend.

Glow buys the ticket to a mission; merging does the clearing. That replaces "Clear mist for 40 Glow", which reads as a purchase.

## Recommended first session

1. Misted tile under a twilight sky, two captions, **Look closer** (as built).
2. **Mission board** slides up: 5×4, eight Seeds and two Sprouts, the *Clear the Mist* bar. Merges send Glow into the mist; the bar fills.
3. The bar's last merge yields the **Garden Satchel** as an item on the mission board. The bar completes on that reveal. No separate spawner lesson before the Egg.
4. Mist lifts, Egg, two answers, hatch, conversation, Memory Seed, Mossprout points at the world (as built).
5. **Persistent board opens with a parcel on the rail.** Claiming it places the Satchel spawner (the existing `arrival.generatorId` path in `claimArrival`). Tap it, grow, serve the first order, first Glow. This is the strongest beat in the flow: the thing you found is now yours.
6. Glow opens the next island's mission.

Trimmed on purpose: the proposal's "discover Satchel → tap spawner → higher-tier merge → clear mist" is four beats before the Egg; the retention review found the opening already front-loads. The spawner tap and the higher-tier merge teach themselves on the persistent board, where they matter.

## Mission model

```ts
type MistMission = {
  id: string;                      // 'opening' | `island:${MossproutNatureIslandId}`
  islandId: MossproutNatureIslandId | 'home';
  entryCost: number;               // Glow; 0 for the opening
  layout: { columns: 5; rows: 4 }; // its own small grid, no cellIndices window
  seed: { cell: number; definitionId: string }[];
  generators?: { cell: number; generatorId: string }[];
  objective: { kind: 'merges'; count: number } | { kind: 'produce'; definitionId: string };
  reward: MissionReward;           // what the parcel carries
};
type MissionReward =
  | { kind: 'generator'; generatorId: string }   // Garden Satchel, later island spawners
  | { kind: 'items'; definitionIds: string[] };
```

A mission is data; islands get missions by authoring, not by code.

## Mission store

- One `MistMissionState` per active mission: `{ missionId, board: MergeBoardCell[], progress, status: 'active' | 'complete' | 'claimed', revision }`, reduced by `reduceMergeWorld` on a mission-scoped `MergeWorldState` (no Energy, no orders, no arrivals: chapter-zero-style economy flags).
- Its own SQLite table and writer, with the same `baseRevision` stale-write guard as the persistent board, and `{ persist: 'immediate' }` on every command while a mission is guided. The FTUE resume rules stay board-derived: on relaunch the mission board is the truth, the run's counted objective is replayed from it (`openingMistBoardStep` refill logic generalises).
- Completion writes the reward as a **persistent-board arrival** (`kind: 'mission_parcel'`, `generatorId` for spawners, `itemDefinitionIds` for items) in the same transaction that marks the mission `claimed`, so a kill between the two cannot lose the reward or grant it twice.

## What already exists

| Piece | Reuse |
|---|---|
| Board reducer, play surface, windowed layout, FTUE gates and finger | `reduceMergeWorld`, `MergePlaySurface`, `MergeBoardLayout`, `useFtueMergeDispatch` |
| Parcel that installs a generator | `claimArrival` with `arrival.generatorId` (discovery parcels use it today) |
| Counted objective, kill-safe replay | `FtueGraphEdge.requiredCount`, `reconcileFtueCheckpoint` count replay |
| Glow flights, impacts, bar, dock entrance | `kingdom-opening-merge-dock.tsx` |
| Island campaigns, wake order, Kingdom goal | `constants/island-campaigns/*` |

## New work, in order

1. `MistMission` catalogue with the opening mission; `createMissionState(mission)`.
2. Mission repository (table, journal, writer flush) and a `MissionBoardProvider` the dock mounts instead of the persistent provider.
3. `mission_parcel` arrival kind and the Garden Satchel generator definition (`garden-satchel`: two nature chains, Seed drops).
4. Script: `world.mist_clear` objective moves onto the mission; a `merge.claim_satchel` beat on the persistent board replaces the current opening-board carry-over (the persistent board starts from `createMossproutChapterZeroState` again, minus the Seeds).
5. Kingdom: a misted island opens its mission when its campaign is next and Glow covers the entry cost; the dock becomes `MistMissionDock` keyed by mission id.
6. Tests: mission resume at every boundary, reward atomicity, parcel-to-generator on a full board ("make one space" path already exists).

## Decisions to make first

- **Energy**: missions are free of it; the persistent board keeps it. Otherwise missions read as a second board to manage.
- **Content cost**: one authored mission per island (board, bar length, reward). Keep the format a template so an island is a data entry.
- **Where mission boards live in the world**: docked under the island's tile as the opening does, camera pulled to the island, not a separate route.

## Steppling's board, revised again (Sept 12, 2026): no spawner, mist that bursts

Built. Spawning is taught on the Garden board by parcel, so this board has no Locker. It holds three
Socks along the bottom, one cell asleep under a lower band of mist (a Shoe), and five cells the Mist
holds completely (`mist.kind === 'veiled'`), each hiding the next sleeper. A sleeper wakes when its match
is dropped on it and wakes as the next piece up, and the moment it wakes every veiled cell sharing an
edge with it bursts open into the sleeper it was hiding (`revealedMistCells` from the engine's echo
branch; a `mist-burst` board effect a beat later, and the revealed sleeper scales in). The chain snakes
up and across the window and holds exactly what it consumes: merge two Socks into a Shoe; wake the
sleeping Shoe (38) into a Boot and 31 bursts; wake 31 into Hiking Gear and two cells burst, 24 wanting a
Pack you cannot make yet and 30 wanting the Sock you still have; wake 30 into a Shoe and 23 bursts; wake
23 into a Boot and 22 bursts; wake 22 into Hiking Gear; merge the two Hiking Gears into the Pack; wake
24 with it into an Expedition Kit, the finale. Eight strikes, two per wisp
(`STEPPLING_MISSION_MERGE_REQUIRED = 8`). At every moment there is one thing to do (the exhaustive test
proves both that no move strands the chain and that no strike after the first offers a choice), so the
board is free without a lock. Guidance: the first merge is spotlit and exclusive; after that nothing is
spotlit and the finger appears only after two seconds of pause (`STEPPLING_MISSION_HINT_THEME`),
pointing at the match that wakes the lowest sleeper, or at the pair when nothing can wake. The first
burst speaks `STEPPLING_WISP_LINES.reveal` once. Source: `features/onboarding/steppling-mission.ts`;
storage key v3, so a Locker board saved mid-mission is left behind. Veiled cells survive reload through
`normalizeDreamMist` (unknown owner or item decays to plain mist), cannot be dropped on, and only a
waking sleeper opens them: an ordinary merge beside one does nothing.
mist), cannot be dropped on, and only a waking sleeper opens them: an ordinary merge beside one does nothing.
