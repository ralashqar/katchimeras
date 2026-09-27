# Battle performance implementation

Full first, Lost Trail, rescue, island, Grove, frontier and daily encounters now run on `/battle`. The existing curtain covers preparation and return. The world route retains its camera/session shell, but its renderer and controllers unmount when the battle takes focus. Short merge lessons, restoration boards and egg reveals remain in the world.

An iPhone development-build hard crash was reported on the first merge. The new Skia/Reanimated effects renderer is now **disabled by default**, including in development. The default provider does not load its module or mount its native hooks; consumers use their existing native-view effects. The new frame probe is also separately opt-in. The exact native crash cause still requires a device stack; passing JS tests or bundle export did not establish native stability.

The user confirmed that combat works on their iPhone development build after this fallback. The provider-loading fix and native-renderer isolation have regression coverage; physical frame-rate and memory targets remain unmeasured.

## Runtime changes

| Area | Change | Practical limit |
| --- | --- | --- |
| Scene ownership | Battle owns its mission hook, board, wisps and effects. The persisted session describes the source, loadout, world bonuses and return result. | The global app providers still exist. Verify their background workers on devices. |
| Readiness | Curtain waits for board layout/art readiness, dock entrance, background, enemy preload and effects atlas. Simulation and input wait for readiness and foreground focus. | Asset failure uses the curtain's recoverable return flow. No timer declares the battle artwork ready. |
| Automatic shots | Default: existing native-view shot/lightning effects. Experimental opt-in: one Skia canvas with 64 effect slots, six atlas sprites per slot, and two reusable lightning paths. | Experimental renderer is quarantined pending iPhone crash investigation. More than 64 simultaneous experimental effects can omit visuals; arrivals still run. |
| Enemy views | Only living enemies and a one-second death tail mount. Mid-battle arrivals retain their entrance. Hover/embers stop when inactive; drift interpolation reads shared coordinates on the UI thread. | Health/intent labels remain native accessible UI. |
| Textures | Existing bullet plus impact sprites packed into a 256×128 atlas. Dark wisps have 128/256 tiers, selected by displayed size and density, with original artwork retained for larger sizes. Only this encounter's textures are pinned. | Atlas decoded RGBA is about 128 KiB; 128/256 enemy tiers are about 64/256 KiB each, versus 1 MiB for a 512 image. Decoder/GPU overhead is additional. |
| Persistence | Latest snapshots coalesce behind a fixed 150 ms deadline, using asynchronous SQLite writes and one writer per key. Explicit barriers include quiet ticks. | JSON serialization still runs on JS. Abrupt process termination before a write completes can lose the most recent unsaved change. |
| Lifecycle | Background, scene exit and completion flush saves. Clears/resets serialize tombstones after in-flight writes. Retry attempts retain their existing run identity. Held-Mist and finale timers clean up on unmount. | OS termination does not promise time to finish background writes. |
| World fallback | Settled solo mode unmounts projected memory plants instead of leaving them transparent. Legacy full battles remain available via the rollback flag. | Embedded lesson/reward Glow effects still use the existing native pools. |

The battle result is stored before returning. The world applies its existing receipt-based rewards and reveals. A failed scripted reward write leaves the return retryable. Pressing Back after the final hit preserves victory. Saves, run IDs, targeting, damage and encounter rules retain their existing formats and calculations.

## Profiling and rollout

`EXPO_PUBLIC_BATTLE_SCENE=0` restores the embedded encounter path. The default is enabled. These are bundle-time Expo variables, so rebuild/rebundle after changing them.

The Skia renderer requires **both** `EXPO_PUBLIC_ENABLE_DIAGNOSTICS=1` and `EXPO_PUBLIC_SKIA_COMBAT_EFFECTS=1`. Leave the latter unset for ordinary play. No native-library change is needed to use the fallback; fully restart the development app with the updated JS bundle to discard old Fast Refresh animation state.

For a diagnostic build:

```powershell
$env:EXPO_PUBLIC_ENABLE_DIAGNOSTICS='1'
$env:EXPO_PUBLIC_SCENE_PERF='1'
$env:EXPO_PUBLIC_MERGE_BOARD_PERF='1'
$env:EXPO_PUBLIC_BATTLE_FRAME_PROBE='1'
```

