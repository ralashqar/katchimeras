export type TodayEnergyLoopPhase =
  | 'action_press'
  | 'destination_open'
  | 'artifact_complete'
  | 'reward_launch'
  | 'token_arrival'
  | 'domain_commit'
  | 'egg_settled'
  | 'cancelled';

export type TodayEnergyLoopMetric = {
  transactionId: string;
  actionId: string;
  phase: TodayEnergyLoopPhase;
  elapsedMs: number;
  phaseElapsedMs: number;
  timestamp: number;
  detail?: Record<string, number | string | boolean | null>;
};

type ActiveTrace = {
  actionId: string;
  startedAt: number;
  lastAt: number;
};

const PERF_ENABLED = typeof __DEV__ !== 'undefined'
  && __DEV__
  && process.env.EXPO_PUBLIC_TODAY_LOOP_PERF === '1';
const active = new Map<string, ActiveTrace>();
const listeners = new Set<(metric: TodayEnergyLoopMetric) => void>();
let sequence = 0;

export function startTodayEnergyTrace(actionId: string): string {
  const now = performance.now();
  sequence += 1;
  const transactionId = `${actionId}:${Math.round(now)}:${sequence}`;
  active.set(transactionId, { actionId, startedAt: now, lastAt: now });
  markTodayEnergyPhase(transactionId, 'action_press');
  return transactionId;
}

export function markTodayEnergyPhase(
  transactionId: string,
  phase: TodayEnergyLoopPhase,
  detail?: TodayEnergyLoopMetric['detail'],
): void {
  const trace = active.get(transactionId);
  if (!trace) return;
  const now = performance.now();
  const metric: TodayEnergyLoopMetric = {
    transactionId,
    actionId: trace.actionId,
    phase,
    elapsedMs: round(now - trace.startedAt),
    phaseElapsedMs: round(now - trace.lastAt),
    timestamp: now,
    ...(detail ? { detail } : {}),
  };
  trace.lastAt = now;
  if (PERF_ENABLED) console.info('[today-energy-loop]', metric);
  listeners.forEach((listener) => listener(metric));
  if (phase === 'egg_settled' || phase === 'cancelled') active.delete(transactionId);
}

export function subscribeTodayEnergyMetrics(listener: (metric: TodayEnergyLoopMetric) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearTodayEnergyTraces(): void {
  active.clear();
}

export function todayEnergyPerformanceEnabled(): boolean {
  return PERF_ENABLED;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
