import { useEffect, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { cancelAnimation, runOnJS, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

import todayScene from '@/data/today-scene.json';
import type { HomeVisualKey } from '@/types/home';
import { companionHomeStageLayout } from '@/utils/companion-home-layout';
import { resolveTodayExplorationDragTranslation } from '@/utils/today-exploration-gesture';

export function useCompanionEnvironmentPan({ activeKey, dismissOnSwipe, enabled, panVisuals = true, visualKey }: {
  activeKey: string;
  dismissOnSwipe?: () => void;
  enabled: boolean;
  panVisuals?: boolean;
  visualKey: HomeVisualKey;
}) {
  const { height, width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const translateX = useSharedValue(0);
  const gestureStartX = useSharedValue(0);
  const layout = companionHomeStageLayout(width, height, visualKey);
  const maxPan = Math.max(0, (layout.backgroundImageSize - width) / 2);
  const spring = todayScene.homeExplorationBackground.resetSpring;

  useEffect(() => {
    cancelAnimation(translateX);
    translateX.value = 0;
  }, [activeKey, translateX]);

  const gesture = useMemo(() => Gesture.Pan()
    .enabled(enabled && ((panVisuals && maxPan > 0) || Boolean(dismissOnSwipe)))
    .maxPointers(1)
    .activeOffsetX([-8, 8])
    .failOffsetY([-16, 16])
    .onBegin(() => {
      cancelAnimation(translateX);
      gestureStartX.value = translateX.value;
    })
    .onUpdate((event) => {
      if (!panVisuals) return;
      translateX.value = resolveTodayExplorationDragTranslation({
        gestureStartX: gestureStartX.value,
        maxPan,
        overscrollResistance: 0,
        translationX: event.translationX,
      });
    })
    .onEnd((event) => {
      if (dismissOnSwipe && (Math.abs(event.translationX) > 48 || Math.abs(event.velocityX) > 720)) {
        runOnJS(dismissOnSwipe)();
      }
    })
    .onFinalize(() => {
      translateX.value = reduceMotion ? 0 : withSpring(0, spring);
    }), [dismissOnSwipe, enabled, gestureStartX, maxPan, panVisuals, reduceMotion, spring, translateX]);

  return { gesture, maxPan, translateX };
}
