import { Profiler, type ReactNode, useEffect } from 'react';

import {
  subscribeTodayEnergyMetrics,
  todayEnergyPerformanceEnabled,
} from '@/utils/today-energy-loop-performance';

type CommitSample = {
  actualDuration: number;
  baseDuration: number;
  commitTime: number;
};

const MAX_COMMIT_SAMPLES = 200;
const commitSamples: CommitSample[] = [];

export function TodayEnergyProfiler({ children }: { children: ReactNode }) {
  if (!todayEnergyPerformanceEnabled()) return children;
  return <EnabledTodayEnergyProfiler>{children}</EnabledTodayEnergyProfiler>;
}

function EnabledTodayEnergyProfiler({ children }: { children: ReactNode }) {
  useEffect(() => subscribeTodayEnergyMetrics((metric) => {
    if (metric.phase !== 'egg_settled' && metric.phase !== 'cancelled') return;
    const traceStartedAt = metric.timestamp - metric.elapsedMs;
    const traceCommits = commitSamples.filter((sample) => sample.commitTime >= traceStartedAt);
    console.info('[today-energy-loop] react-summary', {
      actionId: metric.actionId,
      commitCount: traceCommits.length,
      maxActualDuration: round(Math.max(0, ...traceCommits.map((sample) => sample.actualDuration))),
      totalActualDuration: round(traceCommits.reduce((total, sample) => total + sample.actualDuration, 0)),
      transactionId: metric.transactionId,
    });
  }), []);

  return (
    <Profiler
      id="today-nurture"
      onRender={(_id, _phase, actualDuration, baseDuration, _startTime, commitTime) => {
        commitSamples.push({ actualDuration, baseDuration, commitTime });
        if (commitSamples.length > MAX_COMMIT_SAMPLES) commitSamples.shift();
      }}>
      {children}
    </Profiler>
  );
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
