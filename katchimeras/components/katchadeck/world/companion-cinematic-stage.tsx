import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState, type RefObject } from 'react';
import { type LayoutChangeEvent, type StyleProp, StyleSheet, type TextStyle, useWindowDimensions, View, type View as ViewType } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { CelebrationParticles } from '@/components/katchadeck/world/companion-achievement-celebration';
import { KatchaSurfacePalette, KatchaUI } from '@/constants/katcha-ui';
import type { HomeVisualKey } from '@/types/home';
import type { QuestionnaireImageSource } from '@/utils/companion-questionnaire-presentation';
import type { TodayExplorationBackgroundKey } from '@/utils/today-exploration-backgrounds';
import {
  companionDestinationSpeechBubbleTop,
  companionDestinationStageLift,
  companionSpeechTitleTier,
  companionSpeechBubbleDrop,
} from '@/utils/companion-home-layout';

import { CompanionHomeEnvironmentStage } from './companion-home-environment-stage';

const parchment = KatchaSurfacePalette.parchment;

export function CompanionCinematicStage({
  creature,
  creatureTargetRef,
  bubbleBody,
  bubbleVariant = 'default',
  celebrate = false,
  enterFromLifted = false,
  environmentKey,
  lifted,
  name,
  rewardPulseKey = 0,
  onSpeechBubbleHeightChange,
  onBackgroundReady,
  onCreatureReady,
  showSpeechBubble = true,
  title,
  visualKey,
}: {
  bubbleBody?: string;
  bubbleVariant?: 'default' | 'questionnaire';
  celebrate?: boolean;
  creature: QuestionnaireImageSource;
  creatureTargetRef?: RefObject<ViewType | null>;
  enterFromLifted?: boolean;
  environmentKey: TodayExplorationBackgroundKey | null;
  lifted: boolean;
  name: string;
  rewardPulseKey?: number;
  onSpeechBubbleHeightChange?: (height: number) => void;
  onBackgroundReady?: () => void;
  onCreatureReady?: () => void;
  showSpeechBubble?: boolean;
  title: string;
  visualKey: HomeVisualKey;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { height, width } = useWindowDimensions();
  const compact = height < 735;
  const questionnaireBubble = bubbleVariant === 'questionnaire';
  const defaultTitleTier = companionSpeechTitleTier(title);
  const liftProgress = useSharedValue(enterFromLifted ? 1 : 0);
  const tabletGutter = Math.max(28, (width - 720) / 2);
  const horizontalGutter = width >= 700 ? tabletGutter : 20;
  const bubbleWidth = questionnaireBubble
    ? width >= 700
      ? Math.min(390, width * 0.48)
      : (width - horizontalGutter * 2) * 0.62
    : width >= 700
      ? Math.min(330, width * 0.4)
      : (width - horizontalGutter * 2) * 0.56;
  const destinationLift = companionDestinationStageLift(height);
  const speechBubbleDrop = companionSpeechBubbleDrop(height);
  // The complete art plane lifts on destination pages. Offset the bubble
  // before that transform so its visible position remains below navigation
  // chrome instead of rising beneath the back button.
  const speechBubbleTop = lifted
    ? companionDestinationSpeechBubbleTop(height, insets.top)
    : insets.top + 146 + speechBubbleDrop;

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
          onBackgroundReady={onBackgroundReady}
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
        {showSpeechBubble ? (
          <Animated.View
            accessibilityLabel={`${name} says: ${title}`}
            entering={questionnaireBubble && !reduceMotion ? FadeIn.duration(180) : undefined}
            key={questionnaireBubble ? `question:${title}` : 'destination-speech'}
            onLayout={(event: LayoutChangeEvent) => onSpeechBubbleHeightChange?.(event.nativeEvent.layout.height)}
            style={[
              styles.speechBubble,
              questionnaireBubble && styles.speechBubbleQuestionnaire,
              {
                left: horizontalGutter,
                top: speechBubbleTop,
                width: bubbleWidth,
              },
            ]}>
            <View style={styles.speechTail} />
            <TypewriterText
              durationMs={560}
              key={`speech-title:${title}`}
              reduceMotion={reduceMotion}
              style={[
                styles.title,
                compact && styles.titleCompact,
                !questionnaireBubble && defaultTitleTier === 'medium' && styles.titleMedium,
                !questionnaireBubble && defaultTitleTier === 'long' && styles.titleLong,
                questionnaireBubble && styles.questionTitle,
                questionnaireBubble && title.length > 58 && styles.questionTitleLong,
              ]}
              text={title}
              lightColor="#342317"
              darkColor="#342317"
            />
            {questionnaireBubble && bubbleBody ? (
              <TypewriterText
                delayMs={170}
                durationMs={640}
                key={`speech-body:${bubbleBody}`}
                reduceMotion={reduceMotion}
                style={styles.questionBody}
                text={bubbleBody}
                lightColor="#6B5544"
                darkColor="#6B5544"
              />
            ) : null}
          </Animated.View>
        ) : null}

        {celebrate ? (
          <CelebrationParticles
            layerStyle={{ left: width >= 700 ? '68%' : '72%', top: '50%', zIndex: 0 }}
            tier={1}
            tint="#E4B34B"
          />
        ) : null}

        <CompanionHomeEnvironmentStage
          backgroundKey={environmentKey}
          creature={creature}
          creatureTargetRef={creatureTargetRef}
          layer="creature"
          name={name}
          onCreatureReady={onCreatureReady}
          rewardPulseKey={rewardPulseKey}
          visualKey={visualKey}
        />
      </Animated.View>
    </View>
  );
}

