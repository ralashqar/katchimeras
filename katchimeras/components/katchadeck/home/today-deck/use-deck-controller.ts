import * as Haptics from 'expo-haptics';
import { startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  runOnJS,
  useFrameCallback,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import {
  clampDeckIndex,
  DECK_SPRING,
  isDeckVisuallySettled,
  resolveDraggedIndex,
  resolveSwipeTarget,
} from './deck-navigation';

type DeckItemIdentity = {
  id: string;
};

type UseDeckControllerParams = {
  days: readonly DeckItemIdentity[];
  disabled: boolean;
  maxNavigableIndex: number;
  onSelect: (dayId: string) => void;
  selectedId: string;
  stride: number;
};

const HAPTIC_DELAY_MS = 32;
const VISUAL_SETTLE_FRAMES = 3;

export function useDeckController({
  days,
  disabled,
  maxNavigableIndex,
  onSelect,
  selectedId,
  stride,
}: UseDeckControllerParams) {
  const initialIndex = Math.max(0, days.findIndex((day) => day.id === selectedId));
  const focusedIndex = useSharedValue(initialIndex);
  const gestureOriginIndex = useSharedValue(initialIndex);
  const gestureActive = useSharedValue(0);
  const transitionActive = useSharedValue(0);
  const transitionToken = useSharedValue(0);
  const settleTargetIndex = useSharedValue(-1);
  const settledFrameCount = useSharedValue(0);
  const pendingIndexRef = useRef<number | null>(null);
  const hapticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectionFrameRef = useRef<number | null>(null);
  const initializedRef = useRef(false);
  const selectedIndex = useMemo(() => days.findIndex((day) => day.id === selectedId), [days, selectedId]);

  const cancelPendingSelectionFeedback = useCallback(() => {
    if (selectionFrameRef.current !== null) {
      cancelAnimationFrame(selectionFrameRef.current);
      selectionFrameRef.current = null;
    }
    if (hapticTimerRef.current !== null) {
      clearTimeout(hapticTimerRef.current);
      hapticTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    cancelPendingSelectionFeedback();
  }, [cancelPendingSelectionFeedback]);

  useLayoutEffect(() => {
    if (selectedIndex < 0) return;
    if (!initializedRef.current) {
      initializedRef.current = true;
      focusedIndex.value = selectedIndex;
      gestureOriginIndex.value = selectedIndex;
      settleTargetIndex.value = -1;
      settledFrameCount.value = 0;
      return;
    }
    if (pendingIndexRef.current === selectedIndex) {
      pendingIndexRef.current = null;
      gestureOriginIndex.value = selectedIndex;
      settleTargetIndex.value = -1;
      settledFrameCount.value = 0;
      return;
    }
    pendingIndexRef.current = null;
    settleTargetIndex.value = -1;
    settledFrameCount.value = 0;
    transitionToken.value += 1;
    const token = transitionToken.value;
    transitionActive.value = 1;
    focusedIndex.value = withSpring(selectedIndex, DECK_SPRING, (finished) => {
      if (!finished || transitionToken.value !== token) return;
      transitionActive.value = 0;
    });
    gestureOriginIndex.value = selectedIndex;
  }, [focusedIndex, gestureOriginIndex, selectedIndex, settleTargetIndex, settledFrameCount, transitionActive, transitionToken]);

  const beginNavigation = useCallback((targetIndex: number) => {
    const target = days[targetIndex];
    if (!target) return;
    pendingIndexRef.current = targetIndex;
    settleTargetIndex.value = targetIndex;
    settledFrameCount.value = 0;
    cancelPendingSelectionFeedback();
  }, [cancelPendingSelectionFeedback, days, settleTargetIndex, settledFrameCount]);

  const commitNavigation = useCallback((targetIndex: number) => {
    const target = days[targetIndex];
    if (!target || pendingIndexRef.current !== targetIndex) return;
    if (target.id === selectedId) {
      pendingIndexRef.current = null;
      return;
    }
    cancelPendingSelectionFeedback();
    // Preserve one fully-settled frame before changing selected-day state. This
    // keeps the Today screen's data reconciliation completely outside motion.
    selectionFrameRef.current = requestAnimationFrame(() => {
      selectionFrameRef.current = null;
      if (pendingIndexRef.current !== targetIndex) return;
      startTransition(() => onSelect(target.id));
      if (process.env.EXPO_OS === 'ios') {
        hapticTimerRef.current = setTimeout(() => {
          hapticTimerRef.current = null;
          void Haptics.selectionAsync();
        }, HAPTIC_DELAY_MS);
      }
    });
  }, [cancelPendingSelectionFeedback, days, onSelect, selectedId]);

  useFrameCallback(() => {
    const target = settleTargetIndex.value;
    if (transitionActive.value !== 1 || target < 0) {
      settledFrameCount.value = 0;
      return;
    }
    if (!isDeckVisuallySettled(focusedIndex.value, target)) {
      settledFrameCount.value = 0;
      return;
    }
    settledFrameCount.value += 1;
    if (settledFrameCount.value < VISUAL_SETTLE_FRAMES) return;
    settleTargetIndex.value = -1;
    settledFrameCount.value = 0;
    runOnJS(commitNavigation)(target);
  });

  const navigateToIndex = useCallback((targetIndex: number) => {
    if (disabled) return;
    const target = clampDeckIndex(targetIndex, maxNavigableIndex);
    if (target !== selectedIndex) beginNavigation(target);
    transitionToken.value += 1;
    const token = transitionToken.value;
    transitionActive.value = 1;
    focusedIndex.value = withSpring(target, DECK_SPRING, (finished) => {
      if (!finished || transitionToken.value !== token) return;
      transitionActive.value = 0;
      runOnJS(commitNavigation)(target);
    });
  }, [beginNavigation, commitNavigation, disabled, focusedIndex, maxNavigableIndex, selectedIndex, transitionActive, transitionToken]);

  const swipeGesture = useMemo(
    () => Gesture.Pan()
      .activeOffsetX([-18, 18])
      .failOffsetY([-16, 16])
      .enabled(!disabled)
      .onStart(() => {
        cancelAnimation(focusedIndex);
        transitionToken.value += 1;
        transitionActive.value = 1;
        gestureActive.value = 1;
        gestureOriginIndex.value = focusedIndex.value;
        settleTargetIndex.value = -1;
        settledFrameCount.value = 0;
      })
      .onUpdate((event) => {
        if (gestureActive.value === 0) return;
        focusedIndex.value = resolveDraggedIndex({
          maxIndex: maxNavigableIndex,
          originIndex: gestureOriginIndex.value,
          stride,
          translationX: event.translationX,
        });
      })
      .onEnd((event) => {
        if (gestureActive.value === 0) return;
        gestureActive.value = 0;
        const target = resolveSwipeTarget({
          maxIndex: maxNavigableIndex,
          originIndex: gestureOriginIndex.value,
          translationX: event.translationX,
          velocityX: event.velocityX,
        });
        runOnJS(beginNavigation)(target);
        const token = transitionToken.value;
        focusedIndex.value = withSpring(target, { ...DECK_SPRING, velocity: -event.velocityX / stride }, (finished) => {
          if (!finished || transitionToken.value !== token) return;
          transitionActive.value = 0;
          runOnJS(commitNavigation)(target);
        });
      })
      .onFinalize(() => {
        if (gestureActive.value === 0) return;
        gestureActive.value = 0;
        const token = transitionToken.value;
        const target = clampDeckIndex(Math.round(gestureOriginIndex.value), maxNavigableIndex);
        runOnJS(beginNavigation)(target);
        focusedIndex.value = withSpring(target, DECK_SPRING, (finished) => {
          if (!finished || transitionToken.value !== token) return;
          transitionActive.value = 0;
          runOnJS(commitNavigation)(target);
        });
      }),
    [beginNavigation, commitNavigation, disabled, focusedIndex, gestureActive, gestureOriginIndex, maxNavigableIndex, settleTargetIndex, settledFrameCount, stride, transitionActive, transitionToken]
  );

  return {
    focusedIndex,
    navigateToIndex,
    swipeGesture,
    transitionActive,
  };
}
