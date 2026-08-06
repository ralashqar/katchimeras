# Game flow performance lifecycle

The foreground game routes run as an explicit application activity mode. While
that mode is active, passive foreground location, step capture, and recent-photo
seeding are paused. User-enabled Travel Memory background tracking is separate
and remains governed by its own setting.

Today and companion surfaces remove their heavy visual trees when unfocused.
This releases images, Skia canvases, intervals, and Reanimated loops before a
game starts; returning to the route remounts a fresh tree from persisted state.

## Development tracing

Set `EXPO_PUBLIC_SCENE_PERF=1` before starting Expo. Game entry logs
`[flow-perf] game-hub-game` or `[flow-perf] katchimera-block-blast`. After exit,
`[lifecycle-perf]` reports all tracked game routes, timers, audio players,
location watchers, and pedometer watchers that remain.

An exit is clean when the report has `total: 0`. Any non-zero report includes
resource labels identifying its owner.

## Device soak check

On a release-profile development client:

1. Open Today and launch a mini-game.
2. Play or abandon it and return to Today.
3. Repeat 30 times, including Rhythm, Block Blast, and Live Steps.
4. Confirm every lifecycle exit report is clean.
5. Compare game-ready time for cycles 1–5 and 26–30.
6. Capture Hermes/native-memory and UI-frame traces after cache warm-up.

Expected result: route depth remains constant, tracked resources return to zero,
ready time has no upward trend, and memory settles to a cache plateau rather
than increasing each round.
