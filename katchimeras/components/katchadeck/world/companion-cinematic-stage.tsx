import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { KatchaSurfacePalette, KatchaUI } from '@/constants/katcha-ui';
import type { HomeVisualKey } from '@/types/home';
import type { QuestionnaireImageSource } from '@/utils/companion-questionnaire-presentation';
import type { TodayExplorationBackgroundKey } from '@/utils/today-exploration-backgrounds';
import {
  companionDestinationStageLift,
  companionSpeechBubbleDrop,
} from '@/utils/companion-home-layout';

import { CompanionHomeEnvironmentStage } from './companion-home-environment-stage';

const parchment = KatchaSurfacePalette.parchment;

export function CompanionCinematicStage({
  creature,
  enterFromLifted = false,
  environmentKey,
  lifted,
  name,
  title,
  visualKey,
}: {
  creature: QuestionnaireImageSource;
  enterFromLifted?: boolean;
  environmentKey: TodayExplorationBackgroundKey | null;
  lifted: boolean;
  name: string;
  title: string;
  visualKey: HomeVisualKey;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { height, width } = useWindowDimensions();
  const compact = height < 735;
  const liftProgress = useSharedValue(enterFromLifted ? 1 : 0);
  const tabletGutter = Math.max(28, (width - 720) / 2);
  const horizontalGutter = width >= 700 ? tabletGutter : 20;
  const bubbleWidth = width >= 700
    ? Math.min(330, width * 0.4)
    : (width - horizontalGutter * 2) * 0.56;
  const destinationLift = companionDestinationStageLift(height);
  const speechBubbleDrop = companionSpeechBubbleDrop(height);
  const speechBubbleTop = insets.top + 146 + speechBubbleDrop;

  useEffect(() => {
    liftProgress.value = reduceMotion
      ? lifted ? 1 : 0
      : withTiming(lifted ? 1 : 0, {
          duration: 360,
          easing: Easing.out(Easing.cubic),
        });
  }, [liftProgress, lifted, reduceMotion]);

  const liftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -destinationLift * liftProgress.value }],
  }));

  return (
    <View pointerEvents="box-none" style={styles.root}>
      <Animated.View pointerEvents="none" style={[styles.plane, liftStyle]}>
        <CompanionHomeEnvironmentStage
          backgroundKey={environmentKey}
          creature={creature}
          layer="background"
          name={name}
          visualKey={visualKey}
        />
      </Animated.View>

      <LinearGradient
        colors={[
          'rgba(230,205,167,0)',
          'rgba(230,205,167,0)',
          'rgba(230,205,167,0.22)',
          'rgba(230,205,167,0.82)',
          parchment.background,
        ]}
        locations={[0, 0.62, 0.74, 0.9, 1]}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.parchmentBlend]}
      />

      <Animated.View pointerEvents="none" style={[styles.foregroundPlane, liftStyle]}>
        <Animated.View
          accessibilityLabel={`${name} says: ${title}`}
          style={[
            styles.speechBubble,
            {
              left: horizontalGutter,
              top: speechBubbleTop,
              width: bubbleWidth,
            },
          ]}>
          <View style={styles.speechTail} />
          <ThemedText
            maxFontSizeMultiplier={1.3}
            selectable
            style={[styles.title, compact && styles.titleCompact]}
            lightColor="#342317"
            darkColor="#342317">
            {title}
          </ThemedText>
        </Animated.View>

        <CompanionHomeEnvironmentStage
          backgroundKey={environmentKey}
          creature={creature}
          layer="creature"
          name={name}
          visualKey={visualKey}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  plane: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  parchmentBlend: {
    zIndex: 1,
  },
  foregroundPlane: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  speechBubble: {
    backgroundColor: 'rgba(255,248,231,0.96)',
    borderColor: 'rgba(103,72,39,0.22)',
    borderCurve: 'continuous',
    borderRadius: 27,
    borderWidth: 1,
    boxShadow:
      '0 12px 30px rgba(48,33,18,0.22), inset 0 1px 0 rgba(255,255,255,0.92)',
    gap: 8,
    paddingHorizontal: 17,
    paddingVertical: 16,
    position: 'absolute',
    zIndex: 1,
  },
  speechTail: {
    backgroundColor: '#FFF8E7',
    borderBottomColor: 'rgba(103,72,39,0.18)',
    borderBottomWidth: 1,
    borderRightColor: 'rgba(103,72,39,0.18)',
    borderRightWidth: 1,
    bottom: 34,
    height: 22,
    position: 'absolute',
    right: -10,
    transform: [{ rotate: '-45deg' }],
    width: 22,
  },
  title: {
    ...KatchaUI.type.companionDisplay,
    fontSize: 31,
    lineHeight: 33,
  },
  titleCompact: {
    fontSize: 28,
    lineHeight: 30,
  },
});
