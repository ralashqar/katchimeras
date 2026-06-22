import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import { DayPromptStrip, type FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';
import { EggFeedOverlay, type EggFeed } from '@/components/katchadeck/home/egg-feed-overlay';
import { LanternEgg } from '@/components/katchadeck/home/lantern-egg';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import { dayPromptRegistry } from '@/constants/day-prompts';
import { KatchaDeckUI, Lantern } from '@/constants/theme';
import type { DayPromptKind, EggVisualState } from '@/types/home';
import { enrichBackfillReflections, runBackfillFoundation } from '@/utils/day-backfill';
import { getCreatureVisual, hydrateHomeState } from '@/utils/home-engine';
import { buildHatchYourPast, type HatchedPastCreature } from '@/utils/hatch-your-past';
import { clearStoredHomeState, loadStoredHomeState, saveStoredHomeState } from '@/utils/home-storage';
import { saveOnboardingRecap } from '@/utils/onboarding-recap';
import { loadOnboardingProfile } from '@/utils/onboarding-state';

type Phase = 'questions' | 'hatching' | 'reveal' | 'empty';

// The few reads we ask before hatching, in the same one-at-a-time prompt format
// the main app uses. Their answers (encounter seeds) steer the first hatches.
const QUESTION_KINDS: readonly DayPromptKind[] = ['feeling', 'activity', 'hobby'];

const PAST_EGG_VISUAL: EggVisualState = {
  accentColor: '#A78BFA',
  haloColor: '#C9B8FF',
  coreColor: '#EAE2FF',
  intensity: 0.62,
  shimmer: true,
  swirl: 0.4,
  label: 'Reading your week',
};

// Minimum time the egg rattles before it can burst, so the shake always reads
// even when the scan finishes quickly.
const MIN_SHAKE_MS = 1400;

export default function HatchYourPastRoute() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('questions');
  const [creatures, setCreatures] = useState<HatchedPastCreature[]>([]);
  const [daysHatched, setDaysHatched] = useState(0);
  const [index, setIndex] = useState(0);
  // The hatch (scan + backfill) runs while the egg shakes; this flips true once
  // the creatures are ready, letting the egg finish its burst and hand off to the
  // reveal sequence.
  const [revealReady, setRevealReady] = useState(false);
  const revealOutcomeRef = useRef<'reveal' | 'empty'>('reveal');

  // Questions phase: a prompt at a time feeds the egg, and the chosen seeds are
  // saved as the recap the backfill reads to steer the first hatches.
  const [questionIndex, setQuestionIndex] = useState(0);
  const [eggFeed, setEggFeed] = useState<EggFeed | null>(null);
  const [eggFeedKey, setEggFeedKey] = useState(0);
  const eggRef = useRef<View | null>(null);
  const collectedSeeds = useRef<string[]>([]);
  const collectedTags = useRef<string[]>([]);
  const pendingFeed = useRef<{ seeds: string[]; tags: string[] } | null>(null);
  const feedNonce = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const currentPrompt =
    questionIndex < QUESTION_KINDS.length
      ? { ...dayPromptRegistry[QUESTION_KINDS[questionIndex]], photoCandidates: [] }
      : null;

  // The scan + hatch + reveal, run once the questions are answered (so the recap
  // they produce is already saved when the backfill reads it).
  async function runReveal() {
    // Start from a CLEAN slate so the reconstruction fully owns the last few days
    // (the normal backfill preserves already-hatched days, which is not what this
    // "start as if today is day one" simulation wants).
    try {
      const profile = loadOnboardingProfile();
      const now = new Date();
      clearStoredHomeState();
      const fresh = hydrateHomeState(null, profile, now).state;
      saveStoredHomeState({ ...fresh, archivedDays: [], backfilledAt: undefined });
    } catch {
      // If the reset fails, the backfill below still runs against whatever exists.
    }

    try {
      const result = await runBackfillFoundation();
      if (result.pendingReflectionDayIds.length > 0) {
        void enrichBackfillReflections(result.pendingReflectionDayIds);
      }
    } catch {
      // Backfill failed — fall through; the reveal just shows whatever persisted.
    }

    // Reveal from the persisted hatched past days, so the reveal can never diverge
    // from what's on Home.
    const stored = loadStoredHomeState();
    const hatchedPastDays = (stored?.archivedDays ?? []).filter((day) => day.creature != null);
    const reveal = buildHatchYourPast(hatchedPastDays);

    if (!mountedRef.current) {
      return;
    }
    setCreatures(reveal.creatures);
    setDaysHatched(hatchedPastDays.length);
    // The egg keeps shaking until this flips; the egg's burst then advances the
    // phase to the reveal sequence (or the empty state).
    revealOutcomeRef.current = reveal.creatures.length > 0 ? 'reveal' : 'empty';
    setRevealReady(true);
  }

  function finishQuestions() {
    // Persist the answers as the recap the backfill reads (de-duped seeds), then
    // run the scan + hatch.
    saveOnboardingRecap({
      moodId: null,
      activityIds: [],
      preferredSeedIds: [...new Set(collectedSeeds.current)],
      semanticTags: [...collectedTags.current],
      savedAt: new Date().toISOString(),
    });
    setPhase('hatching');
    void runReveal();
  }

  function handleHatchBurstDone() {
    setPhase(revealOutcomeRef.current);
  }

  function advanceQuestions() {
    const next = questionIndex + 1;
    if (next >= QUESTION_KINDS.length) {
      finishQuestions();
      return;
    }
    setQuestionIndex(next);
  }

  function commitPending() {
    const pending = pendingFeed.current;
    if (pending) {
      collectedSeeds.current.push(...pending.seeds);
      collectedTags.current.push(...pending.tags);
      pendingFeed.current = null;
    }
  }

  // Answering a prompt launches a mote from the tapped chip into the egg (exactly
  // the main-app feed); the egg pulses on arrival and the next question appears.
  function handleAnswerQuestion(kind: DayPromptKind, choiceIds: string[], from: FeedSourceRect) {
    const option = dayPromptRegistry[kind].options.find((candidate) => candidate.id === choiceIds[0]);
    pendingFeed.current = {
      seeds: option?.encounterSeedBias?.map((bias) => bias.seedId) ?? [],
      tags: option?.semanticTags ?? [],
    };
    if (eggRef.current) {
      eggRef.current.measureInWindow((x, y, w, h) => {
        feedNonce.current += 1;
        setEggFeed({
          nonce: feedNonce.current,
          fromX: from.x + from.w / 2,
          fromY: from.y + from.h / 2,
          toX: x + w / 2,
          toY: y + h / 2,
          label: option?.label,
          tint: Lantern.ember300,
        });
      });
    } else {
      commitPending();
      advanceQuestions();
    }
  }

  function handleFeedArrive() {
    commitPending();
    setEggFeed(null);
    setEggFeedKey((key) => key + 1);
    advanceQuestions();
  }

  function handleSkipQuestion(_kind: DayPromptKind) {
    pendingFeed.current = null;
    advanceQuestions();
  }

  function finish() {
    router.replace('/(tabs)');
  }

  const onSummary = index >= creatures.length;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ animation: 'fade', headerShown: false, title: 'Hatch your past' }} />
      <AmbientBackground
        accentColor="rgba(167,139,250,0.16)"
        colors={KatchaDeckUI.gradients.world}
        meshColors={['rgba(167,139,250,0.14)', 'rgba(125,232,205,0.1)', 'rgba(255,195,107,0.1)', 'rgba(20,17,31,0.2)']}
      />

      {phase === 'questions' ? (
        <Animated.View entering={FadeIn.duration(240)} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.questionsContent} showsVerticalScrollIndicator={false}>
            <View style={styles.questionHeader}>
              <ThemedText type="onboardingLabel" style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
                Hatch your past
              </ThemedText>
              <ThemedText style={styles.questionLead} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                A few quick reads on your last few days — your taps shape the first characters that hatch.
              </ThemedText>
            </View>

            <View collapsable={false} ref={eggRef} style={styles.questionEgg}>
              <LanternEgg egg={PAST_EGG_VISUAL} feedKey={eggFeedKey} reactionKey={questionIndex} />
            </View>

            {currentPrompt ? (
              <DayPromptStrip
                onAnswer={handleAnswerQuestion}
                onDismiss={handleSkipQuestion}
                onSelectHeroPhoto={() => {}}
                prompt={currentPrompt}
              />
            ) : null}

            <ThemedText style={styles.questionHint} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              {Math.min(questionIndex + 1, QUESTION_KINDS.length)} of {QUESTION_KINDS.length}
            </ThemedText>
          </ScrollView>
        </Animated.View>
      ) : null}

      {phase === 'hatching' ? (
        <Animated.View entering={FadeIn.duration(240)} style={styles.center}>
          <HatchingEgg egg={PAST_EGG_VISUAL} onBurstDone={handleHatchBurstDone} ready={revealReady} />
          <ThemedText type="display" style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            Reading your days…
          </ThemedText>
        </Animated.View>
      ) : null}

      {phase === 'empty' ? (
        <Animated.View entering={FadeIn.duration(240)} style={styles.center}>
          <ThemedText type="display" style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            Your collection starts tonight.
          </ThemedText>
          <ThemedText style={styles.body} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            We couldn’t find enough of your recent days to read yet. Live one, reveal it at your hatch
            hour, and the collection begins itself.
          </ThemedText>
          <View style={styles.cta}>
            <KatchaButton label="Begin" onPress={finish} variant="primary" />
          </View>
        </Animated.View>
      ) : null}

      {phase === 'reveal' && !onSummary ? (
        <Pressable style={styles.center} onPress={() => setIndex((current) => current + 1)}>
          <CreatureReveal creature={creatures[index]} index={index} total={creatures.length} />
        </Pressable>
      ) : null}

      {phase === 'reveal' && onSummary ? (
        <Animated.View entering={FadeIn.duration(300)} style={styles.center}>
          <ThemedText type="onboardingLabel" style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
            Already yours
          </ThemedText>
          <ThemedText type="display" style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            {creatures.length} {creatures.length === 1 ? 'character' : 'characters'} from your past.
          </ThemedText>
          <ThemedText style={styles.body} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            Hatched from {daysHatched} {daysHatched === 1 ? 'day' : 'days'} you already lived. They’re in
            your collection now — and they’ll remember you.
          </ThemedText>
          <View style={styles.summaryRow}>
            {creatures.map((creature) => {
              const visual = getCreatureVisual(creature.visualKey);
              return (
                <View key={creature.profileId} style={styles.summaryOrb}>
                  <View style={[styles.summaryHalo, { backgroundColor: `${creature.accentColor}2A` }]} />
                  <Image contentFit="contain" source={visual.source} style={styles.summaryImage} transition={0} />
                </View>
              );
            })}
          </View>
          <View style={styles.cta}>
            <KatchaButton label="Begin" onPress={finish} variant="primary" />
          </View>
        </Animated.View>
      ) : null}

      <EggFeedOverlay feed={eggFeed} onArrive={handleFeedArrive} />
    </View>
  );
}

