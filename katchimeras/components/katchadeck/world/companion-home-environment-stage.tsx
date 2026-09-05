import { memo, useEffect, type RefObject } from 'react';
import { StyleSheet, useWindowDimensions, View, type View as ViewType } from 'react-native';
import { Image } from 'expo-image';
import Animated, { cancelAnimation, Easing, type SharedValue, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { CreatureGroundShadow } from '@/components/katchadeck/creature-ground-shadow';
import { TodayExplorationBackground } from '@/components/katchadeck/home/today-exploration-background';
import type { HomeVisualKey } from '@/types/home';
import type { TodayExplorationBackgroundKey } from '@/utils/today-exploration-backgrounds';
import type { QuestionnaireImageSource } from '@/utils/companion-questionnaire-presentation';
import { companionHomeStageLayout } from '@/utils/companion-home-layout';
import { runRewardArrivalMotion } from '@/components/katchadeck/ui/reward-arrival-motion';
import { RotatingRadialSunburst } from '@/components/katchadeck/ui/radial-sunburst';
import { resolveCreatureMeditationArtSource } from '@/utils/creature-art';

import { CreatureAnimatedArt } from './creature-animated-art';
import { CompanionStepsValue } from './companion-steps-value';

const REWARD_GLOW_NATIVE_SURFACE_SCALE = 2;

export const CompanionHomeEnvironmentStage = memo(
  function CompanionHomeEnvironmentStage({
    backgroundKey,
    creature,
    creatureVerticalOffset = 0,
    creatureTargetRef,
    layer = 'both',
    meditating = false,
    name,
    onBackgroundReady,
    onCreatureReady,
    rewardPulseKey = 0,
    sceneTranslateX,
    visualKey,
  }: {
    backgroundKey: TodayExplorationBackgroundKey | null;
    creature: QuestionnaireImageSource;
    creatureVerticalOffset?: number;
    creatureTargetRef?: RefObject<ViewType | null>;
    layer?: 'background' | 'creature' | 'both';
    meditating?: boolean;
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
    const meditationProgress = useSharedValue(meditating ? 1 : 0);
    const layout = companionHomeStageLayout(width, height, visualKey);
    const meditationCreature = resolveCreatureMeditationArtSource(visualKey);
    const stageTransform = useAnimatedStyle(() => ({
      transform: [
        { translateX: layout.translateX + (sceneTranslateX?.value ?? 0) },
        { translateY: layout.translateY },
      ],
    }));
    const showBackground = layer === 'background' || layer === 'both';
    const showCreature = layer === 'creature' || layer === 'both';
    const rewardGlowSize = layout.creatureFrame.size * 0.82;
    const rewardGlowNativeSize = rewardGlowSize * REWARD_GLOW_NATIVE_SURFACE_SCALE;
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
    useEffect(() => {
      meditationProgress.value = reduceMotion
        ? meditating ? 1 : 0
        : withTiming(meditating ? 1 : 0, {
            duration: 520,
            easing: Easing.inOut(Easing.cubic),
          });
      return () => cancelAnimation(meditationProgress);
    }, [meditating, meditationProgress, reduceMotion]);
    const creatureFeedbackStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: shake.value * 7 },
        { rotate: `${shake.value * 2.4}deg` },
        { scale: 1 + feedback.value * 0.055 },
      ],
    }));
    const glowStyle = useAnimatedStyle(() => ({
      opacity: feedback.value * 0.82,
      transform: [{
        scale: (0.72 + feedback.value * 0.55) / REWARD_GLOW_NATIVE_SURFACE_SCALE,
      }],
    }));
    const regularCreatureStyle = useAnimatedStyle(() => ({
      opacity: meditationCreature ? 1 - meditationProgress.value : 1,
    }));
    const meditationCreatureStyle = useAnimatedStyle(() => ({
      opacity: meditationProgress.value,
    }));
    const meditationAuraStyle = useAnimatedStyle(() => ({
      opacity: meditationProgress.value * 0.78,
      transform: [{ scale: 0.92 + meditationProgress.value * 0.08 }],
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
            renderToHardwareTextureAndroid={false}
            ref={creatureTargetRef}
            shouldRasterizeIOS={false}
            style={[
              styles.creatureFrame,
              {
                height: layout.creatureFrame.size,
                marginLeft: -layout.creatureFrame.size / 2,
                top: layout.creatureFrame.top + creatureVerticalOffset,
                width: layout.creatureFrame.size,
              }, creatureFeedbackStyle,
            ]}>
            <Animated.View
              collapsable={false}
              renderToHardwareTextureAndroid={false}
              shouldRasterizeIOS={false}
              style={[
                styles.rewardGlow,
                {
                  height: rewardGlowNativeSize,
                  left: (layout.creatureFrame.size - rewardGlowNativeSize) / 2,
                  top: (layout.creatureFrame.size - rewardGlowNativeSize) / 2,
                  width: rewardGlowNativeSize,
                },
                glowStyle,
              ]}
            />
            <CreatureGroundShadow
              frameSize={layout.creatureFrame.size}
              stage="grown"
              visualKey={visualKey}
              widthMultiplier={1.65}
            />
            {meditationCreature ? (
              <Animated.View pointerEvents="none" style={[styles.meditationAura, meditationAuraStyle]}>
                <RotatingRadialSunburst
                  baseOpacity={0.6}
                  nativeSurfaceScale={2}
                  size={layout.creatureFrame.size * 1.08}
                />
              </Animated.View>
            ) : null}
            <Animated.View style={[StyleSheet.absoluteFill, regularCreatureStyle]}>
              <CreatureAnimatedArt
                accessibilityLabel={`${name}, your Katchimera`}
                allowDownscaling={false}
                fallbackSource={creature}
                onLoad={onCreatureReady}
                style={StyleSheet.absoluteFill}
                visualKey={visualKey}
              />
            </Animated.View>
            {meditationCreature ? (
              <Animated.View style={[StyleSheet.absoluteFill, meditationCreatureStyle]}>
                <Image
                  accessibilityIgnoresInvertColors
                  accessibilityLabel={`${name}, meditating`}
                  allowDownscaling={false}
                  cachePolicy="memory-disk"
                  contentFit="contain"
                  onLoad={meditating ? onCreatureReady : undefined}
                  source={meditationCreature}
                  style={StyleSheet.absoluteFill}
                  transition={0}
                />
              </Animated.View>
            ) : null}
            {visualKey === 'steppling' ? <CompanionStepsValue /> : null}
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
    borderWidth: 6, boxShadow: '0 0 56px rgba(255,193,65,0.72)', position: 'absolute',
  },
  meditationAura: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,220,125,0.16)',
    borderRadius: 999,
    boxShadow: '0 0 42px rgba(255,210,92,0.42)',
    height: '76%',
    justifyContent: 'center',
    left: '12%',
    position: 'absolute',
    top: '13%',
    width: '76%',
  },
});
