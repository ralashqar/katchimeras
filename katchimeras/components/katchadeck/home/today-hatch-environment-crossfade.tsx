import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { TodayExplorationBackground } from '@/components/katchadeck/home/today-exploration-background';
import { useScenes } from '@/features/scenes/scene-provider';
import { HOME_SCENE_Y_OFFSET } from '@/constants/home-loop-layout';
import { todayHatchCreature, type TodayHatchPhase, type TodayHatchPresentation } from '@/utils/today-hatch-presentation';
import { todayKatchimeraExplorationBackgroundKeyForPresentation } from '@/utils/today-exploration-backgrounds';

export function TodayHatchEnvironmentCrossfade({
  imageSize,
  onDestinationReady,
  presentation,
}: {
  imageSize: number;
  onDestinationReady?: () => void;
  presentation: TodayHatchPresentation;
}) {
  const reduceMotion = useReducedMotion();
  const { equippedSceneId } = useScenes();
  const progress = useSharedValue(0);
  const creature = todayHatchCreature(presentation);
  const destinationKey = todayKatchimeraExplorationBackgroundKeyForPresentation({
    creature,
    environmentVisualKey: presentation.committedDay?.card?.scene?.environment?.visualKey,
  });

  useEffect(() => {
    progress.value = withTiming(destinationKey && phaseAtLeast(presentation.phase, 'world_shift') ? 1 : 0, {
      duration: reduceMotion ? 120 : 520,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [destinationKey, presentation.phase, progress, reduceMotion]);
  useEffect(() => {
    if (presentation.committedDay && !destinationKey) onDestinationReady?.();
  }, [destinationKey, onDestinationReady, presentation.committedDay]);

  const homeStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const destinationStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, homeStyle]}>
        <TodayExplorationBackground
          backgroundKey={equippedSceneId}
          imageSize={imageSize}
          verticalOffset={HOME_SCENE_Y_OFFSET}
        />
      </Animated.View>
      {destinationKey ? (
        <Animated.View style={[StyleSheet.absoluteFill, destinationStyle]}>
          <TodayExplorationBackground
            backgroundKey={destinationKey}
            imageSize={imageSize}
            onLoad={onDestinationReady}
            verticalOffset={HOME_SCENE_Y_OFFSET}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

function phaseAtLeast(phase: TodayHatchPhase, target: TodayHatchPhase) {
  const order: TodayHatchPhase[] = [
    'idle',
    'preparing',
    'shaking',
    'cracking',
    'crossfading_subject',
    'subject_settling',
    'awaiting_interaction',
    'world_shift',
    'dashboard_settling',
    'complete',
  ];
  return order.indexOf(phase) >= order.indexOf(target);
}