// The bridge between answering the prompts and the reveal: the same egg rattles
// aggressively and cracks while the days are scanned, then bursts and hands off
// to the 3-creature reveal sequence.
function HatchingEgg({ egg, ready, onBurstDone }: { egg: EggVisualState; ready: boolean; onBurstDone: () => void }) {
  const [crackStage, setCrackStage] = useState<0 | 1 | 2>(0);
  const burstStartedRef = useRef(false);
  const startRef = useRef(Date.now());
  const shake = useSharedValue(0);
  const burst = useSharedValue(0);

  useEffect(() => {
    shake.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 55, easing: Easing.linear }),
        withTiming(-1, { duration: 55, easing: Easing.linear })
      ),
      -1,
      true
    );
  }, [shake]);

  useEffect(() => {
    const timer = setTimeout(() => setCrackStage((current) => (current < 1 ? 1 : current)), 650);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready || burstStartedRef.current) {
      return;
    }
    const wait = Math.max(0, MIN_SHAKE_MS - (Date.now() - startRef.current));
    const startTimer = setTimeout(() => {
      burstStartedRef.current = true;
      setCrackStage(2);
      shake.value = withSequence(
        withTiming(1.8, { duration: 45, easing: Easing.linear }),
        withTiming(-1.8, { duration: 50, easing: Easing.linear }),
        withTiming(0, { duration: 70, easing: Easing.out(Easing.cubic) })
      );
      burst.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
    }, wait);
    const doneTimer = setTimeout(onBurstDone, wait + 480);
    return () => {
      clearTimeout(startTimer);
      clearTimeout(doneTimer);
    };
  }, [burst, onBurstDone, ready, shake]);

  const eggStyle = useAnimatedStyle(() => ({
    opacity: 1 - burst.value,
    transform: [
      { translateX: shake.value * 7 },
      { rotateZ: `${shake.value * 4}deg` },
      { scale: 1 + burst.value * 0.45 },
    ],
  }));

  return (
    <Animated.View pointerEvents="none" style={eggStyle}>
      <LanternEgg crackStage={crackStage} egg={egg} />
    </Animated.View>
  );
}

