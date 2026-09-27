# Battle performance implementation

Full first, Lost Trail, rescue, island, Grove, frontier and daily encounters now run on `/battle`. The existing curtain covers preparation and return. The world route retains its camera/session shell, but its renderer and controllers unmount when the battle takes focus. Short merge lessons, restoration boards and egg reveals remain in the world.

Battle entry waits for the world camera to settle before starting the curtain. It captures the selected tile's final screen frame, including camera zoom, focus scale, and canvas offset, and saves that frame with the battle session. The dedicated page draws the static tile at those same coordinates above the shared bottom-docked merge board instead of fitting it into a separate image box. Pending captures are discarded if the camera starts moving again, the encounter changes, or the world loses focus. Older sessions without a captured frame use the authored mission zoom and focus anchor.

Framing validation: 11 targeted framing, tile, route and session tests passed, along with TypeScript. Tests cover camera projection, saved-frame rendering, interrupted capture, and retaining loaded tile images. Physical-device visual alignment still needs an iPhone check; mocked native measurements do not establish it.

An iPhone development-build hard crash was reported on the first merge. The new Skia/Reanimated effects renderer is now **disabled by default**, including in development. The default provider does not load its module or mount its native hooks; consumers use their existing native-view effects. The new frame probe is also separately opt-in. The exact native crash cause still requires a device stack; passing JS tests or bundle export did not establish native stability.

The user confirmed that combat works on their iPhone development build after this fallback. The provider-loading fix and native-renderer isolation have regression coverage; physical frame-rate and memory targets remain unmeasured.

## Runtime changes

| Area | Change | Practical limit |
| --- | --- | --- |
| Scene ownership | Battle owns its mission hook, board, wisps and effects. The persisted session describes the source, loadout, world bonuses and return result. | The global app providers still exist. Verify their background workers on devices. |
| Readiness | Curtain waits for board layout/art readiness, dock entrance, background, enemy preload and effects atlas. Simulation and input wait for readiness and foreground focus. | Asset failure uses the curtain's recoverable return flow. No timer declares the battle artwork ready. |
| Automatic shots | Default: 16 reusable native bullet slots and eight reusable lightning slots. Overflow retains logical hit timing without mounting more effect trees. Combat retains allocated Glow slots through idle gaps; they stop animating and release after combat. Experimental opt-in: one Skia canvas with 64 effect slots. | Visual caps can omit excess shots, never hits. The experimental renderer remains quarantined pending iPhone crash investigation. |
| Enemy views | Only living enemies and a one-second death tail mount. Mid-battle arrivals retain their entrance. Hover/embers stop when inactive; drift interpolation reads shared coordinates on the UI thread. | Health/intent labels remain native accessible UI. |
| Textures | Existing bullet plus impact sprites packed into a 256×128 atlas. Dark wisps have 128/256 tiers, selected by displayed size and density, with original artwork retained for larger sizes. Only this encounter's textures are pinned. | Atlas decoded RGBA is about 128 KiB; 128/256 enemy tiers are about 64/256 KiB each, versus 1 MiB for a 512 image. Decoder/GPU overhead is additional. |
| Persistence | Latest snapshots coalesce behind a fixed 150 ms deadline, using asynchronous SQLite writes and one writer per key. Explicit barriers include quiet ticks. | JSON serialization still runs on JS. Abrupt process termination before a write completes can lose the most recent unsaved change. |
| Lifecycle | Background, scene exit and completion flush saves. Clears/resets serialize tombstones after in-flight writes. Retry attempts retain their existing run identity. Held-Mist and finale timers clean up on unmount. | OS termination does not promise time to finish background writes. |
| World fallback | Settled solo mode unmounts projected memory plants instead of leaving them transparent. Legacy full battles remain available via the rollback flag. | Embedded lesson/reward Glow effects still use the existing native pools. |

The battle result is stored before returning. The world applies its existing receipt-based rewards and reveals. A failed scripted reward write leaves the return retryable. Pressing Back after the final hit preserves victory. Saves, run IDs, targeting, damage and encounter rules retain their existing formats and calculations.

### Native effects follow-up

