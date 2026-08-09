# Home energy loop performance

The Today core loop can be profiled without enabling general scene logging:

```powershell
$env:EXPO_PUBLIC_TODAY_LOOP_PERF='1'
npm run start:dev-client
```

Use a release-like development client on the same physical 60 Hz reference
device for before/after comparisons. Simulator and remote-debug timings are not
acceptance measurements.

## Traces

Each action receives a transaction id and reports these milestones:

1. `action_press`
2. `destination_open`
3. `artifact_complete` when applicable
4. `reward_launch`
5. one `token_arrival` per payout token
6. `domain_commit`
7. `egg_settled` or `cancelled`

The frame probe reports total frames, frames over 20 ms, their percentage, and
the longest frame. Persistence reports active-envelope bytes, archive bytes,
serialization time, and total async write time. An ordinary Today/Tomorrow
mutation should report zero archive bytes after the first partitioned save.
React Profiler commits are retained in a bounded in-memory buffer and emitted as
one `react-summary` at the end of the transaction, rather than logging during
every animation commit.

## Optimized runtime contract

- Forming Today mounts one nurture scene and one egg. The legacy Today scene is
  unmounted rather than hidden under the full-spread background.
- Mood and sleep completion write the artifact, Growth event, and care state in
  one state mutation and normalize only Today/Tomorrow. Full archive
  normalization remains reserved for hydration and lifecycle boundaries.
- The five-token reward remains legible but lands in roughly 930 ms; egg growth
  and activation settle within the intended 0.9–1.2 second reward rhythm.
- While a reward is entering or playing, layout handoffs are frozen, photo
  discovery is cancelled/paused, location and pedometer samples are buffered,
  and deferred persistence waits for the interaction lease to end.
- Prompt discovery and passive map seeding share a short-lived media-library
  asset-page cache, preventing two near-simultaneous camera-roll enumerations.
- The display-sized egg uses the WebP source and permits image downscaling. The
  authored full-spread scene does not also mount the fallback moving-cloud layer.
- Today and You are separate routes. Opening You unmounts Today instead of
  retaining its gestures, timers, sensors, and UI-thread scene animations below
  an overlay.
- Avatar runtime art is capped at 512 px for bodies, faces, hats, and full Wisp
  artwork and 256 px for held items and Wisp thumbnails. The high-resolution
  masters remain source assets but are not
  imported by the application. `npm run avatar:runtime-assets:check` enforces
  dimensions and an 8 MiB aggregate runtime budget (currently 4.20 MiB).
- The customization collection is virtualized in four columns and renders 256 px
  thumbnails. Only the standalone hero requests the 512 px display layers.
- Today mounts one cinematic background at rest. A neighboring page is mounted
  only during an active transition, and unsupported Katchimeras use the Home
  cinematic instead of loading the retired hex renderer.
- Energy numbers commit once per token while the meter fill animates on the UI
  thread. Ripple/confetti canvases mount only for active feedback and are
  released after the effect completes.
- Passive capture is event-driven and active only on Today. After the opening
  transition settles, steps receive a one-shot read, location receives a
  one-shot balanced-accuracy sample, and Photos receives one incremental scan.
  Continuous passive native watchers are not retained. Step and location reads
  use 15- and 30-minute cooldowns; Photos persists its newest creation-time
  cursor so later sessions enumerate only new assets. Blur, backgrounding,
  games, and critical reward interactions cancel scheduled or in-flight work.

## Acceptance scenarios

Run mood, sleep, quick goal, journal, photo return, and mini-game return once;
then run twenty inline completions and a rapid two-action queue. Verify:

- press-to-feedback p95 is at most 100 ms;
- inline mutation p95 is at most 50 ms;
- reward flight begins within two rendered frames of measurement;
- animation frame p95 is at most 20 ms, fewer than 5% of frames exceed 20 ms,
  and no frame exceeds 100 ms;
- persistence starts off the visible interaction path and ordinary mutations do
  not serialize the archive;
- cancellation, navigation, and unmount leave no active trace or queued reward;
- memory does not trend upward across the twenty-action run.

Repeat with fresh, 30-day, 120-day, and media-heavy histories. The app currently
retains at most 120 archived home days; the partition prevents that bounded
archive from being rewritten for each energy action.

Use an iPhone 11-class physical device as the 60 Hz performance floor. Profile a
release build with Xcode Instruments (Animation Hitches, Time Profiler, and Core
Animation) before considering native dependency or Reanimated static-flag
changes; those changes need device evidence and a separate native build.
