import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
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
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TodaySceneBackdrop } from '@/components/katchadeck/home/today-scene-backdrop';
import { BondIconArt } from '@/components/katchadeck/ui/bond-icon-art';
import { KatchimeraBackButton } from '@/components/katchadeck/ui/katchimera-back-button';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';
import {
  companionChoiceColumnCount,
  COMPANION_PANEL_LAYOUT_DURATION_MS,
  estimatedCompanionChoiceContentHeight,
  useCompanionAdaptivePanel,
} from '@/hooks/use-companion-adaptive-panel';
import type { HomeVisualKey } from '@/types/home';
import type { TodayAtmosphereBackground } from '@/utils/day-background-scene';
import type { QuestionnaireImageSource } from '@/utils/companion-questionnaire-presentation';
import { companionQuestionnaireHeroSpacer } from '@/utils/companion-home-layout';
import type { TodayExplorationBackgroundKey } from '@/utils/today-exploration-backgrounds';
import { companionFirstPersonText } from '@/utils/companion-dialogue';
import type { CompanionBondProgress } from '@/utils/companion-bond';
import { CompanionChoiceList } from './companion-choice-list';
import { CompanionCinematicStage } from './companion-cinematic-stage';
import { KatchimeraPageHeader } from './katchimera-page-header';

export type CompanionQuestionnaireOption = {
  id: string;
  label: string;
  icon?: IconSymbolName | null;
};

export { CompanionResultNotice as QuestionnaireResultNotice } from './companion-ui-primitives';

