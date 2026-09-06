# Hex upgrades v2

The canvas projects `WorldUpgradeAnchor` from the selected tile's painted frame.
Its panel stays readable at different camera scales, respects safe areas, and
waits for camera settling before its entrance. The anchor reserves 80 points below the top safe-area inset for
navigation/currency chrome and exposes all remaining space below its stable top.
The card measures its header and natural scroll content at a fixed width (up to
336 points), then fits their combined height plus its border. It grows downward,
with scrolling enabled only when the content exceeds the remaining screen space.
The initial viewport must match that measured size before the entrance bounce
starts; its transform origin is top-center so the top stays fixed. This avoids first-open clipping at the entrance scale. Markers remain mounted through
selection so their exit and return can animate. Purchase confirmation waits for
the panel's 140ms exit before invoking the existing purchase or tutorial handler.
The transparent outside target consumes the tap; it never passes it to a tile.

## Content

`features/world-upgrades/world-upgrade-stories.ts` contains all 26 current steps,
keyed by offer ID and destination level, with stable before/after line IDs.
Each step has three before-build lines and one reaction. Speaker portraits come
from the skin catalog. Steppling has an authored Mossprout alternative until
the persisted egg hatch is complete. Future steps are not displayed.

The tile panel contains only title/current-max level, required Glow, unlock details
and the purchase action. Its top-left speech button opens `WorldUpgradeNarrative`.
No dialogue is displayed or marked read by opening the base card.

The story is a native full-screen transparent Modal above navigation and the
currency bar, with a dark scrim, gold title ribbon and level badge. Rows alternate
right/orange and left/blue portraits, name plaques and bubble tails. History stays
expanded; only the newest chapter advances a line per tap. Scrolling never
advances dialogue. Manual history can close via X, outside tap or Back.

After the art crossblend reports completion, the same splash opens in required
mode. The saved reveal operation remains unacknowledged until the final Continue;
X/outside/Back cannot skip it. Each advance saves the cursor before revealing the
next line. Failed writes retain the gate with Retry. Tutorial handoffs and reward
toasts wait for completion. If interrupted, the existing receipt-backed reveal
replays without charging again, then resumes the saved cursor and requires the
final Continue. This also applies to the Garden and mist tutorial reveals.

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
The reward notification appears after the required story and opens the collection.

World purchase flow definitions advance to version 3. Version 2 definitions
remain registered for unfinished saves; run IDs and payment receipts are unchanged.
The Garden and mist tutorials retain their own confirmation handlers and effects.

## Verification

Run from `apps/katchimeras`:

```
npx tsx --test tests/world-upgrade-v2.test.tsx tests/world-upgrade-narrative.test.tsx tests/world-upgrade-layout.test.tsx tests/world-upgrades.test.tsx tests/katchimera-wardrobe.test.ts
npm run typecheck
```

On a native device, check close/open spring motion at different zoom levels,
small screens and large text, history scrolling and Back, both tutorial purchases,
insufficient Glow, interruption/retry, and milestone collection access. The
normal web app currently fails bundling on its native-only react-native-maps
import; the existing web SQLite wasm resolution also blocks isolated Metro
previews. Native visual verification is required before treating layout as approved.

The two supplied reference images guide the split between the requirements card
and the separate ribbon-and-dialogue splash. The implementation keeps the game's
existing fonts, circular portraits, Glow art and shared CTA.
