# Merge order rail performance

## Changes

- Serve/parcel callbacks read the current board through the existing state ref instead of changing identity on every command. Chat navigation reads its current revision the same way. Equal FTUE rail gates and equal tray rows retain their references, so unchanged trays can actually pass React's memo check.
- A maximum of six expensive tray contents are mounted. Lightweight keyed layout slots persist for the remaining entries: scrolling changes their contents, not the identity/position of the slots. Real arrivals/removals keep their outer transitions; virtualization does not replay child entrance/exit animations.
- The measured viewport, including partial cards, controls the ready rays independently of the mount window. Off-screen, unfocused and backgrounded trays stop both repeat animations. Visible ready trays retain the same art and timing; reduced motion remains static.
- Scroll events only schedule a coalesced React update when mounted/visible card boundaries change. No row state updates for each pixel of movement.
- The serving card observes cancellation/completion, restoring its button when an interrupted flight leaves the order unserved. Stale item measurements cannot launch a new serve after deactivation or unmount.
- `EXPO_PUBLIC_MERGE_BOARD_PERF=1` now records `order-card` render attempts as well as `order-rail`. These are render attempts, not frame rate or committed-render measurements.

## Verification

Run `npm run test:merge-performance`, `npm run test:merge-world`, `npm run test:lifecycle`, `npm run typecheck`, and `npm run lint`.

On a physical device in a release/profile build:

1. Warm the board. Compare identical spawn bursts with one vs six unready trays, then one vs six ready trays. Record UI/JS frame times and deltas of the merge render counters. Unchanged trays should not rerender for unrelated spawns; trays whose item readiness changes should update immediately.
2. With more than six entries, scroll both directions and return. Confirm no false arrival/serve animation, no blank visible slots, and no cumulative loop count growth. Only visible ready trays should own radial-sunburst loops.
3. Serve a ready order. Confirm item flight, coin payout, real tray departure, and reflow. Background during measurement, item flight, and coin flight; resume and verify the unserved order is tappable and no payout duplicates.
4. Verify FTUE target auto-scroll, exclusive SERVE restrictions, parcel claiming, long-press reroll and chat-note navigation. Resize/rotate at the end of a long rail and after removing the last order.

Native animation/FPS checks require a device; automated callback, viewport, identity and source-wiring checks do not substitute for those measurements.
