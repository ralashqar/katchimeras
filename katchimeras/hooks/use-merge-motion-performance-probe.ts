import { runOnJS, useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';

const MERGE_PERF_ENABLED = __DEV__ && process.env.EXPO_PUBLIC_MERGE_PERF === '1';

function reportMergeMotionSample(sample: { durationMs: number; slowFrames: number; longestFrameMs: number }) {
  if (!MERGE_PERF_ENABLED) return;
  console[sample.longestFrameMs > 34 ? 'warn' : 'info']('[merge-motion]', sample);
}

/** UI-thread frame probe for drag settlement, swaps, merges, and generator launches. */
export function useMergeMotionPerformanceProbe(active: SharedValue<number>) {
  const wasActive = useSharedValue(0);
  const startedAt = useSharedValue(0);
  const slowFrames = useSharedValue(0);
  const longestFrameMs = useSharedValue(0);

  useFrameCallback((frame) => {
    if (!MERGE_PERF_ENABLED) return;
    if (active.value === 1) {
      if (wasActive.value === 0) {
        wasActive.value = 1;
        startedAt.value = frame.timestamp;
        slowFrames.value = 0;
        longestFrameMs.value = 0;
      }
      const frameMs = frame.timeSincePreviousFrame ?? 0;
      if (frameMs > 20) slowFrames.value += 1;
      if (frameMs > longestFrameMs.value) longestFrameMs.value = frameMs;
      return;
    }
    if (wasActive.value === 0) return;
    wasActive.value = 0;
    runOnJS(reportMergeMotionSample)({
      durationMs: Math.max(0, frame.timestamp - startedAt.value),
      slowFrames: slowFrames.value,
      longestFrameMs: longestFrameMs.value,
    });
  }, MERGE_PERF_ENABLED);
}
