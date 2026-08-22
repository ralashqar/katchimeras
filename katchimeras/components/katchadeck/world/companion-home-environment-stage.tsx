import { memo, useEffect, type RefObject } from 'react';
import { StyleSheet, useWindowDimensions, View, type View as ViewType } from 'react-native';
import Animated, { cancelAnimation, type SharedValue, useAnimatedStyle, useReducedMotion, useSharedValue } from 'react-native-reanimated';

import { CreatureGroundShadow } from '@/components/katchadeck/creature-ground-shadow';
import { TodayExplorationBackground } from '@/components/katchadeck/home/today-exploration-background';
import type { HomeVisualKey } from '@/types/home';
import type { TodayExplorationBackgroundKey } from '@/utils/today-exploration-backgrounds';
import type { QuestionnaireImageSource } from '@/utils/companion-questionnaire-presentation';
import { companionHomeStageLayout } from '@/utils/companion-home-layout';
import { runRewardArrivalMotion } from '@/components/katchadeck/ui/reward-arrival-motion';

import { CreatureAnimatedArt } from './creature-animated-art';

export const CompanionHomeEnvironmentStage = memo(
  function CompanionHomeEnvironmentStage({
    backgroundKey,
    creature,
    creatureTargetRef,
    layer = 'both',
    name,
    onBackgroundReady,
    onCreatureReady,
    rewardPulseKey = 0,
    sceneTranslateX,
    visualKey,
  }: {
    backgroundKey: TodayExplorationBackgroundKey | null;
    creature: QuestionnaireImageSource;
    creatureTargetRef?: RefObject<ViewType | null>;
    layer?: 'background' | 'creature' | 'both';
    name: string;
    onBackgroundReady?: () => void;
    onCreatureReady?: () => void;
    rewardPulseKey?: number;
    sceneTranslateX?: SharedValue<number>;
    visualKey: HomeVisualKey;
  }) {
    const { height, width } = useWindowDimensions();
    const reduceMotion = useReducedMotion();
    const feedback = useSharedValue(0);
    const shake = useSharedValue(0);
    const layout = companionHomeStageLayout(width, height, visualKey);
    const stageTransform = useAnimatedStyle(() => ({
      transform: [
        { translateX: layout.translateX + (sceneTranslateX?.value ?? 0) },
        { translateY: layout.translateY },
      ],
    }));
    const showBackground = layer === 'background' || layer === 'both';
    const showCreature = layer === 'creature' || layer === 'both';
    useEffect(() => {
      if (!rewardPulseKey) return;
      runRewardArrivalMotion(feedback, shake, reduceMotion);
      return () => {
        cancelAnimation(feedback);
        cancelAnimation(shake);
        feedback.value = 0;
        shake.value = 0;
      };
    }, [feedback, reduceMotion, rewardPulseKey, shake]);
    const creatureFeedbackStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: shake.value * 7 },
        { rotate: `${shake.value * 2.4}deg` },
        { scale: 1 + feedback.value * 0.055 },
      ],
    }));
    const glowStyle = useAnimatedStyle(() => ({
      opacity: feedback.value * 0.82,
      transform: [{ scale: 0.72 + feedback.value * 0.55 }],
    }));

    return (
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          showCreature && !showBackground && styles.creatureLayerRoot,
        ]}>
        {showBackground && backgroundKey ? (
          <Animated.View style={[styles.backgroundPlane, stageTransform]}>
            <TodayExplorationBackground
              backgroundKey={backgroundKey}
              imageSize={layout.backgroundImageSize}
              onLoad={onBackgroundReady}
            />
          </Animated.View>
        ) : null}

        {showCreature ? <Animated.View style={[styles.creaturePlane, stageTransform]}>
          <Animated.View
            collapsable={false}
            ref={creatureTargetRef}
            style={[
              styles.creatureFrame,
              {
                height: layout.creatureFrame.size,
                marginLeft: -layout.creatureFrame.size / 2,
                top: layout.creatureFrame.top,
                width: layout.creatureFrame.size,
              }, creatureFeedbackStyle,
            ]}>
            <Animated.View style={[styles.rewardGlow, glowStyle]} />
            <CreatureGroundShadow
              frameSize={layout.creatureFrame.size}
              stage="grown"
              visualKey={visualKey}
            />
            <CreatureAnimatedArt
              accessibilityLabel={`${name}, your Katchimera`}
              fallbackSource={creature}
              onLoad={onCreatureReady}
              style={StyleSheet.absoluteFill}
              visualKey={visualKey}
            />
          </Animated.View>
        </Animated.View> : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  backgroundPlane: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  creaturePlane: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  creatureLayerRoot: {
    zIndex: 2,
  },
  creatureFrame: {
    left: '50%',
    position: 'absolute',
  },
  rewardGlow: {
    backgroundColor: 'rgba(255,205,92,0.34)', borderColor: 'rgba(255,239,168,0.86)', borderRadius: 999,
    borderWidth: 3, bottom: '9%', boxShadow: '0 0 28px rgba(255,193,65,0.72)', left: '9%', position: 'absolute',
    right: '9%', top: '9%',
  },
});
