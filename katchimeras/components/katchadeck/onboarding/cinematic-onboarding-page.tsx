import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
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

import { EggFeedOverlay, type EggFeed } from '@/components/katchadeck/home/egg-feed-overlay';
import { LanternEgg } from '@/components/katchadeck/home/lantern-egg';
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
import type { EggVisualState } from '@/types/home';
import type { TimelineDayEntry, TimelineTomorrowState } from '@/types/timeline';

type CinematicOnboardingPageProps = {
  entries: readonly TimelineDayEntry[];
  tomorrowState: TimelineTomorrowState;
  onAdvance: () => void;
  stopAfterOpening?: boolean;
};

const FINAL_BEAT_INDEX = onboardingCinematicBeats.length - 1;
const FOLLOW_UP_BEAT_INDEX = 1;
const OPENING_BASE_STAGE_WIDTH = 390;
const OPENING_BASE_STAGE_HEIGHT = 392;

// The soft glow texture the Home egg uses — reused only behind the hatched
// creature so the reveal glows like the real app, no opaque shapes.
const openingGlowTex = require('../../../assets/images/katchimeras/soft-glow.png');
const AnimatedImage = Animated.createAnimatedComponent(Image);

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
// companion), matching the coffee/cafe moments that feed the egg.
const OPENING_REVEAL_ART = require('../../../assets/images/katchimeras/cutouts/baristabbit.png');
const OPENING_REVEAL_ACCENT = '#E3B68C';

// Feed pacing: the first moment is drawn in a beat after the egg appears, then
// each following one launches sooner than the last — a slow start that
// accelerates so the rest get thrown in quickly (motes overlap in flight).
const FEED_FIRST_DELAY_MS = 600;
const FEED_START_GAP_MS = 520;
const FEED_MIN_GAP_MS = 130;
const FEED_RAMP_MS = 78;
// LanternEgg's internal stage height — the host box that centers the egg.
const EGG_HOST_HEIGHT = 258;
const CREATURE_SIZE = 172;

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
  const openingStageHeight = height < 760 ? 340 : 392;
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
          <StageVisual
            beat={currentBeat}
            entryMap={entryMap}
            openingScene={currentOpeningScene}
            openingStageHeight={openingStageHeight}
            reduceMotionEnabled={reduceMotionEnabled}
            restartToken={restartToken}
          />
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

