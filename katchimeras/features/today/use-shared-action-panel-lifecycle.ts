import { useEffect, useMemo, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import { Easing, FadeIn, FadeInDown, FadeInUp, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { playEggActionHaptic } from '@/features/today/egg-haptics';

/**
 * One lifecycle for every specialized Today action panel. Content can vary,
 * but selection feedback, entry, and the completion handoff must not.
 */
export function useSharedActionPanelLifecycle({
  completionKey,
  enterFromBottom = false,
  onFinished,
  reduceMotion,
  selectionActive,
}: {
  completionKey?: string | null;
  enterFromBottom?: boolean;
  onFinished: (completionKey: string) => void;
  reduceMotion: boolean;
  selectionActive: boolean;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const panelPulse = useSharedValue(0);
  const panelScale = useSharedValue(1);
  const panelX = useSharedValue(0);
  const completedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    // Completion owns its own pulse. Do not restart selection (or its haptic)
    // when the Bond-arrival completion key is published.
    if (completionKey) return;
    if (!selectionActive) {
      if (!completionKey) {
        panelPulse.value = withTiming(0, { duration: reduceMotion ? 60 : 140 });
        panelScale.value = withTiming(1, { duration: reduceMotion ? 60 : 180 });
      }
      return;
    }
    playEggActionHaptic();
    if (reduceMotion) {
      panelPulse.value = withTiming(0.55, { duration: 100 });
      return;
    }
    panelPulse.value = withSequence(
      withTiming(1, { duration: 120, easing: Easing.out(Easing.cubic) }),
      withTiming(0.62, { duration: 240, easing: Easing.out(Easing.cubic) }),
    );
    panelScale.value = withSequence(
      withTiming(1.024, { duration: 115, easing: Easing.out(Easing.cubic) }),
      withTiming(1.012, { duration: 180, easing: Easing.out(Easing.cubic) }),
    );
  }, [completionKey, panelPulse, panelScale, reduceMotion, selectionActive]);

  useEffect(() => {
    if (!completionKey || completedKeyRef.current === completionKey) return;
    completedKeyRef.current = completionKey;
    const exitDelay = reduceMotion ? 40 : 220;
    if (!reduceMotion) {
      panelPulse.value = withSequence(
        withTiming(1, { duration: 90, easing: Easing.out(Easing.cubic) }),
        withDelay(70, withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) })),
      );
      panelScale.value = withSequence(
        withTiming(1.032, { duration: 105, easing: Easing.out(Easing.cubic) }),
        withDelay(45, withTiming(0.99, { duration: 280, easing: Easing.in(Easing.cubic) })),
      );
    }
    panelX.value = withDelay(
      exitDelay,
      withTiming(windowWidth + 24, {
        duration: reduceMotion ? 100 : 330,
        easing: Easing.inOut(Easing.cubic),
      }, (finished) => {
        if (finished) runOnJS(onFinished)(completionKey);
      }),
    );
  }, [completionKey, onFinished, panelPulse, panelScale, panelX, reduceMotion, windowWidth]);

  const entering = useMemo(
    () => reduceMotion
      ? FadeIn.duration(70)
      : (enterFromBottom ? FadeInDown : FadeInUp).delay(55).duration(320).easing(Easing.out(Easing.cubic)),
    [enterFromBottom, reduceMotion],
  );
  const panelStyle = useAnimatedStyle(() => ({
    // Keep the card readable while it travels. The previous independent fade
    // finished before the slide did, making the last part look like a removal.
    // One UI-thread position now owns both motion and its final fade.
    opacity: 1 - Math.max(0, Math.min(1, (panelX.value / (windowWidth + 24) - 0.8) / 0.2)),
    transform: [{ translateX: panelX.value }, { scale: panelScale.value }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({ opacity: panelPulse.value * 0.28 }));

  return { entering, panelStyle, pulseStyle };
}