The native path now reuses lightning views instead of mounting a tree per strike. Seven lightning segments keep static geometry and animate opacity; they no longer recalculate zigzag geometry or update `left`, `top`, and `width` every frame. Lightning motes reduce from eight to four, and wisp strike shards from ten to six. Bullets retain their existing transform animations. No new native dependency, Skia mount, UI frame callback, or shared array of effect events is introduced.

Lightning logical impact/retirement uses one JS deadline timer per layer, including effects omitted by the visual cap. Overflow bullets use one deadline timer per Glow store; simultaneous overflow landings batch their store notifications. Visible bullet timing remains on its existing animation completion path. Cancellation, teardown, and duplicate arrivals are covered by tests. Non-combat reward-token overflow keeps its existing behavior.

Regression tests exercise 40-shot volleys with 16 bullet views and all 40 hits, 40 lightning strikes with eight visual slots, native-view identity across idle gaps, stopped idle animation clocks, Reduced Motion impact timing, cancellation before impact, and disposal before outstanding callbacks. These are React/native-mock tests, not proof of physical-device crash safety or a measured FPS gain. The iPhone development build still needs a rapid-merge, busy-wave, and enter/leave check with this follow-up.

Follow-up validation on 2026-09-27: 79 targeted tests passed and TypeScript passed. Focused lint had no errors (two existing unused-import warnings in `opening-mist-flow.test.ts`). The iOS Expo/Hermes export completed to the ignored `dist/native-effects-ios-check` directory. Logs are in `dist/battle-validation/native-effects-tests.log` and `dist/battle-validation/native-effects-ios-export.log`.

## Profiling and rollout

### Phone capture and lean lane wisps

Lane combat now defaults to a pooled lean renderer: one animated root and one enemy image per slot, with HP/shield badges. It removes ambient hover/pulse/ember loops and temporary arrival/death particle trees; finite fades, drift and hit reactions remain. Slots are reused across waves and grow to the actual peak population, never discarding enemies. Other wisp placement modes retain their existing presentation. `EXPO_PUBLIC_RICH_COMBAT_WISPS=1` restores detailed lane wisps; the diagnostic panel can also switch between them for comparison.

Lane shield presentation now computes active shield columns once instead of checking every enemy against every other enemy. Board geometry is calculated per column instead of twice per enemy, the HUD's remaining count no longer builds a complete visual description, and live wisp targets retain identity across board commits while their subscription delivers state changes.

The local phone capture uses `EXPO_PUBLIC_ENABLE_DIAGNOSTICS=1` and `EXPO_PUBLIC_COMBAT_PROFILE=1`. Keep `EXPO_PUBLIC_MERGE_BOARD_PERF=0`, `EXPO_PUBLIC_BATTLE_FRAME_PROBE=0`, and `EXPO_PUBLIC_SKIA_COMBAT_EFFECTS=0`: the capture deliberately does not enable the old Reanimated frame probes. No new native package is required. Restart Metro and reload the iPhone development app after changing these bundle-time variables.

In combat, tap **Record 15s**, make the merges that hitch, wait for recording to finish, then **Share report**. Repeat after selecting **Try detailed wisps**. Capture idle firing separately. Each recording clears prior samples, records one report rather than logging every frame, and shares nothing until the share button is pressed. A background/scene exit ends the capture early; the latest report is retained in memory.

Report fields:

- `board.onCommand`, `battle.command.reduce`, `battle.command.settle`, `battle.snapshot`: synchronous input/gameplay/save-preparation work.
- `storage.serialize`: synchronous JSON cost, separated from asynchronous `battle.save` latency.
- `react.world-host` or `react.battle-host`, `react.world-map`, `react.board`, `react.wisps`, `react.effects`: React render durations. Parent durations include their children; do not add them together or subtract independently sampled percentiles. These do not measure native layout/GPU work.
- `renderCalls`: render attempts and explicitly named lane-slot mount/unmount counters. These are not per-frame counts.
- `jsHeartbeat`: delays beyond a 50 ms JS timer, with no per-frame React state or Reanimated callback. This is JS responsiveness, **not UI FPS**. Each timing label retains its most recent 200 samples.

### First iPhone capture: merge hitches (2026-09-27)

