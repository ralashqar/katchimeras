import { HAVEN_UPGRADE_TIMING, HAVEN_UPGRADE_REDUCED_TIMING, type HavenUpgradePresentationPhase } from './upgrade-presentation';

/** Mossprout's camera-first timeline. Both games supply their camera and durable receipt. */
export function playUpgradeSequence({ reduced, focus, onPhase, onComplete }: {
  reduced: boolean;
  focus: (settled: () => void) => void;
  onPhase: (phase: HavenUpgradePresentationPhase) => void;
  onComplete: () => void;
}) {
  let cancelled = false, focused = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const schedule = (phase: HavenUpgradePresentationPhase, delay: number) => {
    timers.push(setTimeout(() => {
      if (cancelled) return;
      if (phase === 'complete') onComplete();
      else onPhase(phase);
    }, delay));
  };
  onPhase('focus');
  focus(() => {
    if (cancelled || focused) return;
    focused = true;
    const timing = reduced ? HAVEN_UPGRADE_REDUCED_TIMING : HAVEN_UPGRADE_TIMING;
    onPhase(reduced ? 'focus' : 'payment');
    if (!reduced) schedule('cover', HAVEN_UPGRADE_TIMING.coverAtMs);
    schedule('reveal', timing.revealAtMs);
    schedule('react', timing.reactAtMs);
    schedule('complete', timing.completeAtMs);
  });
  return () => { cancelled = true; timers.forEach(clearTimeout); };
}
