import { useEffect, useState } from 'react';

type UseHeroShowcaseSequenceOptions = {
  itemCount: number;
  startDelay: number;
  spotlightInDuration: number;
  spotlightHoldDuration: number;
  spotlightOutDuration: number;
  gapDuration: number;
};

export type HeroShowcasePhase = 'idle' | 'spotlightIn' | 'spotlightHold' | 'spotlightOut';

export function useHeroShowcaseSequence({
  itemCount,
  startDelay,
  spotlightInDuration,
  spotlightHoldDuration,
  spotlightOutDuration,
  gapDuration,
}: UseHeroShowcaseSequenceOptions) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [phase, setPhase] = useState<HeroShowcasePhase>('idle');

  useEffect(() => {
    if (itemCount === 0) {
      return;
    }

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const schedule = (callback: () => void, delay: number) => {
      const timer = setTimeout(() => {
        if (!cancelled) {
          callback();
        }
      }, delay);

      timers.push(timer);
    };

    const runCycle = (index: number) => {
      setActiveIndex(index);
      setPhase('spotlightIn');

      schedule(() => setPhase('spotlightHold'), spotlightInDuration);
      schedule(() => setPhase('spotlightOut'), spotlightInDuration + spotlightHoldDuration);
      schedule(() => {
        setPhase('idle');
        setActiveIndex(null);
      }, spotlightInDuration + spotlightHoldDuration + spotlightOutDuration);
      schedule(
        () => runCycle((index + 1) % itemCount),
        spotlightInDuration + spotlightHoldDuration + spotlightOutDuration + gapDuration
      );
    };

    schedule(() => runCycle(0), startDelay);

    return () => {
      cancelled = true;
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [gapDuration, itemCount, spotlightHoldDuration, spotlightInDuration, spotlightOutDuration, startDelay]);

  return {
    activeIndex,
    phase,
  };
}
