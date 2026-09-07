import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { HAVEN_UPGRADE_TIMING, HAVEN_UPGRADE_REDUCED_TIMING, type HavenUpgradePresentationPhase } from './upgrade-presentation';
import { worldImageSourceKey } from './seamless-image';

/** The committed domain state is independent from this disposable presentation. */
export function WorldTileTransition({ source, children, effects }: {
  source: ImageSourcePropType;
  children: (source: ImageSourcePropType) => ReactNode;
  effects?: (phase: HavenUpgradePresentationPhase, reduced: boolean) => ReactNode;
}) {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(source);
  const [phase, setPhase] = useState<HavenUpgradePresentationPhase>('complete');
  const key = worldImageSourceKey(source);
  const previous = useRef(key);
  useEffect(() => {
    if (previous.current === key) {
      setVisible(source);
      setPhase('complete');
      return;
    }
    previous.current = key;
    setPhase(reduced ? 'focus' : 'payment');
    const timing = reduced ? HAVEN_UPGRADE_REDUCED_TIMING : HAVEN_UPGRADE_TIMING;
    const timers = [
      setTimeout(() => setPhase('cover'), reduced ? 0 : HAVEN_UPGRADE_TIMING.coverAtMs),
      setTimeout(() => { setVisible(source); setPhase('reveal'); }, timing.revealAtMs),
      setTimeout(() => setPhase('react'), timing.reactAtMs),
      setTimeout(() => setPhase('complete'), timing.completeAtMs),
    ];
    return () => timers.forEach(clearTimeout);
  }, [key, source, reduced]);
  return <>{children(visible)}{phase !== 'complete' && effects?.(phase, reduced)}</>;
}
