// Static Expo environment reads: changing these flags requires a new bundle.
// Developer-tool visibility is deliberately independent of instrumentation.
export const DIAGNOSTICS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_DIAGNOSTICS === '1';
export const MERGE_PERF_ENABLED = DIAGNOSTICS_ENABLED && process.env.EXPO_PUBLIC_MERGE_BOARD_PERF === '1';
export const SCENE_PERF_ENABLED = DIAGNOSTICS_ENABLED && process.env.EXPO_PUBLIC_SCENE_PERF === '1';
export const DECK_PERF_ENABLED = DIAGNOSTICS_ENABLED && process.env.EXPO_PUBLIC_DECK_PERF === '1';
export const TODAY_PERF_ENABLED = DIAGNOSTICS_ENABLED && process.env.EXPO_PUBLIC_TODAY_LOOP_PERF === '1';
export const CREATURE_PERF_ENABLED = DIAGNOSTICS_ENABLED && process.env.EXPO_PUBLIC_CREATURE_IDLE_PERF === '1';
export const SENTRY_TOUCH_TRACKING_ENABLED = DIAGNOSTICS_ENABLED
  && process.env.EXPO_PUBLIC_SENTRY_TOUCH_TRACKING === '1'
  && Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN?.trim());

export const diagnosticNoop = () => undefined;