The supplied embedded-combat development capture lasted 15,085 ms with lean wisps: worst JS delay 225 ms, 20 delays over 50 ms. React p95: world host 38.82 ms, board 19.34 ms, wisps 2.43 ms, effects 0.49 ms. Simulation p95 was 0.13 ms and synchronous command dispatch 2.21 ms. The 147.97 ms save measurement is asynchronous latency; serialization was 0.27 ms. The world-host count of 200 hit the retained-sample cap and is not the total number of commits. Four wisp-slot mounts give no evidence of per-frame enemy remounting.

This prioritizes React render work, while leaving native CPU/GPU cost unmeasured. Follow-up changes:

- Stabilize the map's building/lantern decorations, built-slot arrays, filtered offers and inline callbacks. Previously these defeated `KingdomHexCanvas` memoization on mission updates even when the map had not changed. Actual map/affordability/interaction changes still invalidate their inputs.
- Memoize the board selection highlight and remove its render-time `dragPhase.value` read. Initialize its visibility inside the existing UI reaction instead. [Reanimated documents that reading shared values on JS waits for the UI thread](https://docs.swmansion.com/react-native-reanimated/docs/core/useSharedValue/); this is a possible hitch contributor, not a measured attribution of all board time.
- Preserve equivalent board interaction gates across parent updates, while publishing changed tutorial gates and command handlers.
- Skip the redundant full wisp-view construction when checking lane encounters for spores (only Dark Wisps produce them).
- Add separate `react.world-map` timing and `world-screen`, `world-map`, `board-cell`, `board-selection` render counters to distinguish parent execution, map work and board child updates.

No renderer or native frame probe is added. Fully reload the development app, keep lean wisps and embedded combat, and repeat the same warm 15-second merge sequence. Compare heartbeat stalls, board/world-map durations and render counters; then capture idle firing separately. Native iPhone speed and crash stability still require that device run. There is no measured percentage gain from these follow-up changes yet.

Follow-up validation: 99 targeted tests passed, including selection drag/release behavior without render-time shared-value reads and skipped board renders for equivalent gates (changed gates/handlers still propagate). TypeScript and iOS Expo/Hermes export passed. Lint reported no errors and existing warnings in the large world/mission components. Logs: `dist/battle-validation/render-targeted.log`, `render-ios-export.log`.

### Second iPhone capture: sprite and impact setup (2026-09-27)

The next 15,030 ms capture still had a 221 ms worst JS delay and 18 stalls over 50 ms. Map React work was negligible (`react.world-map` p95 0.0085 ms, no `world-map` render calls), while board p95 was 32.77 ms and the flight/impact layer p95 was 35.52 ms, maximum 98.24 ms. Commands were 0.40 ms p95. This supports keeping embedded combat while addressing sprite/effect work; it does not measure the background map's native/GPU cost. Different command counts and sampled percentiles prevent a controlled overall speedup claim. The user reports hitches both immediately after entry and after playing.

Important naming distinction: `effects-layer` / `effect-slot` counters describe **board decorations**, whereas the original `react.effects` boundary measures **world-space flights and impacts**. Do not correlate those counters as though they measured the same subtree.

Presentation version 3:

- Board sprites now keep stable render slots across item identities. Previously each merge-result instance mounted a new sprite with its own shared values, derived values and animated views. Retired slots remain hidden at the board's peak simultaneous sprite count; active sprites and consumed pieces still finishing their motion are never dropped. Slots stop motion and recoil subscriptions when retired and are released with the board. This trades retained peak view memory for less allocation during play.
- Full wisp impact particles are restored by default after phone testing did not show a clear benefit from simplifying them. The pooled cloud, core, halo, ring and six shards remain available; `EXPO_PUBLIC_RICH_COMBAT_IMPACTS=0` opts into the two-view compact experiment for comparison. Hit, damage and retirement clocks stay unchanged. No Skia or frame callbacks are added.
- Separate React boundaries now measure `board-sprites`, `board-effects`, `projectiles` and `impacts`. Counters include `sprite-mount`, `sprite-unmount`, `projectile-slot-mount`, `impact-slot-mount` and their render counts. Reports identify `presentationVersion: 3` and `impacts: compact`.

After a full reload, capture a warm 15-second rapid-merge segment. Sprite mounts should stop growing once the pool reaches the segment's peak occupancy; the new boundaries distinguish repeated render/setup work from new pool capacity. Compare heartbeat stalls as well as timings. Native device performance and crash stability remain to be verified on the phone.

Regression coverage includes 100 replacement allocations without growth, live merge ghosts, gameplay overflow, real sprite component/native-view identity reuse, interrupted completion callbacks, same-token hide/reveal, recoil unsubscribe, and idle animation cleanup. Projectile tests verify all 40 hits (including visual overflow) land exactly once and six rich impact slots retain their particles with no idle animation clocks.

Validation: 101 targeted cases passed across the suite and focused rerun (the profile test harness needed a `process.env` mock for the new report field). TypeScript, focused lint and iOS Expo/Hermes export passed. The component tests use mocked native views/animation clocks, not a physical iPhone. Logs: `dist/battle-validation/pool-targeted.log`, `pool-regressions.log`, `pool-ios-export.log`.

For native/JS FPS, shake the iPhone and enable **Perf Monitor** in the development menu. For a full JS/component profile, open React Native DevTools from Metro (`j`) or the development menu and record the **Profiler** while reproducing merges. This project uses RN 0.81.5; newer DevTools Performance-panel features may not be available. Use Instruments on a Mac for native main-thread/GPU attribution. Repeat final acceptance on a preview/release build because development checks add substantial overhead. See [React Native debugging](https://reactnative.dev/docs/debugging) and [DevTools](https://reactnative.dev/docs/react-native-devtools).

No shared canvas was added. View pooling reduces native allocations but does not turn separate images into a GPU atlas draw. A different drawing backend should follow a device trace that identifies native drawing as the bottleneck.

Phone-profile follow-up validation: 97 targeted tests passed, TypeScript passed, and the iOS Expo/Hermes export passed (`dist/phone-profile-ios-check`). Focused lint passed; the wider hook check retains three existing dependency warnings in `use-mist-mission.ts`. Runtime tests cover 20 waves reusing the same native slots, no enemy omission at larger populations, stopped inactive animations, live-target identity, shield-rule equivalence, and capture/share behavior. `corruption-wisps.test.ts` also contains an older source-text assertion expecting removed `trail2`/`trail3` wiring; it fails separately and is not counted in the 97 passing tests. Phone timings/FPS have not yet been collected.

`EXPO_PUBLIC_BATTLE_SCENE=0` restores the embedded encounter path. The default is enabled. These are bundle-time Expo variables, so rebuild/rebundle after changing them.

### Embedded-layout comparison

The current local trial uses `EXPO_PUBLIC_BATTLE_SCENE=1`: the curtain opens onto the dedicated battle page with the active hex tile above the board. The session stores the world tile's symbolic appearance (mist, level and upgrade state), excluding memory plants, so resumed sessions resolve current bundled assets instead of persisting Metro image IDs. The page resolves art once, mounts only the selected tile and its optional overlay, and waits for them before releasing readiness. Old sessions without tile appearance data use the encounter's target and its default state. The world camera and neighboring tiles are not mounted in the battle page; particle impacts and the four-finger developer menu remain available.

Set `EXPO_PUBLIC_BATTLE_SCENE=0` in the app's ignored `.env.local` to try combat over the world map. Set it to `1` to restore the dedicated scene. Restart Metro and fully reload the development app after changing it. Switch between battles, after collecting the result and returning to the world; this flag is not a mid-battle session migration. Dedicated results remain saved, but embedded reward handlers ignore them and use the current embedded mission's outcome.

There is no measured percentage gain attributable to either layout yet. Both paths keep quieter board updates, coalesced asynchronous saves, shared-board subscription isolation, live/death-tail wisp mounting, stopped inactive animations, and smaller wisp textures. Embedded solo mode already removes other tiles and projected memory plants once its fade settles. The dedicated route additionally unmounts the world renderer/controllers and prepares encounter textures behind its curtain. Its incremental steady-state benefit therefore needs measurement; entry improvements should be compared separately.

For the comparison, keep the device, encounter/loadout, Reduced Motion setting, build type, and effects flags identical. Leave Skia effects and the experimental Reanimated frame probe disabled in both modes for the iPhone stability trial. Use native profiling for frame timing and memory. Repeat a warm 30-second idle-fire segment and a 30-second rapid-merge segment in each layout, reversing the order on the next run to reduce thermal bias. Record p95 frame time, frames over 20 ms, peak memory, and entry latency. Attribute only the difference between these two optimized layouts to scene isolation; measuring the board improvements separately requires a pre-optimization baseline.

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

## Metro gameplay testing

Run `npm run start:dev-client` from the repository root or app workspace to serve minified production-mode JavaScript to the existing Katchimeras development client. The launcher pins the app workspace, passes `--dev-client --no-dev --minify`, and overrides `EXPO_PUBLIC_ENABLE_DIAGNOSTICS` and `EXPO_PUBLIC_COMBAT_PROFILE` to `0` for that process. It preserves the other environment settings and native libraries.

The launcher sets `EXPO_PUBLIC_ENABLE_DEV_TOOLS=true`, matching the preview build, to keep the four-finger in-app Developer Tools menu available even though `__DEV__` is false. This flag is independent of diagnostic tracking and does not turn on the performance collectors or React development checks.

Metro's cache version includes a hash of the public environment variables because production transforms inline their values. Switching battle/dev-tool flags therefore selects a fresh cache on restart, including when previous export runs used different settings. The root four-finger handler listens to touch starts as well as responder capture, with the same cooldown, so existing child responders do not have to relinquish the gesture for the recovery route to open. After changing startup flags, reopen the app through the current development-client link; production-mode Metro does not Fast Refresh an already-running app.

The launcher checks its requested port (8081 by default) before spawning Expo. If occupied, it prints a message and exits instead of offering a second server on another port. Stop the existing server before intentionally restarting with new flags.

The launcher also sets `EXPO_NO_METRO_LAZY=1` so dynamic-import dependencies are included in the initial bundle. Without it, this Expo version can combine `dev=false` with `lazy=true`; opening a lazy component then throws “Unable to determine the production URL” on native because the production chunk loader expects a browser `location`. React lazy components still work with their modules bundled locally. The first bundle can take longer to build/load.

Stop the previous Metro process first, then scan the new development-client QR code and fully reload/reopen the app. The terminal still says “Using development build”: that describes the native client, while its JavaScript bundle uses `dev=false`, `hot=false`, and `minify=true`, without `lazy=true`. No native rebuild is needed for an already-installed compatible development client. A preview-only installation cannot connect to Metro.

Use `npm run start:dev-client:debug` for normal development-mode checks, Fast Refresh, and the diagnostics configured in `.env.local`. The production-JS workflow reduces development overhead but retains the native development binary, so use preview/release builds for final performance comparisons. When forwarding additional flags in Windows PowerShell, use `npm.cmd`, for example `npm.cmd run start:dev-client -- --port 8082`, to avoid PowerShell's npm wrapper stripping flags.

Validation: started the launcher through the root npm workspace command and verified the custom-client `exp+katchimeras://expo-development-client/` link and an iOS manifest with `dev=false`, `hot=false`, and `minify=true`, without `lazy=true`. Fetched the resulting iOS bundle successfully (7,524 modules); confirmed it contains `KatchimeraKingdomScreen` and no emitted `.bundle?...modulesOnly=true` lazy chunk URLs. This verifies bundling, not physical-device execution or frame rate.

## Regression checks

Validated on 2026-09-27: 117 targeted tests passed; TypeScript passed; focused lint had no errors (three existing dependency warnings in `use-mist-mission.ts`); Android Expo/Hermes export passed. Validation logs are in the ignored local `dist/battle-validation` directory. This establishes code/bundle compatibility, not native frame-rate acceptance.

From `apps/katchimeras`:

```powershell
node --import tsx --test tests/combat-effects-fallback.test.tsx tests/merge-play-surface.test.tsx tests/battle-route.test.tsx tests/battle-session.test.ts tests/battle-persistence.test.ts tests/combat-effects-clock.test.ts tests/mission-board-owner.test.tsx tests/encounter-lanes.test.ts tests/lane-variety.test.ts tests/merge-performance.test.ts tests/native-transition-regressions.test.tsx
node --import tsx --test tests/effect-deadlines.test.ts tests/native-glow-pool.test.tsx
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