function CreatureReveal({ creature, index, total }: { creature: HatchedPastCreature; index: number; total: number }) {
  const visual = getCreatureVisual(creature.visualKey);
  const isRare = creature.rarity !== 'common';
  const subline = isRare
    ? creature.rarityReason
      ? `${capitalize(creature.rarity)} · only from ${creature.rarityReason}`
      : capitalize(creature.rarity)
    : creature.visitCount > 1
      ? `Met ${creature.visitCount} times already`
      : 'A day, kept';

  return (
    <Animated.View entering={FadeIn.duration(360)} exiting={FadeOut.duration(160)} key={creature.profileId} style={styles.revealCard}>
      <View style={[styles.revealHalo, { backgroundColor: `${creature.accentColor}24` }]} />
      <Image contentFit="contain" source={visual.source} style={styles.revealImage} transition={0} />
      <ThemedText type="onboardingLabel" style={styles.revealKicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
        {index + 1} of {total}
      </ThemedText>
      <ThemedText type="display" style={styles.revealName} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
        {creature.name}
      </ThemedText>
      <ThemedText style={styles.revealSub} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
        {subline}
      </ThemedText>
      <ThemedText style={styles.tapHint} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
        Tap to continue
      </ThemedText>
    </Animated.View>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: Lantern.ink950,
    flex: 1,
  },
  center: {
    alignItems: 'center',
    flex: 1,
    gap: 14,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  flex: {
    flex: 1,
  },
  questionsContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 56,
  },
  questionHeader: {
    alignItems: 'center',
    gap: 8,
  },
  questionLead: {
    fontSize: 16,
    lineHeight: 22,
    maxWidth: 320,
    textAlign: 'center',
  },
  questionEgg: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  questionHint: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  kicker: {
    fontSize: 11,
  },
  title: {
    fontSize: 38,
    lineHeight: 42,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 340,
    textAlign: 'center',
  },
  cta: {
    marginTop: 18,
    width: '100%',
  },
  revealCard: {
    alignItems: 'center',
    gap: 8,
  },
  revealHalo: {
    borderRadius: 999,
    height: 300,
    position: 'absolute',
    top: -10,
    width: 300,
  },
  revealImage: {
    height: 280,
    width: 280,
  },
  revealKicker: {
    fontSize: 11,
    marginTop: 6,
  },
  revealName: {
    fontSize: 46,
    fontStyle: 'italic',
    lineHeight: 52,
    textAlign: 'center',
  },
  revealSub: {
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 320,
    textAlign: 'center',
  },
  tapHint: {
    fontSize: 12,
    marginTop: 18,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    marginTop: 8,
    maxWidth: 360,
  },
  summaryOrb: {
    alignItems: 'center',
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  summaryHalo: {
    borderRadius: 999,
    height: 60,
    position: 'absolute',
    width: 60,
  },
  summaryImage: {
    height: 52,
    width: 52,
  },
});
