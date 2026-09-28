# Dedicated café and event boards

`/activity` owns the Café/Kitchen board, local-event mission boards, and daily Wisp Rush heats. Daily Mist already uses `/battle`. The world retains the event picker, Rush ladder and story conversations. Chapter restoration boards keep their existing flow.

Entry first focuses the target tile using the existing world-camera directive. Once the camera settles, the route captures the tile's screen rectangle and symbolic artwork state using the battle framing helper. Only then does the curtain close. The destination mounts one static tile at the captured position and scale, with the original shared dock and safe-area spacing. The world route unmounts its renderer and controllers while covered by the activity page.

Activity sessions persist their source, tile appearance, viewport/frame, and return result, without storing native handles or Metro asset IDs. The page reads repository snapshots directly rather than depending on the world route's `MergeWorldProvider`. It owns only the selected activity controller. The curtain waits for background/tile art, screen layout, and the dock's visual readiness and settled measurement. Touch input stays disabled until the curtain opens and the app is in the foreground.

The Café keeps its existing `katchimeras.cafe.v3` board, order progression, Kitchen upgrade, first-order guidance, and item/reward flights. Leaving flushes the board. A serve locks before native measurement, preventing duplicate requests or leaving midway through payout. Failed writes can retry the same order without consuming its pieces twice. Completing a café chapter goal returns to the world for its existing dialogue or next-goal handoff.

Local-event moves continue through the existing event repository transaction. Leaving waits for the current move. Completion returns to the hosted resolution conversation. An event that expires while open presents a return action. The event's existing prerequisite order flow is unchanged.

Rush retains its first-move clock start, running-heat leave confirmation, and background voiding rule. Results wait for final flights, are recorded before leaving, and reappear on the world Rush ladder. A failed result save offers a retry. Native view effects remain in use; this change adds no Skia canvas or per-frame mounting mechanism.

Validation: 27 targeted activity, framing, local-event and café tests passed, covering readiness, persistence, stale initial reads, payout retry, event exit, and Rush result ordering. TypeScript and focused lint passed; the iOS Expo/Hermes export completed in `dist/activity-ios-check`. Native mocks and bundle export do not establish physical iPhone layout or performance. On the phone, check Café entry/serve/leave/reopen, first-order guidance, Rush completion and backgrounding, and an event's final merge and resolution conversation. Fully reload production-mode Metro before testing the new route.
