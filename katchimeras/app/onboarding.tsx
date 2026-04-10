import { Redirect, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import PagerView from 'react-native-pager-view';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import { CollectibleCard } from '@/components/katchadeck/collectible-card';
import { HoodedAvatar } from '@/components/katchadeck/hooded-avatar';
import {
  CinematicOnboardingPage,
} from '@/components/katchadeck/onboarding/cinematic-onboarding-page';
import {
  presenceEnter,
  presenceExit,
  rewardEnter,
  usePressMotion,
} from '@/components/katchadeck/motion';
import { ProgressBar } from '@/components/katchadeck/progress-bar';
import { GlassPanel } from '@/components/katchadeck/ui/glass-panel';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  aspirationOptions,
  createStarterReveal,
  painPointOptions,
  preferenceOptions,
} from '@/constants/katchadeck';
import { timelineDemoEntries, timelineTomorrowState } from '@/constants/timeline-demo';
import { KatchaDeckUI } from '@/constants/theme';
import {
  defaultOnboardingProfile,
  loadOnboardingProfile,
  saveOnboardingProfile,
} from '@/utils/onboarding-state';

type OnboardingTheme = {
  accentColor: string;
  colors: readonly [string, string, string];
  meshColors: readonly [string, string, string, string];
  pageLabel: string;
  primaryCtaLabel?: string;
  secondaryCtaLabel?: string;
};

const pageThemes: OnboardingTheme[] = [
  {
    accentColor: 'rgba(200,216,255,0.12)',
    colors: ['#05070D', '#0B1020', '#12172A'],
    meshColors: [
      'rgba(200,216,255,0.12)',
      'rgba(106,95,232,0.06)',
      'rgba(95,168,123,0.04)',
      'rgba(243,183,136,0.06)',
    ],
    pageLabel: 'Intro',
  },
  {
    accentColor: 'rgba(200,216,255,0.12)',
    colors: ['#090B12', '#101828', '#151E30'],
    meshColors: [
      'rgba(200,216,255,0.14)',
      'rgba(106,95,232,0.06)',
      'rgba(95,168,123,0.06)',
      'rgba(200,216,255,0.06)',
    ],
    pageLabel: 'Your goal',
    primaryCtaLabel: 'This fits',
  },
  {
    accentColor: 'rgba(227,160,110,0.12)',
    colors: ['#090B12', '#131825', '#1A1F2E'],
    meshColors: [
      'rgba(227,160,110,0.14)',
      'rgba(200,216,255,0.06)',
      'rgba(106,95,232,0.08)',
      'rgba(95,168,123,0.06)',
    ],
    pageLabel: 'What is missing',
    primaryCtaLabel: 'Keep going',
  },
  {
    accentColor: 'rgba(95,168,123,0.12)',
    colors: ['#090B12', '#101926', '#152133'],
    meshColors: [
      'rgba(95,168,123,0.14)',
      'rgba(200,216,255,0.08)',
      'rgba(106,95,232,0.06)',
      'rgba(227,160,110,0.06)',
    ],
    pageLabel: 'World tone',
    primaryCtaLabel: 'Shape my deck',
  },
  {
    accentColor: 'rgba(227,160,110,0.14)',
    colors: ['#090B12', '#171329', '#221C35'],
    meshColors: [
      'rgba(227,160,110,0.14)',
      'rgba(200,216,255,0.08)',
      'rgba(106,95,232,0.1)',
      'rgba(95,168,123,0.06)',
    ],
    pageLabel: 'Reading your pattern',
  },
  {
    accentColor: 'rgba(200,216,255,0.12)',
    colors: ['#090B12', '#10192A', '#171E34'],
    meshColors: [
      'rgba(200,216,255,0.14)',
      'rgba(227,160,110,0.08)',
      'rgba(95,168,123,0.08)',
      'rgba(106,95,232,0.08)',
    ],
    pageLabel: 'First reveal',
    primaryCtaLabel: 'See what this becomes',
  },
  {
    accentColor: 'rgba(200,216,255,0.14)',
    colors: ['#090B12', '#12192A', '#1A2136'],
    meshColors: [
      'rgba(200,216,255,0.16)',
      'rgba(240,223,255,0.1)',
      'rgba(255,216,192,0.08)',
      'rgba(95,168,123,0.06)',
    ],
    pageLabel: 'What happens next',
    primaryCtaLabel: 'Open my timeline',
    secondaryCtaLabel: 'See premium preview',
  },
];

