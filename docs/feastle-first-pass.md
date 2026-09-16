# Feastle: The Table We Remember

This is bundled game content, not an exported Studio draft. Reload the updated
development client (or build an updated app) to receive it. Existing saves do not
need resetting.

- `feastle-home` is at axial coordinate `(0, -1)`, beyond Steppling's home.
  It is visible in the shared world; rescue becomes available after the Kingdom
  goal is introduced and costs 60 Glow.
- The food merge rescue board has four Wisps and eight required strikes.
- Two optional-answer choices clear the Egg's two Wisps; the player then hatches
  Feastle explicitly. No camera, step count or real meal is required.
- The first conversation grants a Hearth Pantry parcel. The merge lesson makes
  and serves a Snack from its food chain.
- Seven Journey episodes tell a hearth/belonging story. Three meal orders and
  two-/four-hour waits connect later episodes to merge play. These are episode
  numbers, not seven strictly calendar-gated days.
- Daily content includes an optional food-photo card, a small-moment card,
  noticing choices and 20 rotating questions. Photos use the existing food
  category recognition; they do not grade nutrition or require calorie data.
- The existing forward-facing Feastle idle animated WebP is reused. The home
  uses `feastle_hearth_v1_hex_tile` and its LODs, generated through the
  existing Nano Banana 2 + BiRefNet pipeline from Mossprout's reference base.
  The centre/front floor is clear for the live character. This pass reveals that home; it does not add a multi-stage
  restoration campaign.

## Authoring

The source definitions live in `apps/katchimeras/constants/`:

- `hatchable-companions/feastle.ts`: tile, rescue, first day, lesson, daily cards.
- `feastle-hatch-profile.ts`: current two-question Egg flow.
- `companion-journey-chapters/feastle.ts`: episodes, dialogue, orders, gates.

Feastle is in Studio's existing Characters editor. Restart Studio after source
changes. Saved edits/exported review bundles still require source integration;
the editor does not mutate the running app automatically. Feastle is no longer a
new-companion template candidate because it now has a bundled experience.

## Verification

Automated checks cover rescue board move paths, Egg answer combinations,
content compilation, Journey order gates, editor validation and replay rules.
Device playtesting remains necessary: inspect tile placement, animated art,
rescue-to-Egg transitions, parcel/lesson, photo permissions, and offline resume.

## September 17 fixes

The post-hatch softlock was a shared runtime race: the saved hatch reached the
world before Bond reconciliation finished, and the busy guard refused to close
the Egg. Egg mode hid the resident tile required for camera completion. A durable
`hatchedAt` now permits that handoff while unfinished answers/hatches stay locked.
Reload the updated app and open Feastle to resume an already-hatched save; no
reset or repeat rescue is required. A saved-state hook test covers the first
conversation, one parcel reward and restarting before the Garden handoff.

Daily poll conversation registration now derives from every hatchable definition,
including Feastle's 20 questions. Previously only Steppling and Baristabbit's
polls were registered explicitly.

Art provenance, prompt, source and alpha master are in
`art-source/katchimeras/feastle-hearth-v1/`. The old crowded tile is no longer
assigned to Feastle's home. His character animation is unchanged.
