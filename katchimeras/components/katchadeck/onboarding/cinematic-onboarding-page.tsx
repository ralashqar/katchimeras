import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View, useWindowDimensions, type DimensionValue } from 'react-native';
import Animated, {
  Easing,
  FadeInRight,
  FadeInUp,
  FadeOutDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { BlurMask, Canvas, Line } from '@shopify/react-native-skia';

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

type AmbientParticleConfig = {
  id: string;
  left: DimensionValue;
  top: DimensionValue;
  size: number;
  durationMs: number;
  travel: number;
  delayMs: number;
  opacity: number;
};

const AMBIENT_PARTICLES: readonly AmbientParticleConfig[] = [
  { id: 'p-1', left: '10%', top: '12%', size: 5, durationMs: 5200, travel: 18, delayMs: 0, opacity: 0.14 },
  { id: 'p-2', left: '84%', top: '18%', size: 3, durationMs: 6000, travel: 24, delayMs: 180, opacity: 0.12 },
  { id: 'p-3', left: '26%', top: '28%', size: 4, durationMs: 5400, travel: 16, delayMs: 420, opacity: 0.1 },
  { id: 'p-4', left: '72%', top: '34%', size: 6, durationMs: 6600, travel: 20, delayMs: 120, opacity: 0.1 },
  { id: 'p-5', left: '16%', top: '58%', size: 4, durationMs: 6100, travel: 22, delayMs: 540, opacity: 0.12 },
  { id: 'p-6', left: '88%', top: '62%', size: 5, durationMs: 5600, travel: 18, delayMs: 360, opacity: 0.14 },
  { id: 'p-7', left: '40%', top: '74%', size: 3, durationMs: 6800, travel: 14, delayMs: 240, opacity: 0.1 },
] as const;

const HATCH_PARTICLES = [
  { id: 'burst-1', x: -44, y: -48, size: 8, color: '#FFD9B1' },
  { id: 'burst-2', x: 52, y: -34, size: 7, color: '#D8CCFF' },
  { id: 'burst-3', x: -58, y: 10, size: 6, color: '#A7D5FF' },
  { id: 'burst-4', x: 62, y: 16, size: 6, color: '#F8B1CA' },
  { id: 'burst-5', x: -22, y: 58, size: 8, color: '#91D8C7' },
  { id: 'burst-6', x: 24, y: 64, size: 7, color: '#F4BE8D' },
] as const;

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
  const openingRevealEntry =
    openingSequence?.handoff.revealTargetId ? entryMap.get(openingSequence.handoff.revealTargetId) ?? null : null;
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
          <Animated.View
            key={`copy-${copyKey}-${restartToken}`}
            style={styles.copyBlock}>
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
            openingRevealEntry={openingRevealEntry}
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
  openingRevealEntry,
  openingStageHeight,
  reduceMotionEnabled,
  restartToken,
}: {
  beat: OnboardingCinematicBeat;
  entryMap: Map<string, TimelineDayEntry>;
  openingScene: OpeningScene | null;
  openingRevealEntry: TimelineDayEntry | null;
  openingStageHeight: number;
  reduceMotionEnabled: boolean;
  restartToken: number;
}) {
  const morningCoffee = entryMap.get('morning-coffee');
  const gymSession = entryMap.get('gym-session');
  const familyDinner = entryMap.get('family-dinner');
  const todayCafe = entryMap.get('today-cafe');

  if (beat.openingSequence && openingScene && openingRevealEntry) {
    return (
      <OpeningSequenceStage
        chips={beat.openingSequence.chips}
        reduceMotionEnabled={reduceMotionEnabled}
        restartToken={restartToken}
        revealEntry={openingRevealEntry}
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

function OpeningSequenceStage({
  chips,
  revealEntry,
  scene,
  stageHeight,
  reduceMotionEnabled,
  restartToken,
}: {
  chips: readonly OpeningMomentChip[];
  revealEntry: TimelineDayEntry;
  scene: OpeningScene;
  stageHeight: number;
  reduceMotionEnabled: boolean;
  restartToken: number;
}) {
  const { width } = useWindowDimensions();
  const stageMetrics = useMemo(() => getOpeningStageMetrics(width, stageHeight), [stageHeight, width]);
  return (
    <View style={[styles.openingStage, { height: stageHeight }]}>
      <AmbientParticleField reduceMotionEnabled={reduceMotionEnabled} restartToken={restartToken} />
      <OpeningMergeField
        chips={chips}
        reduceMotionEnabled={reduceMotionEnabled}
        restartToken={restartToken}
        scene={scene}
        stageHeight={stageHeight}
        stageMetrics={stageMetrics}
      />

      {chips.map((chip) => (
        <OpeningMomentChipBadge
          chip={chip}
          key={`${chip.id}-${restartToken}`}
          reduceMotionEnabled={reduceMotionEnabled}
          scene={scene}
          stageScale={stageMetrics.scale}
        />
      ))}

      <OpeningEggReveal
        reduceMotionEnabled={reduceMotionEnabled}
        restartToken={restartToken}
        revealEntry={revealEntry}
        scene={scene}
        stageMetrics={stageMetrics}
      />

      {scene.bottomCopy ? (
        <Animated.View
          entering={FadeInUp.duration(reduceMotionEnabled ? 140 : 500)}
          exiting={FadeOutDown.duration(reduceMotionEnabled ? 120 : 240)}
          key={`opening-bottom-${scene.id}-${restartToken}`}
          style={styles.bottomCopyWrap}>
          <ThemedText
            style={[
              styles.bottomCopy,
              scene.bottomCopy.tone === 'locked' ? styles.bottomCopyLocked : null,
            ]}
            lightColor="#DCE6FF"
            darkColor="#DCE6FF">
            {scene.bottomCopy.text}
          </ThemedText>
        </Animated.View>
      ) : null}
    </View>
  );
}

function AmbientParticleField({
  reduceMotionEnabled,
  restartToken,
}: {
  reduceMotionEnabled: boolean;
  restartToken: number;
}) {
  return (
    <View pointerEvents="none" style={styles.particleLayer}>
      {AMBIENT_PARTICLES.map((particle) => (
        <AmbientParticle
          key={`${particle.id}-${restartToken}`}
          delayMs={particle.delayMs}
          durationMs={particle.durationMs}
          left={particle.left}
          opacity={particle.opacity}
          reduceMotionEnabled={reduceMotionEnabled}
          size={particle.size}
          top={particle.top}
          travel={particle.travel}
        />
      ))}
    </View>
  );
}

function AmbientParticle({
  delayMs,
  durationMs,
  left,
  opacity,
  reduceMotionEnabled,
  size,
  top,
  travel,
}: {
  delayMs: number;
  durationMs: number;
  left: DimensionValue;
  opacity: number;
  reduceMotionEnabled: boolean;
  size: number;
  top: DimensionValue;
  travel: number;
}) {
  const drift = useSharedValue(0);
  const shimmer = useSharedValue(opacity);

  useEffect(() => {
    drift.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: reduceMotionEnabled ? 1200 : durationMs,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0, {
            duration: reduceMotionEnabled ? 1200 : durationMs,
            easing: Easing.inOut(Easing.sin),
          })
        ),
        -1,
        false
      )
    );
    shimmer.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(opacity + 0.12, {
            duration: reduceMotionEnabled ? 800 : durationMs * 0.7,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(opacity, {
            duration: reduceMotionEnabled ? 800 : durationMs * 0.7,
            easing: Easing.inOut(Easing.sin),
          })
        ),
        -1,
        false
      )
    );
  }, [delayMs, drift, durationMs, opacity, reduceMotionEnabled, shimmer]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: shimmer.value,
    transform: [{ translateY: -drift.value * travel }, { scale: 0.92 + drift.value * 0.16 }],
  }));

  return (
    <Animated.View
      style={[
        styles.particleDot,
        {
          height: size,
          left,
          top,
          width: size,
        },
        animatedStyle,
      ]}
    />
  );
}

