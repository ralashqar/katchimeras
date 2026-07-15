import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import {
  scoreTimingTap,
  timingAccuracy,
  type TimingRating,
} from '@/utils/quests/experiences/timing-zone';
import type { QuestResult } from '@/utils/quests/experiences/types';

import {
  ExperienceAction,
  ExperienceResult,
  QuestExperiencePreview,
  experienceStyles,
  useQuestAppActive,
} from './quest-experience-ui';

type Config = {
  challengeId: 'steppling-stride' | 'mossprout-tend';
  attempts: number;
  targetHits: number;
  traversalMs: number;
  zoneWidth: number;
  tier: number;
};

type Props = {
  config: Config;
  onAttemptStart: (config: Record<string, unknown>) => string;
  onAttemptCancel: (id: string) => void;
  onComplete: (id: string, result: QuestResult) => void;
  onRunningChange: (running: boolean, id?: string | null) => void;
};

function mossRatingCopy(rating: TimingRating | null): string {
  if (rating === 'perfect') return 'RIGHT ON THE ROOTS';
  if (rating === 'good') return 'NICELY WATERED';
  if (rating === 'early') return 'A LITTLE EARLY';
  if (rating === 'late') return 'A LITTLE LATE';
  return 'FOLLOW THE DROP';
}

export function TimingZoneQuest({
  config,
  onAttemptStart,
  onAttemptCancel,
  onComplete,
  onRunningChange,
}: Props) {
  const [started, setStarted] = useState(false);
  const [position, setPosition] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [hits, setHits] = useState(0);
  const [rating, setRating] = useState<TimingRating | null>(null);
  const [lastTapHit, setLastTapHit] = useState<boolean | null>(null);
  const offsets = useRef<number[]>([]);
  const attemptId = useRef<string | null>(null);
  const startedAt = useRef(0);
  const origin = useRef(0);
  const pulseScale = useSharedValue(0.45);
  const pulseOpacity = useSharedValue(0);
  const countScale = useSharedValue(1);
  const reduceMotion = useReducedMotion();
  const complete = attempts >= config.attempts;
  const success = complete && hits >= config.targetHits;
  const moss = config.challengeId === 'mossprout-tend';
  const appActive = useQuestAppActive();
  const progress = Math.min(1, hits / Math.max(1, config.targetHits));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
    transform: [{ scale: pulseScale.value }],
  }));
  const countStyle = useAnimatedStyle(() => ({
    transform: [{ scale: countScale.value }],
  }));

  useEffect(() => {
    if (!started || complete || !appActive) return;
    origin.current = 0;
    let frame = 0;
    const tick = (now: number) => {
      if (!origin.current) origin.current = now;
      const phase = ((now - origin.current) % (config.traversalMs * 2)) / config.traversalMs;
      setPosition(phase <= 1 ? phase : 2 - phase);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [appActive, complete, config.traversalMs, started]);

  const start = () => {
    attemptId.current = onAttemptStart(config);
    startedAt.current = Date.now();
    origin.current = 0;
    setStarted(true);
    onRunningChange(true, attemptId.current);
  };

  const reset = () => {
    if (attemptId.current) onAttemptCancel(attemptId.current);
    attemptId.current = null;
    setStarted(false);
    setAttempts(0);
    setHits(0);
    setRating(null);
    setLastTapHit(null);
    offsets.current = [];
    onRunningChange(false);
  };

  const tap = () => {
    if (complete || !appActive) return;
    const scored = scoreTimingTap(position, 0.5, config.zoneWidth);
    offsets.current.push(Math.abs(scored.normalizedOffset) * config.traversalMs);
    setAttempts((value) => value + 1);
    if (scored.hit) setHits((value) => value + 1);
    setRating(scored.rating);
    setLastTapHit(scored.hit);

    pulseScale.value = 0.45;
    pulseOpacity.value = 0.82;
    pulseScale.value = withTiming(reduceMotion ? 1 : 1.85, { duration: reduceMotion ? 120 : 380 });
    pulseOpacity.value = withTiming(0, { duration: reduceMotion ? 120 : 420 });
    if (scored.hit) {
      countScale.value = reduceMotion
        ? 1
        : withSequence(withTiming(1.17, { duration: 90 }), withTiming(1, { duration: 170 }));
    }

    if (process.env.EXPO_OS === 'ios') {
      void Haptics.impactAsync(
        scored.hit ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
      );
    }
  };

  const result = (): QuestResult => ({
    kind: 'timing_zone',
    success,
    hits,
    attempts,
    accuracy: timingAccuracy(hits, attempts),
    averageOffsetMs: offsets.current.length
      ? offsets.current.reduce((sum, value) => sum + value, 0) / offsets.current.length
      : 0,
    durationMs: Date.now() - startedAt.current,
  });

  if (!started) {
    return (
        <QuestExperiencePreview
          eyebrow={moss ? 'Mossprout' : 'Steppling'}
          title={moss ? 'Tend Mossprout’s patch' : 'Catch the stride'}
          body={moss ? 'Tap when the drop reaches the glowing soil.' : 'Tap when the moving light enters the stride zone.'}
          icon={moss ? 'water.waves' : 'figure.run'}
          actionLabel={moss ? 'Start watering' : 'Start timing'}
          onAction={start}
        />
    );
  }

  if (complete && attemptId.current) {
    return (
      <ExperienceResult
        success={success}
        title={success ? (moss ? 'The patch is glowing' : 'You found the rhythm') : 'Nearly there'}
        body={
          success
            ? `${hits} well-timed taps.`
            : `You needed ${config.targetHits} hits. Try once more when you’re ready.`
        }
        metric={`${hits}/${attempts}`}
        onRetry={reset}
        onComplete={() => {
          if (success) onComplete(attemptId.current!, result());
          else reset();
        }}
      />
    );
  }

  const track = (
    <View
      pointerEvents={moss ? 'none' : 'auto'}
      style={[styles.playArea, moss && styles.mossPlayArea, lastTapHit === true && styles.hitPlayArea]}>
      {moss ? (
        <View style={styles.gardenBed}>
          {Array.from({ length: config.targetHits }, (_, index) => (
            <View key={index} style={[styles.sprout, index < hits && styles.sproutWatered]} />
          ))}
        </View>
      ) : null}
      <View
        style={[
          styles.zone,
          {
            left: `${(0.5 - config.zoneWidth / 2) * 100}%`,
            width: `${config.zoneWidth * 100}%`,
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.tapPulse,
          { left: `${position * 100}%` },
          lastTapHit === false && styles.missPulse,
          pulseStyle,
        ]}
      />
      <View style={[styles.marker, moss && styles.dropMarker, { left: `${position * 100}%` }]}>
        <ThemedText
          style={[styles.markerText, moss && styles.dropText]}
          lightColor={moss ? Lantern.moon50 : Lantern.emberInk}
          darkColor={moss ? Lantern.moon50 : Lantern.emberInk}>
          {moss ? '●' : '✦'}
        </ThemedText>
      </View>
    </View>
  );

  const status = (
    <>
      {moss ? (
        <View
          accessible
          accessibilityLabel={`${hits} of ${config.targetHits} good drops`}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: config.targetHits, now: hits }}
          style={styles.mossProgressCard}>
          <View style={styles.progressCopy}>
            <ThemedText style={styles.progress} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              WATERING THE PATCH
            </ThemedText>
            <ThemedText style={styles.progressHint} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
              {Math.max(0, config.targetHits - hits)} good drops to go
            </ThemedText>
          </View>
          <Animated.View style={[styles.countBubble, countStyle]}>
            <ThemedText style={styles.countValue} lightColor={Lantern.auroraTeal} darkColor={Lantern.auroraTeal}>
              {hits}
            </ThemedText>
            <ThemedText style={styles.countTarget} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              /{config.targetHits}
            </ThemedText>
          </Animated.View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>
      ) : (
        <ThemedText style={styles.progress} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
          {attempts + 1} OF {config.attempts} · {hits} HITS
        </ThemedText>
      )}
      {moss ? track : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tap now"
          onPress={tap}
          style={({ pressed }) => pressed && styles.pressed}>
          {track}
        </Pressable>
      )}
      <View style={experienceStyles.center} pointerEvents="none">
        <ThemedText
          style={styles.rating}
          lightColor={rating === 'perfect' || rating === 'good' ? Lantern.auroraTeal : Lantern.ember300}
          darkColor={rating === 'perfect' || rating === 'good' ? Lantern.auroraTeal : Lantern.ember300}>
          {moss ? mossRatingCopy(rating) : rating ? rating.toUpperCase() : 'WATCH THE LIGHT'}
        </ThemedText>
        <ThemedText style={experienceStyles.help} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
          {moss
            ? `Drop ${attempts + 1} of ${config.attempts} · tap anywhere in this garden area`
            : 'Tap anywhere as the marker crosses the green zone.'}
        </ThemedText>
      </View>
    </>
  );

  return (
    <View style={experienceStyles.root}>
      {moss ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Water now. ${hits} of ${config.targetHits} good drops.`}
          accessibilityHint="Tap anywhere in the garden area when the drop reaches the glowing soil"
          onPress={tap}
          style={({ pressed }) => [styles.fullTapSurface, pressed && styles.pressed]}>
          {status}
        </Pressable>
      ) : (
        <View style={styles.fullTapSurface}>{status}</View>
      )}
      <ExperienceAction label="Cancel attempt" quiet onPress={reset} />
    </View>
  );
}

const styles = StyleSheet.create({
  fullTapSurface: {
    flex: 1,
    gap: 14,
    justifyContent: 'space-between',
    minHeight: 0,
  },
  pressed: {
    opacity: 0.92,
  },
  progress: {
    fontSize: 11.5,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  mossProgressCard: {
    backgroundColor: 'rgba(125,232,205,0.07)',
    borderColor: 'rgba(125,232,205,0.18)',
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 15,
  },
  progressCopy: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
    minWidth: 150,
  },
  progressHint: {
    fontSize: 13,
    fontWeight: '700',
  },
  countBubble: {
    alignItems: 'baseline',
    backgroundColor: Lantern.ink900,
    borderColor: 'rgba(125,232,205,0.28)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    minWidth: 82,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  countValue: {
    fontSize: 28,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
    lineHeight: 32,
  },
  countTarget: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  progressTrack: {
    backgroundColor: 'rgba(125,232,205,0.12)',
    borderRadius: 999,
    height: 7,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    backgroundColor: Lantern.auroraTeal,
    borderRadius: 999,
    height: '100%',
  },
  playArea: {
    backgroundColor: Lantern.ink900,
    borderColor: 'rgba(201,194,232,0.15)',
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    height: 150,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mossPlayArea: {
    backgroundColor: 'rgba(20,36,29,0.88)',
    borderColor: 'rgba(125,232,205,0.2)',
  },
  hitPlayArea: {
    borderColor: 'rgba(125,232,205,0.5)',
  },
  gardenBed: {
    alignItems: 'flex-end',
    bottom: 15,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    left: 18,
    position: 'absolute',
    right: 18,
  },
  sprout: {
    backgroundColor: 'rgba(125,232,205,0.16)',
    borderRadius: 999,
    height: 5,
    width: 18,
  },
  sproutWatered: {
    backgroundColor: Lantern.auroraTeal,
    height: 9,
  },
  zone: {
    backgroundColor: 'rgba(125,232,205,0.2)',
    borderColor: Lantern.auroraTeal,
    borderRadius: 18,
    borderWidth: 2,
    height: 94,
    position: 'absolute',
  },
  tapPulse: {
    borderColor: Lantern.auroraTeal,
    borderRadius: 999,
    borderWidth: 3,
    height: 64,
    marginLeft: -32,
    position: 'absolute',
    width: 64,
  },
  missPulse: {
    borderColor: Lantern.ember300,
  },
  marker: {
    alignItems: 'center',
    backgroundColor: Lantern.ember300,
    borderRadius: 999,
    height: 48,
    justifyContent: 'center',
    marginLeft: -24,
    position: 'absolute',
    width: 48,
  },
  dropMarker: {
    backgroundColor: '#369FC0',
    borderColor: 'rgba(246,243,255,0.7)',
    borderWidth: 2,
    shadowColor: Lantern.auroraTeal,
    shadowOpacity: 0.38,
    shadowRadius: 12,
  },
  markerText: {
    fontSize: 19,
    fontWeight: '900',
  },
  dropText: {
    fontSize: 15,
  },
  rating: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
});
