import { createElement, useEffect, useRef } from 'react';
import {
  runOnJS,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { SCENE_PERF_ENABLED } from '@/constants/diagnostics';
export { SCENE_PERF_ENABLED } from '@/constants/diagnostics';

type SceneFrameSample = {
  droppedFrames: number;
  durationMs: number;
  imageMounts: number;
  imageSourceChanges: number;
  imageUnmounts: number;
  longestFrameMs: number;
  over20MsPercent: number;
  totalFrames: number;
};

type SceneImageCounters = Pick<SceneFrameSample, 'imageMounts' | 'imageSourceChanges' | 'imageUnmounts'>;

const sceneImageCounters = new Map<string, SceneImageCounters>();
const sceneSampleBaselines = new Map<string, SceneImageCounters>();

function countersFor(sceneKey: string): SceneImageCounters {
  const current = sceneImageCounters.get(sceneKey);
  if (current) return current;
  const created = { imageMounts: 0, imageSourceChanges: 0, imageUnmounts: 0 };
  sceneImageCounters.set(sceneKey, created);
  return created;
}

function beginSceneFrameSample(label: string, sceneKey: string) {
  sceneSampleBaselines.set(label, { ...countersFor(sceneKey) });
}

function reportSceneFrameSample(
  label: string,
  sceneKey: string,
  sample: Omit<SceneFrameSample, keyof SceneImageCounters | 'over20MsPercent'>,
) {
  if (!SCENE_PERF_ENABLED) return;
  const baseline = sceneSampleBaselines.get(label) ?? { imageMounts: 0, imageSourceChanges: 0, imageUnmounts: 0 };
  const current = countersFor(sceneKey);
  const over20MsPercent = sample.totalFrames > 0 ? (sample.droppedFrames / sample.totalFrames) * 100 : 0;
  const completed: SceneFrameSample = {
    ...sample,
    imageMounts: current.imageMounts - baseline.imageMounts,
    imageSourceChanges: current.imageSourceChanges - baseline.imageSourceChanges,
    imageUnmounts: current.imageUnmounts - baseline.imageUnmounts,
    over20MsPercent,
  };
  const level = sample.droppedFrames > 0 ? 'warn' : 'info';
  console[level](`[scene-perf] ${label}`, completed);
}

type ImageTraceProps = { sceneKey: string; sourceKey: string };
export function SceneImagePerformanceTrace(props: ImageTraceProps) {
  return SCENE_PERF_ENABLED ? createElement(EnabledSceneImagePerformanceTrace, props) : null;
}
function EnabledSceneImagePerformanceTrace({ sceneKey, sourceKey }: ImageTraceProps) {
  const previousSourceRef = useRef(sourceKey);

  useEffect(() => {
    if (!SCENE_PERF_ENABLED) return;
    countersFor(sceneKey).imageMounts += 1;
    return () => {
      countersFor(sceneKey).imageUnmounts += 1;
    };
  }, [sceneKey]);

  useEffect(() => {
    if (!SCENE_PERF_ENABLED) return;
    if (previousSourceRef.current !== sourceKey) {
      countersFor(sceneKey).imageSourceChanges += 1;
      previousSourceRef.current = sourceKey;
    }
  }, [sceneKey, sourceKey]);
  return null;
}

/**
 * Opt-in UI-thread sampling, mounted only in explicitly instrumented bundles.
 */
type SceneProbeProps = { label: string; transitionActive: SharedValue<number>; sceneKey?: string };
export function ScenePerformanceProbe(props: SceneProbeProps) {
  return SCENE_PERF_ENABLED ? createElement(EnabledScenePerformanceProbe, props) : null;
}
function EnabledScenePerformanceProbe({ label, transitionActive, sceneKey = label }: SceneProbeProps) {
  const wasActive = useSharedValue(0);
  const startedAt = useSharedValue(0);
  const droppedFrames = useSharedValue(0);
  const longestFrameMs = useSharedValue(0);
  const totalFrames = useSharedValue(0);

  useFrameCallback((frame) => {
    if (!SCENE_PERF_ENABLED) return;
    if (transitionActive.value === 1) {
      if (wasActive.value === 0) {
        wasActive.value = 1;
        startedAt.value = frame.timestamp;
        droppedFrames.value = 0;
        longestFrameMs.value = 0;
        totalFrames.value = 0;
        runOnJS(beginSceneFrameSample)(label, sceneKey);
      }
      const frameMs = frame.timeSincePreviousFrame ?? 0;
      totalFrames.value += 1;
      if (frameMs > 20) droppedFrames.value += 1;
      if (frameMs > longestFrameMs.value) longestFrameMs.value = frameMs;
      return;
    }
    if (wasActive.value === 0) return;
    wasActive.value = 0;
    runOnJS(reportSceneFrameSample)(label, sceneKey, {
      droppedFrames: droppedFrames.value,
      durationMs: Math.max(0, frame.timestamp - startedAt.value),
      longestFrameMs: longestFrameMs.value,
      totalFrames: totalFrames.value,
    });
  }, SCENE_PERF_ENABLED);
  return null;
}
