# Foreground/resume verification

The automated lifecycle suite exercises 30-cycle scheduling and camera ownership,
and runs the actual story repository against a fake SQLite boundary to count
writes and subscriber notifications. It does not measure native FPS or memory.

## Device pass

Use the same build, profile, board and device for each comparison. Prefer a
release/profile build without remote debugging. For opt-in existing diagnostics,
enable `EXPO_PUBLIC_MERGE_BOARD_PERF=1` and `EXPO_PUBLIC_SCENE_PERF=1` when building.

1. Cold-launch Merge. Record frame-time and JS/native memory baselines after idle.
2. Background/foreground 30 times while idle, including brief Control Center
   interruptions and longer background stays. Repeat the same five-item spawn
   burst every five cycles. Compare settled memory and frame times, not only the
   first resume frame.
3. Repeat while spawning, mid-merge and mid-drag. Committed items must remain;
   no ghost items, hidden sprites or blocked input may remain. Critical-work
   ownership must return to idle. The five-second operation watchdog is a
   recovery fallback, not the expected normal completion path.
4. Interrupt a parcel flight after claiming it: contents should be visible on
   resume, with no second claim. Interrupt a serving/reward flight: because the
   order commits at flight completion, cancellation keeps an uncommitted order
   and its items ready to serve again, with no retained preview currency.
5. Repeat on the world map, during a free pan, an FTUE camera move and resident
   focus/exit. Settled framing must not replay. An interrupted authored move
   should finish at its destination once, without a duplicate CTA or effect.
6. Check first-egg FTUE, mist reveal, Steppling hatch and normal orders across
   these interruptions. Kill/relaunch once to confirm persisted progress.

Expected scheduling: one debounced story resume worker; at most one trailing
request while busy; no queued resume starts after background/disposal. Unchanged
waiting/completed runs produce no UPDATE/receipt INSERTs or journal notifications.

If frame time still degrades after settling, capture an Instruments/Android
profiler trace and memory snapshots. These lifecycle fixes alone do not establish
that native image/GPU allocations are leak-free.
