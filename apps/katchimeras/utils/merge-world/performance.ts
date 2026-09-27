// Opt-in only, including release profiling builds. Never log every frame.
import { DIAGNOSTICS_ENABLED, MERGE_PERF_ENABLED, diagnosticNoop } from '../../constants/diagnostics';
export { MERGE_PERF_ENABLED } from '../../constants/diagnostics';
export const COMBAT_PROFILE_ENABLED = DIAGNOSTICS_ENABLED && process.env.EXPO_PUBLIC_COMBAT_PROFILE === '1';
const METRICS_ENABLED = MERGE_PERF_ENABLED || COMBAT_PROFILE_ENABLED;
const samples = new Map<string, number[]>();
const renderCalls = new Map<string, number>();
/** Render attempts, not React commit counts; compare deltas in a warm burst. */
export function recordMergeRender(component: string) {
  if (METRICS_ENABLED) renderCalls.set(component, (renderCalls.get(component) ?? 0) + 1);
}
export function measureMergeWork(label: string): () => void {
  if (!METRICS_ENABLED) return diagnosticNoop;
  const start = performance.now();
  return () => {
    recordMergeWorkSample(label, performance.now() - start);
  };
}
export function recordMergeWorkSample(label: string, duration: number) {
  if (!METRICS_ENABLED) return;
  const values = samples.get(label) ?? [];
  values.push(duration);
  if (values.length > 200) values.shift();
  samples.set(label, values);
}
export function resetMergePerformance() { samples.clear(); renderCalls.clear(); }
export function measureMergeOperation<T>(label: string, work: () => T): T {
  const done = measureMergeWork(label);
  try { return work(); } finally { done(); }
}
export function mergePerformanceSnapshot() {
  const timings = Object.fromEntries([...samples].map(([label, values]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return [label, { count: sorted.length, p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0, maxMs: sorted.at(-1) ?? 0 }];
  }));
  return { timings, renderCalls: Object.fromEntries(renderCalls) };
}
