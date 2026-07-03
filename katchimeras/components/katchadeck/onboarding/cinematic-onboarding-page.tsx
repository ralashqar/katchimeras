import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Easing,
  FadeInRight,
  FadeInUp,
  FadeOutDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EggFeedOverlay, type EggFeed } from '@/components/katchadeck/home/egg-feed-overlay';
import { HatchReveal } from '@/components/katchadeck/home/hatch-reveal';
import { LanternEgg } from '@/components/katchadeck/home/lantern-egg';
import {
  HOME_EGG_SHELL_SCALE,
  HOME_EGG_STAGE_TOP,
  todayEggFraming,
} from '@/components/katchadeck/home/meadow-scene-backdrop';
import { DayTimeline } from '@/components/katchadeck/timeline/day-timeline';
import { GlassPanel } from '@/components/katchadeck/ui/glass-panel';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  onboardingCinematicBeats,
  type OnboardingCinematicBeat,
  type OpeningMomentChip,
  type OpeningScene,
} from '@/constants/onboarding-cinematic';
import { KatchaDeckUI } from '@/constants/theme';
import type { EggVisualState, LocalCreatureRecord } from '@/types/home';
import type { TimelineDayEntry, TimelineTomorrowState } from '@/types/timeline';

type CinematicOnboardingPageProps = {
  entries: readonly TimelineDayEntry[];
  tomorrowState: TimelineTomorrowState;
  onAdvance: () => void;
  stopAfterOpening?: boolean;
};

const FINAL_BEAT_INDEX = onboardingCinematicBeats.length - 1;
const FOLLOW_UP_BEAT_INDEX = 1;

// The forming egg shown during the opening is the EXACT egg widget from the
// Today page (LanternEgg). EggShell ignores the color fields (its glow is baked
// into the artwork), but the visual-state type needs the full shape.
const OPENING_EGG_VISUAL: EggVisualState = {
  accentColor: '#93C7FF',
  haloColor: '#C9D8FF',
  coreColor: '#EAF1FF',
  intensity: 0.6,
  shimmer: true,
  swirl: 0.4,
  label: 'Gathering shape',
};

// What the opening day hatches into — a real, used cast member (the coffee-shop
// companion), matching the coffee/cafe moments that feed the egg. A minimal
// creature record so the REAL HatchReveal (the home page's hatch) runs it.
const OPENING_REVEAL_CREATURE: LocalCreatureRecord = {
  id: 'onboarding-baristabbit',
  name: 'Baristabbit',
  primaryTrait: 'social',
  secondaryTrait: 'calm',
  rarity: 'common',
  visualKey: 'baristabbit',
  accentColor: '#E3B68C',
  highlightMomentId: null,
  highlight: 'A coffee ritual kept',
  reflection: '',
  motifTags: [],
  encounterProfileId: null,
  repeatDepth: 0,
};

// Feed pacing: a clear pause first (so the "Moments shape your day" title reads),
// then the first moments drift in slowly and each following one launches sooner
// than the last — speeding up as it goes (motes overlap in flight near the end).
const FEED_FIRST_DELAY_MS = 900;
const FEED_START_GAP_MS = 560;
const FEED_MIN_GAP_MS = 110;
const FEED_RAMP_MS = 95;

// LanternEgg's internal stage height — the host box that centers the egg.
const EGG_HOST_HEIGHT = 258;