function OpeningMergeField({
  chips,
  reduceMotionEnabled,
  restartToken,
  scene,
  stageHeight,
  stageMetrics,
}: {
  chips: readonly OpeningMomentChip[];
  reduceMotionEnabled: boolean;
  restartToken: number;
  scene: OpeningScene;
  stageHeight: number;
  stageMetrics: ReturnType<typeof getOpeningStageMetrics>;
}) {
  const isActive = scene.chipBehavior === 'converge' || scene.chipBehavior === 'build';
  const showCorona = scene.eggState === 'build';
  const center = {
    x: stageMetrics.stageWidth * 0.5,
    y: stageMetrics.eggCenterY,
  };

  if (!isActive && !showCorona) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.mergeField}>
      {isActive
        ? chips.map((chip) => (
            <OpeningMomentStream
              center={center}
              chip={chip}
              key={`${chip.id}-${scene.id}-${restartToken}`}
              reduceMotionEnabled={reduceMotionEnabled}
              stageHeight={stageHeight}
              stageWidth={stageMetrics.stageWidth}
              stageScale={stageMetrics.scale}
              tension={scene.chipBehavior === 'build' ? 'tight' : 'soft'}
            />
          ))
        : null}
      <OpeningIntakeGlow center={center} reduceMotionEnabled={reduceMotionEnabled} scene={scene} stageMetrics={stageMetrics} />
      {showCorona ? <OpeningEggCorona center={center} reduceMotionEnabled={reduceMotionEnabled} stageMetrics={stageMetrics} /> : null}
    </View>
  );
}