const CINEMATIC_PAGE_INDEX = 0;
const GOAL_PAGE = 1;
const PAIN_PAGE = GOAL_PAGE + 1;
const WORLD_PAGE = GOAL_PAGE + 2;
const PROCESSING_PAGE = GOAL_PAGE + 3;
const REVEAL_PAGE = GOAL_PAGE + 4;

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pagerRef = useRef<PagerView>(null);
  const storedProfile = loadOnboardingProfile();
  const [page, setPage] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const [draft, setDraft] = useState(() => ({
    aspirationId: storedProfile.aspirationId,
    painPointIds: storedProfile.painPointIds,
    preferenceIds: storedProfile.preferenceIds,
  }));

  const reveal = useMemo(
    () =>
      createStarterReveal({
        ...defaultOnboardingProfile,
        ...draft,
      }),
    [draft]
  );

  const totalSteps = pageThemes.length;
  const isCinematicStep = page === CINEMATIC_PAGE_INDEX;
  const isProcessingStep = page === PROCESSING_PAGE;
  const isFinalStep = page === totalSteps - 1;
  const currentTheme = pageThemes[page];
  const progressCurrent = Math.max(1, page);
  const progressTotal = totalSteps - 2;

  useEffect(() => {
    if (!isProcessingStep) {
      return;
    }

    const timer = setTimeout(() => {
      setCurrentPage(REVEAL_PAGE);
    }, 1650);

    return () => clearTimeout(timer);
  }, [isProcessingStep]);

  const canContinue =
    page === GOAL_PAGE
      ? Boolean(draft.aspirationId)
      : page === PAIN_PAGE
        ? draft.painPointIds.length > 0
        : page === WORLD_PAGE
          ? draft.preferenceIds.length > 0
          : true;

  function setCurrentPage(nextPage: number) {
    pagerRef.current?.setPage(nextPage);
    setPage(nextPage);
  }

  function handleNext() {
    if (!canContinue || page >= totalSteps - 1 || isProcessingStep) {
      return;
    }

    setCurrentPage(page + 1);
  }

  function togglePainPoint(id: string) {
    setDraft((current) => ({
      ...current,
      painPointIds: current.painPointIds.includes(id)
        ? current.painPointIds.filter((item) => item !== id)
        : [...current.painPointIds, id],
    }));
  }

  function togglePreference(id: string) {
    setDraft((current) => ({
      ...current,
      preferenceIds: current.preferenceIds.includes(id)
        ? current.preferenceIds.filter((item) => item !== id)
        : [...current.preferenceIds, id],
    }));
  }

  function handleResetFlow() {
    Alert.alert(
      'Start over?',
      'This will clear the current answers and return to the beginning.',
      [
        { text: 'Keep going', style: 'cancel' },
        {
          text: 'Start over',
          style: 'destructive',
          onPress: () => {
            setDraft({
              aspirationId: null,
              painPointIds: [],
              preferenceIds: [],
            });
            setCurrentPage(0);
          },
        },
      ]
    );
  }

  function completeOnboarding() {
    saveOnboardingProfile({
      completed: true,
      aspirationId: draft.aspirationId,
      painPointIds: draft.painPointIds,
      preferenceIds: draft.preferenceIds,
      completedAt: new Date().toISOString(),
    });
    router.replace('/(tabs)');
  }

  if (storedProfile.completed) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <View style={styles.screen}>
      <TransitioningOnboardingBackground page={page} theme={currentTheme} />
      <View style={[styles.safeArea, { paddingTop: insets.top + 10 }]}>
        <Animated.View entering={presenceEnter()} style={styles.header}>
          <View style={styles.headerRow}>
            <ThemedText type="onboardingLabel" style={styles.brandLabel} lightColor="#D4E1FF" darkColor="#D4E1FF">
              {isCinematicStep ? 'Katchimeras' : 'KatchaDeck'}
            </ThemedText>
            {!isCinematicStep && !isProcessingStep ? (
              <Pressable onPress={handleResetFlow} style={styles.resetAction}>
                <IconSymbol color="#C8D8FF" name="arrow.counterclockwise" size={14} />
                <ThemedText style={styles.resetLabel} lightColor="#C8D8FF" darkColor="#C8D8FF">
                  Start over
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
          {!isCinematicStep && !isFinalStep ? (
            <ProgressBar current={progressCurrent} total={progressTotal} />
          ) : null}
        </Animated.View>

        <PagerView
          ref={pagerRef}
          initialPage={0}
          onPageSelected={(event) => setPage(event.nativeEvent.position)}
          overdrag={false}
          scrollEnabled={false}
          style={styles.pager}>
          <View key="cinematic" style={styles.cinematicPage}>
            <CinematicOnboardingPage
              entries={timelineDemoEntries}
              onAdvance={handleNext}
              tomorrowState={timelineTomorrowState}
            />
          </View>

          <QuestionPage
            key="goal"
            footerHeight={footerHeight}
            question="What do you want your life to feel like?">
            {aspirationOptions.map((option, index) => (
              <Animated.View entering={presenceEnter(60 + index * 45)} key={option.id}>
                <QuestionOptionCard
                  accentColor={option.accent}
                  description={option.description}
                  onPress={() => setDraft((current) => ({ ...current, aspirationId: option.id }))}
                  selected={draft.aspirationId === option.id}
                  title={option.title}
                />
              </Animated.View>
            ))}
          </QuestionPage>

          <QuestionPage
            key="pain"
            footerHeight={footerHeight}
            question="What feels absent right now?">
            {painPointOptions.map((option, index) => {
              const selected = draft.painPointIds.includes(option.id);

              return (
                <Animated.View entering={presenceEnter(60 + index * 45)} key={option.id}>
                  <QuestionOptionCard
                    accentColor="#E3A06E"
                    description={option.description}
                    multiSelect
                    onPress={() => togglePainPoint(option.id)}
                    selected={selected}
                    title={option.title}
                  />
                </Animated.View>
              );
            })}
          </QuestionPage>

          <QuestionPage
            key="world"
            footerHeight={footerHeight}
            question="What kind of world should your deck lean toward?">
            {preferenceOptions.map((option, index) => {
              const selected = draft.preferenceIds.includes(option.id);

              return (
                <Animated.View entering={presenceEnter(60 + index * 40)} key={option.id}>
                  <QuestionOptionCard
                    accentColor={option.palette[1]}
                    description={option.description}
                    multiSelect
                    onPress={() => togglePreference(option.id)}
                    selected={selected}
                    title={option.title}
                  />
                </Animated.View>
              );
            })}
          </QuestionPage>

          <View key="processing" style={[styles.pageContent, styles.processingPage]}>
            <Animated.View entering={rewardEnter()} style={styles.processingStack}>
              <HoodedAvatar size={194} />
              <View style={styles.processingCopy}>
                <ThemedText type="onboardingLabel" style={styles.pageLabel} lightColor="#FFDCC0" darkColor="#FFDCC0">
                  {pageThemes[PROCESSING_PAGE].pageLabel}
                </ThemedText>
                <ThemedText type="title" style={styles.questionTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
                  Reading the first pattern...
                </ThemedText>
                <ThemedText style={styles.questionBody} lightColor="#DCE6FF" darkColor="#DCE6FF">
                  Looking for rhythm, places, and the tone beneath the day.
                </ThemedText>
              </View>
            </Animated.View>
          </View>

          <ScrollView
            key="reveal"
            contentContainerStyle={[styles.pageContent, { paddingBottom: footerHeight + 56 }]}
            contentInsetAdjustmentBehavior="automatic"
            showsVerticalScrollIndicator={false}>
            <Animated.View entering={rewardEnter()} style={styles.revealHeader}>
              <View style={styles.revealCopy}>
                <ThemedText type="onboardingLabel" style={styles.pageLabel} lightColor="#D4E1FF" darkColor="#D4E1FF">
                  Congratulations
                </ThemedText>
                <ThemedText type="title" style={styles.questionTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
                  You started your timeline.
                </ThemedText>
                <ThemedText style={styles.questionBody} lightColor="#DCE6FF" darkColor="#DCE6FF">
                  {reveal.narrative}
                </ThemedText>
              </View>
              <HoodedAvatar size={148} />
            </Animated.View>

            <ScrollView horizontal contentContainerStyle={styles.cardRow} showsHorizontalScrollIndicator={false}>
              {reveal.cards.map((card, index) => (
                <Animated.View entering={presenceEnter(100 + index * 70)} key={card.id}>
                  <CollectibleCard
                    interactive={false}
                    location={card.location}
                    name={card.name}
                    palette={card.palette}
                    rarity={card.rarity}
                    trait={card.trait}
                  />
                </Animated.View>
              ))}
            </ScrollView>

            <Animated.View entering={presenceEnter(220)}>
              <GlassPanel contentStyle={styles.revealPanel}>
                <ThemedText type="onboardingLabel" style={styles.panelLabel} lightColor="#D4E1FF" darkColor="#D4E1FF">
                  First signal
                </ThemedText>
                <ThemedText type="subtitle" style={styles.revealInsightTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
                  The app can already read a direction
                </ThemedText>
                <ThemedText style={styles.panelBody} lightColor="#E6EEFF" darkColor="#E6EEFF">
                  {reveal.identityInsight}
                </ThemedText>
              </GlassPanel>
            </Animated.View>
          </ScrollView>

          <ScrollView
            key="benefits"
            contentContainerStyle={[styles.pageContent, { paddingBottom: footerHeight + 56 }]}
            contentInsetAdjustmentBehavior="automatic"
            showsVerticalScrollIndicator={false}>
            <Animated.View entering={rewardEnter()} style={styles.benefitHeader}>
              <ThemedText type="onboardingLabel" style={styles.pageLabel} lightColor="#FFE7D7" darkColor="#FFE7D7">
                {pageThemes[totalSteps - 1].pageLabel}
              </ThemedText>
              <ThemedText type="title" style={styles.questionTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
                Here is what KatchaDeck gives back.
              </ThemedText>
              <ThemedText style={styles.questionBody} lightColor="#DCE6FF" darkColor="#DCE6FF">
                You move through life. The app turns that movement into something visible,
                memorable, and worth keeping.
              </ThemedText>
            </Animated.View>

            <Animated.View entering={presenceEnter(120)}>
              <GlassPanel contentStyle={styles.benefitPanel}>
                <BenefitRow
                  body="The deck grows from what you actually do, not from a streak gimmick."
                  title="Your walks become creatures"
                />
                <BenefitRow
                  body="Places leave visual marks, so repeated routes and favorite corners start to matter."
                  title="Your places shape the cards"
                />
                <BenefitRow
                  body="Quiet days, city days, and return visits all push the collection in different directions."
                  title="Your routine evolves over time"
                />
              </GlassPanel>
            </Animated.View>

            <Animated.View entering={presenceEnter(220)}>
              <GlassPanel contentStyle={styles.previewPanel}>
                <ThemedText type="onboardingLabel" style={styles.panelLabel} lightColor="#FFE7D7" darkColor="#FFE7D7">
                  Premium preview
                </ThemedText>
                <ThemedText type="subtitle" style={styles.revealInsightTitle} lightColor="#FFF8F4" darkColor="#FFF8F4">
                  Unlock the fuller version of your life
                </ThemedText>
                <ThemedText style={styles.panelBody} lightColor="#F2E6E1" darkColor="#F2E6E1">
                  Enhanced card variants, deeper identity reads, story-comic moments, and evolution
                  systems are waiting behind the next layer.
                </ThemedText>
              </GlassPanel>
            </Animated.View>
          </ScrollView>
        </PagerView>

        {!isCinematicStep ? (
          <View
            onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
            style={[styles.footerWrap, { paddingBottom: insets.bottom + 10 }]}>
            <View style={styles.footerShell}>
              <Animated.View
                entering={presenceEnter(20)}
                exiting={presenceExit()}
                key={`footer-${page}-${isFinalStep ? 'final' : 'flow'}`}>
                {isProcessingStep ? (
                  <View style={styles.footerPlaceholder} />
                ) : isFinalStep ? (
                  <View style={styles.footerStack}>
                    <KatchaButton
                      icon="sparkles"
                      label={currentTheme.secondaryCtaLabel ?? 'See premium preview'}
                      onPress={() => router.push('/modal')}
                      variant="secondary"
                    />
                    <KatchaButton
                      icon="arrow.right"
                      label={currentTheme.primaryCtaLabel ?? 'Open my timeline'}
                      onPress={completeOnboarding}
                      variant="primary"
                    />
                  </View>
                ) : (
                  <KatchaButton
                    disabled={!canContinue}
                    icon="arrow.right"
                    label={currentTheme.primaryCtaLabel ?? 'Continue'}
                    onPress={handleNext}
                    variant="secondary"
                  />
                )}
              </Animated.View>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function QuestionPage({
  question,
  footerHeight,
  children,
}: {
  question: string;
  footerHeight: number;
  children: ReactNode;
}) {
  return (
    <ScrollView
      contentContainerStyle={[styles.pageContent, { paddingBottom: footerHeight + 56 }]}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}>
      <Animated.View entering={presenceEnter()} style={styles.questionHeader}>
        <ThemedText type="title" style={styles.questionTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
          {question}
        </ThemedText>
      </Animated.View>
      <View style={styles.answerStack}>{children}</View>
    </ScrollView>
  );
}

function QuestionOptionCard({
  title,
  description,
  selected,
  onPress,
  accentColor,
  multiSelect = false,
}: {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
  accentColor: string;
  multiSelect?: boolean;
}) {
  const press = usePressMotion();

  return (
    <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut}>
      <Animated.View style={press.animatedStyle}>
        <View
          style={[
            styles.answerCard,
            selected ? styles.answerCardSelected : null,
            { borderColor: selected ? accentColor : 'rgba(255,255,255,0.18)' },
          ]}>
          <View style={styles.answerCopy}>
            <ThemedText type="subtitle" style={styles.answerTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
              {title}
            </ThemedText>
            <ThemedText style={styles.answerDescription} lightColor="#DCE6FF" darkColor="#DCE6FF">
              {description}
            </ThemedText>
          </View>
          <View
            style={[
              styles.answerIndicator,
              multiSelect ? styles.answerIndicatorMulti : null,
              selected ? { borderColor: accentColor, backgroundColor: accentColor } : null,
            ]}
          />
        </View>
      </Animated.View>
    </Pressable>
  );
}

function BenefitRow({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.benefitRow}>
      <View style={styles.benefitDot} />
      <View style={styles.benefitCopy}>
        <ThemedText type="subtitle" style={styles.benefitTitle} lightColor="#FFF8F4" darkColor="#FFF8F4">
          {title}
        </ThemedText>
        <ThemedText style={styles.benefitBody} lightColor="#E6EEFF" darkColor="#E6EEFF">
          {body}
        </ThemedText>
      </View>
    </View>
  );
}

function TransitioningOnboardingBackground({
  page,
  theme,
}: {
  page: number;
  theme: OnboardingTheme;
}) {
  const [previousTheme, setPreviousTheme] = useState<OnboardingTheme | null>(null);
  const [activeTheme, setActiveTheme] = useState(theme);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (page === 0 && activeTheme === theme) {
      return;
    }

    setPreviousTheme(activeTheme);
    setActiveTheme(theme);
    opacity.value = 0;
    opacity.value = withTiming(1, { duration: 620 });

    const timer = setTimeout(() => {
      setPreviousTheme(null);
    }, 680);

    return () => clearTimeout(timer);
  }, [activeTheme, opacity, page, theme]);

  const currentStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: 1 + (1 - opacity.value) * 0.02 }],
  }));

  const previousStyle = useAnimatedStyle(() => ({
    opacity: 1 - opacity.value,
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {previousTheme ? (
        <Animated.View style={[StyleSheet.absoluteFill, previousStyle]}>
          <AmbientBackground
            accentColor={previousTheme.accentColor}
            colors={previousTheme.colors}
            meshColors={previousTheme.meshColors}
          />
        </Animated.View>
      ) : null}
      <Animated.View style={[StyleSheet.absoluteFill, currentStyle]}>
        <AmbientBackground
          accentColor={activeTheme.accentColor}
          colors={activeTheme.colors}
          meshColors={activeTheme.meshColors}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#090B12',
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    gap: 12,
    paddingHorizontal: 20,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  brandLabel: {
    fontSize: 11,
  },
  resetAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  resetLabel: {
    ...KatchaDeckUI.typography.onboardingCTA,
    fontSize: 13,
  },
  pager: {
    flex: 1,
  },
  cinematicPage: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  pageContent: {
    gap: 22,
    minHeight: '100%',
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  pageLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  questionHeader: {
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    maxWidth: 330,
  },
  questionTitle: {
    fontFamily: KatchaDeckUI.typography.headline.fontFamily,
    fontSize: 35,
    lineHeight: 40,
    maxWidth: 320,
    textAlign: 'center',
  },
  questionBody: {
    fontSize: 16,
    lineHeight: 23,
    maxWidth: 330,
  },
  answerStack: {
    gap: 14,
  },
  answerCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 94,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  answerCardSelected: {
    backgroundColor: 'rgba(200,216,255,0.14)',
  },
  answerCopy: {
    flex: 1,
    gap: 4,
  },
  answerTitle: {
    fontSize: 20,
    lineHeight: 24,
  },
  answerDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  answerIndicator: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: 999,
    borderWidth: 1.5,
    height: 20,
    width: 20,
  },
  answerIndicatorMulti: {
    borderRadius: 7,
  },
  processingPage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingStack: {
    alignItems: 'center',
    gap: 18,
    maxWidth: 300,
  },
  processingCopy: {
    alignItems: 'center',
    gap: 8,
  },
  revealHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 20,
    justifyContent: 'space-between',
  },
  revealCopy: {
    flex: 1,
    gap: 8,
    maxWidth: 260,
  },
  cardRow: {
    gap: 16,
    paddingRight: 20,
  },
  revealPanel: {
    gap: 12,
  },
  panelLabel: {
    fontSize: 11,
  },
  revealInsightTitle: {
    fontSize: 24,
    lineHeight: 29,
  },
  panelBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  benefitHeader: {
    alignItems: 'center',
    gap: 8,
  },
  benefitPanel: {
    gap: 18,
  },
  benefitRow: {
    flexDirection: 'row',
    gap: 12,
  },
  benefitDot: {
    backgroundColor: '#FFE7D7',
    borderRadius: 999,
    height: 8,
    marginTop: 8,
    width: 8,
  },
  benefitCopy: {
    flex: 1,
    gap: 4,
  },
  benefitTitle: {
    fontSize: 18,
    lineHeight: 22,
  },
  benefitBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  previewPanel: {
    gap: 12,
  },
  footerWrap: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  footerShell: {
    backgroundColor: 'rgba(8, 11, 20, 0.76)',
    borderColor: 'rgba(216,228,255,0.1)',
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    padding: 12,
  },
  footerPlaceholder: {
    height: 52,
  },
  footerStack: {
    gap: 10,
  },
});
