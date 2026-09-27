import { useEffect, useSyncExternalStore } from 'react';
import { runOnJS, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { SCENE_PERF_ENABLED } from '@/constants/diagnostics';
import { acquireLifecycleResource, lifecycleResourceSnapshot } from '@/utils/lifecycle-performance';
import { mergePerformanceSnapshot } from '@/utils/merge-world/performance';

type Quality = 'standard' | 'reduced';
let quality: Quality = 'standard';
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const useBattleQuality = () => useSyncExternalStore(subscribe, () => quality, () => 'standard' as Quality);
function setQuality(next: Quality) { if (quality === next) return; quality = next; listeners.forEach((listener) => listener()); }

/** One sample every five seconds, including automatic shooting without player input. */
export function BattlePerformanceProbe({ active, label }: { active: boolean; label: string }) {
  return SCENE_PERF_ENABLED && process.env.EXPO_PUBLIC_BATTLE_FRAME_PROBE === '1'
    ? <ActiveBattlePerformanceProbe active={active} label={label} /> : null;
}

function ActiveBattlePerformanceProbe({ active, label }: { active: boolean; label: string }) {
  const frames = useSharedValue(0);
  const slow = useSharedValue(0);
  const longest = useSharedValue(0);
  const elapsed = useSharedValue(0);
  const stable = useSharedValue(0);
  const buckets = useSharedValue([0, 0, 0, 0, 0, 0]);
  const report = (count: number, over20: number, max: number, histogram: number[]) => {
    if (!SCENE_PERF_ENABLED) return;
    const limits = [16.7, 20, 25, 33.4, 50, Infinity];
    let cumulative = 0;
    const p95 = limits.find((_, index) => { cumulative += histogram[index]!; return cumulative >= count * 0.95; });
    console.info('[battle-perf]', { label, frames: count, over20Percent: count ? over20 / count * 100 : 0,
      p95UpperBoundMs: p95 === Infinity ? '>50' : p95, longestFrameMs: max, quality, resources: lifecycleResourceSnapshot(), work: mergePerformanceSnapshot() });
  };
  const callback = useFrameCallback((frame) => {
    const dt = frame.timeSincePreviousFrame;
    if (dt == null) return;
    frames.value++;
    elapsed.value += dt;
    if (dt > 20) slow.value++;
    longest.value = Math.max(longest.value, dt);
    const index = dt <= 16.7 ? 0 : dt <= 20 ? 1 : dt <= 25 ? 2 : dt <= 33.4 ? 3 : dt <= 50 ? 4 : 5;
    buckets.modify((counts) => { counts[index]++; return counts; });
    if (elapsed.value < 5000) return;
    const ratio = slow.value / Math.max(1, frames.value);
    if (ratio > 0.1) { stable.value = 0; runOnJS(setQuality)('reduced'); }
    else if (ratio < 0.02) { stable.value++; if (stable.value >= 3) runOnJS(setQuality)('standard'); }
    else stable.value = 0;
    if (SCENE_PERF_ENABLED) runOnJS(report)(frames.value, slow.value, longest.value, buckets.value);
    frames.value = 0; slow.value = 0; elapsed.value = 0; longest.value = 0; buckets.value = [0, 0, 0, 0, 0, 0];
  }, false);
  useEffect(() => {
    callback.setActive(active);
    const release = active ? acquireLifecycleResource('frame_probe', 'battle') : () => {};
    if (!active) { frames.value = 0; slow.value = 0; elapsed.value = 0; longest.value = 0; buckets.value = [0, 0, 0, 0, 0, 0]; }
    return () => { callback.setActive(false); release(); };
  }, [active, buckets, callback, elapsed, frames, longest, slow]);
  useEffect(() => {
    const release = acquireLifecycleResource('game_route', 'battle');
    return () => { release(); setQuality('standard'); };
  }, []);
  return null;
}