function StageVisual({
  beat,
  entryMap,
  openingScene,
  openingStageHeight,
  reduceMotionEnabled,
  restartToken,
}: {
  beat: OnboardingCinematicBeat;
  entryMap: Map<string, TimelineDayEntry>;
  openingScene: OpeningScene | null;
  openingStageHeight: number;
  reduceMotionEnabled: boolean;
  restartToken: number;
}) {
  const morningCoffee = entryMap.get('morning-coffee');
  const gymSession = entryMap.get('gym-session');
  const familyDinner = entryMap.get('family-dinner');
  const todayCafe = entryMap.get('today-cafe');

  if (beat.openingSequence && openingScene) {
    return (
      <OpeningSequenceStage
        chips={beat.openingSequence.chips}
        reduceMotionEnabled={reduceMotionEnabled}
        restartToken={restartToken}
        scene={openingScene}
        stageHeight={openingStageHeight}
      />
    );
  }

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

// The opening stage: the real Today-page egg widget sits centered while the
// day's moments fly into it one by one (a labelled mote with a trail that lands
// and pulses the egg — exactly the Home "answer a prompt" feed), then it hatches.
function OpeningSequenceStage({
  chips,
  scene,
  stageHeight,
  reduceMotionEnabled,
  restartToken,
}: {
  chips: readonly OpeningMomentChip[];
  scene: OpeningScene;
  stageHeight: number;
  reduceMotionEnabled: boolean;
  restartToken: number;
}) {
  const { width } = useWindowDimensions();
  const metrics = useMemo(() => getOpeningStageMetrics(width, stageHeight), [stageHeight, width]);
  const eggCenter = { x: metrics.stageWidth / 2, y: metrics.eggCenterY };

  const eggShown = scene.eggState !== 'hidden';
  const hatched = scene.eggState === 'hatch' || scene.eggState === 'revealed';
  const crackStage: 0 | 1 | 2 = scene.eggState === 'build' ? 1 : hatched ? 2 : 0;

  // Multiple motes can be in flight at once (the cadence accelerates), so the
  // overlay renders a list rather than a single feed.
  const [activeFeeds, setActiveFeeds] = useState<EggFeed[]>([]);
  const [feedKey, setFeedKey] = useState(0);
  const [launchedCount, setLaunchedCount] = useState(0);
  const startedRef = useRef<number | null>(null);
  const feedNonceRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  function launchMote(index: number) {
    if (index >= chips.length) {
      return;
    }
    const chip = chips[index];
    const anchor = getChipZoneAnchor(chip.zone);
    feedNonceRef.current += 1;
    const feed: EggFeed = {
      nonce: feedNonceRef.current,
      fromX: anchor.x * metrics.stageWidth,
      fromY: anchor.y * stageHeight,
      toX: eggCenter.x,
      toY: eggCenter.y - 18 * metrics.scale,
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
    if (scene.eggState !== 'forming' || startedRef.current === restartToken) {
      return;
    }
    startedRef.current = restartToken;
    let at = reduceMotionEnabled ? 200 : FEED_FIRST_DELAY_MS;
    for (let index = 0; index < chips.length; index += 1) {
      const launchAt = at;
      timersRef.current.push(setTimeout(() => launchMote(index), launchAt));
      const gap = reduceMotionEnabled
        ? 110
        : Math.max(FEED_MIN_GAP_MS, FEED_START_GAP_MS - index * FEED_RAMP_MS);
      at += gap;
    }
    // launchMote closes over this render's metrics, which are stable for the run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.eggState, restartToken, reduceMotionEnabled, chips.length]);

  // Hatch choreography: the egg rattles (gently while building, violently at the
  // moment of hatch), then shrinks away just as the creature pops up in its place.
  const eggOpacity = useSharedValue(0);
  const eggShake = useSharedValue(0);
  const eggHatch = useSharedValue(0);
  const creatureProgress = useSharedValue(0);
  const creatureScale = useSharedValue(0.4);

  const isBuilding = scene.eggState === 'build';

  useEffect(() => {
    eggOpacity.value = withTiming(eggShown && !hatched ? 1 : 0, {
      duration: reduceMotionEnabled ? 140 : hatched ? 240 : 420,
      easing: Easing.out(Easing.cubic),
    });
    // Shrink the egg out of existence at the hatch.
    eggHatch.value = withTiming(hatched ? 1 : 0, {
      duration: reduceMotionEnabled ? 140 : 300,
      easing: Easing.in(Easing.cubic),
    });
  }, [eggHatch, eggOpacity, eggShown, hatched, reduceMotionEnabled]);

  useEffect(() => {
    if (reduceMotionEnabled) {
      eggShake.value = withTiming(0, { duration: 120 });
      return;
    }
    if (isBuilding) {
      // Aggressive, continuous rattle while the day takes shape.
      eggShake.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 55, easing: Easing.linear }),
          withTiming(-1, { duration: 55, easing: Easing.linear })
        ),
        -1,
        true
      );
    } else if (hatched) {
      // One last violent jolt as it bursts.
      eggShake.value = withSequence(
        withTiming(1.8, { duration: 45, easing: Easing.linear }),
        withTiming(-1.8, { duration: 50, easing: Easing.linear }),
        withTiming(0, { duration: 70, easing: Easing.out(Easing.cubic) })
      );
    } else {
      eggShake.value = withTiming(0, { duration: 160, easing: Easing.out(Easing.cubic) });
    }
  }, [eggShake, hatched, isBuilding, reduceMotionEnabled]);

  useEffect(() => {
    creatureProgress.value = withTiming(hatched ? 1 : 0, {
      duration: reduceMotionEnabled ? 160 : 460,
      easing: Easing.out(Easing.cubic),
    });
    // Scale up with an overshoot so the new katchimera springs into being.
    creatureScale.value = withTiming(hatched ? 1 : 0.4, {
      duration: reduceMotionEnabled ? 160 : 520,
      easing: hatched ? Easing.out(Easing.back(1.7)) : Easing.out(Easing.cubic),
    });
  }, [creatureProgress, creatureScale, hatched, reduceMotionEnabled]);

  const eggStyle = useAnimatedStyle(() => ({
    opacity: eggOpacity.value,
    transform: [
      { translateX: eggShake.value * 7 },
      { rotateZ: `${eggShake.value * 4}deg` },
      { scale: 1 - eggHatch.value * 0.82 },
    ],
  }));
  const creatureStyle = useAnimatedStyle(() => ({
    opacity: creatureProgress.value,
    transform: [{ translateY: 14 - creatureProgress.value * 14 }, { scale: creatureScale.value }],
  }));
  const creatureGlowStyle = useAnimatedStyle(() => ({
    opacity: creatureProgress.value * 0.85,
    transform: [{ scale: 0.7 + creatureProgress.value * 0.5 }],
  }));

  return (
    <View style={[styles.openingStage, { height: stageHeight }]}>
      {eggShown ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.openingEggHost, { top: eggCenter.y - EGG_HOST_HEIGHT / 2 }, eggStyle]}>
          <LanternEgg egg={OPENING_EGG_VISUAL} crackStage={crackStage} feedKey={feedKey} reactionKey={feedKey} />
        </Animated.View>
      ) : null}

      {eggShown && !hatched
        ? chips.map((chip, index) => {
            if (index < launchedCount) {
              return null;
            }
            return (
              <Animated.View
                key={`${chip.id}-${restartToken}`}
                entering={FadeInUp.duration(reduceMotionEnabled ? 120 : 420)}
                exiting={FadeOutDown.duration(reduceMotionEnabled ? 100 : 200)}
                pointerEvents="none"
                style={[
                  styles.momentLabel,
                  getChipZoneStyle(chip.zone),
                  { backgroundColor: `${chip.accent}1A`, borderColor: `${chip.accent}55` },
                ]}>
                <IconSymbol color={chip.accent} name={chip.icon} size={13} />
                <ThemedText
                  style={styles.momentLabelText}
                  lightColor="#F4F8FF"
                  darkColor="#F4F8FF"
                  numberOfLines={1}>
                  {chip.label}
                </ThemedText>
              </Animated.View>
            );
          })
        : null}

      {hatched ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.creatureWrap, { top: eggCenter.y - CREATURE_SIZE / 2 }, creatureStyle]}>
          <AnimatedImage
            contentFit="contain"
            source={openingGlowTex}
            style={[styles.creatureGlow, creatureGlowStyle]}
            tintColor={OPENING_REVEAL_ACCENT}
            transition={0}
          />
          <Image contentFit="contain" source={OPENING_REVEAL_ART} style={styles.creatureImage} transition={0} />
        </Animated.View>
      ) : null}

      {scene.bottomCopy ? (
        <Animated.View
          entering={FadeInUp.duration(reduceMotionEnabled ? 140 : 500)}
          exiting={FadeOutDown.duration(reduceMotionEnabled ? 120 : 240)}
          key={`opening-bottom-${scene.id}-${restartToken}`}
          style={styles.bottomCopyWrap}>
          <ThemedText
            style={[styles.bottomCopy, scene.bottomCopy.tone === 'locked' ? styles.bottomCopyLocked : null]}
            lightColor="#DCE6FF"
            darkColor="#DCE6FF">
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

// Where each moment label sits around the egg (corner-anchored), and the point
// its mote launches from when drawn into the egg. The two are tuned to coincide.
function getChipZoneStyle(zone: OpeningMomentChip['zone']) {
  if (zone === 'top-left') {
    return { left: '2%', top: '8%' } as const;
  }
  if (zone === 'top-center') {
    return { left: '32%', top: '3%' } as const;
  }
  if (zone === 'top-right') {
    return { right: '2%', top: '10%' } as const;
  }
  if (zone === 'mid-left') {
    return { left: '0%', top: '36%' } as const;
  }
  if (zone === 'mid-right') {
    return { right: '0%', top: '38%' } as const;
  }
  if (zone === 'bottom-left') {
    return { left: '4%', bottom: '20%' } as const;
  }
  if (zone === 'bottom-center') {
    return { left: '30%', bottom: '8%' } as const;
  }

  return { right: '4%', bottom: '20%' } as const;
}

function getChipZoneAnchor(zone: OpeningMomentChip['zone']) {
  if (zone === 'top-left') {
    return { x: 0.18, y: 0.13 };
  }
  if (zone === 'top-center') {
    return { x: 0.5, y: 0.08 };
  }
  if (zone === 'top-right') {
    return { x: 0.82, y: 0.15 };
  }
  if (zone === 'mid-left') {
    return { x: 0.15, y: 0.42 };
  }
  if (zone === 'mid-right') {
    return { x: 0.85, y: 0.44 };
  }
  if (zone === 'bottom-left') {
    return { x: 0.2, y: 0.74 };
  }
  if (zone === 'bottom-center') {
    return { x: 0.5, y: 0.84 };
  }

  return { x: 0.8, y: 0.74 };
}

function getOpeningStageMetrics(stageWidth: number, stageHeight: number) {
  const scale = Math.max(
    0.92,
    Math.min(1.32, Math.min(stageWidth / OPENING_BASE_STAGE_WIDTH, stageHeight / OPENING_BASE_STAGE_HEIGHT))
  );
  const eggSize = 102 * scale;
  const eggTop = stageHeight * 0.311;

  return {
    eggCenterY: eggTop + eggSize / 2,
    eggSize,
    eggTop,
    scale,
    stageHeight,
    stageWidth,
  };
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
    overflow: 'hidden',
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
  openingStage: {
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  // Full-width host that vertically centers the real LanternEgg widget on the
  // egg point; left/right unset so its content centers horizontally.
  openingEggHost: {
    height: EGG_HOST_HEIGHT,
    left: 0,
    position: 'absolute',
    right: 0,
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
    position: 'absolute',
  },
  momentLabelText: {
    fontSize: 13,
    lineHeight: 16,
  },
  creatureWrap: {
    alignItems: 'center',
    height: CREATURE_SIZE,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  creatureGlow: {
    height: CREATURE_SIZE * 1.4,
    position: 'absolute',
    width: CREATURE_SIZE * 1.4,
  },
  creatureImage: {
    height: CREATURE_SIZE,
    width: CREATURE_SIZE,
  },
  bottomCopyWrap: {
    alignItems: 'center',
    bottom: 0,
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
