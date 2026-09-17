# World-integrated events

The pilot now plays in the Kingdom. The event overview contains schedules, scoring and rewards, not an alternative board or story renderer.

## Test the new pilot

Reload the updated client. Developer Tools → Content Packs → Offline world event pilot → Activate and restart creates fresh occurrence IDs and a seven-day schedule. This uses content schema 4. No Supabase deployment or account is required.

After FTUE, with Mossprout home, the first garden restoration and 100 Harmony, return to an idle Kingdom map. Mossprout introduces the disturbance through the hosted character conversation. If another story is running, complete or close it first. You can also use top bar → World events → Visit Mossprout. Existing schema-3 pilot saves resume their current encounter with the new presentation; use a fresh pilot to see its opening again.

1. Acknowledge the tile narrative. Only then does the event create its normal Merge order.
2. Use the event action card (on the map or the companion dashboard) to make and serve the supplies.
3. Return to the map and use the same card to resume the draggable mission board beneath the companion's tile. This uses `MistMissionDock` and `MergePlaySurface`, not a grid inside a modal.
4. Clear three merges. The resolution opens with the companion on their tile. Acknowledge it to complete the encounter.
5. Continue the remaining two action cards. The final resolution earns the permanent lantern. Collect optional tiers and display the keepsake from the event overview.

## Authoring

Each local encounter supplies `hexId`, optional `companionId` (legacy default Mossprout), optional `actionTitle`, opening/resolution copy, normal Merge requirements, seed item and merge count. Tile ownership and reachable merge goals are validated. Studio exposes these fields. The opening and resolution compile to contextual conversations, excluded from ordinary random chat selection. Joined definitions remain pinned.

A new hatchable hex and its regular rescue/day-one/Journey content can be included in the same content release using the existing character content-pack pipeline and art assignments. Set its availability to `{ "kind": "event_joined", "eventId": "the-local-event-id" }`. Before participation it is sleeping; joining introduces its normal rescue arc. This is a permanent introduction: expiry or retiring the event does not remove the tile, its rescue or the friend's progression. This mechanism does not implement disposable temporary hexes. The reference must resolve to a local event in the candidate release. These fields require schema 4 so older clients reject unsupported behaviour.

## Acceptance checks on device

Check fresh opening, closing and resuming dialogue, order delivery, dragging/merging on the standard dock, leaving/reopening the board, relaunch during each phase, resolution, expiry, dark theme, and keepsake claims. Check that FTUE and an existing story retain priority and event cards return afterwards. Unit/UI tests exercise the routing, same-sheet overview, pinned narratives, board dispatch, persistence, expiry, schema gates and permanent event-linked tile availability. Physical device visual/camera acceptance remains necessary.


## Persistence and authority

- Harmony award policy is data; existing milestone receipts retain their original
  amounts. Historical facts never score newly joined events.
- Occurrences pin their complete definition at enrollment. Retirement stops new
  enrollment, while existing runs keep their schedule and earned keepsakes.
- Local encounter state and claims live inside the versioned world snapshot.
  Inventory, claims, scoring and emitted actions use the existing serialized
  SQLite write path. Buffered provider saves preserve repository-owned event state.
- Bond, Wisp and Journey stores embed pending gameplay facts in the same KV write
  as their source snapshot. Delivery retries deduplicate, and acknowledgement
  preserves newer source writes. No photos, journal answers or story choices are
  copied into the event journal.
- Completing temporary Mist emits `incursion_completed`, not permanent
  restoration. Ordinary merge and order actions include their board context.
- Local rewards allow only Glow and event keepsakes. They never authorize Gems,
  premium entitlements or verified server claims. The existing verified-board
  pilot remains separate.
- The local clock never moves backwards on committed event interactions. It is
  not a trusted clock. Deferred source actions retain their occurrence time;
  expired event orders cannot consume supplies. Client tampering is outside the
  authority guarantees of this free local mode.
- The latest 200 event interactions are retained in `localLiveOps.recentActivity`
  for local diagnostics (view, enrollment, encounter begin/resolution, claims,
  dismissals and errors). There is no new telemetry upload endpoint. Mid-run
  abandonment is visible as an unfinished node and its last interaction.

## Verification and rollout

`npm run test:local-events --workspace=katchimeras` covers the complete reducer
loop, serialized restart, actual order consumption, overlapping scoring,
historical exclusion, reward retries, expiry, source-outbox recovery, real SQLite
claim rollback/concurrency, provider overwrites and the React entry/resume flow.

Also run the existing live-ops/content-pack suite, app typecheck, focused lint,
Studio build and verified replay suite. The replay archive changes when the game
reducer changes; old checkpoint archives remain installed.

Physical iOS and Android acceptance remains a release gate: validate marker
placement, safe-area layout, story/FTUE priority, touch interactions, airplane
mode, process death, clock rollback, expiry, claim recovery and preserved
restoration. Do not enable a player-facing release until those checks pass.

Next milestone: a separately verified paid pass, RevenueCat credential setup,
native purchase/restore/refund acceptance, and an explicit migration policy for
ordinary offline saves. None is implied by successful local-event tests.