`[battle-perf]` reports five-second UI-frame windows, percent over 20 ms, histogram p95 upper bound, maximum frame time, lifecycle resources and merge-work samples. `battle.tick` measures simulation CPU time; `battle.save` measures total asynchronous save latency, not JS blocking time. Use a native profiler to distinguish JS, layout, GPU and storage cost.

With the experimental frame probe enabled, decorative quality reduces after a window exceeds 10% slow frames. It restores after three consecutive windows below 2%. This changes motes/embers only; simulation, damage and rewards stay the same. Ordinary builds retain standard quality and the existing Reduced Motion behavior.

On an older supported iPhone and a representative midrange Android, use release/preview builds and record:

1. Cold entry and warm entry into the first battle, a dense multi-wave encounter, a boss, and a rescue. Confirm the curtain never reveals missing art.
2. Thirty seconds idle while shooters fire, then thirty seconds of rapid merges, dragging, generator taps and abilities. Include more than sixteen overlapping projectiles.
3. Background/resume while shots are in flight, then Retry, Keep Going, leave/resume, win, and relaunch before/after the return receipt.
4. Thirty world → battle → world cycles. World canvas/board/animation resources should return to their prior counts, with no accumulating timers or retained enemy textures. Inspect native memory as well as JS heap.
5. Repeat with Reduced Motion and with the rollback flag. Verify gameplay and rewards agree.

Warm-play acceptance: p95 frame time ≤20 ms and fewer than 5% of frames over 20 ms, aiming for 60 fps. Measure entry separately so texture decoding is visible rather than hidden inside a long average. Physical-device FPS, GPU timing, thermal behavior and the thirty-cycle memory result have **not** been established by automated Node tests or bundle export.

If profiling still points to simulation, use `battle.tick` samples before adding spatial indexes or changing tick frequency. If serialization dominates, split the saved snapshot or move serialization to a worker; do not weaken reward barriers. If GPU fill dominates, reduce decorative overlap and background resolution before changing gameplay art.

## Regression checks

Validated on 2026-09-27: 117 targeted tests passed; TypeScript passed; focused lint had no errors (three existing dependency warnings in `use-mist-mission.ts`); Android Expo/Hermes export passed. Validation logs are in the ignored local `dist/battle-validation` directory. This establishes code/bundle compatibility, not native frame-rate acceptance.

From `apps/katchimeras`:

```powershell
node --import tsx --test tests/combat-effects-fallback.test.tsx tests/merge-play-surface.test.tsx tests/battle-route.test.tsx tests/battle-session.test.ts tests/battle-persistence.test.ts tests/combat-effects-clock.test.ts tests/mission-board-owner.test.tsx tests/encounter-lanes.test.ts tests/lane-variety.test.ts tests/merge-performance.test.ts tests/native-transition-regressions.test.tsx
npx tsc --noEmit
npx expo export --platform android --output-dir dist/battle-perf-check --max-workers 2
```

Tests cover readiness/foreground gating, save-before-return, final-hit Back behavior, descriptor reload/reset, matching retry identity, fixed save deadlines, write failures, in-flight clears/resets, owner isolation, overflow arrivals and the existing lane rules.

The play-surface regression also triggers native board layout before asserting that an independent combat board renders without a world provider. It checks that a null mission board stays empty and that ordinary world boards still subscribe correctly. The route-only test mocks the dock and cannot catch a provider dependency inside that shared surface.

Regenerate committed artwork from the repository root:

```powershell
python tooling/art-pipeline/scripts/build-combat-effects-atlas.py
python tooling/art-pipeline/scripts/build-combat-wisp-lods.py
```

Two existing source-text assertions need separate maintenance: `kingdom-rendering.test.ts` expects `interactionEnabled` to start with the resident guard (the current source first checks the Lantern), and `veiled-mist.test.ts` expects the older per-cell scheduling expression. Both expressions already differ in the baseline checkout; neither failure demonstrates a change to battle behavior.
