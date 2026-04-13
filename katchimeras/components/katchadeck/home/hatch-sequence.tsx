import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { GlassPanel } from '@/components/katchadeck/ui/glass-panel';
import { ThemedText } from '@/components/themed-text';
import type { HomeDayRecord } from '@/types/home';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { KatchaDeckUI } from '@/constants/theme';

export type HatchSequencePhase = 'recap' | 'converging' | 'revealing';

type HatchSequenceProps = {
  day: HomeDayRecord;
  phase: HatchSequencePhase;
  onSkip: () => void;
};

export function HatchSequence({ day, phase, onSkip }: HatchSequenceProps) {
  const pulse = useSharedValue(0.18);
  const phaseProgress = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.2, { duration: 1400, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [pulse]);

  useEffect(() => {
    phaseProgress.value = withTiming(resolvePhaseValue(phase), {
      duration: phase === 'revealing' ? 320 : 420,
      easing: Easing.out(Easing.cubic),
    });
  }, [phase, phaseProgress]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.16 + pulse.value * 0.26 + phaseProgress.value * 0.08,
    transform: [{ scale: 0.94 + pulse.value * 0.1 + phaseProgress.value * 0.08 }],
  }));

  const chipsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(phaseProgress.value, [0, 1, 2], [1, 0.9, 0.18]),
    transform: [
      { scale: interpolate(phaseProgress.value, [0, 1, 2], [1, 0.92, 0.72]) },
      { translateY: interpolate(phaseProgress.value, [0, 1, 2], [0, -6, -18]) },
    ],
  }));

  const coreHaloStyle = useAnimatedStyle(() => ({
    opacity: 0.24 + pulse.value * 0.2 + phaseProgress.value * 0.18,
    transform: [{ scale: 0.88 + pulse.value * 0.08 + phaseProgress.value * 0.16 }],
  }));

  const coreShellStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.96 + pulse.value * 0.04 + phaseProgress.value * 0.08 }],
  }));

  const coreStyle = useAnimatedStyle(() => ({
    opacity: 0.6 + pulse.value * 0.18 + phaseProgress.value * 0.12,
    transform: [{ scale: 0.92 + phaseProgress.value * 0.1 }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + pulse.value * 0.12 + phaseProgress.value * 0.2,
    transform: [{ scale: 0.94 + phaseProgress.value * 0.12 }],
  }));

  return (
    <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(220)} style={styles.overlay}>
      <Animated.View style={[styles.halo, { backgroundColor: `${day.egg.haloColor}20` }, haloStyle]} />
      <GlassPanel
        contentStyle={styles.panel}
        fillColor="rgba(7, 10, 19, 0.82)"
        gradientColors={['rgba(221,232,255,0.12)', 'rgba(240,223,255,0.08)', 'rgba(255,216,192,0.06)']}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <ThemedText type="onboardingLabel" style={styles.label} lightColor="#D7E4FF" darkColor="#D7E4FF">
              {phase === 'recap' ? 'Moment recap' : phase === 'converging' ? 'Converging' : 'Revealing'}
            </ThemedText>
            <ThemedText type="subtitle" style={styles.title} lightColor="#F8FBFF" darkColor="#F8FBFF">
              {phase === 'recap'
                ? 'The day is gathering itself.'
                : phase === 'converging'
                  ? 'Everything is pulling inward.'
                  : 'The hatch is almost visible.'}
            </ThemedText>
          </View>
          <KatchaButton icon="arrow.right" label="Skip" onPress={onSkip} variant="secondary" />
        </View>

        <Animated.View style={[styles.momentCloud, chipsStyle]}>
          <Animated.View style={[styles.coreHalo, { backgroundColor: `${day.egg.haloColor}2A` }, coreHaloStyle]} />
          <Animated.View style={[styles.outerRing, { borderColor: `${day.egg.accentColor}66` }, ringStyle]} />
          <Animated.View style={[styles.innerRing, { borderColor: `${day.egg.coreColor}7A` }, ringStyle]} />
          <Animated.View style={[styles.coreShell, coreShellStyle]}>
            <LinearGradient colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']} style={styles.coreSheen} />
            <View style={[styles.coreEgg, { borderColor: `${day.egg.accentColor}A0` }]}>
              <Animated.View style={[styles.coreOrb, { backgroundColor: day.egg.coreColor }, coreStyle]} />
              <View style={[styles.coreSpark, { backgroundColor: day.egg.accentColor }]} />
              <View style={[styles.coreSparkSecondary, { backgroundColor: `${day.egg.coreColor}CC` }]} />
            </View>
          </Animated.View>
          {day.moments.map((moment, index) => (
            <View
              key={moment.id}
              style={[
                styles.momentChip,
                getChipPlacement(index),
                {
                  backgroundColor: `${moment.accentColor}18`,
                  borderColor: `${moment.accentColor}48`,
                },
              ]}>
              <IconSymbol color={moment.accentColor} name={moment.icon} size={14} />
              <ThemedText style={styles.chipLabel} lightColor="#F8FBFF" darkColor="#F8FBFF">
                {moment.label}
              </ThemedText>
            </View>
          ))}
        </Animated.View>

        <View style={styles.sequenceCopy}>
          <ThemedText style={styles.body} lightColor="#DCE6FF" darkColor="#DCE6FF">
            {phase === 'recap'
              ? 'The moments of this day are replaying before the hatch settles.'
              : phase === 'converging'
                ? 'Movement, mood, and little signals are closing into a single shape.'
                : 'One form is about to carry the whole day forward.'}
          </ThemedText>
        </View>
      </GlassPanel>
    </Animated.View>
  );
}

