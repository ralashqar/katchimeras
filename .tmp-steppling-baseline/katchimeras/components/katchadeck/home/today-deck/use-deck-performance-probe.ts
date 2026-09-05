import { createElement } from 'react';
import { useFrameCallback, useSharedValue, type SharedValue, runOnJS } from 'react-native-reanimated';

import { DECK_PERF_ENABLED } from '@/constants/diagnostics';
export { DECK_PERF_ENABLED } from '@/constants/diagnostics';

type DeckFrameSample = {
  droppedFrames: number;
  longestFrameMs: number;
  durationMs: number;
};

function reportDeckFrameSample(sample: DeckFrameSample) {
  if (!DECK_PERF_ENABLED) return;
  const level = sample.droppedFrames > 0 ? 'warn' : 'info';
  console[level]('[today-deck] transition', sample);
}

type ProbeProps = { transitionActive: SharedValue<number> };
export function DeckPerformanceProbe(props: ProbeProps) {
  return DECK_PERF_ENABLED ? createElement(EnabledDeckPerformanceProbe, props) : null;
}
function EnabledDeckPerformanceProbe({ transitionActive }: ProbeProps) {
  const wasActive = useSharedValue(0);
  const startedAt = useSharedValue(0);
  const droppedFrames = useSharedValue(0);
  const longestFrameMs = useSharedValue(0);

  useFrameCallback((frame) => {
    if (!DECK_PERF_ENABLED) return;
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
    runOnJS(reportDeckFrameSample)({
      droppedFrames: droppedFrames.value,
      durationMs: Math.max(0, frame.timestamp - startedAt.value),
      longestFrameMs: longestFrameMs.value,
    });
  }, DECK_PERF_ENABLED);
  return null;
}
