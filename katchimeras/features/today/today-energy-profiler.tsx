import { Profiler, type ReactNode } from 'react';

import { todayEnergyPerformanceEnabled } from '@/utils/today-energy-loop-performance';

let commitCount = 0;

export function TodayEnergyProfiler({ children }: { children: ReactNode }) {
  if (!todayEnergyPerformanceEnabled()) return children;
  return (
    <Profiler
      id="today-nurture"
      onRender={(id, phase, actualDuration, baseDuration, startTime, commitTime) => {
        commitCount += 1;
        console.info('[today-energy-loop] react-commit', {
          actualDuration: round(actualDuration),
          baseDuration: round(baseDuration),
          commitCount,
          commitTime: round(commitTime),
          id,
          phase,
          startTime: round(startTime),
        });
      }}>
      {children}
    </Profiler>
  );
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
