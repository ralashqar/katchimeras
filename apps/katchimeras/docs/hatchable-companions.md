# Hatchable companions: a friend the Mist keeps, as content

Status: built Sept 12, 2026 on `refactor/shared-tech-incubator`. Steppling and Baristabbit are the
two entries. Device verification of Baristabbit's path has not been run.

A hatchable companion is a friend found under a misted hex tile of the shared world: the tile wakes,
light is saved toward its price, a docked mission board clears the Mist, the paid reveal shows an Egg,
the Egg is grown with a question and a feed, the friend hatches, day one hands over a parcel, a garden
lesson teaches their spawner, and their requests join the tray. Every stage reads one definition;
nothing in the screens, flows or engine names a friend.

## Adding a friend

1. **A definition file** in `constants/hatchable-companions/<name>.ts` of type
   `HatchableCompanionDefinition` (`types/hatchable-companion.ts`), registered in `registry.ts`.
   It carries: the tile (hex, unlock id, price, name, alpha-bounds key, sleeping line), availability
   (`after_ftue`, `kingdom_goal_introduced`, `after_companion`), the discovery gate and path the hatch
   records, the mission (storage key, required strikes, camera, seed of items/echoes/veiled cells,
   guides, wisps, lines), the discovery flow copy (offer, egg; a garden lesson only if the Garden
   board is introduced here), day one (conversation id, opening, choices, handoffs, end line, parcel),
   the garden lesson (flow ids, task capability, event prefix, spawner, grow/drop tiers, order, copy),
   the Egg policy (`constants/<name>-egg-copy.ts`), and the economy's spawner.
2. **Copy files**: `<name>-day-one-copy.ts`, `<name>-egg-copy.ts`. Lore voice: present tense, one image
   a line, no exclamation marks.
3. **Art**: the cleared hex tile at 1024/512/256 (`scripts/generate-shared-world-discovery-art.py
   generate|matte|package --tile <name>` with a `briefs.json` entry, then
   `generate-hex-tile-bounds.py`), registered in `constants/hatchable-companions/tile-art.ts` with
   the friend's cut-out for the lesson's closing scene.
4. **A journey profile** in `constants/companion-journey-profiles.ts` (daily garden titles, request
   titles), and the friend's `KATCHIMERA_MERGE_PROFILES` entry and spawner must already exist in the
   merge catalogue.

`tests/hatchable-companions.test.ts` walks every definition: unique ids and tiles, art registered and
bounded, flows that compile, a lesson the spawner can feed, and a mission board with no dead end and
one legal move at every strike after the first.

## What is shared

- `features/onboarding/hatchable-flows.ts` generates each friend's discovery, day-one and
  garden-lesson flows; Steppling's are pinned node for node against fixtures.
- `features/onboarding/hatchable-runtime.ts` starts and recovers discoveries, records the mission
  cleared and the Egg entered, advances the mist upgrade, repairs and reconciles lessons, and reads
  every friend's runs in one subscription (`useHatchableRuns`, `activeHatchableFor`).
- `features/onboarding/hatchable-egg-policy.ts` reduces any Egg on its policy (steps, photo or
  answer feed); `use-steppling-encounter.ts` and `steppling-encounter-panel.tsx` export the generic
  hook and panel with Steppling's names as wrappers.
- `utils/merge-world/glow-discovery-policy.ts`: tile state (`sleeping | saving | ready | egg | open`),
  availability, the purchase refusal while a tile sleeps, the gate written at the hatch.
- `features/world-upgrades/world-upgrade-offers.ts` and `world-upgrade-marker.tsx`: the silhouette
  Egg marker with rays lit by the tile's state.
- `components/katchadeck/world/mossprout-hex-neighborhood-scene.ts` draws every tile from the
  registry; the Kingdom canvas takes `gatewayTileId` for the live companion.
- State: `worldUnlocks[unlockId]`, `hatchableEggs[companion]`, `gardenLessons[companion]`
  (Steppling's older `stepplingEgg` / `stepplingGardenLesson` fields are read and mirrored).

## Not yet data

- Daily actions and daily question pools are still per-family code (Mossprout's photo/notice,
  Steppling's steps, the generic poll builder). Baristabbit uses the existing Barista poll pack.
- (Done Sept 13, 2026) Daily cards as content: a definition's `daily` block names a photo card (a
  category, worth the life-activity Bond once a day, through `utils/companion-photo-capture-storage.ts`
  and `companion-photo-activity-storage.ts`), the friend's scenario polls (served one a day, like
  Steppling's), and the page's lines. `components/katchadeck/world/hatchable-actions.tsx` draws them on
  the journey stage for any hatchable friend. A photo feed for the Egg (`feed.kind: 'photo'`) exists on
  the same session, but Baristabbit's Egg hatches on answers alone.
- Journey chapters (journey days with merge orders and rest cycles) are still authored per family
  (Steppling, Mossprout); a hatchable friend without one shows their daily cards and idle line.
- Fixtures: no "Before Baristabbit" profile snapshot yet.
