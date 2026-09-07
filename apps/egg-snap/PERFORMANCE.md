# Combat performance verification

## Implemented

- One persistent Skia Atlas canvas draws both fighters' cells, launch/collision pulses, shards, falling misses and bomb destruction. Cell paths and shard directions are prepared at spawn; reusable transform/rectangle/colour buffers replace per-cell native views. The canvas stops reading the combat clock when its queue is empty.
- Essential cells have dynamically sized capacity. Only decorative shards have a global cap. High uses 6 shards/collision (cap 96), Balanced 3 (48), Low 1 (16). Each spawn retains its chosen quality. Collisions and health remain simulation events, independent of renderer retirement.
- Health subscribes separately from the battle. Impact events directly update avatar shared values; they no longer commit the battle scene, tray, fields or layered avatar through React. Live event batches are consumed once and cleared; the pure engine retains its bounded history for deterministic tests.
- Egg aura/rim textures are cached 256px white alpha images, tinted at render time and animated with opacity/transforms. Legacy avatar callers retain compatible props and shadow presentation. Phones omit the completely covered blurred backdrop underlay; tablet margins retain it.
- Settled footprint pictures are cached per placement; only entering/landing cells are recorded during animation. Hover remains independent. Candidate pruning skips AI drops that cannot overlap any footprint, preserving origin order and duplicate weighting.
- Adaptive quality samples UI frame intervals, once per second to JS. Two consecutive windows above 10% of frames over 25ms lower quality one tier; five below 2% raise it. Loading, pause, background and terminal combat are excluded. Haptics retain the existing motor guard and per-cell rhythm.

## Repeatable profiling

Open **Mechanics arena → Performance stress duel**. It uses seed `egg-perf-v1`, fixed 600ms player inputs, a 600ms opponent action range and 92% opponent accuracy, equal large health, and cycles every implemented mechanic. Manual dragging remains available; keep it untouched for reproducible comparisons, then repeat with rapid dragging to check responsiveness. No campaign rewards are granted.

The small panel updates in its own subtree once per second. It reports JS p95 frame interval, JS/UI slow-frame counts, simulation maximum, battle commits and active/peak effect cells. The quality button cycles Auto/High/Balanced/Low. These are frame scheduling diagnostics, **not GPU or resident-memory measurements**. The sample buffer is bounded. UI counters are constant space.

1. On the same physical iPhone, run three minutes from a fresh entry, pause and record the panel, then leave/re-enter and repeat. Record device, OS, viewport, build mode, power/thermal state and quality override.
2. Repeat with the existing preview build profile, setting `EXPO_PUBLIC_EGG_PERF=1` at build time to explicitly enable the arena. Ordinary production builds do not expose it. Compare fixed Balanced first, then Auto.
3. Use Instruments/Core Animation and Allocations to check compositor frame time and resident memory. Compare identical runs against the pre-optimization build; dev/browser scheduling is not a substitute. Verify memory settles across repeated runs and route exits.
4. During a separate interaction run, drag rapidly while both eggs volley; check target agreement, continuous placement-to-launch handoff, outward paths, side impacts, incremental health, smooth rim glow, attack priority, and haptics. Pause with cells in flight, resume, then verify defeat/retry and a campaign victory save.
5. Repeat Low and reduced-motion accessibility mode. Every gameplay cell and collision must still be represented. Check bomb/colour waits and jigsaw origin alignment.

Targets pending physical-device measurement: 60fps preview; 95% of frames at or below 20ms; no repeatable >50ms spikes; at least 50% fewer >25ms frames and 75% fewer impact-related React commits than baseline. No per-cell native views and no idle projectile-clock subscription are structural guarantees; these percentage targets are not claimed as measured gains.

## Automated checks

From the workspace root:

```sh
npm run check --workspace=egg-snap
npm run test:tile-match
npm run test:packages
npm run check:boundaries
npm run typecheck --workspace=katchimeras
npx tsx apps/egg-snap/scripts/benchmark-opponent.ts
```

The frozen pre-optimization AI oracle compares exact actions across 30 seeds, both strengths, every modifier, accurate/inaccurate play and five rolls, including successive partial/chip states. Tests also cover subscription delivery/unsubscribe, collision timing, essential buffer capacity, quality hysteresis and bounded diagnostics. Native export checks validate bundling, not native runtime frame rate or haptic feel.

## Local verification record (7 September 2026)

47 Egg Snap tests, the tile-match suite, 10 shared-package tests, workspace boundaries, Katchimeras typechecking and Android/iOS Metro exports passed. Browser inspection exercised matching, outward flying cells, the two-sided stress arena, impact health, and pause. A rendering compatibility issue was caught visually: the atlas must use a non-texture image across offscreen/onscreen GPU contexts, and an explicit source-over paint separate from its tint blend mode. Keep both when changing the renderer.

CPU-only inaccurate-move benchmark (100 seeds, 1,000 samples per mechanic, one desktop run):

| Mechanic | Before p95 ms | After p95 ms | Mean time reduction |
| --- | ---: | ---: | ---: |
| Tap | 0.463 | 0.199 | 69.0% |
| Drift | 0.462 | 0.159 | 73.9% |
| Armour | 0.583 | 0.137 | 80.0% |
| Bomb | 0.562 | 0.218 | 72.8% |
| Fuse | 0.723 | 0.133 | 84.9% |
| Crossed | 0.538 | 0.148 | 76.4% |
| Hues | 0.326 | 0.056 | 83.7% |

These numbers isolate AI choice CPU cost, not total frame time. Physical iPhone profiling, memory plateau, native haptics, and percentage frame/commit improvements remain unmeasured.

## Projectile visibility regression fix

The flight renderer now records `canvas.drawAtlas` directly into a shared Skia Picture each active frame. It no longer relies on the native declarative Atlas recorder observing in-place changes to three separate shared buffer arrays. This publishes the entire frame together and retains the single canvas, cached sprite texture, bounded decoration, outward paths and simulation-owned collision timing. New command data also triggers a frame when the clock has not advanced yet.

The renderer test executes the actual component with native drawing boundaries replaced by a recording canvas, checking non-zero handoff transforms, upward and downward travel, paused positions, impact particles, expired-cell clearing and one retirement notification. All 48 Egg Snap tests pass. Browser inspection confirms visible flight; native exports check bundling but do not substitute for physical-device verification.
