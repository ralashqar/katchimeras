import { createElement } from 'react';
import { useFrameCallback, useSharedValue, runOnJS } from 'react-native-reanimated';
import { TODAY_PERF_ENABLED } from '@/constants/diagnostics';

import { todayEnergyPerformanceEnabled } from '@/utils/today-energy-loop-performance';

type FrameSample = {
  frames: number;
  slowFrames: number;
  longestFrameMs: number;
};

function reportFrameSample(sample: FrameSample) {
  if (!todayEnergyPerformanceEnabled()) return;
  const slowFrameRatio = sample.frames > 0 ? sample.slowFrames / sample.frames : 0;
  console[slowFrameRatio > 0.05 ? 'warn' : 'info']('[today-energy-loop] animation-frames', {
    ...sample,
    slowFrameRatio: Math.round(slowFrameRatio * 1000) / 10,
  });
}

export function TodayEnergyFrameProbe(props: { active: boolean }) {
  return TODAY_PERF_ENABLED ? createElement(EnabledTodayEnergyFrameProbe, props) : null;
}
function EnabledTodayEnergyFrameProbe({ active }: { active: boolean }) {
  const wasActive = useSharedValue(0);
  const frames = useSharedValue(0);
  const slowFrames = useSharedValue(0);
  const longestFrameMs = useSharedValue(0);

  useFrameCallback((frame) => {
    if (!TODAY_PERF_ENABLED) return;
    if (active) {
      if (wasActive.value === 0) {
        wasActive.value = 1;
        frames.value = 0;
        slowFrames.value = 0;
        longestFrameMs.value = 0;
      }
      const frameMs = frame.timeSincePreviousFrame ?? 0;
      frames.value += 1;
      if (frameMs > 20) slowFrames.value += 1;
      if (frameMs > longestFrameMs.value) longestFrameMs.value = frameMs;
      return;
    }
    if (wasActive.value === 0) return;
    wasActive.value = 0;
    runOnJS(reportFrameSample)({
      frames: frames.value,
      slowFrames: slowFrames.value,
      longestFrameMs: Math.round(longestFrameMs.value * 10) / 10,
    });
  }, TODAY_PERF_ENABLED);
  return null;
}