export function CinematicOnboardingPage({
  entries,
  tomorrowState,
  onAdvance,
  stopAfterOpening = false,
}: CinematicOnboardingPageProps) {
  const { height } = useWindowDimensions();
  const [beatIndex, setBeatIndex] = useState(0);
  const [openingSceneIndex, setOpeningSceneIndex] = useState(0);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [restartToken, setRestartToken] = useState(0);
  const currentBeat = onboardingCinematicBeats[beatIndex];
  const isOpeningBeat = Boolean(currentBeat.openingSequence);
  const openingSequence = currentBeat.openingSequence ?? null;
  const currentOpeningScene = openingSequence?.scenes[openingSceneIndex] ?? null;
  const lastHapticKeyRef = useRef<string | null>(null);
  const dockProgress = useSharedValue(currentBeat.showCta ? 1 : 0);
  const stageMinHeight = height < 760 ? 302 : 360;
  const entryMap = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const finalBeatIndex = stopAfterOpening ? 0 : FINAL_BEAT_INDEX;

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) {
        setReduceMotionEnabled(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReduceMotionEnabled(enabled);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    dockProgress.value = withTiming(!isOpeningBeat && currentBeat.showCta ? 1 : 0, {
      duration: reduceMotionEnabled ? 120 : 360,
      easing: Easing.out(Easing.cubic),
    });

    if (isOpeningBeat && openingSequence && currentOpeningScene) {
      const lastSceneIndex = openingSequence.scenes.length - 1;
      const timer = setTimeout(() => {
        if (openingSceneIndex >= lastSceneIndex) {
          if (stopAfterOpening) {
            onAdvance();
            return;
          }

          setBeatIndex(FOLLOW_UP_BEAT_INDEX);
          return;
        }

        setOpeningSceneIndex((current) => Math.min(current + 1, lastSceneIndex));
      }, reduceMotionEnabled ? 1100 : currentOpeningScene.durationMs);

      return () => clearTimeout(timer);
    }

    if (beatIndex >= finalBeatIndex) {
      return;
    }

    const timer = setTimeout(
      () => setBeatIndex((current) => Math.min(current + 1, finalBeatIndex)),
      reduceMotionEnabled ? 900 : currentBeat.durationMs
    );

    return () => clearTimeout(timer);
  }, [
    beatIndex,
    currentBeat.durationMs,
    currentBeat.showCta,
    currentOpeningScene,
    dockProgress,
    isOpeningBeat,
    openingSceneIndex,
    openingSequence,
    onAdvance,
    reduceMotionEnabled,
    stopAfterOpening,
    finalBeatIndex,
  ]);

  useEffect(() => {
    if (!isOpeningBeat || !currentOpeningScene?.hapticCue) {
      return;
    }

    const hapticKey = `${restartToken}-${currentOpeningScene.id}-${currentOpeningScene.hapticCue}`;
    if (lastHapticKeyRef.current === hapticKey) {
      return;
    }
    lastHapticKeyRef.current = hapticKey;

    const fire = async () => {
      try {
        if (currentOpeningScene.hapticCue === 'egg-build') {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
          return;
        }

        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        // Ignore haptic availability issues.
      }
    };

    void fire();
  }, [currentOpeningScene, isOpeningBeat, restartToken]);

  function handleRestart() {
    lastHapticKeyRef.current = null;
    setBeatIndex(0);
    setOpeningSceneIndex(0);
    setRestartToken((current) => current + 1);
  }

  function handleSurfacePress() {
    if (isOpeningBeat) {
      return;
    }

    if (beatIndex < finalBeatIndex) {
      setBeatIndex((current) => Math.min(current + 1, finalBeatIndex));
      return;
    }

    onAdvance();
  }

  const dockStyle = useAnimatedStyle(() => ({
    opacity: dockProgress.value,
    transform: [{ translateY: 18 - dockProgress.value * 18 }],
  }));

  const displayedHeadline = isOpeningBeat ? currentOpeningScene?.headline ?? '' : currentBeat.headline;
  const displayedSubtext = isOpeningBeat ? currentOpeningScene?.subtext ?? '' : currentBeat.subtext;
  const hasCopy = displayedHeadline.length > 0 || displayedSubtext.length > 0;
  const copyKey = isOpeningBeat ? currentOpeningScene?.id ?? `opening-${restartToken}` : currentBeat.id;

  // The opening is a FULL-SCREEN fixed composition on the Meadow scene: the
  // real egg pinned exactly where it lives on the home page, copy above it,
  // moment rows below flying up into it, then the normal in-place hatch.
  if (isOpeningBeat && openingSequence && currentOpeningScene) {
    return (
      <OpeningScenePage
        chips={openingSequence.chips}
        copyKey={`${copyKey}-${restartToken}`}
        headline={displayedHeadline}
        subtext={displayedSubtext}
        onRestart={handleRestart}
        reduceMotionEnabled={reduceMotionEnabled}
        restartToken={restartToken}
        scene={currentOpeningScene}
      />
    );
  }

  return (
    <Pressable onPress={handleSurfacePress} style={styles.page}>
      <View style={styles.topRow}>
        <View style={styles.topSpacer} />
        <Pressable hitSlop={16} onPress={handleRestart} style={styles.restartAction}>
          <IconSymbol color="#C8D8FF" name="arrow.counterclockwise" size={14} />
          <ThemedText style={styles.restartLabel} lightColor="#C8D8FF" darkColor="#C8D8FF">
            Restart
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.copyViewport}>
        {hasCopy ? (
          <Animated.View key={`copy-${copyKey}-${restartToken}`} style={styles.copyBlock}>
            {displayedHeadline ? (
              <Animated.View
                entering={FadeInUp.duration(reduceMotionEnabled ? 140 : 620)}
                exiting={FadeOutDown.duration(reduceMotionEnabled ? 120 : 220)}>
                <ThemedText type="onboardingDisplay" style={styles.title} lightColor="#F8FBFF" darkColor="#F8FBFF">
                  {displayedHeadline}
                </ThemedText>
              </Animated.View>
            ) : null}
            {displayedSubtext ? (
              <Animated.View
                entering={FadeInUp.delay(
                  isOpeningBeat && currentOpeningScene?.id === 'scene-1-opening-line' && !reduceMotionEnabled ? 900 : 120
                ).duration(reduceMotionEnabled ? 140 : 520)}
                exiting={FadeOutDown.duration(reduceMotionEnabled ? 120 : 220)}>
                <ThemedText style={styles.body} lightColor="#DCE6FF" darkColor="#DCE6FF">
                  {displayedSubtext}
                </ThemedText>
              </Animated.View>
            ) : null}
          </Animated.View>
        ) : (
          <View style={styles.copySpacer} />
        )}
      </View>

      <View style={[styles.stageViewport, { minHeight: stageMinHeight }]}>
        <View style={styles.stageFrame}>
          <StageVisual beat={currentBeat} entryMap={entryMap} />
        </View>
      </View>

      {!isOpeningBeat ? (
        <Animated.View
          entering={FadeInRight.duration(reduceMotionEnabled ? 140 : 420)}
          key={`timeline-${currentBeat.id}`}
          style={styles.timelineShell}>
          <DayTimeline
            entries={entries}
            mode="scripted"
            scriptedState={currentBeat.timelineState}
            tomorrowState={tomorrowState}
          />
        </Animated.View>
      ) : (
        <View style={styles.timelineSpacer} />
      )}

      <Animated.View pointerEvents={currentBeat.showCta ? 'auto' : 'none'} style={[styles.dockWrap, dockStyle]}>
        <GlassPanel contentStyle={styles.dockPanel}>
          <ThemedText type="onboardingLabel" style={styles.dockLabel} lightColor="#D4E1FF" darkColor="#D4E1FF">
            Tomorrow hook
          </ThemedText>
          <KatchaButton
            glow
            icon="arrow.right"
            label={currentBeat.ctaLabel ?? 'Continue'}
            onPress={onAdvance}
            style={styles.dockButton}
            variant="primary"
          />
        </GlassPanel>
      </Animated.View>
    </Pressable>
  );
}

