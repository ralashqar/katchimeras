// Opt-in only, including release profiling builds. Never log every frame.
import { MERGE_PERF_ENABLED, diagnosticNoop } from '../../constants/diagnostics';
export { MERGE_PERF_ENABLED } from '../../constants/diagnostics';
const samples = new Map<string, number[]>();
const renderCalls = new Map<string, number>();
/** Render attempts, not React commit counts; compare deltas in a warm burst. */
export function recordMergeRender(component: 'board' | 'sprite' | 'order-rail' | 'order-card' | 'coin-hud' | 'effects-layer' | 'effect-slot') {
  if (MERGE_PERF_ENABLED) renderCalls.set(component, (renderCalls.get(component) ?? 0) + 1);
}
export function measureMergeWork(label: string): () => void {
  if (!MERGE_PERF_ENABLED) return diagnosticNoop;
  const start = performance.now();
  return () => {
    const values = samples.get(label) ?? [];
    values.push(performance.now() - start);
    if (values.length > 200) values.shift();
    samples.set(label, values);
  };
}
export function mergePerformanceSnapshot() {
  const timings = Object.fromEntries([...samples].map(([label, values]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return [label, { count: sorted.length, p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0, maxMs: sorted.at(-1) ?? 0 }];
  }));
  return { timings, renderCalls: Object.fromEntries(renderCalls) };
}
