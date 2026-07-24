import {
  runOnJS,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

export const SCENE_PERF_ENABLED = __DEV__ && process.env.EXPO_PUBLIC_SCENE_PERF === '1';

type SceneFrameSample = {
  droppedFrames: number;
  durationMs: number;
  longestFrameMs: number;
};

function reportSceneFrameSample(label: string, sample: SceneFrameSample) {
  if (!SCENE_PERF_ENABLED) return;
  const level = sample.droppedFrames > 0 ? 'warn' : 'info';
  console[level](`[scene-perf] ${label}`, sample);
}

/**
 * Development-only UI-thread frame probe. Enable with
 * EXPO_PUBLIC_SCENE_PERF=1; production builds keep the callback inactive.
 */
export function useScenePerformanceProbe(label: string, transitionActive: SharedValue<number>) {
  const wasActive = useSharedValue(0);
  const startedAt = useSharedValue(0);
  const droppedFrames = useSharedValue(0);
  const longestFrameMs = useSharedValue(0);

  useFrameCallback((frame) => {
    if (!SCENE_PERF_ENABLED) return;
    if (transitionActive.value === 1) {
      if (wasActive.value === 0) {
        wasActive.value = 1;
        startedAt.value = frame.timestamp;
        droppedFrames.value = 0;
        longestFrameMs.value = 0;
      }
      const frameMs = frame.timeSincePreviousFrame ?? 0;
      if (frameMs > 20) droppedFrames.value += 1;
      if (frameMs > longestFrameMs.value) longestFrameMs.value = frameMs;
      return;
    }
    if (wasActive.value === 0) return;
    wasActive.value = 0;
    runOnJS(reportSceneFrameSample)(label, {
      droppedFrames: droppedFrames.value,
      durationMs: Math.max(0, frame.timestamp - startedAt.value),
      longestFrameMs: longestFrameMs.value,
    });
  }, SCENE_PERF_ENABLED);
}