function OpeningMomentStream({
  center,
  chip,
  reduceMotionEnabled,
  stageHeight,
  stageScale,
  stageWidth,
  tension,
}: {
  center: { x: number; y: number };
  chip: OpeningMomentChip;
  reduceMotionEnabled: boolean;
  stageHeight: number;
  stageScale: number;
  stageWidth: number;
  tension: 'soft' | 'tight';
}) {
  const shimmerA = useSharedValue(0);
  const shimmerB = useSharedValue(0.24);
  const opacity = useSharedValue(0);
  const anchor = getChipZoneAnchor(chip.zone);
  const startX = anchor.x * stageWidth;
  const startY = anchor.y * stageHeight;
  const dx = center.x - startX;
  const dy = center.y - startY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = `${(Math.atan2(dy, dx) * 180) / Math.PI}deg`;
  const midpointX = (startX + center.x) / 2;
  const midpointY = (startY + center.y) / 2;
  const sparkTravel = Math.max(length - 34, 24);

  useEffect(() => {
    opacity.value = withTiming(tension === 'tight' ? 0.26 : 0.38, {
      duration: reduceMotionEnabled ? 120 : 360,
      easing: Easing.out(Easing.cubic),
    });

    if (reduceMotionEnabled) {
      shimmerA.value = withTiming(0.62, { duration: 160, easing: Easing.out(Easing.cubic) });
      shimmerB.value = withTiming(0.26, { duration: 160, easing: Easing.out(Easing.cubic) });
      return;
    }

    shimmerA.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: tension === 'tight' ? 460 : 680,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(0, {
          duration: tension === 'tight' ? 460 : 680,
          easing: Easing.inOut(Easing.sin),
        })
      ),
      -1,
      false
    );
    shimmerB.value = withDelay(
      tension === 'tight' ? 120 : 180,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: tension === 'tight' ? 480 : 720,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0, {
            duration: tension === 'tight' ? 480 : 720,
            easing: Easing.inOut(Easing.sin),
          })
        ),
        -1,
        false
      )
    );
  }, [opacity, reduceMotionEnabled, shimmerA, shimmerB, tension]);

  const streamStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ rotateZ: angle }, { scaleX: 0.96 + opacity.value * 0.08 }],
  }));

  const sparkleAStyle = useAnimatedStyle(() => ({
    opacity: 0.2 + shimmerA.value * 0.72,
    transform: [{ translateX: shimmerA.value * sparkTravel }, { scale: 0.72 + shimmerA.value * 0.42 }],
  }));

  const sparkleBStyle = useAnimatedStyle(() => ({
    opacity: 0.16 + shimmerB.value * 0.64,
    transform: [{ translateX: shimmerB.value * sparkTravel }, { scale: 0.68 + shimmerB.value * 0.34 }],
  }));

  return (
    <Animated.View
      style={[
        styles.streamWrap,
        {
          left: midpointX - length / 2,
          top: midpointY - 7 * stageScale,
          width: length,
        },
        streamStyle,
      ]}>
      <LinearGradient
        colors={['rgba(255,255,255,0)', `${chip.accent}12`, `${chip.accent}8A`]}
        locations={[0, 0.54, 1]}
        style={[
          styles.streamBeam,
          { height: 2 * stageScale, marginTop: 6 * stageScale },
          tension === 'tight' ? [styles.streamBeamTight, { height: 2.4 * stageScale, marginTop: 5.8 * stageScale }] : null,
        ]}
      />
      <Animated.View
        style={[
          styles.streamParticle,
          {
            backgroundColor: chip.accent,
            height: 4 * stageScale,
            top: 5 * stageScale,
            width: 4 * stageScale,
          },
          sparkleAStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.streamParticle,
          styles.streamParticleSecondary,
          {
            backgroundColor: `${chip.accent}CC`,
            height: 3 * stageScale,
            top: 5.5 * stageScale,
            width: 3 * stageScale,
          },
          sparkleBStyle,
        ]}
      />
    </Animated.View>
  );
}

