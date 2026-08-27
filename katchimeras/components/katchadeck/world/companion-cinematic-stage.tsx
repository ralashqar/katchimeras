import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { type LayoutChangeEvent, Pressable, type StyleProp, StyleSheet, type TextStyle, useWindowDimensions, View, type View as ViewType } from 'react-native';
import Animated, {
  Easing,
  LinearTransition,
  ZoomIn,
  ZoomOut,
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
  companionInteractionCreatureDrop,
  companionSpeechTitleTier,
  companionSpeechBubbleDrop,
  companionHomeStageLayout,
} from '@/utils/companion-home-layout';

import { CompanionHomeEnvironmentStage } from './companion-home-environment-stage';

export function normalizeCompanionSpeechText(text: string | undefined): string {
  return (text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

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
  nameplateEyebrow,
  nameplateTitle,
  rewardPulseKey = 0,
  sceneTranslateX,
  onSpeechBubbleHeightChange,
  onBackgroundReady,
  onCreatureReady,
  onSpeechBubblePress,
  showSpeechBubble = true,
  showNameplate = false,
  stagePresentation = 'full',
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
  nameplateEyebrow?: string;
  nameplateTitle?: string;
  rewardPulseKey?: number;
  sceneTranslateX?: SharedValue<number>;
  onSpeechBubbleHeightChange?: (height: number) => void;
  onBackgroundReady?: () => void;
  onCreatureReady?: () => void;
  onSpeechBubblePress?: () => void;
  showSpeechBubble?: boolean;
  showNameplate?: boolean;
  stagePresentation?: 'full' | 'speech-only';
  title: string;
  visualKey: HomeVisualKey;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { height, width } = useWindowDimensions();
  const incomingSpeechTitle = normalizeCompanionSpeechText(title);
  const incomingSpeechBody = bubbleVariant === 'questionnaire' ? normalizeCompanionSpeechText(bubbleBody) : '';
  const incomingSpeechPresent = incomingSpeechTitle.length > 0 || incomingSpeechBody.length > 0;
  const [retainedSpeech, setRetainedSpeech] = useState(() => ({
    body: incomingSpeechBody,
    title: incomingSpeechTitle,
    variant: bubbleVariant,
  }));
  useLayoutEffect(() => {
    if (!incomingSpeechPresent) return;
    setRetainedSpeech((current) => (
      current.body === incomingSpeechBody
      && current.title === incomingSpeechTitle
      && current.variant === bubbleVariant
        ? current
        : { body: incomingSpeechBody, title: incomingSpeechTitle, variant: bubbleVariant }
    ));
  }, [bubbleVariant, incomingSpeechBody, incomingSpeechPresent, incomingSpeechTitle]);
  // Conversation commits can briefly clear the current node before the next
  // node arrives. Keep the last real line mounted during that handoff; callers
  // still hide the bubble explicitly with showSpeechBubble when it should leave.
  const renderedSpeech = incomingSpeechPresent
    ? { body: incomingSpeechBody, title: incomingSpeechTitle, variant: bubbleVariant }
    : retainedSpeech;
  const questionnaireBubble = renderedSpeech.variant === 'questionnaire';
  const speechTitle = renderedSpeech.title;
  const speechBody = questionnaireBubble ? renderedSpeech.body : '';
  const hasSpeechTitle = speechTitle.length > 0;
  const hasSpeechBody = speechBody.length > 0;
  const speechBubbleVisible = showSpeechBubble && (hasSpeechTitle || hasSpeechBody);
  const defaultTitleTier = companionSpeechTitleTier(speechTitle);
  const speechKey = `${speechTitle}\u0000${speechBody}`;
  const [revealAllSpeechKey, setRevealAllSpeechKey] = useState<string | null>(reduceMotion ? speechKey : null);
  const [revealedTitleKey, setRevealedTitleKey] = useState<string | null>(reduceMotion ? speechKey : null);
  const [revealedBodyKey, setRevealedBodyKey] = useState<string | null>(reduceMotion || !hasSpeechBody ? speechKey : null);
  const revealAllSpeech = reduceMotion || revealAllSpeechKey === speechKey;
  const speechFullyRevealed = !speechBubbleVisible || revealAllSpeech || (
    (!hasSpeechTitle || revealedTitleKey === speechKey)
    && (!hasSpeechBody || revealedBodyKey === speechKey)
  );
  const speechBubblePressable = speechBubbleVisible && (!speechFullyRevealed || Boolean(onSpeechBubblePress));
  const speechBubbleLayout = reduceMotion
    ? undefined
    : LinearTransition.duration(190).easing(Easing.out(Easing.cubic));
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
  const interactionCreatureDrop = companionInteractionCreatureDrop(width, height, visualKey);
  // The complete art plane lifts on destination pages. Offset the bubble
  // before that transform so its visible position remains below navigation
  // chrome instead of rising beneath the back button.
  const speechBubbleTop = lifted
    ? companionDestinationSpeechBubbleTop(height, insets.top, width)
    : insets.top + 84 + speechBubbleDrop * 0.25;
  const nameplateTop = stageLayout.creatureFrame.stageContactY
    + stageLayout.translateY
    + interactionCreatureDrop
    + 7;

  useEffect(() => {
    liftProgress.value = reduceMotion
      ? lifted ? 1 : 0
      : withTiming(lifted ? 1 : 0, {
          duration: 360,
          easing: Easing.out(Easing.cubic),
        });
  }, [liftProgress, lifted, reduceMotion]);

  useEffect(() => {
    if (!speechBubbleVisible) onSpeechBubbleHeightChange?.(0);
  }, [onSpeechBubbleHeightChange, speechBubbleVisible]);

  useEffect(() => {
    if (stagePresentation !== 'speech-only') return;
    onBackgroundReady?.();
    onCreatureReady?.();
  }, [onBackgroundReady, onCreatureReady, stagePresentation]);

  const liftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -destinationLift * liftProgress.value }],
  }));
  const subjectPanStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sceneTranslateX?.value ?? 0 }],
  }));

  return (
    <View pointerEvents="box-none" style={styles.root}>
      {stagePresentation === 'full' ? <Animated.View pointerEvents="none" style={[styles.plane, liftStyle]}>
        <CompanionHomeEnvironmentStage
          backgroundKey={environmentKey}
          creature={creature}
          layer="background"
          name={name}
          onBackgroundReady={onBackgroundReady}
          sceneTranslateX={sceneTranslateX}
          visualKey={visualKey}
        />
      </Animated.View> : null}

      {stagePresentation === 'full' ? <LinearGradient
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
      /> : null}

      <Animated.View pointerEvents={speechBubblePressable ? 'box-none' : 'none'} style={[styles.foregroundPlane, liftStyle]}>
        {speechBubbleVisible ? (
          <Animated.View
            accessibilityLabel={`${name} says: ${[speechTitle, speechBody].filter(Boolean).join(' ')}`}
            entering={reduceMotion ? undefined : ZoomIn.duration(190).easing(Easing.out(Easing.cubic))}
            exiting={reduceMotion ? undefined : ZoomOut.duration(140).easing(Easing.in(Easing.cubic))}
            key={questionnaireBubble ? 'questionnaire-speech' : 'destination-speech'}
            layout={speechBubbleLayout}
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
            {hasSpeechTitle ? <TypewriterText
              durationMs={560}
              onComplete={() => setRevealedTitleKey(speechKey)}
              reduceMotion={reduceMotion}
              revealAll={revealAllSpeech}
              style={[
                styles.title,
                questionnaireBubble && styles.questionTitle,
              ]}
              numberOfLines={4}
              minimumFontScale={0.48}
              text={speechTitle}
              lightColor="#342317"
              darkColor="#342317"
            /> : null}
            {hasSpeechBody ? (
              <TypewriterText
                delayMs={170}
                durationMs={640}
                onComplete={() => setRevealedBodyKey(speechKey)}
                reduceMotion={reduceMotion}
                revealAll={revealAllSpeech}
                style={styles.questionBody}
                numberOfLines={2}
                minimumFontScale={0.48}
                text={speechBody}
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

        {stagePresentation === 'full' ? <CompanionHomeEnvironmentStage
          backgroundKey={environmentKey}
          creature={creature}
          creatureVerticalOffset={interactionCreatureDrop}
          creatureTargetRef={creatureTargetRef}
          layer="creature"
          name={name}
          onCreatureReady={onCreatureReady}
          rewardPulseKey={rewardPulseKey}
          sceneTranslateX={sceneTranslateX}
          visualKey={visualKey}
        /> : null}

        {showNameplate && stagePresentation === 'full' ? (
          <Animated.View
            accessibilityLabel={nameplateTitle
              ? `${nameplateEyebrow ?? 'Journey'}, ${nameplateTitle}`
              : `${name}, Haven level ${houseLevel ?? 1}`}
            style={[styles.nameplate, { top: nameplateTop }, subjectPanStyle]}>
            <ThemedText selectable style={styles.nameplateEyebrow} lightColor="#F5EBD2" darkColor="#F5EBD2">
              {nameplateEyebrow ?? `HAVEN · LV ${houseLevel ?? 1}`}
            </ThemedText>
            <ThemedText adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} selectable style={styles.nameplateName} lightColor="#FFD86B" darkColor="#FFD86B">
              {nameplateTitle ?? name}
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
  const [revealState, setRevealState] = useState(() => ({
    count: reduceMotion ? characters.length : 0,
    text,
  }));
  const visibleCount = revealState.text === text
    ? revealState.count
    : reduceMotion || revealAll ? characters.length : 0;
  const [fittedFontScale, setFittedFontScale] = useState(1);
  const [fitComplete, setFitComplete] = useState(!numberOfLines);
  const [fitWidth, setFitWidth] = useState(0);
  const [measuredLineCount, setMeasuredLineCount] = useState<number | null>(null);
  const largestFittingScaleRef = useRef<number | null>(null);
  const smallestOverflowingScaleRef = useRef<number | null>(null);
  const activeFitRef = useRef({ scale: fittedFontScale, width: fitWidth });
  activeFitRef.current = { scale: fittedFontScale, width: fitWidth };
  const flattenedStyle = StyleSheet.flatten(style);
  const baseFontSize = typeof flattenedStyle?.fontSize === 'number' ? flattenedStyle.fontSize : 14;
  const baseLineHeight = typeof flattenedStyle?.lineHeight === 'number' ? flattenedStyle.lineHeight : baseFontSize * 1.2;
  const fittedTextStyle = fittedFontScale < 1 ? {
    fontSize: baseFontSize * fittedFontScale,
    lineHeight: baseLineHeight * fittedFontScale,
  } : undefined;
  const fittedLineHeight = baseLineHeight * fittedFontScale;
  const fittedFrameStyle = numberOfLines ? {
    height: fittedLineHeight * Math.min(numberOfLines, Math.max(1, measuredLineCount ?? numberOfLines)),
  } : undefined;

  useEffect(() => {
    setFittedFontScale(1);
    setFitComplete(!numberOfLines);
    largestFittingScaleRef.current = null;
    smallestOverflowingScaleRef.current = null;
  }, [fitWidth, numberOfLines, text]);

  useEffect(() => {
    if (reduceMotion || revealAll) {
      setRevealState({ count: characters.length, text });
      return;
    }

    setRevealState({ count: 0, text });
    let frame: number | null = null;
    const startAt = performance.now() + delayMs;
    const reveal = (timestamp: number) => {
      if (timestamp < startAt) {
        frame = requestAnimationFrame(reveal);
        return;
      }
      const ratio = Math.min(1, (timestamp - startAt) / durationMs);
      const nextCount = Math.min(characters.length, Math.ceil(characters.length * ratio));
      setRevealState((current) => (
        current.text === text && current.count === nextCount
          ? current
          : { count: nextCount, text }
      ));
      if (ratio < 1) frame = requestAnimationFrame(reveal);
    };
    frame = requestAnimationFrame(reveal);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [characters, delayMs, durationMs, reduceMotion, revealAll, text]);

  const complete = visibleCount >= characters.length;
  useEffect(() => {
    if (complete) onComplete?.();
  }, [complete, onComplete]);
  return (
    <View
      onLayout={(event) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width * 2) / 2;
        if (nextWidth > 0) setFitWidth((current) => current === nextWidth ? current : nextWidth);
      }}
      style={styles.typewriterLayout}>
      {numberOfLines && fitWidth > 0 ? <ThemedText
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        key={`fit:${fitWidth}:${fittedFontScale}`}
        maxFontSizeMultiplier={1.3}
        onTextLayout={(event) => {
          const measurementScale = fittedFontScale;
          if (
            activeFitRef.current.width !== fitWidth
            || activeFitRef.current.scale !== measurementScale
          ) return;
          const lineCount = event.nativeEvent.lines.length;
          if (fitComplete) return;

          if (lineCount <= numberOfLines) {
            largestFittingScaleRef.current = measurementScale;
            const overflowingScale = smallestOverflowingScaleRef.current;
            if (measurementScale === 1 || overflowingScale === null || overflowingScale - measurementScale <= 0.002) {
              setMeasuredLineCount(lineCount);
              setFitComplete(true);
              return;
            }
            setFittedFontScale(Number(((measurementScale + overflowingScale) / 2).toFixed(4)));
            return;
          }

          smallestOverflowingScaleRef.current = measurementScale;
          const fittingScale = largestFittingScaleRef.current;
          if (measurementScale <= minimumFontScale) {
            setMeasuredLineCount(numberOfLines);
            setFitComplete(true);
            return;
          }
          if (fittingScale !== null && measurementScale - fittingScale <= 0.002) {
            setFittedFontScale(fittingScale);
            setMeasuredLineCount(numberOfLines);
            setFitComplete(true);
            return;
          }
          const nextScale = fittingScale === null
            ? (minimumFontScale + measurementScale) / 2
            : (fittingScale + measurementScale) / 2;
          setFittedFontScale(Number(Math.max(minimumFontScale, nextScale).toFixed(4)));
        }}
        style={[style, fittedTextStyle, styles.typewriterMeasure, { width: fitWidth }]}
        lightColor={lightColor}
        darkColor={darkColor}>
        {text}
      </ThemedText> : null}
      <View style={[styles.typewriterFrame, fittedFrameStyle]}>
        <ThemedText
          accessibilityLabel={text}
          maxFontSizeMultiplier={1.3}
          numberOfLines={fitComplete ? numberOfLines : undefined}
          selectable={complete}
          style={[StyleSheet.absoluteFill, style, fittedTextStyle]}
          lightColor={lightColor}
          darkColor={darkColor}>
          {characters.slice(0, visibleCount).join('')}
        </ThemedText>
      </View>
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
  typewriterLayout: {
    alignSelf: 'stretch',
    position: 'relative',
  },
  typewriterFrame: { overflow: 'hidden', position: 'relative' },
  typewriterMeasure: {
    color: 'transparent',
    left: 0,
    position: 'absolute',
    top: 0,
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
    lineHeight: 25,
    textAlign: 'center',
  },
  questionTitle: {
    fontSize: 22,
    lineHeight: 25,
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
