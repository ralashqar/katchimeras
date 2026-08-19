import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState, type RefObject } from 'react';
import { type LayoutChangeEvent, Pressable, type StyleProp, StyleSheet, type TextStyle, useWindowDimensions, View, type View as ViewType } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { CelebrationParticles } from '@/components/katchadeck/world/companion-achievement-celebration';
import { KatchaUI } from '@/constants/katcha-ui';
import type { HomeVisualKey } from '@/types/home';
import type { QuestionnaireImageSource } from '@/utils/companion-questionnaire-presentation';
import type { TodayExplorationBackgroundKey } from '@/utils/today-exploration-backgrounds';
import {
  companionDestinationSpeechBubbleTop,
  companionDestinationStageLift,
  companionSpeechTitleTier,
  companionSpeechBubbleDrop,
  companionHomeStageLayout,
} from '@/utils/companion-home-layout';

import { CompanionHomeEnvironmentStage } from './companion-home-environment-stage';

export function CompanionCinematicStage({
  creature,
  creatureTargetRef,
  bubbleBody,
  bubbleVariant = 'default',
  celebrate = false,
  environmentKey,
  houseLevel,
  lifted,
  name,
  rewardPulseKey = 0,
  sceneTranslateX,
  onSpeechBubbleHeightChange,
  onBackgroundReady,
  onCreatureReady,
  onSpeechBubblePress,
  showSpeechBubble = true,
  showNameplate = false,
  title,
  visualKey,
}: {
  bubbleBody?: string;
  bubbleVariant?: 'default' | 'questionnaire';
  celebrate?: boolean;
  creature: QuestionnaireImageSource;
  creatureTargetRef?: RefObject<ViewType | null>;
  environmentKey: TodayExplorationBackgroundKey | null;
  houseLevel?: number;
  lifted: boolean;
  name: string;
  rewardPulseKey?: number;
  sceneTranslateX?: SharedValue<number>;
  onSpeechBubbleHeightChange?: (height: number) => void;
  onBackgroundReady?: () => void;
  onCreatureReady?: () => void;
  onSpeechBubblePress?: () => void;
  showSpeechBubble?: boolean;
  showNameplate?: boolean;
  title: string;
  visualKey: HomeVisualKey;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { height, width } = useWindowDimensions();
  const compact = height < 735;
  const questionnaireBubble = bubbleVariant === 'questionnaire';
  const defaultTitleTier = companionSpeechTitleTier(title);
  const speechKey = `${title}\u0000${questionnaireBubble ? bubbleBody ?? '' : ''}`;
  const hasSpeechBody = Boolean(questionnaireBubble && bubbleBody);
  const [revealAllSpeechKey, setRevealAllSpeechKey] = useState<string | null>(reduceMotion ? speechKey : null);
  const [revealedTitleKey, setRevealedTitleKey] = useState<string | null>(reduceMotion ? speechKey : null);
  const [revealedBodyKey, setRevealedBodyKey] = useState<string | null>(reduceMotion || !hasSpeechBody ? speechKey : null);
  const revealAllSpeech = reduceMotion || revealAllSpeechKey === speechKey;
  const speechFullyRevealed = revealAllSpeech || (
    revealedTitleKey === speechKey
    && (!hasSpeechBody || revealedBodyKey === speechKey)
  );
  const speechBubblePressable = !speechFullyRevealed || Boolean(onSpeechBubblePress);
  const handleSpeechBubblePress = () => {
    if (!speechFullyRevealed) {
      setRevealAllSpeechKey(speechKey);
      return;
    }
    onSpeechBubblePress?.();
  };
  const liftProgress = useSharedValue(lifted ? 1 : 0);
  const tabletGutter = Math.max(28, (width - 720) / 2);
  const horizontalGutter = width >= 700 ? tabletGutter : 20;
  const availableBubbleWidth = width - horizontalGutter * 2;
  const flexibleBubbleRatio = defaultTitleTier === 'long'
    ? 0.98
    : defaultTitleTier === 'medium'
      ? 0.92
      : 0.84;
  const bubbleWidth = questionnaireBubble
    ? Math.min(width >= 700 ? 560 : 470, availableBubbleWidth * 0.96)
    : Math.min(width >= 700 ? 520 : 460, availableBubbleWidth * flexibleBubbleRatio);
  const destinationLift = companionDestinationStageLift(height, width);
  const speechBubbleDrop = companionSpeechBubbleDrop(height);
  const stageLayout = companionHomeStageLayout(width, height, visualKey);
  // The complete art plane lifts on destination pages. Offset the bubble
  // before that transform so its visible position remains below navigation
  // chrome instead of rising beneath the back button.
  const speechBubbleTop = lifted
    ? companionDestinationSpeechBubbleTop(height, insets.top, width)
    : insets.top + 84 + speechBubbleDrop * 0.25;
  const nameplateTop = stageLayout.creatureFrame.stageContactY
    + stageLayout.translateY
    + 7;

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
  const subjectPanStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sceneTranslateX?.value ?? 0 }],
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
          sceneTranslateX={sceneTranslateX}
          visualKey={visualKey}
        />
      </Animated.View>

      <LinearGradient
        colors={[
          'rgba(19,36,24,0)',
          'rgba(19,36,24,0)',
          'rgba(19,36,24,0.10)',
          'rgba(19,36,24,0.42)',
          'rgba(19,36,24,0.76)',
        ]}
        locations={[0, 0.68, 0.78, 0.9, 1]}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.parchmentBlend]}
      />

      <Animated.View pointerEvents={speechBubblePressable ? 'box-none' : 'none'} style={[styles.foregroundPlane, liftStyle]}>
        {showSpeechBubble ? (
          <Animated.View
            accessibilityLabel={`${name} says: ${title}`}
            entering={questionnaireBubble && !reduceMotion ? FadeIn.duration(180) : undefined}
            key={questionnaireBubble ? `question:${title}` : 'destination-speech'}
            onLayout={(event: LayoutChangeEvent) => onSpeechBubbleHeightChange?.(event.nativeEvent.layout.height)}
            style={[{ left: (width - bubbleWidth) / 2, position: 'absolute', top: speechBubbleTop, width: bubbleWidth, zIndex: 4 }, subjectPanStyle]}>
            <Pressable
              accessibilityHint={!speechFullyRevealed ? 'Shows the full message' : onSpeechBubblePress ? 'Advances to the next part of the conversation' : undefined}
              accessibilityRole={speechBubblePressable ? 'button' : undefined}
              disabled={!speechBubblePressable}
              onPress={handleSpeechBubblePress}
              style={({ pressed }) => [
                styles.speechBubble,
                questionnaireBubble && styles.speechBubbleQuestionnaire,
                pressed && speechBubblePressable && styles.speechBubblePressed,
              ]}>
              <View style={styles.speechTail} />
            <TypewriterText
              durationMs={560}
              key={`speech-title:${title}`}
              onComplete={() => setRevealedTitleKey(speechKey)}
              reduceMotion={reduceMotion}
              revealAll={revealAllSpeech}
              style={[
                styles.title,
                compact && styles.titleCompact,
                !questionnaireBubble && defaultTitleTier === 'medium' && styles.titleMedium,
                !questionnaireBubble && defaultTitleTier === 'long' && styles.titleLong,
                questionnaireBubble && styles.questionTitle,
                questionnaireBubble && title.length > 58 && styles.questionTitleLong,
              ]}
              numberOfLines={questionnaireBubble ? 2 : 3}
              minimumFontScale={0.72}
              text={title}
              lightColor="#342317"
              darkColor="#342317"
            />
            {questionnaireBubble && bubbleBody ? (
              <TypewriterText
                delayMs={170}
                durationMs={640}
                key={`speech-body:${bubbleBody}`}
                onComplete={() => setRevealedBodyKey(speechKey)}
                reduceMotion={reduceMotion}
                revealAll={revealAllSpeech}
                style={styles.questionBody}
                numberOfLines={2}
                minimumFontScale={0.76}
                text={bubbleBody}
                lightColor="#6B5544"
                darkColor="#6B5544"
              />
            ) : null}
            </Pressable>
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
          sceneTranslateX={sceneTranslateX}
          visualKey={visualKey}
        />

        {showNameplate ? (
          <Animated.View
            accessibilityLabel={`${name}, Haven level ${houseLevel ?? 1}`}
            style={[styles.nameplate, { top: nameplateTop }, subjectPanStyle]}>
            <ThemedText selectable style={styles.nameplateEyebrow} lightColor="#F5EBD2" darkColor="#F5EBD2">
              HAVEN · LV {houseLevel ?? 1}
            </ThemedText>
            <ThemedText adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} selectable style={styles.nameplateName} lightColor="#FFD86B" darkColor="#FFD86B">
              {name}
            </ThemedText>
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
}

function TypewriterText({
  darkColor,
  delayMs = 0,
  durationMs,
  lightColor,
  onComplete,
  reduceMotion,
  revealAll = false,
  minimumFontScale = 0.72,
  numberOfLines,
  style,
  text,
}: {
  darkColor: string;
  delayMs?: number;
  durationMs: number;
  lightColor: string;
  onComplete?: () => void;
  reduceMotion: boolean;
  revealAll?: boolean;
  minimumFontScale?: number;
  numberOfLines?: number;
  style: StyleProp<TextStyle>;
  text: string;
}) {
  const characters = useMemo(() => Array.from(text), [text]);
  const [visibleCount, setVisibleCount] = useState(() => reduceMotion ? characters.length : 0);

  useEffect(() => {
    if (reduceMotion || revealAll) {
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
  }, [characters, delayMs, durationMs, reduceMotion, revealAll]);

  const complete = visibleCount >= characters.length;
  useEffect(() => {
    if (complete) onComplete?.();
  }, [complete, onComplete]);
  return (
    <View style={styles.typewriterFrame}>
      <ThemedText
        adjustsFontSizeToFit={Boolean(numberOfLines)}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        maxFontSizeMultiplier={1.3}
        minimumFontScale={minimumFontScale}
        numberOfLines={numberOfLines}
        style={[style, styles.typewriterMeasure]}
        lightColor={lightColor}
        darkColor={darkColor}>
        {text}
      </ThemedText>
      <ThemedText
        adjustsFontSizeToFit={Boolean(numberOfLines)}
        accessibilityLabel={text}
        maxFontSizeMultiplier={1.3}
        minimumFontScale={minimumFontScale}
        numberOfLines={numberOfLines}
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
    borderColor: 'rgba(141,99,43,0.40)',
    borderCurve: 'continuous',
    borderRadius: 27,
    borderWidth: 2,
    boxShadow:
      '0 10px 24px rgba(33,25,15,0.24), inset 0 0 0 3px rgba(255,255,255,0.36), inset 0 1px 0 rgba(255,255,255,0.94)',
    gap: 5,
    paddingHorizontal: 18,
    paddingVertical: 13,
    width: '100%',
  },
  speechBubblePressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  speechBubbleQuestionnaire: {
    paddingBottom: 15,
    paddingHorizontal: 18,
    paddingTop: 15,
  },
  speechTail: {
    backgroundColor: '#FFF8E7',
    borderBottomColor: 'rgba(103,72,39,0.18)',
    borderBottomWidth: 1,
    borderRightColor: 'rgba(103,72,39,0.18)',
    borderRightWidth: 1,
    bottom: -11,
    height: 22,
    position: 'absolute',
    left: '50%',
    marginLeft: -11,
    transform: [{ rotate: '45deg' }],
    width: 22,
  },
  title: {
    ...KatchaUI.type.companionDisplay,
    fontSize: 22,
    lineHeight: 27,
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: 20,
    lineHeight: 25,
  },
  titleMedium: {
    fontSize: 20,
    lineHeight: 25,
  },
  titleLong: {
    fontSize: 18,
    lineHeight: 23,
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
  nameplate: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(35,42,31,0.84)',
    borderColor: 'rgba(244,220,152,0.42)',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    boxShadow: '0 7px 16px rgba(17,24,17,0.32), inset 0 1px 0 rgba(255,255,255,0.14)',
    gap: 0,
    left: '50%',
    marginLeft: -92,
    minHeight: 50,
    paddingHorizontal: 18,
    paddingVertical: 5,
    position: 'absolute',
    width: 184,
    zIndex: 5,
  },
  nameplateEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8, lineHeight: 12 },
  nameplateName: { ...KatchaUI.type.companionName, fontSize: 23, lineHeight: 27, textAlign: 'center' },
});
