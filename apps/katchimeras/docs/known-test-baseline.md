# Known test baseline (Sept 25 2026; rechecked Sept 26 2026 after the Frontier)

## Status

A full run of all 223 test files, each run separately, after the cozy 4X Phase 0 cleanup:

- **Removed:** the failing tests for systems the cozy 4X direction retired.
  - The Egg/Bond first session and its script.
  - Today and the life inputs.
  - Feastle and the journey Garden.
  - Chapter 0 and the Merge page.
  - The Steppling Egg discovery.
  - The old Kingdom goal.
  - The old world-upgrade FTUE flows.

  Only failing tests were removed; every touched file kept its passing count. Two files held nothing but retired tests and are gone: `feastle-content.test.ts` and `opening-glow.test.ts`.
- **Updated to the current design:**
  - `economy`: the Wisp catalog is now 57 ready and 63 planned.
  - `kingdom-progress`: 9 places, and a chapter now moves on to its battle.
  - `island-campaign-registry`: there is no return beat after a served chapter.
  - `level-track`: the island lift holds, and the docked-board list grew.
  - `corruption-wisps`: partly updated (`GlowSink.pointOf`, Lanes shots, the scripted battles in the wisp chain, and the retired opening assertion removed).

## How to run the SQLite suites

Five files need `node --experimental-sqlite`, as the package scripts already run them:

- `live-ops`
- `local-event-repository`
- `shared-adventure-repository`
- `verified-pilot-queue`
- `wisp-lantern-repository`

A bare `tsx --test` reports them as failing.

## Still failing: stale pins in live systems

These need the owning system's intent checked, not a blind update. None of them is a regression from the cozy 4X work.

| Test | What it pins | Likely cause |
|---|---|---|
| `corruption-wisps` (1) | Column-shot wisps hang above the board | The wisp layer's placement changed with Lanes |
| `encounter-territory` (1) | Three boss looks, including `thief` | The Colour Thief's look was not carried into Lanes |
| `time-trial` (1) | A rush chapter closes on its own | The rush chapter checkpoint changed with the campaign pivot |
| `veiled-mist` (1) | The burst is shown a beat after the wake | Board effect timing |
| `petalimp-island-campaign` (1) | Island narratives never project Mossprout | The panel subject |
| `companion-page-policy` (3) | Companion page and roster routing | Companion pages were pared back in the pivot |
| `dev-tools-preview` (1) | `devHavenOrderFillersForSlots` | The Merge page tooling was retired |
| `game-hub` (1), `game-ui` (2), `kingdom-rendering` (1) | UI source regexes | UI moved on |
| `wisp-lantern-repository` (1) | Lantern pouch receipt | The Lantern economy |
| `wisp-lantern-upgrades` (1) | Imports a missing `./friend-wisp-constellations` | The design was never built |
| `haven-detail-panel`, `wisp-lantern-hub` (1 each) | "Invalid or unexpected token" | The harness loads `constants/merge-world-ui-art`, whose images are not mocked |
