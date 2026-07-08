import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EssenceReview } from '@/components/katchadeck/capture/essence-review';
import { DayPromptStrip, type FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';
import { EggFeedOverlay, type EggFeed } from '@/components/katchadeck/home/egg-feed-overlay';
import { LanternEgg } from '@/components/katchadeck/home/lantern-egg';
import {
  HOME_EGG_SHELL_SCALE,
  HOME_EGG_STAGE_TOP,
  MeadowSceneBackdrop,
  todayEggFraming,
} from '@/components/katchadeck/home/meadow-scene-backdrop';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { hatchPastPrompts } from '@/constants/hatch-past-prompts';
import { Meadow } from '@/constants/meadow-theme';
import { Lantern } from '@/constants/theme';
import { homeRepository } from '@/storage/repositories/home-repository';
import type { DayPromptKind, DayVisionSummary, EggVisualState } from '@/types/home';
import type { MeaningTag } from '@/utils/capture-energy';
import { enrichBackfillReflections, runBackfillFoundation } from '@/utils/day-backfill';
import { getCreatureVisual, hydrateHomeState } from '@/game/days';
import { buildHatchYourPast, type HatchedPastCreature } from '@/utils/hatch-your-past';
import { saveOnboardingRecap } from '@/utils/onboarding-recap';
import { loadOnboardingProfile } from '@/utils/onboarding-state';
import { analyzePhoto } from '@/utils/photo-vision';
import { aggregatePhotoVision, buildVisionSignals, CAPTURE_PHOTO_CONFIDENCE_FLOOR } from '@/utils/vision-signals';

type Phase = 'questions' | 'capture' | 'hatching' | 'reveal' | 'empty';

// While capturing: the camera is open, the shot is taken, then its essence is
// reviewed (same flow as the main-app camera button).
type CaptureStage = 'intro' | 'live' | 'capturing' | 'review';

// A captured photo's chosen meaning nudges the first hatches toward a fitting
// creature even when the on-device vision finds no specific subject.
const MEANING_SEED: Record<MeaningTag, string> = {
  calm: 'home_evening',
  energy: 'high_steps_day',
  together: 'social_gathering',
  meaningful: 'creative_day',
};

const PAST_EGG_VISUAL: EggVisualState = {
  accentColor: '#A78BFA',
  haloColor: '#C9B8FF',
  coreColor: '#EAE2FF',
  intensity: 0.62,
  shimmer: true,
  swirl: 0.4,
  label: 'Reading your week',
};

// The home page's egg stage is 258px tall (LanternEgg's natural height); the
// content band on this screen starts right below it.
const EGG_STAGE_HEIGHT = 258;

// Minimum time the egg rattles before it can burst, so the shake always reads
// even when the scan finishes quickly.
const MIN_SHAKE_MS = 1400;

export default function HatchYourPastRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('questions');
  const [creatures, setCreatures] = useState<HatchedPastCreature[]>([]);
  const [daysHatched, setDaysHatched] = useState(0);
  const [index, setIndex] = useState(0);
  // The hatch (scan + backfill) runs while the egg shakes; this flips true once
  // the creatures are ready, letting the egg finish its burst and hand off to the
  // reveal sequence.
  const [revealReady, setRevealReady] = useState(false);
  const revealOutcomeRef = useRef<'reveal' | 'empty'>('reveal');

  // The egg sits EXACTLY where the home page's egg lives (same backdrop, same
  // framing, same stage anchor) and never moves between phases — only the
  // prompts and copy below it change.
  const eggFraming = todayEggFraming();
  const eggStageTop = insets.top + HOME_EGG_STAGE_TOP;
  const contentTop = eggStageTop + EGG_STAGE_HEIGHT;

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

  // Capture phase: open the camera, take a photo, read its essence, fold the
  // resulting seeds into the recap so a real surrounding shapes a first hatch.
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [captureStage, setCaptureStage] = useState<CaptureStage>('intro');
  const [capturePhotoUri, setCapturePhotoUri] = useState<string | null>(null);
  const cameraRef = useRef<CameraView | null>(null);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const currentPrompt =
    questionIndex < hatchPastPrompts.length
      ? { ...hatchPastPrompts[questionIndex], photoCandidates: [] }
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
      homeRepository.clear();
      const fresh = hydrateHomeState(null, profile, now).state;
      homeRepository.save({ ...fresh, archivedDays: [], backfilledAt: undefined });
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
    const stored = homeRepository.load();
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
    // After the prompts, offer to capture a real moment before hatching.
    setCaptureStage('intro');
    setPhase('capture');
  }

  // Save the recap (prompt answers + any capture seeds), then run the scan + hatch.
  function proceedToHatch() {
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

  async function handleOpenCamera() {
    if (cameraPermission?.granted) {
      setCaptureStage('live');
      return;
    }
    const result = await requestCameraPermission();
    if (result.granted) {
      setCaptureStage('live');
    }
    // If denied, stay on the intro — the user can still skip.
  }

  async function handleCapturePhoto() {
    if (!cameraRef.current || captureStage !== 'live') {
      return;
    }
    setCaptureStage('capturing');
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6, skipProcessing: true });
      if (photo?.uri) {
        setCapturePhotoUri(photo.uri);
        setCaptureStage('review');
      } else {
        setCaptureStage('intro');
      }
    } catch {
      setCaptureStage('intro');
    }
  }

  const analyzeCapture = useCallback(async (): Promise<DayVisionSummary | null> => {
    if (!capturePhotoUri) {
      return null;
    }
    const result = await analyzePhoto(capturePhotoUri);
    return result ? aggregatePhotoVision([result], CAPTURE_PHOTO_CONFIDENCE_FLOOR) : null;
  }, [capturePhotoUri]);

  function commitCapture(meaning: MeaningTag, vision: DayVisionSummary | null) {
    // The photo's real subject (vision concepts) plus its chosen meaning become
    // preferred seeds, so a first hatch reflects the captured surrounding.
    const seeds: string[] = [];
    if (vision) {
      for (const signal of buildVisionSignals(vision)) {
        seeds.push(signal.seedId);
      }
    }
    seeds.push(MEANING_SEED[meaning]);
    collectedSeeds.current.push(...seeds);
    collectedTags.current.push(`capture:${meaning}`);
    proceedToHatch();
  }

  function advanceQuestions() {
    const next = questionIndex + 1;
    if (next >= hatchPastPrompts.length) {
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
    const prompt = hatchPastPrompts.find((candidate) => candidate.id === kind);
    const option = prompt?.options.find((candidate) => candidate.id === choiceIds[0]);
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
  // The egg stage stays mounted (at the SAME anchor) through the questions, the
  // capture intro, and the hatch — the camera/review take the full screen, and
  // the reveal replaces the burst egg in place.
  const showEggStage =
    phase === 'questions' || phase === 'hatching' || (phase === 'capture' && captureStage === 'intro');

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ animation: 'fade', headerShown: false, title: 'Hatch your past' }} />
      {/* The Meadow scene — the same golden-hour backdrop as the home page, so
          the egg's world never changes. */}
      <MeadowSceneBackdrop />

      {showEggStage ? (
        <View
          collapsable={false}
          pointerEvents="none"
          ref={eggRef}
          style={[styles.eggStage, { top: eggStageTop }]}>
          {phase === 'hatching' ? (
            <HatchingEgg egg={PAST_EGG_VISUAL} onBurstDone={handleHatchBurstDone} ready={revealReady} />
          ) : (
            <LanternEgg
              egg={PAST_EGG_VISUAL}
              feedKey={eggFeedKey}
              reactionKey={questionIndex}
              scale={eggFraming.scale}
              offsetY={eggFraming.offsetY}
              membraneScale={eggFraming.membraneScale}
              membraneOffsetY={eggFraming.membraneOffsetY}
              shellScale={HOME_EGG_SHELL_SCALE}
              shellOffsetY={0}
            />
          )}
        </View>
      ) : null}

      {phase === 'questions' ? (
        <Animated.View entering={FadeIn.duration(240)} style={styles.flex}>
          <View pointerEvents="none" style={[styles.questionHeader, { top: insets.top + 14 }]}>
            <ThemedText type="onboardingLabel" style={[styles.kicker, styles.onScene]} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
              Hatch your past
            </ThemedText>
            <ThemedText style={[styles.questionLead, styles.onScene]} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              A few quick reads on your last few days — your taps shape the first characters that hatch.
            </ThemedText>
          </View>

          <View style={[styles.belowStage, { top: contentTop }]}>
            <ScrollView contentContainerStyle={styles.questionsContent} showsVerticalScrollIndicator={false}>
              {currentPrompt ? (
                <DayPromptStrip
                  onAnswer={handleAnswerQuestion}
                  onDismiss={handleSkipQuestion}
                  onSelectHeroPhoto={() => {}}
                  prompt={currentPrompt}
                />
              ) : null}

              <ThemedText style={[styles.questionHint, styles.onScene]} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                {Math.min(questionIndex + 1, hatchPastPrompts.length)} of {hatchPastPrompts.length}
              </ThemedText>
            </ScrollView>
          </View>
        </Animated.View>
      ) : null}

      {phase === 'capture' ? (
        captureStage === 'review' && capturePhotoUri ? (
          <EssenceReview
            analyze={analyzeCapture}
            onClose={proceedToHatch}
            onCommit={commitCapture}
            photoUri={capturePhotoUri}
          />
        ) : captureStage === 'live' || captureStage === 'capturing' ? (
          <View style={StyleSheet.absoluteFill}>
            <CameraView facing="back" ref={cameraRef} style={StyleSheet.absoluteFill} />
            {captureStage === 'capturing' ? (
              <Animated.View
                entering={FadeIn.duration(120)}
                exiting={FadeOut.duration(360)}
                pointerEvents="none"
                style={styles.flash}
              />
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => setCaptureStage('intro')}
              style={[styles.cameraClose, { top: insets.top + 12 }]}>
              <IconSymbol color={Lantern.moon50} name="xmark" size={18} />
            </Pressable>
            <View style={[styles.cameraPrompt, { top: insets.top + 18 }]}>
              <ThemedText style={styles.cameraPromptText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                What stands out around you?
              </ThemedText>
            </View>
            {captureStage === 'live' ? (
              <View style={[styles.shutterRow, { bottom: insets.bottom + 36 }]}>
                <Pressable
                  accessibilityLabel="Capture moment"
                  accessibilityRole="button"
                  onPress={handleCapturePhoto}
                  style={styles.shutter}>
                  <View style={styles.shutterInner} />
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : (
          <Animated.View entering={FadeIn.duration(240)} style={[styles.belowStage, { top: contentTop }]}>
            <ScrollView contentContainerStyle={styles.panelScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.panel}>
                <IconSymbol color={Lantern.ember300} name="camera.fill" size={34} />
                <ThemedText type="onboardingLabel" style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
                  One more thing
                </ThemedText>
                <ThemedText type="display" style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                  Capture where you are.
                </ThemedText>
                <ThemedText style={styles.body} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
                  Snap your surroundings — we read its essence on your device and fold it into your first hatches.
                  This is how the camera works in the app.
                </ThemedText>
                {cameraPermission && !cameraPermission.granted && !cameraPermission.canAskAgain ? (
                  <ThemedText style={styles.permNote} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                    Camera access is off — enable it in Settings to capture, or skip for now.
                  </ThemedText>
                ) : null}
                <View style={styles.captureCta}>
                  <KatchaButton label="Capture a moment" onPress={handleOpenCamera} variant="primary" />
                  <KatchaButton label="Skip for now" onPress={proceedToHatch} variant="secondary" />
                </View>
              </View>
            </ScrollView>
          </Animated.View>
        )
      ) : null}

      {phase === 'hatching' ? (
        <Animated.View
          entering={FadeIn.duration(240)}
          pointerEvents="none"
          style={[styles.belowStage, { top: contentTop }]}>
          <View style={styles.hatchingCopy}>
            <ThemedText type="display" style={[styles.title, styles.onScene]} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              Reading your days…
            </ThemedText>
          </View>
        </Animated.View>
      ) : null}

      {phase === 'empty' ? (
        <Animated.View entering={FadeIn.duration(240)} style={[styles.belowStage, { top: contentTop }]}>
          <ScrollView contentContainerStyle={styles.panelScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.panel}>
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
            </View>
          </ScrollView>
        </Animated.View>
      ) : null}

      {phase === 'reveal' && !onSummary ? (
        <Pressable style={styles.revealScreen} onPress={() => setIndex((current) => current + 1)}>
          <CreatureReveal creature={creatures[index]} index={index} stageTop={eggStageTop} total={creatures.length} />
        </Pressable>
      ) : null}

      {phase === 'reveal' && onSummary ? (
        <Animated.View entering={FadeIn.duration(300)} style={[styles.belowStage, { top: contentTop }]}>
          <ScrollView contentContainerStyle={styles.panelScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.panel}>
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
            </View>
          </ScrollView>
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
  // The same framing the home page (and the questions phase) applies, so the
  // egg does not shift when the hatch takes over.
  const eggFraming = todayEggFraming();

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
      <LanternEgg
        crackStage={crackStage}
        egg={egg}
        scale={eggFraming.scale}
        offsetY={eggFraming.offsetY}
        membraneScale={eggFraming.membraneScale}
        membraneOffsetY={eggFraming.membraneOffsetY}
        shellScale={HOME_EGG_SHELL_SCALE}
        shellOffsetY={0}
      />
    </Animated.View>
  );
}

function CreatureReveal({
  creature,
  index,
  stageTop,
  total,
}: {
  creature: HatchedPastCreature;
  index: number;
  stageTop: number;
  total: number;
}) {
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
    <Animated.View
      entering={FadeIn.duration(360)}
      exiting={FadeOut.duration(160)}
      key={creature.profileId}
      // The creature's portrait (280px) is centred over the 258px egg stage, so
      // each reveal takes the burst egg's exact place.
      style={[styles.revealCard, { marginTop: stageTop - (280 - EGG_STAGE_HEIGHT) / 2 }]}>
      <View style={[styles.revealHalo, { backgroundColor: `${creature.accentColor}24` }]} />
      <Image contentFit="contain" source={visual.source} style={styles.revealImage} transition={0} />
      <ThemedText type="onboardingLabel" style={[styles.revealKicker, styles.onScene]} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
        {index + 1} of {total}
      </ThemedText>
      <ThemedText type="display" style={[styles.revealName, styles.onScene]} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
        {creature.name}
      </ThemedText>
      <ThemedText style={[styles.revealSub, styles.onScene]} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
        {subline}
      </ThemedText>
      <ThemedText style={[styles.tapHint, styles.onScene]} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
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
  flex: {
    flex: 1,
  },
  eggStage: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  belowStage: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  // Warm dark shadow behind copy sitting directly on the painting (the
  // backdrop's scrim only darkens the bottom of the scene).
  onScene: {
    textShadowColor: 'rgba(30, 20, 10, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  questionsContent: {
    flexGrow: 1,
    paddingBottom: 32,
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  questionHeader: {
    alignItems: 'center',
    gap: 8,
    left: 24,
    position: 'absolute',
    right: 24,
  },
  questionLead: {
    fontSize: 16,
    lineHeight: 22,
    maxWidth: 320,
    textAlign: 'center',
  },
  questionHint: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  hatchingCopy: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 12,
  },
  panelScroll: {
    flexGrow: 1,
    paddingBottom: 32,
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  panel: {
    alignItems: 'center',
    backgroundColor: Meadow.overlay.sheetBg,
    borderColor: Meadow.overlay.sheetBorder,
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 24,
    width: '100%',
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
    marginTop: 4,
    width: '100%',
  },
  captureCta: {
    gap: 10,
    marginTop: 4,
    width: '100%',
  },
  permNote: {
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 320,
    textAlign: 'center',
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,243,224,0.85)',
  },
  cameraClose: {
    alignItems: 'center',
    backgroundColor: 'rgba(34, 27, 16, 0.55)',
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    position: 'absolute',
    right: 18,
    width: 38,
    zIndex: 5,
  },
  cameraPrompt: {
    alignItems: 'center',
    alignSelf: 'center',
    position: 'absolute',
  },
  cameraPromptText: {
    fontSize: 15,
    fontWeight: '700',
    opacity: 0.9,
  },
  shutterRow: {
    alignItems: 'center',
    alignSelf: 'center',
    position: 'absolute',
  },
  shutter: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: 999,
    borderWidth: 3,
    height: 78,
    justifyContent: 'center',
    width: 78,
  },
  shutterInner: {
    backgroundColor: Lantern.moon50,
    borderRadius: 999,
    height: 60,
    width: 60,
  },
  revealScreen: {
    alignItems: 'center',
    flex: 1,
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
