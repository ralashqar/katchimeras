import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  type StyleProp,
  StyleSheet,
  type TextStyle,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInLeft,
  FadeInRight,
  FadeInUp,
  FadeOutDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TodaySceneBackdrop } from '@/components/katchadeck/home/today-scene-backdrop';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { KatchaDeckUI } from '@/constants/theme';
import { Meadow } from '@/constants/meadow-theme';
import type { TodayAtmosphereBackground } from '@/utils/day-background-scene';
import type { QuestionnaireImageSource } from '@/utils/companion-questionnaire-presentation';

export type CompanionQuestionnaireOption = {
  id: string;
  label: string;
  icon?: IconSymbolName | null;
};

export function CompanionQuestionnaireScene({
  accentColor,
  background,
  children,
  companionName,
  creature,
  helperText,
  onBack,
  onSelect,
  options,
  progress,
  result = false,
  stepLabel,
  title,
}: {
  accentColor: string;
  background: TodayAtmosphereBackground;
  children?: ReactNode;
  companionName: string;
  creature: QuestionnaireImageSource;
  helperText?: string;
  onBack: () => void;
  onSelect?: (option: CompanionQuestionnaireOption) => void;
  options?: readonly CompanionQuestionnaireOption[];
  progress?: number;
  result?: boolean;
  stepLabel: string;
  title: string;
}) {
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const compact = height < 720;
  const longTitle = title.length > 58;
  const titleWordCount = wordCount(title);
  const totalWordCount = titleWordCount + wordCount(helperText ?? '');
  const wordDelay = Math.max(18, Math.min(42, Math.round(340 / Math.max(1, totalWordCount - 1))));
  const optionRevealDelay = reduceMotion ? 0 : Math.min(460, Math.max(260, totalWordCount * wordDelay));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const lowerScrollRef = useRef<ScrollView>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousTitleRef = useRef(title);
  const creatureShake = useSharedValue(0);
  const progressValue = useSharedValue(progress ?? 0);
  const creatureShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: creatureShake.value }],
  }));
  const progressStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progressValue.value }],
  }));

  useEffect(() => {
    setSelectedId(null);
    lowerScrollRef.current?.scrollTo({ animated: false, x: 0, y: 0 });
    if (timerRef.current) clearTimeout(timerRef.current);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [title]);

  useEffect(() => {
    if (previousTitleRef.current === title) return;
    previousTitleRef.current = title;
    if (reduceMotion) {
      creatureShake.value = 0;
      return;
    }
    creatureShake.value = withSequence(
      withTiming(-4, { duration: 45, easing: Easing.out(Easing.quad) }),
      withTiming(4, { duration: 60, easing: Easing.inOut(Easing.quad) }),
      withTiming(-2, { duration: 50, easing: Easing.inOut(Easing.quad) }),
      withTiming(0, { duration: 65, easing: Easing.out(Easing.cubic) }),
    );
  }, [creatureShake, reduceMotion, title]);

  useEffect(() => {
    if (progress === undefined) return;
    progressValue.value = withTiming(progress, {
      duration: reduceMotion ? 0 : 420,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, progressValue, reduceMotion]);

  const select = (option: CompanionQuestionnaireOption) => {
    if (selectedId || !onSelect) return;
    setSelectedId(option.id);
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    timerRef.current = setTimeout(() => onSelect(option), reduceMotion ? 0 : 150);
  };

  return (
    <View style={[styles.root, { height, width }]}>
      <TodaySceneBackdrop background={background} scene={null} variant="splash" />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: `${accentColor}0C` }]} />
      <LinearGradient
        colors={['rgba(26,60,94,0.14)', 'rgba(24,75,117,0.02)', 'rgba(22,49,78,0.28)']}
        locations={[0, 0.42, 1]}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, { paddingTop: insets.top + 12 }]}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Back to You"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <IconSymbol color={Meadow.ink} name="chevron.left" size={23} />
          </Pressable>
          <View style={styles.headerCopy}>
            <ThemedText style={styles.eyebrow} lightColor="#FFD36E" darkColor="#FFD36E">
              You &amp; {companionName}
            </ThemedText>
            <ThemedText style={styles.step} lightColor="#F8FCFF" darkColor="#F8FCFF">
              {stepLabel}
            </ThemedText>
          </View>
        </View>

        {progress !== undefined ? (
          <View
            accessibilityLabel={`${Math.round(progress * 100)} percent complete`}
            accessibilityRole="progressbar"
            accessibilityValue={{ max: 100, min: 0, now: Math.round(progress * 100) }}
            style={styles.track}>
            <Animated.View
              style={[styles.trackFill, { backgroundColor: accentColor }, progressStyle]}
            />
          </View>
        ) : null}

        <View style={[styles.stage, compact && styles.stageCompact]}>
          <Animated.View
            entering={reduceMotion ? FadeIn.duration(80) : FadeInRight.duration(220)}
            style={[styles.bubble, compact && styles.bubbleCompact, { width: width < 390 ? '70%' : '68%' }]}>
            <View style={[styles.bubbleAccent, { backgroundColor: accentColor }]} />
            <WordRevealText
              darkColor="#35251B"
              lightColor="#35251B"
              reduceMotion={reduceMotion}
              sequenceKey={title}
              style={[styles.title, compact && styles.titleCompact, longTitle && styles.titleLong]}
              text={title}
              wordDelay={wordDelay}
            />
            {helperText ? (
              <WordRevealText
                darkColor="#675346"
                lightColor="#675346"
                reduceMotion={reduceMotion}
                sequenceKey={title}
                startIndex={titleWordCount}
                style={styles.helper}
                text={helperText}
                wordDelay={wordDelay}
              />
            ) : null}
            <View style={styles.tail} />
          </Animated.View>
          <Animated.View
            entering={reduceMotion ? FadeIn.duration(80) : FadeInUp.duration(230)}
            style={[
              styles.creatureFrame,
              compact && styles.creatureFrameCompact,
              creatureShakeStyle,
            ]}>
            <Image
              accessibilityLabel={`${companionName}, your Katchimera`}
              contentFit="contain"
              source={creature}
              style={styles.creature}
            />
          </Animated.View>
        </View>

        <ScrollView
          ref={lowerScrollRef}
          automaticallyAdjustContentInsets={false}
          bounces
          contentContainerStyle={[
            styles.lowerContent,
            {
              paddingBottom: insets.bottom + 24,
              paddingHorizontal: Math.max(22, (width - 620) / 2 + 22),
            },
          ]}
          contentInsetAdjustmentBehavior="never"
          endFillColor="transparent"
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          style={[styles.lowerScroll, { width }]}>
          {options?.length ? (
            <View accessibilityRole="radiogroup" style={styles.options}>
              {options.map((option, index) => {
                const selected = selectedId === option.id;
                return (
                  <Animated.View
                    entering={
                      reduceMotion
                        ? FadeIn.duration(80)
                        : FadeInLeft.delay(optionRevealDelay + index * 38)
                            .duration(220)
                            .easing(Easing.out(Easing.cubic))
                    }
                    exiting={
                      reduceMotion
                        ? undefined
                        : FadeOutDown.delay(index * 22)
                            .duration(150)
                            .easing(Easing.in(Easing.cubic))
                    }
                    key={`${title}:${option.id}`}>
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected, disabled: Boolean(selectedId) }}
                      disabled={Boolean(selectedId)}
                      onPress={() => select(option)}
                      style={({ pressed }) => [
                        styles.option,
                        selected && { borderColor: accentColor, backgroundColor: '#FFF5D8' },
                        pressed && !selectedId && styles.optionPressed,
                      ]}>
                      {option.icon ? (
                        <View style={[styles.optionIcon, { backgroundColor: `${accentColor}24` }]}>
                          <IconSymbol color={accentColor} name={option.icon} size={21} />
                        </View>
                      ) : null}
                      <ThemedText style={styles.optionLabel} lightColor={Meadow.ink} darkColor={Meadow.ink}>
                        {option.label}
                      </ThemedText>
                      <IconSymbol
                        color={selected ? accentColor : Meadow.goldDeep}
                        name={selected ? 'checkmark' : 'chevron.right'}
                        size={20}
                      />
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          ) : null}

          {result ? <Animated.View entering={reduceMotion ? FadeIn.duration(80) : FadeInUp.duration(220)} style={styles.resultContent}>{children}</Animated.View> : children}
        </ScrollView>
      </View>
    </View>
  );
}

