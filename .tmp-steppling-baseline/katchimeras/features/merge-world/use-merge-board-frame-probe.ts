import { createElement } from 'react';
import { runOnJS, useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { mergePerformanceSnapshot } from '@/utils/merge-world/performance';
import { lifecycleResourceSnapshot } from '@/utils/lifecycle-performance';

import { MERGE_PERF_ENABLED as MERGE_BOARD_PERF_ENABLED } from '@/constants/diagnostics';

type MergeBoardFrameSample = {
  frames: number;
  longestFrameMs: number;
  p95UpperBoundMs: number;
  slowFrameRatio: number;
  slowFrames: number;
};

function reportMergeBoardFrameSample(sample: MergeBoardFrameSample) {
  if (!MERGE_BOARD_PERF_ENABLED) return;
  console[sample.slowFrameRatio > 5 ? 'warn' : 'info']('[merge-board] animation-frames', {
    ...sample, work: mergePerformanceSnapshot(), resources: lifecycleResourceSnapshot(),
  });
}

/** Opt-in UI-frame sampling for warm board gestures, spawns, and merges. */
type ProbeProps = { active: boolean; dragPhase: SharedValue<number>; effectsActivity?: SharedValue<number> };
export function MergeBoardFrameProbe(props: ProbeProps) {
  return MERGE_BOARD_PERF_ENABLED ? createElement(EnabledMergeBoardFrameProbe, props) : null;
}
function EnabledMergeBoardFrameProbe({ active, dragPhase, effectsActivity }: ProbeProps) {
  const wasActive = useSharedValue(0);
  const frames = useSharedValue(0);
  const slowFrames = useSharedValue(0);
  const longestFrameMs = useSharedValue(0);
  const bucket12 = useSharedValue(0);
  const bucket17 = useSharedValue(0);
  const bucket20 = useSharedValue(0);
  const bucket25 = useSharedValue(0);
  const bucket34 = useSharedValue(0);
  const bucket50 = useSharedValue(0);
  const bucketOver50 = useSharedValue(0);

  useFrameCallback((frame) => {
    if (!MERGE_BOARD_PERF_ENABLED) return;
    const sampling = active || dragPhase.value !== 0 || (effectsActivity?.value ?? 0) !== 0;
    if (sampling) {
      if (wasActive.value === 0) {
        wasActive.value = 1;
        frames.value = 0;
        slowFrames.value = 0;
        longestFrameMs.value = 0;
        bucket12.value = 0;
        bucket17.value = 0;
        bucket20.value = 0;
        bucket25.value = 0;
        bucket34.value = 0;
        bucket50.value = 0;
        bucketOver50.value = 0;
      }
      const frameMs = frame.timeSincePreviousFrame ?? 0;
      frames.value += 1;
      if (frameMs > 20) slowFrames.value += 1;
      if (frameMs > longestFrameMs.value) longestFrameMs.value = frameMs;
      if (frameMs <= 12) bucket12.value += 1;
      else if (frameMs <= 16.7) bucket17.value += 1;
      else if (frameMs <= 20) bucket20.value += 1;
      else if (frameMs <= 25) bucket25.value += 1;
      else if (frameMs <= 33.4) bucket34.value += 1;
      else if (frameMs <= 50) bucket50.value += 1;
      else bucketOver50.value += 1;
      return;
    }
    if (wasActive.value === 0) return;
    wasActive.value = 0;
    const target = Math.max(1, Math.ceil(frames.value * 0.95));
    const counts = [bucket12.value, bucket17.value, bucket20.value, bucket25.value, bucket34.value, bucket50.value, bucketOver50.value];
    const bounds = [12, 16.7, 20, 25, 33.4, 50, 51];
    let cumulative = 0;
    let p95UpperBoundMs = 51;
    for (let index = 0; index < counts.length; index += 1) {
      cumulative += counts[index] ?? 0;
      if (cumulative < target) continue;
      p95UpperBoundMs = bounds[index] ?? 51;
      break;
    }
    runOnJS(reportMergeBoardFrameSample)({
      frames: frames.value,
      longestFrameMs: Math.round(longestFrameMs.value * 10) / 10,
      p95UpperBoundMs,
      slowFrameRatio: frames.value ? Math.round((slowFrames.value / frames.value) * 1000) / 10 : 0,
      slowFrames: slowFrames.value,
    });
  }, MERGE_BOARD_PERF_ENABLED);
  return null;
}