function OpeningIntakeGlow({
  center,
  reduceMotionEnabled,
  scene,
  stageMetrics,
}: {
  center: { x: number; y: number };
  reduceMotionEnabled: boolean;
  scene: OpeningScene;
  stageMetrics: ReturnType<typeof getOpeningStageMetrics>;
}) {
  const pulse = useSharedValue(scene.eggState === 'build' ? 1 : 0.4);

  useEffect(() => {
    if (reduceMotionEnabled) {
      pulse.value = withTiming(scene.eggState === 'build' ? 0.92 : 0.48, {
        duration: 120,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    pulse.value =
      scene.eggState === 'build'
        ? withRepeat(
            withSequence(
              withTiming(1, { duration: 520, easing: Easing.inOut(Easing.sin) }),
              withTiming(0.36, { duration: 620, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            false
          )
        : withRepeat(
            withSequence(
              withTiming(0.76, { duration: 860, easing: Easing.inOut(Easing.sin) }),
              withTiming(0.28, { duration: 980, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            false
          );
  }, [pulse, reduceMotionEnabled, scene.eggState]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + pulse.value * (scene.eggState === 'build' ? 0.42 : 0.18),
    transform: [{ scale: 0.82 + pulse.value * (scene.eggState === 'build' ? 0.26 : 0.14) }],
  }));

  return (
    <Animated.View
      style={[
        styles.intakeGlow,
        {
          height: stageMetrics.intakeSize,
          left: center.x - stageMetrics.intakeSize / 2,
          top: center.y - stageMetrics.intakeSize / 2,
          width: stageMetrics.intakeSize,
        },
        glowStyle,
      ]}
    />
  );
}

function OpeningEggCorona({
  center,
  reduceMotionEnabled,
  stageMetrics,
}: {
  center: { x: number; y: number };
  reduceMotionEnabled: boolean;
  stageMetrics: ReturnType<typeof getOpeningStageMetrics>;
}) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotionEnabled) {
      pulse.value = withTiming(0.58, {
        duration: 120,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 520, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.24, { duration: 640, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [pulse, reduceMotionEnabled]);

  const coronaStyle = useAnimatedStyle(() => ({
    opacity: 0.22 + pulse.value * 0.34,
    transform: [{ scale: 0.94 + pulse.value * 0.1 }],
  }));

  return (
    <Animated.View
      style={[
        styles.coronaWrap,
        {
          height: stageMetrics.coronaSize,
          left: center.x - stageMetrics.coronaSize / 2,
          top: center.y - stageMetrics.coronaSize / 2,
          width: stageMetrics.coronaSize,
        },
        coronaStyle,
      ]}>
      <Canvas style={{ height: stageMetrics.coronaSize, width: stageMetrics.coronaSize }}>
        {Array.from({ length: 12 }, (_, index) => {
          const angle = (Math.PI * 2 * index) / 12;
          const innerRadius = (index % 2 === 0 ? 42 : 46) * stageMetrics.scale;
          const outerRadius = (index % 2 === 0 ? 62 : 68) * stageMetrics.scale;
          const centerPoint = stageMetrics.coronaSize / 2;

          return (
            <Line
              color="rgba(234, 239, 255, 0.5)"
              key={`ray-${index}`}
              p1={{
                x: centerPoint + Math.cos(angle) * innerRadius,
                y: centerPoint + Math.sin(angle) * innerRadius,
              }}
              p2={{
                x: centerPoint + Math.cos(angle) * outerRadius,
                y: centerPoint + Math.sin(angle) * outerRadius,
              }}
              strokeCap="round"
              strokeWidth={(index % 3 === 0 ? 2 : 1.3) * stageMetrics.scale}>
              <BlurMask blur={1.6} style="solid" />
            </Line>
          );
        })}
      </Canvas>
    </Animated.View>
  );
}

function OpeningMomentChipBadge({
  chip,
  reduceMotionEnabled,
  scene,
  stageScale,
}: {
  chip: OpeningMomentChip;
  reduceMotionEnabled: boolean;
  scene: OpeningScene;
  stageScale: number;
}) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(getDepthScale(chip.depth) - 0.08);
  const driftX = useSharedValue(0);
  const driftY = useSharedValue(0);
  const pullX = useSharedValue(0);
  const pullY = useSharedValue(0);
  const enterX = useSharedValue(0);
  const enterY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const zoneStyle = getChipZoneStyle(chip.zone);
  const centerPull = getChipCenterPull(chip.zone, stageScale);
  const direction = getChipLaneDirection(chip.lane);
  const entryOffset = getChipEntryOffset(chip.zone, chip.enterFrom, stageScale);

  useEffect(() => {
    const isVisible =
      scene.chipBehavior !== 'hidden' &&
      scene.chipBehavior !== 'hidden-after-hatch' &&
      (scene.chipBehavior !== 'slow' || chip.appearIn === 'slow');
    const isFastMotion =
      scene.chipBehavior === 'fast' || scene.chipBehavior === 'converge' || scene.chipBehavior === 'build';
    const isConverging = scene.chipBehavior === 'converge' || scene.chipBehavior === 'build';
    const depthScale = getDepthScale(chip.depth);
    const baseOpacity = getDepthOpacity(chip.depth);
    const targetOpacity =
      !isVisible ? 0 : scene.chipBehavior === 'build' ? baseOpacity * 0.34 : baseOpacity;
    const targetScale =
      !isVisible ? depthScale - 0.08 : scene.chipBehavior === 'build' ? depthScale * 0.76 : depthScale;
    const amplitude =
      chip.emphasis === 'strong'
        ? isFastMotion
          ? 22 * stageScale
          : 12 * stageScale
        : isFastMotion
          ? 16 * stageScale
          : 8 * stageScale;
    const duration = reduceMotionEnabled ? 220 : isFastMotion ? 1450 : 3200;
    const delayMs =
      reduceMotionEnabled || !isVisible
        ? 0
        : scene.chipBehavior === 'fast'
          ? Math.min(chip.staggerMs, 1200)
          : chip.staggerMs;
    const pullStrength = scene.chipBehavior === 'converge' ? 0.56 : scene.chipBehavior === 'build' ? 0.88 : 0;

    opacity.value = withDelay(
      delayMs,
      withTiming(targetOpacity, {
        duration: reduceMotionEnabled ? 140 : isVisible ? 520 : 240,
        easing: Easing.out(Easing.cubic),
      })
    );
    scale.value = withDelay(
      delayMs,
      withTiming(targetScale, {
        duration: reduceMotionEnabled ? 140 : 520,
        easing: Easing.out(Easing.cubic),
      })
    );
    enterX.value = withDelay(
      delayMs,
      withTiming(isVisible ? 0 : entryOffset.x * 0.34, {
        duration: reduceMotionEnabled ? 160 : isVisible ? 860 : 220,
        easing: Easing.out(Easing.cubic),
      })
    );
    enterY.value = withDelay(
      delayMs,
      withTiming(isVisible ? 0 : entryOffset.y * 0.34, {
        duration: reduceMotionEnabled ? 160 : isVisible ? 860 : 220,
        easing: Easing.out(Easing.cubic),
      })
    );
    rotate.value = withTiming(isConverging ? direction.x * 4 : 0, {
      duration: reduceMotionEnabled ? 160 : 560,
      easing: Easing.out(Easing.cubic),
    });

    driftX.value = isVisible
      ? withRepeat(
          withSequence(
            withTiming(direction.x * amplitude, { duration, easing: Easing.inOut(Easing.sin) }),
            withTiming(direction.x * -amplitude, { duration, easing: Easing.inOut(Easing.sin) })
          ),
          -1,
          true
        )
      : withTiming(0, { duration: 180 });
    driftY.value = isVisible
      ? withRepeat(
          withSequence(
            withTiming(direction.y * amplitude, { duration: duration + 220, easing: Easing.inOut(Easing.sin) }),
            withTiming(direction.y * -amplitude, { duration: duration + 220, easing: Easing.inOut(Easing.sin) })
          ),
          -1,
          true
        )
      : withTiming(0, { duration: 180 });
    pullX.value = withTiming(isConverging ? centerPull.x * pullStrength : 0, {
      duration: reduceMotionEnabled ? 160 : 700,
      easing: Easing.out(Easing.cubic),
    });
    pullY.value = withTiming(isConverging ? centerPull.y * pullStrength : 0, {
      duration: reduceMotionEnabled ? 160 : 700,
      easing: Easing.out(Easing.cubic),
    });
  }, [
    centerPull.x,
    centerPull.y,
    chip.appearIn,
    chip.depth,
    chip.emphasis,
    chip.staggerMs,
    direction.x,
    direction.y,
    driftX,
    driftY,
    enterX,
    enterY,
    entryOffset.x,
    entryOffset.y,
    opacity,
    pullX,
    pullY,
    reduceMotionEnabled,
    rotate,
    scale,
    scene.chipBehavior,
    stageScale,
  ]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: enterX.value + driftX.value + pullX.value },
      { translateY: enterY.value + driftY.value + pullY.value },
      { rotateZ: `${rotate.value}deg` },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.memoryChip,
        zoneStyle,
        {
          backgroundColor: getChipBackground(chip.accent, chip.depth),
          borderColor: `${chip.accent}2E`,
          shadowColor: chip.accent,
        },
        animatedStyle,
      ]}>
      <View style={[styles.memoryChipIconWrap, { backgroundColor: `${chip.accent}26` }]}>
        <IconSymbol color={chip.accent} name={chip.icon} size={14} />
      </View>
      <ThemedText style={styles.memoryChipLabel} lightColor="#F8FBFF" darkColor="#F8FBFF">
        {chip.label}
      </ThemedText>
    </Animated.View>
  );
}

function OpeningEggReveal({
  reduceMotionEnabled,
  restartToken,
  revealEntry,
  scene,
  stageMetrics,
}: {
  reduceMotionEnabled: boolean;
  restartToken: number;
  revealEntry: TimelineDayEntry;
  scene: OpeningScene;
  stageMetrics: ReturnType<typeof getOpeningStageMetrics>;
}) {
  const eggOpacity = useSharedValue(0);
  const eggScale = useSharedValue(0.42);
  const eggPulse = useSharedValue(0.12);
  const eggShake = useSharedValue(0);
  const innerFlash = useSharedValue(0);
  const crackOpacity = useSharedValue(0);
  const creatureOpacity = useSharedValue(0);
  const creatureScale = useSharedValue(0.78);
  const memoryOpacity = useSharedValue(0);
  const burstProgress = useSharedValue(0);

  useEffect(() => {
    const isForming = scene.eggState === 'forming';
    const isBuilding = scene.eggState === 'build';
    const isHatching = scene.eggState === 'hatch';
    const isRevealed = scene.eggState === 'revealed';

    eggOpacity.value = withTiming(isForming || isBuilding ? 1 : 0, {
      duration: reduceMotionEnabled ? 120 : isForming ? 480 : 320,
      easing: Easing.out(Easing.cubic),
    });
    eggScale.value = withTiming(
      isForming ? 0.88 : isBuilding ? 1 : isHatching ? 1.12 : 0.42,
      {
        duration: reduceMotionEnabled ? 120 : isBuilding ? 520 : 420,
        easing: Easing.out(Easing.cubic),
      }
    );
    crackOpacity.value = withTiming(isBuilding ? 0.78 : 0, {
      duration: reduceMotionEnabled ? 120 : 420,
      easing: Easing.out(Easing.cubic),
    });

    eggPulse.value =
      isBuilding
        ? withRepeat(
            withSequence(
              withTiming(1, { duration: reduceMotionEnabled ? 320 : 920, easing: Easing.inOut(Easing.sin) }),
              withTiming(0.38, { duration: reduceMotionEnabled ? 320 : 820, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            false
          )
        : withTiming(isForming ? 0.52 : 0.12, {
            duration: reduceMotionEnabled ? 140 : 320,
            easing: Easing.out(Easing.cubic),
          });
    innerFlash.value =
      isBuilding
        ? withRepeat(
            withSequence(
              withTiming(1, { duration: reduceMotionEnabled ? 260 : 620, easing: Easing.inOut(Easing.sin) }),
              withTiming(0.26, { duration: reduceMotionEnabled ? 260 : 520, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            false
          )
        : withTiming(isForming ? 0.4 : 0, {
            duration: reduceMotionEnabled ? 140 : 360,
            easing: Easing.out(Easing.cubic),
          });

    if (isBuilding && !reduceMotionEnabled) {
      eggShake.value = withRepeat(
        withSequence(
          withTiming(-1, { duration: 120, easing: Easing.linear }),
          withTiming(1, { duration: 140, easing: Easing.linear }),
          withTiming(0, { duration: 120, easing: Easing.out(Easing.cubic) })
        ),
        -1,
        false
      );
    } else if (isHatching && !reduceMotionEnabled) {
      eggShake.value = withSequence(
        withTiming(-1.6, { duration: 50, easing: Easing.linear }),
        withTiming(1.8, { duration: 56, easing: Easing.linear }),
        withTiming(-1.2, { duration: 48, easing: Easing.linear }),
        withTiming(0, { duration: 60, easing: Easing.out(Easing.cubic) })
      );
    } else {
      eggShake.value = withTiming(0, { duration: 120, easing: Easing.out(Easing.cubic) });
    }

    burstProgress.value = isHatching
      ? withSequence(
          withTiming(1, {
            duration: reduceMotionEnabled ? 220 : 420,
            easing: Easing.out(Easing.cubic),
          }),
          withTiming(0, {
            duration: reduceMotionEnabled ? 260 : 460,
            easing: Easing.out(Easing.cubic),
          })
        )
      : withTiming(0, { duration: 120, easing: Easing.out(Easing.cubic) });

    creatureOpacity.value = withTiming(isHatching || isRevealed ? 1 : 0, {
      duration: reduceMotionEnabled ? 120 : isHatching ? 420 : 360,
      easing: Easing.out(Easing.cubic),
    });
    creatureScale.value = withTiming(isHatching ? 1.08 : isRevealed ? 1 : 0.78, {
      duration: reduceMotionEnabled ? 120 : isHatching ? 460 : 400,
      easing: Easing.out(Easing.cubic),
    });
    memoryOpacity.value = withTiming(isRevealed ? 1 : 0, {
      duration: reduceMotionEnabled ? 140 : 520,
      easing: Easing.out(Easing.cubic),
    });
  }, [
    burstProgress,
    crackOpacity,
    creatureOpacity,
    creatureScale,
    eggOpacity,
    eggPulse,
    eggScale,
    eggShake,
    innerFlash,
    memoryOpacity,
    reduceMotionEnabled,
    restartToken,
    scene.eggState,
  ]);

  const eggShellStyle = useAnimatedStyle(() => ({
    opacity: eggOpacity.value,
    transform: [
      { translateY: 10 - eggPulse.value * 10 },
      { translateX: eggShake.value * 8 },
      { rotateZ: `${eggShake.value * 4}deg` },
      { scale: eggScale.value },
    ],
  }));

  const eggGlowStyle = useAnimatedStyle(() => ({
    opacity: eggOpacity.value * (0.2 + eggPulse.value * 0.72),
    transform: [{ scale: 0.82 + eggPulse.value * 0.3 }],
  }));

  const crackStyle = useAnimatedStyle(() => ({
    opacity: crackOpacity.value,
  }));

  const innerFlashStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + innerFlash.value * 0.72,
  }));

  const creatureStyle = useAnimatedStyle(() => ({
    opacity: creatureOpacity.value,
    transform: [{ translateY: 18 - creatureOpacity.value * 18 }, { scale: creatureScale.value }],
  }));

  const memoryStyle = useAnimatedStyle(() => ({
    opacity: memoryOpacity.value,
    transform: [{ translateY: 20 - memoryOpacity.value * 20 }],
  }));

  return (
    <View pointerEvents="none" style={styles.eggRevealShell}>
      <Animated.View
        style={[
          styles.openingEggGlow,
          {
            height: stageMetrics.glowSize,
            top: stageMetrics.eggTop - 34 * stageMetrics.scale,
            width: stageMetrics.glowSize,
          },
          eggGlowStyle,
        ]}
      />

      <Animated.View
        style={[
          styles.openingEggShell,
          {
            height: stageMetrics.eggSize,
            top: stageMetrics.eggTop,
            width: stageMetrics.eggSize,
          },
          eggShellStyle,
        ]}>
        <Animated.View style={[styles.openingEggInnerFlash, innerFlashStyle]}>
          <View
            style={[
              styles.openingEggEcho,
              styles.openingEggEchoWarm,
              {
                height: 28 * stageMetrics.scale,
                left: 24 * stageMetrics.scale,
                top: 24 * stageMetrics.scale,
                width: 28 * stageMetrics.scale,
              },
            ]}
          />
          <View
            style={[
              styles.openingEggEcho,
              styles.openingEggEchoCool,
              {
                height: 20 * stageMetrics.scale,
                right: 24 * stageMetrics.scale,
                top: 34 * stageMetrics.scale,
                width: 20 * stageMetrics.scale,
              },
            ]}
          />
          <View
            style={[
              styles.openingEggEcho,
              styles.openingEggEchoPhoto,
              {
                bottom: 22 * stageMetrics.scale,
                height: 18 * stageMetrics.scale,
                left: 40 * stageMetrics.scale,
                width: 18 * stageMetrics.scale,
              },
            ]}
          />
        </Animated.View>
        <Animated.View style={[styles.openingEggCracks, crackStyle]}>
          <View
            style={[
              styles.openingEggCrack,
              styles.openingEggCrackPrimary,
              {
                height: 36 * stageMetrics.scale,
                left: 48 * stageMetrics.scale,
                top: 18 * stageMetrics.scale,
                width: 1.5 * stageMetrics.scale,
              },
            ]}
          />
          <View
            style={[
              styles.openingEggCrack,
              styles.openingEggCrackLeft,
              {
                height: 20 * stageMetrics.scale,
                left: 38 * stageMetrics.scale,
                top: 34 * stageMetrics.scale,
                width: 1.5 * stageMetrics.scale,
              },
            ]}
          />
          <View
            style={[
              styles.openingEggCrack,
              styles.openingEggCrackRight,
              {
                height: 18 * stageMetrics.scale,
                right: 38 * stageMetrics.scale,
                top: 30 * stageMetrics.scale,
                width: 1.5 * stageMetrics.scale,
              },
            ]}
          />
        </Animated.View>
        <View
          style={[
            styles.openingEggCore,
            {
              height: 46 * stageMetrics.scale,
              width: 46 * stageMetrics.scale,
            },
          ]}
        />
      </Animated.View>

      {HATCH_PARTICLES.map((particle) => (
        <OpeningBurstParticle
          key={`${particle.id}-${restartToken}`}
          particle={particle}
          progress={burstProgress}
          stageMetrics={stageMetrics}
        />
      ))}

      <Animated.View
        style={[
          styles.openingCreatureWrap,
          {
            height: 156 * stageMetrics.scale,
            top: 98 * stageMetrics.scale,
            width: 156 * stageMetrics.scale,
          },
          creatureStyle,
        ]}>
        <View style={[styles.openingCreatureGlow, { backgroundColor: `${revealEntry.creature.accent}38` }]} />
        <View style={styles.openingCreatureImageShell}>
          <Image contentFit="cover" source={revealEntry.creature.imageSource} style={styles.openingCreatureImage} transition={0} />
        </View>
      </Animated.View>

      <Animated.View
        style={[
          styles.openingMemoryPanelWrap,
          {
            top: 274 * stageMetrics.scale,
            width: 272 * stageMetrics.scale,
          },
          memoryStyle,
        ]}>
        <GlassPanel contentStyle={styles.openingMemoryPanel}>
          <ThemedText type="onboardingLabel" style={styles.openingMemoryTag} lightColor="#FFDCC0" darkColor="#FFDCC0">
            {revealEntry.memory.tag}
          </ThemedText>
          <ThemedText type="subtitle" style={styles.openingMemoryTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
            {revealEntry.memory.title}
          </ThemedText>
          <ThemedText style={styles.openingMemoryBody} lightColor="#DCE6FF" darkColor="#DCE6FF">
            {revealEntry.memory.metrics}
          </ThemedText>
        </GlassPanel>
      </Animated.View>
    </View>
  );
}

function OpeningBurstParticle({
  particle,
  progress,
  stageMetrics,
}: {
  particle: (typeof HATCH_PARTICLES)[number];
  progress: SharedValue<number>;
  stageMetrics: ReturnType<typeof getOpeningStageMetrics>;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateX: particle.x * stageMetrics.scale * progress.value },
      { translateY: particle.y * stageMetrics.scale * progress.value },
      { scale: 0.52 + progress.value * 0.9 },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.burstParticle,
        {
          backgroundColor: particle.color,
          height: particle.size * stageMetrics.scale,
          top: stageMetrics.eggCenterY + 3 * stageMetrics.scale,
          width: particle.size * stageMetrics.scale,
        },
        animatedStyle,
      ]}
    />
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

function getChipZoneStyle(zone: OpeningMomentChip['zone']) {
  if (zone === 'top-left') {
    return { left: '-2%', top: '10%' } as const;
  }
  if (zone === 'top-center') {
    return { left: '32%', top: '6%' } as const;
  }
  if (zone === 'top-right') {
    return { right: '-2%', top: '12%' } as const;
  }
  if (zone === 'mid-left') {
    return { left: '-4%', top: '34%' } as const;
  }
  if (zone === 'mid-right') {
    return { right: '-4%', top: '36%' } as const;
  }
  if (zone === 'bottom-left') {
    return { left: '2%', bottom: '22%' } as const;
  }
  if (zone === 'bottom-center') {
    return { left: '26%', bottom: '10%' } as const;
  }

  return { right: '2%', bottom: '22%' } as const;
}

function getChipZoneAnchor(zone: OpeningMomentChip['zone']) {
  if (zone === 'top-left') {
    return { x: 0.18, y: 0.19 };
  }
  if (zone === 'top-center') {
    return { x: 0.5, y: 0.17 };
  }
  if (zone === 'top-right') {
    return { x: 0.82, y: 0.21 };
  }
  if (zone === 'mid-left') {
    return { x: 0.17, y: 0.42 };
  }
  if (zone === 'mid-right') {
    return { x: 0.82, y: 0.44 };
  }
  if (zone === 'bottom-left') {
    return { x: 0.22, y: 0.72 };
  }
  if (zone === 'bottom-center') {
    return { x: 0.5, y: 0.79 };
  }

  return { x: 0.78, y: 0.72 };
}

function getChipCenterPull(zone: OpeningMomentChip['zone'], scale: number) {
  if (zone === 'top-left') {
    return { x: 94 * scale, y: 64 * scale };
  }
  if (zone === 'top-center') {
    return { x: 0, y: 74 * scale };
  }
  if (zone === 'top-right') {
    return { x: -94 * scale, y: 64 * scale };
  }
  if (zone === 'mid-left') {
    return { x: 92 * scale, y: 2 * scale };
  }
  if (zone === 'mid-right') {
    return { x: -92 * scale, y: 2 * scale };
  }
  if (zone === 'bottom-left') {
    return { x: 88 * scale, y: -72 * scale };
  }
  if (zone === 'bottom-center') {
    return { x: 0, y: -94 * scale };
  }

  return { x: -88 * scale, y: -72 * scale };
}

function getChipLaneDirection(lane: OpeningMomentChip['lane']) {
  if (lane === 'rise-right') {
    return { x: 1, y: -1 };
  }
  if (lane === 'rise-left') {
    return { x: -1, y: -1 };
  }
  if (lane === 'fall-right') {
    return { x: 1, y: 1 };
  }

  return { x: -1, y: 1 };
}

function getChipEntryOffset(zone: OpeningMomentChip['zone'], enterFrom: OpeningMomentChip['enterFrom'], scale: number) {
  const horizontal = enterFrom === 'left' ? -1 : 1;

  if (zone === 'top-left') {
    return { x: horizontal * 142 * scale, y: -46 * scale };
  }
  if (zone === 'top-center') {
    return { x: horizontal * 132 * scale, y: -84 * scale };
  }
  if (zone === 'top-right') {
    return { x: horizontal * 142 * scale, y: -42 * scale };
  }
  if (zone === 'mid-left') {
    return { x: horizontal * 156 * scale, y: -10 * scale };
  }
  if (zone === 'mid-right') {
    return { x: horizontal * 156 * scale, y: 10 * scale };
  }
  if (zone === 'bottom-left') {
    return { x: horizontal * 136 * scale, y: 84 * scale };
  }
  if (zone === 'bottom-center') {
    return { x: horizontal * 126 * scale, y: 98 * scale };
  }

  return { x: horizontal * 136 * scale, y: 84 * scale };
}

function getOpeningStageMetrics(stageWidth: number, stageHeight: number) {
  const scale = Math.max(
    0.92,
    Math.min(1.32, Math.min(stageWidth / OPENING_BASE_STAGE_WIDTH, stageHeight / OPENING_BASE_STAGE_HEIGHT))
  );
  const eggSize = 102 * scale;
  const eggTop = stageHeight * 0.311;

  return {
    coronaSize: 148 * scale,
    eggCenterY: eggTop + eggSize / 2,
    eggSize,
    eggTop,
    glowSize: 176 * scale,
    intakeSize: 104 * scale,
    scale,
    stageHeight,
    stageWidth,
  };
}

function getDepthScale(depth: OpeningMomentChip['depth']) {
  if (depth === 'near') {
    return 1.06;
  }
  if (depth === 'mid') {
    return 0.96;
  }

  return 0.88;
}

function getDepthOpacity(depth: OpeningMomentChip['depth']) {
  if (depth === 'near') {
    return 1;
  }
  if (depth === 'mid') {
    return 0.86;
  }

  return 0.66;
}

function getChipBackground(accent: string, depth: OpeningMomentChip['depth']) {
  if (depth === 'near') {
    return `${accent}16`;
  }
  if (depth === 'mid') {
    return 'rgba(8, 12, 22, 0.84)';
  }

  return 'rgba(8, 12, 22, 0.7)';
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
  particleLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  particleDot: {
    backgroundColor: 'rgba(220, 232, 255, 0.82)',
    borderRadius: 999,
    position: 'absolute',
  },
  mergeField: {
    ...StyleSheet.absoluteFillObject,
  },
  streamWrap: {
    height: 14,
    position: 'absolute',
  },
  streamBeam: {
    borderRadius: 999,
    height: 2,
    marginTop: 6,
    width: '100%',
  },
  streamBeamTight: {
    height: 2.4,
    marginTop: 5.8,
  },
  streamParticle: {
    borderRadius: 999,
    height: 4,
    left: 0,
    position: 'absolute',
    top: 5,
    width: 4,
  },
  streamParticleSecondary: {
    height: 3,
    top: 5.5,
    width: 3,
  },
  intakeGlow: {
    backgroundColor: 'rgba(234, 240, 255, 0.22)',
    borderRadius: 999,
    height: 104,
    position: 'absolute',
    width: 104,
  },
  coronaWrap: {
    height: 148,
    position: 'absolute',
    width: 148,
  },
  memoryChip: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    position: 'absolute',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
  },
  memoryChipIconWrap: {
    alignItems: 'center',
    borderRadius: 999,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  memoryChipLabel: {
    fontSize: 13,
    lineHeight: 16,
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
  eggRevealShell: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'flex-end',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  openingEggGlow: {
    backgroundColor: 'rgba(238, 230, 255, 0.18)',
    borderRadius: 999,
    position: 'absolute',
  },
  openingEggShell: {
    alignItems: 'center',
    backgroundColor: 'rgba(10, 14, 24, 0.96)',
    borderColor: 'rgba(230,236,255,0.34)',
    borderRadius: 999,
    borderWidth: 1,
    boxShadow: KatchaDeckUI.shadows.card,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'absolute',
  },
  openingEggCore: {
    backgroundColor: 'rgba(243,183,136,0.18)',
    borderRadius: 999,
    height: 46,
    width: 46,
  },
  openingEggInnerFlash: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    position: 'absolute',
    width: '100%',
  },
  openingEggEcho: {
    borderRadius: 999,
    position: 'absolute',
  },
  openingEggEchoWarm: {
    backgroundColor: 'rgba(244, 190, 141, 0.54)',
    height: 28,
    left: 24,
    top: 24,
    width: 28,
  },
  openingEggEchoCool: {
    backgroundColor: 'rgba(144, 188, 255, 0.46)',
    height: 20,
    right: 24,
    top: 34,
    width: 20,
  },
  openingEggEchoPhoto: {
    backgroundColor: 'rgba(210, 190, 255, 0.46)',
    bottom: 22,
    height: 18,
    left: 40,
    width: 18,
  },
  openingEggCracks: {
    ...StyleSheet.absoluteFillObject,
  },
  openingEggCrack: {
    backgroundColor: 'rgba(248, 251, 255, 0.76)',
    borderRadius: 999,
    position: 'absolute',
  },
  openingEggCrackPrimary: {
    height: 36,
    left: 48,
    top: 18,
    width: 1.5,
  },
  openingEggCrackLeft: {
    height: 20,
    left: 38,
    top: 34,
    transform: [{ rotateZ: '-32deg' }],
    width: 1.5,
  },
  openingEggCrackRight: {
    height: 18,
    right: 38,
    top: 30,
    transform: [{ rotateZ: '26deg' }],
    width: 1.5,
  },
  burstParticle: {
    borderRadius: 999,
    position: 'absolute',
    top: 176,
  },
  openingCreatureWrap: {
    alignItems: 'center',
    height: 156,
    justifyContent: 'center',
    position: 'absolute',
    top: 98,
    width: 156,
  },
  openingCreatureGlow: {
    borderRadius: 999,
    bottom: -10,
    left: -10,
    position: 'absolute',
    right: -10,
    top: -10,
  },
  openingCreatureImageShell: {
    backgroundColor: 'rgba(13, 18, 28, 0.9)',
    borderColor: 'rgba(231, 238, 255, 0.22)',
    borderRadius: 999,
    borderWidth: 1.5,
    boxShadow: KatchaDeckUI.shadows.card,
    height: '100%',
    overflow: 'hidden',
    width: '100%',
  },
  openingCreatureImage: {
    height: '100%',
    width: '100%',
  },
  openingMemoryPanelWrap: {
    position: 'absolute',
    top: 274,
    width: 272,
  },
  openingMemoryPanel: {
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  openingMemoryTag: {
    fontSize: 11,
  },
  openingMemoryTitle: {
    fontSize: 22,
    lineHeight: 26,
  },
  openingMemoryBody: {
    fontSize: 13,
    lineHeight: 18,
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