function StageVisual({ beat, entryMap }: { beat: OnboardingCinematicBeat; entryMap: Map<string, TimelineDayEntry> }) {
  const morningCoffee = entryMap.get('morning-coffee');
  const gymSession = entryMap.get('gym-session');
  const familyDinner = entryMap.get('family-dinner');
  const todayCafe = entryMap.get('today-cafe');

  if (beat.id === 'variety') {
    const varietyEntries = [morningCoffee, gymSession, familyDinner].filter(
      (entry): entry is TimelineDayEntry => Boolean(entry)
    );

    return (
      <View style={styles.varietyStage}>
        {varietyEntries.map((entry, index) => (
          <Animated.View entering={FadeInUp.duration(320).delay(index * 120)} key={entry.id} style={styles.varietyChip}>
            <Image contentFit="contain" source={entry.creature.imageSource} style={styles.varietyImage} transition={0} />
            <ThemedText style={styles.varietyName} lightColor="#F8FBFF" darkColor="#F8FBFF">
              {entry.creature.name}
            </ThemedText>
          </Animated.View>
        ))}
      </View>
    );
  }

  if (beat.id === 'memory' && todayCafe) {
    return <MemoryStage entry={todayCafe} />;
  }

  if (beat.id === 'tomorrow' && todayCafe) {
    return <TomorrowStage entry={todayCafe} />;
  }

  return <View style={styles.emptyStage} />;
}