export function CompanionQuestionnaireScene({
  accentColor,
  background,
  bondProgress,
  children,
  choicePresentation = 'responsive-grid',
  companionName,
  creature,
  environmentKey,
  helperText,
  onBack,
  onOpenMore,
  onOpenCards,
  onOpenTrophies,
  onSelect,
  options,
  progress,
  presentation = 'immersive',
  result = false,
  selectionActionLabel: _selectionActionLabel = 'Next',
  stepLabel,
  title,
  visualKey,
}: {
  accentColor: string;
  background: TodayAtmosphereBackground;
  bondProgress?: CompanionBondProgress;
  children?: ReactNode;
  choicePresentation?: 'responsive-grid' | 'single-column';
  companionName: string;
  creature: QuestionnaireImageSource;
  environmentKey: TodayExplorationBackgroundKey | null;
  helperText?: string;
  onBack: () => void;
  onOpenMore?: () => void;
  onOpenCards?: () => void;
  onOpenTrophies?: () => void;
  onSelect?: (option: CompanionQuestionnaireOption) => void;
  options?: readonly CompanionQuestionnaireOption[];
  progress?: number;
  presentation?: 'immersive' | 'conversation';
  result?: boolean;
  selectionActionLabel?: string;
  stepLabel: string;
  title: string;
  visualKey: HomeVisualKey;
}) {
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const [speechBubbleHeight, setSpeechBubbleHeight] = useState(0);
  const [selection, setSelection] = useState<{ question: string; optionId: string | null }>({
    optionId: null,
    question: title,
  });
  const selectedId = selection.question === title ? selection.optionId : null;
  const lowerScrollRef = useRef<ScrollView>(null);
  const progressValue = useSharedValue(progress ?? 0);
  const conversationPresentation = presentation === 'conversation';
  const optionCount = options?.length ?? 0;
  const estimatedPanelContentHeight = result
    ? 220
    : estimatedCompanionChoiceContentHeight(
        optionCount,
        choicePresentation === 'single-column'
          ? 1
          : companionChoiceColumnCount(width, optionCount),
      );
  const panelContentKey = `${title}:${result ? 'result' : 'question'}:${choicePresentation}:${options?.map((option) => option.id).join(',') ?? 'no-options'}`;
  const adaptivePanel = useCompanionAdaptivePanel({
    chromeHeight: progress === undefined ? 43 : 61,
    contentKey: panelContentKey,
    estimatedContentHeight: estimatedPanelContentHeight,
    safeAreaBottom: insets.bottom,
    safeAreaTop: insets.top,
    viewportHeight: height,
  });
  const spokenTitle = companionFirstPersonText(title, companionName);
  const spokenHelperText = helperText
    ? companionFirstPersonText(helperText, companionName)
    : undefined;
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
    onSelect(option);
  };

  return (
    <View style={[styles.root, { height, width }]}>
      <TodaySceneBackdrop background={background} scene={null} variant="splash" />
      <CompanionCinematicStage
        bubbleBody={spokenHelperText}
        bubbleVariant="questionnaire"
        creature={creature}
        environmentKey={environmentKey}
        lifted
        name={companionName}
        onSpeechBubbleHeightChange={setSpeechBubbleHeight}
        title={spokenTitle}
        visualKey={visualKey}
      />

      <View style={[
        styles.content,
        conversationPresentation && styles.conversationContent,
        {
          paddingBottom: conversationPresentation ? insets.bottom + 16 : 0,
          paddingTop: insets.top + 12,
        },
      ]}>
        {conversationPresentation ? <KatchimeraPageHeader
          bondProgress={bondProgress}
          includeSafeArea={false}
          onBack={onBack}
          onOpenCards={onOpenCards}
          onOpenTrophies={onOpenTrophies}
        /> : null}
        <View style={[styles.header, conversationPresentation && styles.conversationHeader, conversationPresentation && { display: 'none' }]}>
          <KatchimeraBackButton
            accessibilityHint="Your completed answers are saved"
            accessibilityLabel="Exit to You"
            onPress={onBack}
          />
          {conversationPresentation ? (
            <>
              <View style={styles.portraitFrame}>
                <Image accessibilityLabel={`${companionName} portrait`} contentFit="contain" source={creature} style={styles.portrait} />
              </View>
              <View style={styles.modernHeaderCopy}>
                <ThemedText
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                  numberOfLines={1}
                  style={styles.companionName}
                  lightColor="#FFD36E"
                  darkColor="#FFD36E">
                  {companionName}
                </ThemedText>
                {bondProgress ? (
                  <View
                    accessibilityLabel={`${bondProgress.relationshipStage} bond, ${Math.round(bondProgress.relationshipStageRatio * 100)} percent to the next stage`}
                    style={styles.bondRow}>
                    <BondIconArt size={17} />
                    <ThemedText style={styles.bondLabel} lightColor="#FFF1CC" darkColor="#FFF1CC">
                      {bondProgress.relationshipStage}
                    </ThemedText>
                    <View style={styles.bondTrack}>
                      <View style={[styles.bondFill, { width: `${Math.max(bondProgress.totalPoints ? 5 : 0, bondProgress.relationshipStageRatio * 100)}%` }]} />
                    </View>
                  </View>
                ) : null}
              </View>
              {onOpenMore ? (
                <Pressable
                  accessibilityLabel="Open companion story dashboard"
                  accessibilityRole="button"
                  onPress={onOpenMore}
                  style={({ pressed }) => [styles.storyButton, pressed && styles.storyButtonPressed]}>
                  <IconSymbol color="#6B4A24" name="book.closed.fill" size={17} weight="bold" />
                  <ThemedText style={styles.storyButtonLabel} lightColor="#6B4A24" darkColor="#6B4A24">Story</ThemedText>
                </Pressable>
              ) : null}
            </>
          ) : (
            <View style={styles.headerCopy}>
              <ThemedText style={styles.eyebrow} lightColor="#FFD36E" darkColor="#FFD36E">
                You &amp; {companionName}
              </ThemedText>
            </View>
          )}
        </View>

        <View
          pointerEvents="none"
          style={conversationPresentation
            ? styles.conversationHeroSpacer
            : { height: companionQuestionnaireHeroSpacer(height, speechBubbleHeight) }}
        />

        <Animated.View
          layout={conversationPresentation && !reduceMotion
            ? LinearTransition.duration(COMPANION_PANEL_LAYOUT_DURATION_MS)
            : undefined}
          style={[
          styles.interactionPanel,
          conversationPresentation && styles.conversationPanel,
          conversationPresentation && { height: adaptivePanel.panelHeight },
        ]}>
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
            bounces={conversationPresentation ? adaptivePanel.scrollable : true}
            contentContainerStyle={[
              styles.lowerContent,
              { paddingBottom: options?.length ? 12 : insets.bottom + 24 },
            ]}
            contentInsetAdjustmentBehavior="never"
            endFillColor="transparent"
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            onContentSizeChange={(_, contentHeight) => adaptivePanel.onContentHeightChange(contentHeight)}
            scrollEnabled={conversationPresentation ? adaptivePanel.scrollable : true}
            showsVerticalScrollIndicator={false}
            style={styles.lowerScroll}>
            {options?.length ? (
              <Animated.View
                key={`options:${title}`}
                accessibilityRole="radiogroup"
                entering={reduceMotion ? FadeIn.duration(80) : FadeInUp.duration(220)}
                style={styles.options}>
                <CompanionChoiceList
                  accentColor={accentColor}
                  onSelect={(optionId) => {
                    const option = options.find((candidate) => candidate.id === optionId);
                    if (option) select(option);
                  }}
                  options={options}
                  presentation={choicePresentation}
                  selectedOptionId={selectedId}
                />
              </Animated.View>
            ) : null}

            {result ? <View style={styles.resultContent}>{children}</View> : children}
          </ScrollView>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'center', flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' },
  content: { alignSelf: 'center', flex: 1, gap: 10, maxWidth: 620, minHeight: 0, paddingHorizontal: 16, paddingTop: 12, width: '100%', zIndex: 3 },
  conversationContent: { maxWidth: 720 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  conversationHeader: { gap: 0, minHeight: 48, zIndex: 4 },
  headerCopy: { flex: 1, gap: 1 },
  portraitFrame: { alignItems: 'center', backgroundColor: 'rgba(255,247,220,0.92)', borderColor: 'rgba(255,225,158,0.7)', borderCurve: 'continuous', borderRadius: 15, borderWidth: 1, height: 46, justifyContent: 'center', marginLeft: 10, overflow: 'hidden', width: 46 },
  portrait: { height: 44, width: 44 },
  modernHeaderCopy: { flex: 1, gap: 3, paddingHorizontal: 9 },
  companionName: { ...KatchaUI.type.companionName, fontSize: 22, lineHeight: 25 },
  bondRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  bondLabel: { fontSize: 9.5, fontWeight: '900' },
  bondTrack: { backgroundColor: 'rgba(255,244,213,0.25)', borderRadius: 999, flex: 1, height: 5, overflow: 'hidden' },
  bondFill: { backgroundColor: '#E8B547', borderRadius: 999, height: '100%' },
  storyButton: { alignItems: 'center', backgroundColor: 'rgba(255,248,225,0.94)', borderCurve: 'continuous', borderRadius: 14, gap: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 10 },
  storyButtonPressed: { opacity: 0.68 },
  storyButtonLabel: { fontSize: 8.5, fontWeight: '900' },
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
  interactionPanel: { backgroundColor: KatchaUI.companionScenePanel.background, borderColor: KatchaUI.companionScenePanel.border, borderCurve: 'continuous', borderRadius: 28, borderWidth: 1, boxShadow: KatchaUI.companionScenePanel.shadow, flex: 1, minHeight: 0, overflow: 'hidden' },
  conversationHeroSpacer: { flex: 1, minHeight: 120 },
  conversationPanel: { borderRadius: 30, flex: 0, maxHeight: 520 },
  progressBlock: { gap: 9, paddingBottom: 12, paddingHorizontal: 16, paddingTop: 15 },
  progressHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  progressCount: { ...KatchaUI.type.meta, fontSize: 10, fontVariant: ['tabular-nums'], fontWeight: '900' },
  track: { backgroundColor: KatchaUI.companionScenePanel.softBackground, borderColor: KatchaUI.companionScenePanel.softBorder, borderRadius: 999, borderWidth: 1, height: 8, overflow: 'hidden' },
  trackFill: { borderRadius: 999, height: '100%', transformOrigin: 'left center', width: '100%' },
  lowerScroll: { backgroundColor: 'transparent', flex: 1, minHeight: 0 },
  lowerContent: { backgroundColor: 'transparent', flexGrow: 1, paddingBottom: 12, paddingHorizontal: 14, paddingTop: 2 },
  options: { backgroundColor: 'transparent', gap: 10 },
  resultContent: { gap: 12 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.97 }] },
});
