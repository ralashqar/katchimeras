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
- The five-token reward remains legible but lands in roughly 620 ms; egg growth
  and activation settle within the intended 0.8–1.0 second interaction rhythm.
- While a reward is entering or playing, layout handoffs are frozen, photo
  discovery is cancelled/paused, location and pedometer samples are buffered,
  and deferred persistence waits for the interaction lease to end.
- Prompt discovery and passive map seeding share a short-lived media-library
  asset-page cache, preventing two near-simultaneous camera-roll enumerations.
- The display-sized egg uses the WebP source and permits image downscaling. The
  authored full-spread scene does not also mount the fallback moving-cloud layer.

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
