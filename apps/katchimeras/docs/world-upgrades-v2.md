# Hex upgrades v2

The canvas projects `WorldUpgradeAnchor` from the selected tile's painted frame.
Its panel stays readable at different camera scales, respects safe areas, and
waits for camera settling before its entrance. Markers remain mounted through
selection so their exit and return can animate. Purchase confirmation waits for
the panel's 140ms exit before invoking the existing purchase or tutorial handler.
The transparent outside target consumes the tap; it never passes it to a tile.

## Content

`features/world-upgrades/world-upgrade-stories.ts` contains all 26 current steps,
keyed by offer ID and destination level, with stable before/after line IDs.
Each step has three before-build lines and one reaction. Speaker portraits come
from the skin catalog. Steppling has an authored Mossprout alternative until
the persisted egg hatch is complete. Future steps are not displayed.

The tile panel opens directly into an expanded, scrolling conversation with its
first line already visible and a fixed purchase footer. Tap the current speech
bubble to add one new line; scrolling never advances dialogue. Completed upgrade
conversations are available above the current beat. Expand opens the same story
in a larger darkened overlay. Build does not require reading.

Portraits reuse `HavenCharacterPortrait` from the top-level world selector: a
cream-rimmed green circle with character art overlapping it. Speech bubbles use
the companion interaction parchment, Fredoka display/name fonts, and Manrope
secondary labels. Saved cursors are monotonically updated in the
existing serialized snapshot writer, independently of content-flow runs.
Unread earlier dialogue remains available after building; reactions become
available when the corresponding level has been committed.

## Rewards and compatibility

Bloom Garden 4 grants Petalimp, Orchard Grove 4 grants Amberleaf, and Wildgrowth
Grove 4 grants Fernip. Grants are deterministic records in `upgradeSkinGrants`,
reconciled inside the successful island upgrade transaction. Loading an older
save reconciles already-earned milestones from completed levels, without
charging Glow or replaying a reveal. Wardrobe and card collection ownership
include those grants; no additional companion is created or automatically equipped.
The reward notification appears after the world reveal and opens the collection.

World purchase flow definitions advance to version 3. Version 2 definitions
remain registered for unfinished saves; run IDs and payment receipts are unchanged.
The Garden and mist tutorials retain their own confirmation handlers and effects.

## Verification

Run from `apps/katchimeras`:

```
npx tsx --test tests/world-upgrade-v2.test.tsx tests/world-upgrades.test.tsx tests/katchimera-wardrobe.test.ts
npm run typecheck
```

On a native device, check close/open spring motion at different zoom levels,
small screens and large text, history scrolling and Back, both tutorial purchases,
insufficient Glow, interruption/retry, and milestone collection access. The
normal web app currently fails bundling on its native-only react-native-maps
import; the existing web SQLite wasm resolution also blocks isolated Metro
previews. Native visual verification is required before treating layout as approved.

The targeted upgrade/wardrobe/repository tests and all 247 story-flow checks
pass. The separate Haven progression suite has four existing failures (order
priority, old FTUE rest checkpoint, meditation Back source assertion, and route
focus source assertion), reproduced with the pre-change engine.

The three requested reference images were not available in this conversation;
the implementation follows the written brief and existing parchment/Glow styling.