// The opening scene: a FULL-SCREEN fixed composition. The real Today-page egg
// widget is pinned at the exact home-page position (same framing, same anchor),
// copy lives above it, and the day's moments sit in rows BELOW the egg — each
// launches UP into the egg (the Home "answer a prompt" feed), then the normal
// in-place HatchReveal runs where the egg stands.
function OpeningScenePage({
  chips,
  scene,
  copyKey,
  headline,
  subtext,
  onRestart,
  reduceMotionEnabled,
  restartToken,
}: {
  chips: readonly OpeningMomentChip[];
  scene: OpeningScene;
  copyKey: string;
  headline: string;
  subtext: string;
  onRestart: () => void;
  reduceMotionEnabled: boolean;
  restartToken: number;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const eggFraming = useMemo(() => todayEggFraming(), []);

  // The exact home-page anchor: stage top below the safe area, egg centered in
  // the 258px host, plus the JSON vertical offset.
  const eggStageTop = insets.top + HOME_EGG_STAGE_TOP;
  const eggCenter = { x: width / 2, y: eggStageTop + EGG_HOST_HEIGHT / 2 + eggFraming.offsetY };
  const rowsTop = eggStageTop + EGG_HOST_HEIGHT + 16;

  const eggShown = scene.eggState !== 'hidden';
  const hatched = scene.eggState === 'hatch' || scene.eggState === 'revealed';
  const crackStage: 0 | 1 | 2 = scene.eggState === 'build' ? 1 : 0;

  // Multiple motes can be in flight at once (the cadence accelerates), so the
  // overlay renders a list rather than a single feed.
  const [activeFeeds, setActiveFeeds] = useState<EggFeed[]>([]);
  const [feedKey, setFeedKey] = useState(0);
  const [launchedCount, setLaunchedCount] = useState(0);
  const startedRef = useRef<number | null>(null);
  const feedNonceRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Each chip's measured box (relative to the rows container) — the mote
  // launches from the chip's real centre, straight up into the egg. Launched
  // chips go invisible but KEEP their space so the rows never reflow.
  const chipLayoutsRef = useRef<Record<number, { x: number; y: number; width: number; height: number }>>({});

  function launchMote(index: number) {
    if (index >= chips.length) {
      return;
    }
    const chip = chips[index];
    const layout = chipLayoutsRef.current[index];
    feedNonceRef.current += 1;
    const feed: EggFeed = {
      nonce: feedNonceRef.current,
      fromX: layout ? layout.x + layout.width / 2 : width / 2,
      fromY: rowsTop + (layout ? layout.y + layout.height / 2 : 24),
      toX: eggCenter.x,
      toY: eggCenter.y - 18,
      label: chip.label,
      tint: chip.accent,
    };
    setActiveFeeds((current) => [...current, feed]);
    // Hide the static label the moment its mote launches.
    setLaunchedCount((current) => Math.max(current, index + 1));
  }

  function handleFeedArrive(nonce: number) {
    setActiveFeeds((current) => current.filter((feed) => feed.nonce !== nonce));
    // Each landing pulses the egg.
    setFeedKey((key) => key + 1);
  }

  // Reset the feed whenever the opening restarts; clear pending timers on unmount.
  useEffect(() => {
    setActiveFeeds([]);
    setFeedKey(0);
    setLaunchedCount(0);
    startedRef.current = null;
    feedNonceRef.current = 0;
    chipLayoutsRef.current = {};
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [restartToken]);

  // Begin feeding once the egg first appears (the "Moments shape your day" beat).
  // Launches are scheduled on an ACCELERATING timeline — each gap is shorter than
  // the last — so the first moment drifts in slowly, then the rest pour in.
  useEffect(() => {
    // Start at the first moments beat — the egg has already scaled in by now (it
    // appears a scene earlier, during "they're made of moments").
    if (scene.chipBehavior !== 'slow' || startedRef.current === restartToken) {
      return;
    }
    startedRef.current = restartToken;
    let at = reduceMotionEnabled ? 160 : FEED_FIRST_DELAY_MS;
    for (let index = 0; index < chips.length; index += 1) {
      const launchAt = at;
      timersRef.current.push(setTimeout(() => launchMote(index), launchAt));
      const gap = reduceMotionEnabled
        ? 100
        : Math.max(FEED_MIN_GAP_MS, FEED_START_GAP_MS - index * FEED_RAMP_MS);
      at += gap;
    }
    // launchMote closes over this render's geometry, which is stable for the run
    // (chip positions come from the layout ref at launch time).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.chipBehavior, restartToken, reduceMotionEnabled, chips.length]);

  // The egg fades in at its FIXED spot (no scale-in, no travel — it lives where
  // the home page keeps it) and rattles while the day builds. The hatch itself
  // is the real HatchReveal, swapped into the same host exactly like home.
  const eggFade = useSharedValue(0);
  const eggShake = useSharedValue(0);
  const isBuilding = scene.eggState === 'build';

  useEffect(() => {
    if (eggShown) {
      eggFade.value = withTiming(1, {
        duration: reduceMotionEnabled ? 150 : 520,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [eggFade, eggShown, reduceMotionEnabled]);

  useEffect(() => {
    if (isBuilding && !reduceMotionEnabled) {
      // Aggressive, continuous rattle while the day takes shape.
      eggShake.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 55, easing: Easing.linear }),
          withTiming(-1, { duration: 55, easing: Easing.linear })
        ),
        -1,
        true
      );
    } else {
      eggShake.value = withTiming(0, { duration: 160, easing: Easing.out(Easing.cubic) });
    }
  }, [eggShake, isBuilding, reduceMotionEnabled]);

  const eggStyle = useAnimatedStyle(() => ({
    opacity: eggFade.value,
    transform: [{ translateX: eggShake.value * 7 }, { rotateZ: `${eggShake.value * 4}deg` }],
  }));

  const chipsVisible = eggShown && !hatched && scene.chipBehavior !== 'hidden';

  return (
    <View style={styles.openingPage}>
      <Pressable hitSlop={16} onPress={onRestart} style={[styles.openingRestart, { top: insets.top + 10 }]}>
        <IconSymbol color="#FBF3E4" name="arrow.counterclockwise" size={14} />
        <ThemedText style={styles.restartLabel} lightColor="#FBF3E4" darkColor="#FBF3E4">
          Restart
        </ThemedText>
      </Pressable>

      {/* Copy band ABOVE the egg (where home keeps its week strip). */}
      <View pointerEvents="none" style={[styles.openingCopyBand, { height: HOME_EGG_STAGE_TOP - 6, top: insets.top + 30 }]}>
        {headline || subtext ? (
          <Animated.View key={`copy-${copyKey}`} style={styles.openingCopyBlock}>
            {headline ? (
              <Animated.View
                entering={FadeInUp.duration(reduceMotionEnabled ? 140 : 620)}
                exiting={FadeOutDown.duration(reduceMotionEnabled ? 120 : 220)}>
                <ThemedText type="onboardingDisplay" style={styles.openingTitle} lightColor="#FBF3E4" darkColor="#FBF3E4">
                  {headline}
                </ThemedText>
              </Animated.View>
            ) : null}
            {subtext ? (
              <Animated.View
                entering={FadeInUp.delay(
                  scene.id === 'scene-1-opening-line' && !reduceMotionEnabled ? 900 : 120
                ).duration(reduceMotionEnabled ? 140 : 520)}
                exiting={FadeOutDown.duration(reduceMotionEnabled ? 120 : 220)}>
                <ThemedText style={styles.openingBody} lightColor="rgba(251,243,228,0.88)" darkColor="rgba(251,243,228,0.88)">
                  {subtext}
                </ThemedText>
              </Animated.View>
            ) : null}
          </Animated.View>
        ) : null}
      </View>

      {/* The egg host — the exact home-page anchor. HatchReveal swaps in place
          at hatch time, exactly as it does on the Today page. */}
      <View pointerEvents="none" style={[styles.openingEggHost, { top: eggStageTop }]}>
        {hatched ? (
          <HatchReveal
            creature={OPENING_REVEAL_CREATURE}
            egg={OPENING_EGG_VISUAL}
            hideCaption
            onComplete={() => {}}
          />
        ) : eggShown ? (
          <Animated.View style={eggStyle}>
            <LanternEgg
              egg={OPENING_EGG_VISUAL}
              crackStage={crackStage}
              feedKey={feedKey}
              reactionKey={feedKey}
              scale={eggFraming.scale}
              offsetY={eggFraming.offsetY}
              membraneScale={eggFraming.membraneScale}
              membraneOffsetY={eggFraming.membraneOffsetY}
              shellScale={HOME_EGG_SHELL_SCALE}
              shellOffsetY={0}
            />
          </Animated.View>
        ) : null}
      </View>

      {/* The day's moments, in rows BELOW the egg — each flies UP into it.
          Launched chips go invisible but keep their slot (no reflow). */}
      {chipsVisible ? (
        <View pointerEvents="none" style={[styles.momentRows, { top: rowsTop }]}>
          {chips.map((chip, index) => (
            <Animated.View
              key={`${chip.id}-${restartToken}`}
              entering={FadeInUp.delay(reduceMotionEnabled ? 0 : Math.min(index * 90, 540)).duration(
                reduceMotionEnabled ? 120 : 420
              )}
              onLayout={(event: LayoutChangeEvent) => {
                chipLayoutsRef.current[index] = event.nativeEvent.layout;
              }}
              style={[
                styles.momentLabel,
                { backgroundColor: `${chip.accent}1A`, borderColor: `${chip.accent}55` },
                index < launchedCount ? styles.momentLabelLaunched : null,
              ]}>
              <IconSymbol color={chip.accent} name={chip.icon} size={13} />
              <ThemedText style={styles.momentLabelText} lightColor="#FBF3E4" darkColor="#FBF3E4" numberOfLines={1}>
                {chip.label}
              </ThemedText>
            </Animated.View>
          ))}
        </View>
      ) : null}

      {scene.bottomCopy ? (
        <Animated.View
          entering={FadeInUp.duration(reduceMotionEnabled ? 140 : 500)}
          exiting={FadeOutDown.duration(reduceMotionEnabled ? 120 : 240)}
          key={`opening-bottom-${scene.id}-${restartToken}`}
          style={[styles.bottomCopyWrap, { bottom: insets.bottom + 56 }]}>
          <ThemedText
            style={[styles.bottomCopy, scene.bottomCopy.tone === 'locked' ? styles.bottomCopyLocked : null]}
            lightColor="rgba(251,243,228,0.88)"
            darkColor="rgba(251,243,228,0.88)">
            {scene.bottomCopy.text}
          </ThemedText>
        </Animated.View>
      ) : null}

      {activeFeeds.map((feed) => (
        <EggFeedOverlay feed={feed} key={feed.nonce} onArrive={() => handleFeedArrive(feed.nonce)} />
      ))}
    </View>
  );
}

function MemoryStage({ entry }: { entry: TimelineDayEntry }) {
  const float = useSharedValue(0);

  useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1700, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [float]);

  const creatureStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -float.value * 10 }],
  }));

  return (
    <View style={styles.memoryStage}>
      <Animated.View style={[styles.memoryCreatureWrap, creatureStyle]}>
        <View style={[styles.memoryCreatureGlow, { backgroundColor: `${entry.creature.accent}36` }]} />
        <Image contentFit="contain" source={entry.creature.imageSource} style={styles.memoryCreatureImage} transition={0} />
      </Animated.View>
      <GlassPanel contentStyle={styles.memoryPanel}>
        <ThemedText type="onboardingLabel" style={styles.memoryTag} lightColor="#FFDCC0" darkColor="#FFDCC0">
          {entry.memory.tag}
        </ThemedText>
        <ThemedText type="subtitle" style={styles.memoryTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
          {entry.memory.title}
        </ThemedText>
        <ThemedText style={styles.memoryLocation} lightColor="#F3C8A5" darkColor="#F3C8A5">
          {entry.memory.location}
        </ThemedText>
      </GlassPanel>
    </View>
  );
}

