import * as Haptics from 'expo-haptics';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TodaySceneBackdrop } from '@/components/katchadeck/home/today-scene-backdrop';
import { KatchimeraBackButton } from '@/components/katchadeck/ui/katchimera-back-button';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';
import { Meadow } from '@/constants/meadow-theme';
import type { HomeVisualKey } from '@/types/home';
import type { TodayAtmosphereBackground } from '@/utils/day-background-scene';
import type { QuestionnaireImageSource } from '@/utils/companion-questionnaire-presentation';
import type { TodayExplorationBackgroundKey } from '@/utils/today-exploration-backgrounds';
import { CompanionCinematicStage } from './companion-cinematic-stage';

export type CompanionQuestionnaireOption = {
  id: string;
  label: string;
  icon?: IconSymbolName | null;
};

export { CompanionResultNotice as QuestionnaireResultNotice } from './companion-ui-primitives';

export function CompanionQuestionnaireScene({
  accentColor,
  background,
  children,
  companionName,
  creature,
  environmentKey,
  helperText,
  onBack,
  onSelect,
  options,
  progress,
  result = false,
  selectionActionLabel = 'Continue',
  stepLabel,
  title,
  visualKey,
}: {
  accentColor: string;
  background: TodayAtmosphereBackground;
  children?: ReactNode;
  companionName: string;
  creature: QuestionnaireImageSource;
  environmentKey: TodayExplorationBackgroundKey | null;
  helperText?: string;
  onBack: () => void;
  onSelect?: (option: CompanionQuestionnaireOption) => void;
  options?: readonly CompanionQuestionnaireOption[];
  progress?: number;
  result?: boolean;
  selectionActionLabel?: string;
  stepLabel: string;
  title: string;
  visualKey: HomeVisualKey;
}) {
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const compact = height < 720;
  const [selection, setSelection] = useState<{ question: string; optionId: string | null }>({
    optionId: null,
    question: title,
  });
  const selectedId = selection.question === title ? selection.optionId : null;
  const lowerScrollRef = useRef<ScrollView>(null);
  const progressValue = useSharedValue(progress ?? 0);
  const progressStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progressValue.value }],
  }));

  useEffect(() => {
    lowerScrollRef.current?.scrollTo({ animated: false, x: 0, y: 0 });
  }, [title]);

  useEffect(() => {
    if (progress === undefined) return;
    progressValue.value = withTiming(progress, {
      duration: reduceMotion ? 0 : 420,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, progressValue, reduceMotion]);

  const select = (option: CompanionQuestionnaireOption) => {
    if (!onSelect) return;
    setSelection({ optionId: option.id, question: title });
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
  };
  const confirmSelection = () => {
    const selected = options?.find((option) => option.id === selectedId);
    if (selected && onSelect) onSelect(selected);
  };

  return (
    <View style={[styles.root, { height, width }]}>
      <TodaySceneBackdrop background={background} scene={null} variant="splash" />
      <CompanionCinematicStage
        bubbleBody={helperText}
        bubbleVariant="questionnaire"
        creature={creature}
        enterFromLifted
        environmentKey={environmentKey}
        lifted
        name={companionName}
        title={title}
        visualKey={visualKey}
      />

      <View style={[styles.content, { paddingTop: insets.top + 12 }]}>
        <View style={styles.header}>
          <KatchimeraBackButton
            accessibilityHint="Your completed answers are saved"
            accessibilityLabel="Exit to You"
            onPress={onBack}
          />
          <View style={styles.headerCopy}>
            <ThemedText style={styles.eyebrow} lightColor="#FFD36E" darkColor="#FFD36E">
              You &amp; {companionName}
            </ThemedText>
          </View>
        </View>

        <View pointerEvents="none" style={{ height: compact ? 210 : 238 }} />

        <View style={styles.interactionPanel}>
          <View style={styles.progressBlock}>
            <View style={styles.progressHeading}>
              <ThemedText style={styles.step} lightColor="#F9EAC8" darkColor="#F9EAC8">
                {stepLabel}
              </ThemedText>
              {progress !== undefined ? (
                <ThemedText style={styles.progressCount} lightColor="#D9C59D" darkColor="#D9C59D">
                  {Math.round(progress * 100)}%
                </ThemedText>
              ) : null}
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
          </View>

          <ScrollView
            ref={lowerScrollRef}
            automaticallyAdjustContentInsets={false}
            bounces
            contentContainerStyle={[
              styles.lowerContent,
              { paddingBottom: options?.length ? 12 : insets.bottom + 24 },
            ]}
            contentInsetAdjustmentBehavior="never"
            endFillColor="transparent"
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            style={styles.lowerScroll}>
            {options?.length ? (
              <Animated.View
                key={`options:${title}`}
                accessibilityRole="radiogroup"
                entering={reduceMotion ? FadeIn.duration(80) : FadeInUp.duration(220)}
                style={styles.options}>
                {options.map((option) => {
                  const selected = selectedId === option.id;
                  return (
                    <Animated.View key={`${title}:${option.id}`}>
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                        onPress={() => select(option)}
                        style={({ pressed }) => [
                          styles.option,
                          selected && { borderColor: accentColor, backgroundColor: '#FFF5D8' },
                          pressed && styles.optionPressed,
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
              </Animated.View>
            ) : null}

            {result ? <View style={styles.resultContent}>{children}</View> : children}
          </ScrollView>
          {options?.length && selectedId ? (
            <Animated.View
              entering={reduceMotion ? FadeIn.duration(80) : FadeInUp.duration(180)}
              style={[styles.selectionFooter, { paddingBottom: insets.bottom + 12 }]}>
              <Pressable
                accessibilityRole="button"
                onPress={confirmSelection}
                style={({ pressed }) => [
                  styles.selectionAction,
                  { backgroundColor: accentColor },
                  pressed && styles.selectionActionPressed,
                ]}>
                <ThemedText style={styles.selectionActionLabel} lightColor="#2B2018" darkColor="#2B2018">
                  {selectionActionLabel}
                </ThemedText>
                <IconSymbol color="#2B2018" name="arrow.right" size={18} />
              </Pressable>
            </Animated.View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'center', flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' },
  content: { alignSelf: 'center', flex: 1, gap: 10, maxWidth: 620, minHeight: 0, paddingHorizontal: 16, paddingTop: 12, width: '100%', zIndex: 3 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  headerCopy: { flex: 1, gap: 1 },
  eyebrow: {
    ...KatchaUI.type.sectionTitle,
    textShadowColor: 'rgba(30,70,111,0.92)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  step: {
    ...KatchaUI.type.companionAction,
    fontSize: 12.5,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
  },
  interactionPanel: { backgroundColor: '#211A13', borderColor: 'rgba(248,220,165,0.2)', borderCurve: 'continuous', borderRadius: 28, borderWidth: 1, boxShadow: '0 16px 38px rgba(31,20,10,0.32), inset 0 1px 0 rgba(255,255,255,0.06)', flex: 1, minHeight: 0, overflow: 'hidden' },
  progressBlock: { gap: 9, paddingBottom: 12, paddingHorizontal: 16, paddingTop: 15 },
  progressHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  progressCount: { ...KatchaUI.type.meta, fontSize: 10, fontVariant: ['tabular-nums'], fontWeight: '900' },
  track: { backgroundColor: '#413525', borderColor: 'rgba(255,235,192,0.2)', borderRadius: 999, borderWidth: 1, height: 8, overflow: 'hidden' },
  trackFill: { borderRadius: 999, height: '100%', transformOrigin: 'left center', width: '100%' },
  lowerScroll: { backgroundColor: 'transparent', flex: 1, minHeight: 0 },
  lowerContent: { backgroundColor: 'transparent', flexGrow: 1, paddingBottom: 12, paddingHorizontal: 14, paddingTop: 2 },
  options: { backgroundColor: 'transparent', gap: 10 },
  option: { alignItems: 'center', backgroundColor: 'rgba(255,250,239,0.97)', borderColor: 'rgba(117,82,44,0.22)', borderCurve: 'continuous', borderRadius: 19, borderWidth: 1, boxShadow: '0 7px 18px rgba(67,42,17,0.2), inset 0 1px 0 rgba(255,255,255,0.9)', flexDirection: 'row', gap: 12, minHeight: 62, paddingHorizontal: 15, paddingVertical: 10 },
  optionPressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  optionIcon: { alignItems: 'center', borderRadius: 999, height: 40, justifyContent: 'center', width: 40 },
  optionLabel: { ...KatchaUI.type.companionAction, flex: 1 },
  resultContent: { gap: 12 },
  selectionFooter: { backgroundColor: '#211A13', borderTopColor: 'rgba(248,220,165,0.14)', borderTopWidth: 1, paddingHorizontal: 14, paddingTop: 10 },
  selectionAction: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 17, boxShadow: '0 8px 24px rgba(45,31,16,0.25)', flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 52, paddingHorizontal: 18 },
  selectionActionPressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  selectionActionLabel: { ...KatchaUI.type.companionAction, fontWeight: '900' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.97 }] },
});