function WordRevealText({
  darkColor,
  lightColor,
  reduceMotion,
  sequenceKey,
  startIndex = 0,
  style,
  text,
  wordDelay,
}: {
  darkColor: string;
  lightColor: string;
  reduceMotion: boolean;
  sequenceKey: string;
  startIndex?: number;
  style: StyleProp<TextStyle>;
  text: string;
  wordDelay: number;
}) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const [revealState, setRevealState] = useState({
    count: reduceMotion ? words.length : 0,
    sequenceKey,
  });
  const visibleWordCount = revealState.sequenceKey === sequenceKey
    ? revealState.count
    : 0;

  useEffect(() => {
    if (reduceMotion) {
      setRevealState({ count: words.length, sequenceKey });
      return;
    }

    setRevealState({ count: 0, sequenceKey });
    const timers = Array.from({ length: words.length }, (_, index) =>
      setTimeout(() => {
        setRevealState((current) =>
          current.sequenceKey === sequenceKey
            ? { ...current, count: index + 1 }
            : current,
        );
      }, (startIndex + index) * wordDelay),
    );

    return () => timers.forEach(clearTimeout);
  }, [reduceMotion, sequenceKey, startIndex, text, wordDelay, words.length]);

  return (
    <ThemedText
      accessibilityLabel={text}
      selectable
      style={style}
      lightColor={lightColor}
      darkColor={darkColor}>
      {words.map((word, index) => (
        <RevealingWord
          key={`${sequenceKey}:${text}:${index}`}
          reduceMotion={reduceMotion}
          revealed={index < visibleWordCount}>
          {word}{index < words.length - 1 ? ' ' : ''}
        </RevealingWord>
      ))}
    </ThemedText>
  );
}

