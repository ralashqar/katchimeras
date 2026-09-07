/** Explicit opt-in for profiling a preview binary; ordinary production builds omit the arena. */
export const ARENA_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_EGG_PERF === '1';
