import { SCENE_PERF_ENABLED as FLOW_PERF_ENABLED, diagnosticNoop } from '../constants/diagnostics';
const starts = new Map<string, number>();

export function markFlowStart(label: string): void {
  if (FLOW_PERF_ENABLED) starts.set(label, performance.now());
}

export function reportFlowReady(label: string): () => void {
  if (!FLOW_PERF_ENABLED) return diagnosticNoop;
  let secondFrame: number | null = null;
  const firstFrame = requestAnimationFrame(() => {
    secondFrame = requestAnimationFrame(() => {
      const startedAt = starts.get(label);
      if (startedAt == null) return;
      starts.delete(label);
      console.info(`[flow-perf] ${label}`, {
        readyMs: Math.round((performance.now() - startedAt) * 10) / 10,
      });
    });
  });
  return () => {
    cancelAnimationFrame(firstFrame);
    if (secondFrame !== null) cancelAnimationFrame(secondFrame);
  };
}