function TypewriterText({
  darkColor,
  delayMs = 0,
  durationMs,
  lightColor,
  reduceMotion,
  style,
  text,
}: {
  darkColor: string;
  delayMs?: number;
  durationMs: number;
  lightColor: string;
  reduceMotion: boolean;
  style: StyleProp<TextStyle>;
  text: string;
}) {
  const characters = useMemo(() => Array.from(text), [text]);
  const [visibleCount, setVisibleCount] = useState(() => reduceMotion ? characters.length : 0);

  useEffect(() => {
    if (reduceMotion) {
      setVisibleCount(characters.length);
      return;
    }

    setVisibleCount(0);
    let frame: number | null = null;
    const startAt = performance.now() + delayMs;
    const reveal = (timestamp: number) => {
      if (timestamp < startAt) {
        frame = requestAnimationFrame(reveal);
        return;
      }
      const ratio = Math.min(1, (timestamp - startAt) / durationMs);
      const nextCount = Math.min(characters.length, Math.ceil(characters.length * ratio));
      setVisibleCount((current) => current === nextCount ? current : nextCount);
      if (ratio < 1) frame = requestAnimationFrame(reveal);
    };
    frame = requestAnimationFrame(reveal);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [characters, delayMs, durationMs, reduceMotion]);

  const complete = visibleCount >= characters.length;
  return (
    <View style={styles.typewriterFrame}>
      <ThemedText
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        maxFontSizeMultiplier={1.3}
        style={[style, styles.typewriterMeasure]}
        lightColor={lightColor}
        darkColor={darkColor}>
        {text}
      </ThemedText>
      <ThemedText
        accessibilityLabel={text}
        maxFontSizeMultiplier={1.3}
        selectable={complete}
        style={[StyleSheet.absoluteFill, style]}
        lightColor={lightColor}
        darkColor={darkColor}>
        {characters.slice(0, visibleCount).join('')}
      </ThemedText>
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
  typewriterFrame: {
    alignSelf: 'stretch',
    position: 'relative',
  },
  typewriterMeasure: {
    opacity: 0,
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
  speechBubbleQuestionnaire: {
    minHeight: 146,
    paddingBottom: 20,
    paddingHorizontal: 18,
    paddingTop: 20,
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
  titleMedium: {
    fontSize: 25,
    lineHeight: 29,
  },
  titleLong: {
    fontSize: 21,
    lineHeight: 25,
  },
  questionTitle: {
    fontSize: 22,
    lineHeight: 27,
  },
  questionTitleLong: {
    fontSize: 19,
    lineHeight: 24,
  },
  questionBody: {
    ...KatchaUI.type.companionBody,
    fontSize: 12,
    lineHeight: 17,
  },
});
