const FLOW_PERF_ENABLED = __DEV__ && process.env.EXPO_PUBLIC_SCENE_PERF === '1';
const starts = new Map<string, number>();

export function markFlowStart(label: string): void {
  if (FLOW_PERF_ENABLED) starts.set(label, performance.now());
}

export function reportFlowReady(label: string): () => void {
  if (!FLOW_PERF_ENABLED) return () => undefined;
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