function RevealingWord({
  children,
  reduceMotion,
  revealed,
}: {
  children: ReactNode;
  reduceMotion: boolean;
  revealed: boolean;
}) {
  const opacity = useSharedValue(reduceMotion || revealed ? 1 : 0);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  useEffect(() => {
    if (!revealed) {
      opacity.value = 0;
      return;
    }
    opacity.value = withTiming(1, {
      duration: reduceMotion ? 0 : 115,
      easing: Easing.out(Easing.cubic),
    });
  }, [opacity, reduceMotion, revealed]);

  return (
    <Animated.Text accessible={false} style={animatedStyle}>
      {children}
    </Animated.Text>
  );
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

const styles = StyleSheet.create({
  root: { alignSelf: 'center', flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' },
  content: { alignSelf: 'center', flex: 1, gap: 13, maxWidth: 620, minHeight: 0, paddingHorizontal: 22, paddingTop: 12, width: '100%' },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  back: { alignItems: 'center', backgroundColor: 'rgba(255,249,235,0.96)', borderColor: 'rgba(117,82,44,0.26)', borderRadius: 999, borderWidth: 1, boxShadow: '0 5px 14px rgba(55,38,20,0.22), inset 0 1px 0 rgba(255,255,255,0.9)', height: 48, justifyContent: 'center', width: 48 },
  headerCopy: { flex: 1, gap: 1 },
  eyebrow: {
    ...KatchaDeckUI.typography.screenHeader,
    textShadowColor: 'rgba(30,70,111,0.92)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  step: {
    ...KatchaDeckUI.typography.screenMeta,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(27,72,111,0.82)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  track: { backgroundColor: 'rgba(40,42,29,0.42)', borderColor: 'rgba(255,249,235,0.46)', borderRadius: 999, borderWidth: 1, height: 8, overflow: 'hidden' },
  trackFill: { borderRadius: 999, height: '100%', transformOrigin: 'left center', width: '100%' },
  stage: { alignItems: 'flex-start', flexDirection: 'row', minHeight: 255, paddingTop: 10, position: 'relative' },
  stageCompact: { minHeight: 226, paddingTop: 5 },
  bubble: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,250,239,0.98)', borderColor: 'rgba(126,92,53,0.16)', borderCurve: 'continuous', borderRadius: 28, borderWidth: 1, boxShadow: '0 12px 30px rgba(70,44,18,0.22), inset 0 1px 0 rgba(255,255,255,0.94)', gap: 8, overflow: 'visible', paddingBottom: 20, paddingHorizontal: 20, paddingTop: 22, zIndex: 2 },
  bubbleCompact: { paddingBottom: 17, paddingHorizontal: 18, paddingTop: 19 },
  bubbleAccent: { borderRadius: 999, height: 10, opacity: 0.75, position: 'absolute', right: 20, top: 17, width: 10 },
  title: { ...KatchaDeckUI.typography.screenTitle },
  titleCompact: { fontSize: 23, lineHeight: 28 },
  titleLong: { fontSize: 21, lineHeight: 26 },
  helper: { ...KatchaDeckUI.typography.uiBody },
  tail: { backgroundColor: 'rgba(255,250,239,0.98)', height: 26, position: 'absolute', right: -11, top: '55%', transform: [{ rotate: '45deg' }], width: 26 },
  creatureFrame: { alignItems: 'center', height: 275, justifyContent: 'flex-start', position: 'absolute', right: -18, top: -10, width: '49%', zIndex: 4 },
  creatureFrameCompact: { height: 248, right: -16, top: -8, width: '47%' },
  creature: { height: '100%', width: '100%' },
  lowerScroll: { alignSelf: 'center', backgroundColor: 'transparent', flex: 1, minHeight: 0 },
  lowerContent: { backgroundColor: 'transparent', flexGrow: 1, paddingTop: 2 },
  options: { backgroundColor: 'transparent', gap: 10 },
  option: { alignItems: 'center', backgroundColor: 'rgba(255,250,239,0.97)', borderColor: 'rgba(117,82,44,0.22)', borderCurve: 'continuous', borderRadius: 19, borderWidth: 1, boxShadow: '0 7px 18px rgba(67,42,17,0.2), inset 0 1px 0 rgba(255,255,255,0.9)', flexDirection: 'row', gap: 12, minHeight: 62, paddingHorizontal: 15, paddingVertical: 10 },
  optionPressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  optionIcon: { alignItems: 'center', borderRadius: 999, height: 40, justifyContent: 'center', width: 40 },
  optionLabel: { ...KatchaDeckUI.typography.uiAction, flex: 1 },
  resultContent: { backgroundColor: 'rgba(255,250,239,0.94)', borderCurve: 'continuous', borderRadius: 24, boxShadow: '0 10px 28px rgba(67,42,17,0.18)', gap: 14, padding: 18 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.97 }] },
});
