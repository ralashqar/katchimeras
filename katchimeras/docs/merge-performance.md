# Merge and Haven performance pass

## Implemented

- Merge sprites retain authored 256px textures inside fixed 1.5x image surfaces. Animation changes transforms and opacity, not native image width/height every frame. Resting dimensions and authored motion curves stay unchanged.
- Ordinary move/merge and generator commands reduce synchronously but save on a fixed 250ms deadline from the first dirty command. Later commands do not slide that deadline. Rewards and other commands bypass buffering. Blur, background and unmount flush; the normal Garden return waits for the flush. Pending receipt IDs remain unioned with the newest snapshot.
- Drag and animation lifetimes own deferred-work leases, released by completion, cancellation, node changes or teardown. There is no guessed 180ms animation timeout.
- Image warming includes the next merge tier, pins outgoing sprites, retains a bounded working set (96 entries or the visible required set if larger), and releases evicted refs after consumers receive replacement sources. Replacement workers queue behind any unavoidable in-flight decode; cancelled jobs do not start more decodes.
- Coin HUD and board use selected snapshots. Wallet updates skip equal balances; the order rail is memoized with stable equivalent rows. Sprites receive their own resolved image rather than the entire changing cache. Matching hints are stable between changes. Board item counts are cached against immutable board identity.
- Haven explicitly renders its blur teardown instead of relying on freezing. Heavy world/merge scenes remain focus-scoped; lightweight retained provider snapshots and reset listeners deliberately remain. Hidden reset listeners adopt snapshots without story reconciliation.
- Free-camera world tiles choose an image tier from settled projected size and device density. Authored camera, interaction and reveal paths retain full-resolution art. No tile culling was added.
- Meditation image/ray layers unmount after their exit fade; ordinary idle playback pauses during meditation. Idle logging is opt-in.
- Spawn bursts now live in a separate effects store/layer. Slots and their particle/ring/glow children are memoized; only the affected slot updates. Expiry timers are slot-owned, cancelled on replacement/unmount, and stale retirements are no-ops. The six-slot pool explicitly replaces its previous occupant even after gaps in expiry.
- A normal spawn landing retains the existing sprite array when the presented board is already canonical. Merge/return cleanup and external edits still take the full reconciliation path. Completion receipts and animation leases are released at each individual landing, not deferred until the whole burst ends. The flight curve, 760ms duration, particle counts and shadows are unchanged.

## Save tradeoff

Abrupt process termination before a buffered save starts can lose up to 250ms of ordinary board edits, plus storage I/O time. Explicit reward commands do not use this buffer. Existing FTUE durability barriers may flush earlier, intentionally. Existing retry/outbox behavior remains; buffering is not a guarantee against storage failure.

## Automated verification

Run `npm run typecheck`, `npm run test:merge-performance`, `npm run test:merge-world`, `npm run test:lifecycle`, `npm run test:kingdom`, and `npm run verify:story-flows`.

The performance tests exercise deadline/coalescing, selector identity, cancelled waits, lease handoff, serial task replacement, sprite scale limits and resolution thresholds. Source contracts check native integration points. These are not mounted native UI tests or evidence of measured 60fps.

## Device profiling still required

Use the oldest supported phone. Compare the same saved fixture on this version and the baseline, first in the reported development build, then a release-like build without the debugger. Target 60fps (16.7ms frame budget); do not interpret development timings as release performance.

Enable `EXPO_PUBLIC_MERGE_BOARD_PERF=1` and `EXPO_PUBLIC_SCENE_PERF=1` in a profiling build. The merge probe emits one report per completed animation burst, including UI-frame buckets, reducer/serialization/decode durations and cumulative render attempts (including effects-layer and effect-slot). Sampling includes the landing-effects tail without subscribing the board to effect changes. Compare counter deltas, not absolute counts. Logs are off by default. Optional idle playback logs use `EXPO_PUBLIC_CREATURE_IDLE_PERF=1` in development.

1. Cold entry, then 50 warm merges/spawns; include rapid taps, overlapping animations, invalid drops, full board and locked-cell merges. Check visual sharpness and unchanged hit targets.
2. Serve multiple orders: coin flights must still land at the exact HUD artwork size/position and grant once.
3. Run both Mossprout and mist-clearing FTUE sequences, parcel reveal, Steppling hatch, meditation enter/exit, and camera pan/zoom with Reduce Motion on and off.
4. Repeat World → Merge → World 30 times. After settling, Merge should have one board, zero world canvases and one active merge provider; World should have one canvas and zero merge boards. Retained provider/reset subscriptions are expected. Art workers and repository workers may briefly finish in-flight work; they must drain. Visible world interaction may own a companion scene/sheet.
5. Background during drag, spawn, merge, serving and save; resume and verify exact board/reward state. Kill/relaunch after an acknowledged reward; separately test the documented ordinary-edit loss window.
6. Record native CPU, memory and GPU/frame traces. Check for a stable memory plateau across repeated navigation, and for no invisible meditation rays/idle players after exit. The JS counters do not measure native texture allocation or prove absence of all background work.

Compare warm p95 frame time, longest frame, frames over 20ms, reducer/serialization duration, per-burst sprite renders and peak/settled memory. Further effects reduction or renderer changes should be justified by those traces, not assumed necessary.