function resolvePhaseValue(phase: HatchSequencePhase) {
  if (phase === 'converging') {
    return 1;
  }

  if (phase === 'revealing') {
    return 2;
  }

  return 0;
}

function getChipPlacement(index: number) {
  const positions = [
    { left: '4%', top: 10 },
    { right: '6%', top: 20 },
    { left: '12%', bottom: 24 },
    { right: '12%', bottom: 16 },
    { left: '30%', top: 4 },
    { right: '24%', top: 68 },
  ] as const;

  return positions[index % positions.length];
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(4, 6, 14, 0.66)',
    justifyContent: 'center',
    padding: 20,
    zIndex: 20,
  },
  halo: {
    borderRadius: 999,
    height: 320,
    position: 'absolute',
    width: 320,
  },
  panel: {
    gap: 20,
    minHeight: 360,
    width: '100%',
  },
  header: {
    gap: 12,
  },
  headerCopy: {
    gap: 6,
  },
  label: {
    fontSize: 11,
  },
  title: {
    fontSize: 25,
    lineHeight: 30,
  },
  momentCloud: {
    height: 172,
    position: 'relative',
  },
  coreHalo: {
    borderRadius: 999,
    height: 122,
    left: '50%',
    marginLeft: -61,
    marginTop: -61,
    position: 'absolute',
    top: '50%',
    width: 122,
  },
  outerRing: {
    borderRadius: 999,
    borderWidth: 1,
    height: 112,
    left: '50%',
    marginLeft: -56,
    marginTop: -56,
    position: 'absolute',
    top: '50%',
    width: 112,
  },
  innerRing: {
    borderRadius: 999,
    borderWidth: 1,
    height: 82,
    left: '50%',
    marginLeft: -41,
    marginTop: -41,
    position: 'absolute',
    top: '50%',
    width: 82,
  },
  coreShell: {
    alignItems: 'center',
    height: 104,
    justifyContent: 'center',
    left: '50%',
    marginLeft: -42,
    marginTop: -50,
    position: 'absolute',
    top: '50%',
    width: 84,
  },
  coreEgg: {
    alignItems: 'center',
    backgroundColor: 'rgba(10,14,24,0.96)',
    borderRadius: 999,
    borderWidth: 1.25,
    boxShadow: KatchaDeckUI.shadows.card,
    height: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  coreSheen: {
    borderRadius: 999,
    height: 34,
    left: 14,
    opacity: 0.8,
    position: 'absolute',
    top: 12,
    width: 24,
    zIndex: 2,
  },
  coreOrb: {
    borderRadius: 999,
    height: 38,
    width: 38,
  },
  coreSpark: {
    borderRadius: 999,
    height: 10,
    position: 'absolute',
    right: 18,
    top: 14,
    width: 10,
  },
  coreSparkSecondary: {
    borderRadius: 999,
    bottom: 18,
    height: 8,
    left: 18,
    position: 'absolute',
    width: 8,
  },
  momentChip: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    position: 'absolute',
  },
  chipLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  sequenceCopy: {
    gap: 6,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
});