function TomorrowStage({ entry }: { entry: TimelineDayEntry }) {
  const pulse = useSharedValue(0.2);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.out(Easing.sin) }),
        withTiming(0.2, { duration: 1400, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [pulse]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 0.92 + pulse.value * 0.16 }],
  }));

  return (
    <View style={styles.tomorrowStage}>
      <View style={styles.tomorrowPastCreature}>
        <Image contentFit="contain" source={entry.creature.imageSource} style={styles.tomorrowPastImage} transition={0} />
      </View>
      <Animated.View style={[styles.tomorrowHalo, haloStyle]} />
      <View style={styles.tomorrowEggShell}>
        <View style={styles.tomorrowEggCenter} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    gap: 10,
    minHeight: '100%',
    paddingBottom: 12,
    paddingTop: 4,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  topSpacer: {
    width: 64,
  },
  restartAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  restartLabel: {
    ...KatchaDeckUI.typography.onboardingCTA,
    fontSize: 13,
  },
  copyViewport: {
    alignItems: 'center',
    height: 140,
    justifyContent: 'center',
    // Unmasked so the headline/subtext animate in and out at full height instead
    // of being clipped to a tight band.
    overflow: 'visible',
    paddingTop: 6,
  },
  copyBlock: {
    alignItems: 'center',
    gap: 10,
    maxWidth: 336,
    position: 'absolute',
  },
  copySpacer: {
    height: 140,
  },
  title: {
    fontSize: 40,
    lineHeight: 43,
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 308,
    textAlign: 'center',
  },
  stageViewport: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  emptyStage: {
    height: 1,
    width: '100%',
  },
  // The full-screen opening composition — everything anchors to the SCREEN so
  // the egg sits exactly where the home page keeps it.
  openingPage: {
    ...StyleSheet.absoluteFillObject,
  },
  openingRestart: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    position: 'absolute',
    right: 20,
    zIndex: 5,
  },
  openingCopyBand: {
    alignItems: 'center',
    justifyContent: 'center',
    left: 20,
    overflow: 'visible',
    position: 'absolute',
    right: 20,
  },
  openingCopyBlock: {
    alignItems: 'center',
    gap: 8,
    maxWidth: 336,
    position: 'absolute',
  },
  openingTitle: {
    fontSize: 30,
    lineHeight: 34,
    textAlign: 'center',
    textShadowColor: 'rgba(30, 20, 10, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  openingBody: {
    fontSize: 15,
    lineHeight: 21,
    maxWidth: 300,
    textAlign: 'center',
    textShadowColor: 'rgba(30, 20, 10, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  // Full-width host that vertically centers the real LanternEgg widget on the
  // egg point; left/right 0 so its content centers horizontally.
  openingEggHost: {
    height: EGG_HOST_HEIGHT,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  // The moment chips, wrapped into centred rows under the egg.
  momentRows: {
    columnGap: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    left: 20,
    position: 'absolute',
    right: 20,
    rowGap: 10,
  },
  momentLabel: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    maxWidth: 170,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  // Launched chips vanish but KEEP their slot so the rows never reflow (the
  // remaining chips' measured launch anchors stay valid).
  momentLabelLaunched: {
    opacity: 0,
  },
  momentLabelText: {
    fontSize: 13,
    lineHeight: 16,
  },
  bottomCopyWrap: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  bottomCopy: {
    fontSize: 15,
    lineHeight: 21,
    maxWidth: 290,
    textAlign: 'center',
  },
  bottomCopyLocked: {
    color: '#F1F5FF',
  },
  varietyStage: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
    width: '100%',
  },
  varietyChip: {
    alignItems: 'center',
    gap: 8,
    width: 86,
  },
  varietyImage: {
    height: 68,
    width: 68,
  },
  varietyName: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  memoryStage: {
    alignItems: 'center',
    gap: 14,
    width: '100%',
  },
  memoryCreatureWrap: {
    alignItems: 'center',
    height: 120,
    justifyContent: 'center',
    width: 120,
  },
  memoryCreatureGlow: {
    borderRadius: 999,
    bottom: -10,
    left: -10,
    position: 'absolute',
    right: -10,
    top: -10,
  },
  memoryCreatureImage: {
    height: '100%',
    width: '100%',
  },
  memoryPanel: {
    gap: 6,
    minWidth: 240,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  memoryTag: {
    fontSize: 11,
  },
  memoryTitle: {
    fontSize: 22,
    lineHeight: 26,
  },
  memoryLocation: {
    fontSize: 14,
    lineHeight: 18,
  },
  tomorrowStage: {
    alignItems: 'center',
    height: 160,
    justifyContent: 'center',
    width: '100%',
  },
  tomorrowPastCreature: {
    left: 48,
    opacity: 0.22,
    position: 'absolute',
    top: 44,
  },
  tomorrowPastImage: {
    height: 54,
    width: 54,
  },
  tomorrowHalo: {
    backgroundColor: 'rgba(221,232,255,0.18)',
    borderRadius: 999,
    height: 140,
    position: 'absolute',
    width: 140,
  },
  tomorrowEggShell: {
    alignItems: 'center',
    backgroundColor: 'rgba(9,13,24,0.92)',
    borderColor: 'rgba(221,232,255,0.34)',
    borderRadius: 999,
    borderWidth: 1,
    boxShadow: KatchaDeckUI.shadows.card,
    height: 92,
    justifyContent: 'center',
    width: 92,
  },
  tomorrowEggCenter: {
    backgroundColor: 'rgba(243,183,136,0.24)',
    borderRadius: 999,
    height: 48,
    width: 48,
  },
  timelineShell: {
    minHeight: 270,
  },
  timelineSpacer: {
    minHeight: 270,
  },
  dockWrap: {
    marginTop: -4,
  },
  dockPanel: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dockLabel: {
    fontSize: 11,
  },
  dockButton: {
    alignSelf: 'stretch',
  },
});
