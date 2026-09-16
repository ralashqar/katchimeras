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
5. **Daily cards** as the definition's `daily` block (`types/companion-daily.ts`): the day's question
   polls, an optional photo, noticing prompt, water, a daily moment, and an optional step goal with the
   friend's milestones and lines. The shared cards (`companion-daily-actions.tsx`) draw all of it.
6. **A journey chapter** (optional) in `constants/companion-journey-chapters/<name>.ts`, registered in
   `COMPANION_JOURNEY_CHAPTERS`; see `journey-chapters.md`. Without one the page shows the daily cards
   and the idle line.

`tests/legacy-guard.test.ts` keeps the shared tech free of friend names and of imports of what the
refactor removed; `tests/companion-registry.test.ts` walks every chapter and daily config.

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
  answer feed); `use-hatchable-encounter.ts` and `hatchable-encounter-panel.tsx` export the generic
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

- (Done Sept 14, 2026) Daily activities are shared tech on a `CompanionDailyConfig`
  (`types/companion-daily.ts`): a definition's `daily` block names its photo card (what to look for as
  quality ids or capture categories, the camera's copy, follow-ups, whether the photo is kept as a
  memory), an optional noticing prompt rotation, water, the scenario polls served one a day, the page's
  lines, and whether the cards sit behind one gateway card (`menu`) or lie flat (`rows`). Mossprout's
  nature photo, noticing and water are the first config (`constants/companion-daily/mossprout.ts`);
  `companionDailyConfig(familyId)` finds any friend's. One card
  (`components/katchadeck/world/companion-life-activity-card.tsx`), one store per friend
  (`utils/companion-life-activity-storage.ts`, `companion:<family>-life-activities:v1`), one grading
  (`utils/companion-photo-match.ts`) and one camera branch (`companionActivityId` +
  `companionActivityFor` on `/moment-capture`) serve every friend; `companion-daily-actions.tsx` draws
  a hatchable friend's column and `companion-daily-question.tsx` the day's question for anyone,
  Steppling included. Only Steppling's step goal is still his own. A photo feed for the Egg
  (`feed.kind: 'photo'`) uses the Egg's own capture session; Baristabbit's Egg hatches on answers alone.
- Journey chapters are episodes unlocked by progress, played as conversations (see
  `journey-chapters.md`); Steppling has one, a hatchable friend without one shows their daily
  cards and idle line.
- Fixtures: no "Before Baristabbit" profile snapshot yet.
