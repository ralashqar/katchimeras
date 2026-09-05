import { type ComponentProps, type ReactNode, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';

type AnimatedIntegerTextProps = Omit<ComponentProps<typeof ThemedText>, 'children'> & {
  durationMs?: number;
  easing?: 'linear' | 'out-cubic';
  formatValue?: (value: number) => string;
  suffix?: ReactNode;
  value: number;
};

const formatInteger = (value: number) => Math.round(value).toLocaleString();

/**
 * A shared numeric-label transition. It owns only its small text subtree, so
 * frequent visual updates do not rerender the HUD or the surrounding panel.
 */
export function AnimatedIntegerText({
  durationMs = 220,
  easing = 'out-cubic',
  formatValue = formatInteger,
  suffix,
  value,
  ...textProps
}: AnimatedIntegerTextProps) {
  const reduceMotion = useReducedMotion();
  const target = normalizedInteger(value);
  const displayedRef = useRef(target);
  const frameRef = useRef<number | null>(null);
  const [displayed, setDisplayed] = useState(target);

  useEffect(() => {
    if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    const from = displayedRef.current;
    if (reduceMotion || durationMs <= 0 || from === target) {
      displayedRef.current = target;
      setDisplayed(target);
      frameRef.current = null;
      return;
    }

    let startedAt: number | null = null;
    const tick = (timestamp: number) => {
      startedAt ??= timestamp;
      const linearProgress = Math.min(1, (timestamp - startedAt) / durationMs);
      const easedProgress = easing === 'linear'
        ? linearProgress
        : 1 - Math.pow(1 - linearProgress, 3);
      const next = Math.round(from + (target - from) * easedProgress);
      if (next !== displayedRef.current) {
        displayedRef.current = next;
        setDisplayed(next);
      }
      if (linearProgress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        displayedRef.current = target;
        setDisplayed(target);
        frameRef.current = null;
      }
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [durationMs, easing, reduceMotion, target]);

  return <ThemedText {...textProps}>{formatValue(displayed)}{suffix}</ThemedText>;
}

function normalizedInteger(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}
