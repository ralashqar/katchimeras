# Optional diagnostic tracking

Normal development, preview, and production bundles do not collect optional
performance diagnostics. Developer-tool visibility (`EXPO_PUBLIC_ENABLE_DEV_TOOLS`)
does not enable tracking. Saved content-flow journals and crash capture are unchanged.

To investigate, set `EXPO_PUBLIC_ENABLE_DIAGNOSTICS=1` and only the needed category:

- `EXPO_PUBLIC_MERGE_BOARD_PERF=1`: merge render/work and frame samples.
- `EXPO_PUBLIC_SCENE_PERF=1`: scene/frame/image, readiness timing and lifecycle audits.
- `EXPO_PUBLIC_DECK_PERF=1`: deck frame/React summaries.
- `EXPO_PUBLIC_TODAY_LOOP_PERF=1`: action-loop timing, React summaries and persistence timing.
- `EXPO_PUBLIC_CREATURE_IDLE_PERF=1`: creature playback diagnostics.
- `EXPO_PUBLIC_SENTRY_TOUCH_TRACKING=1`: root touch instrumentation, also requiring a configured Sentry DSN.

The master flag alone enables in-memory story history, informational navigation
logs, and the visible Atmosphere Lab FPS display. Histories are transient and bounded.
Flags are static Expo bundle values: restart Metro/rebundle after changing them;
an already installed embedded/update bundle does not change retroactively.

The Content Flow Inspector reads its functional journal only while focused and
foregrounded. Notifications coalesce into one read plus one pending refresh;
results from a previous visibility session are discarded. FPS loops stop on blur,
background, and unmount. The inspector still works with diagnostic history off.

## Verification

Run `npm run test:diagnostics`, plus merge-performance, lifecycle, Today energy and
native-transition regressions. Tests of enabled collectors opt in explicitly;
default-off tests isolate configuration and assert no diagnostic hook allocation,
timers or metric notifications.

On an iPhone, compare the same saved board, order count, and rapid spawn/merge
sequence with diagnostics off, first in development and then the existing preview
profile (`npm run build:ios:preview`). Repeat after visiting the inspector/lab and
30 background/resume cycles. Capture frame timings in a separate explicitly
instrumented pass so sampling overhead is not confused with baseline behavior.
Also verify Sentry captures a controlled test error with touch tracking disabled.
Physical-device frame timings and crash delivery cannot be verified by unit tests.

React Native/Worklets development checks remain enabled. A release-mode preview
is the performance baseline; this change does not promise release speed in Metro
development mode. No framework validation or gameplay persistence is removed.
