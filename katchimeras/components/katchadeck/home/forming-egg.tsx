import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import type { EggVisualState } from '@/types/home';
import { KatchaDeckUI } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

type FormingEggProps = {
  egg: EggVisualState;
  onPress?: () => void;
  reactionKey?: number;
  caption?: string;
};

export function FormingEgg({ egg, onPress, reactionKey = 0, caption }: FormingEggProps) {
  const breathe = useSharedValue(0);
  const reaction = useSharedValue(0);
  const shimmer = useSharedValue(egg.shimmer ? 1 : 0);

  useEffect(() => {
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [breathe]);

  useEffect(() => {
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.18, { duration: 1800, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [egg.shimmer, shimmer]);

  useEffect(() => {
    reaction.value = 0;
    reaction.value = withSequence(
      withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 520, easing: Easing.out(Easing.cubic) })
    );
  }, [reaction, reactionKey]);

  const shellStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breathe.value * 0.04 + reaction.value * 0.06 }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.28 + breathe.value * 0.18 + reaction.value * 0.34,
    transform: [{ scale: 0.96 + breathe.value * 0.06 + reaction.value * 0.12 }],
  }));

  const coreStyle = useAnimatedStyle(() => ({
    opacity: 0.52 + shimmer.value * 0.34 + reaction.value * 0.16,
    transform: [{ scale: 0.9 + egg.intensity * 0.14 + reaction.value * 0.08 }],
  }));

  const swirlStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + shimmer.value * 0.16,
    transform: [{ rotateZ: `${egg.swirl * 210 + reaction.value * 16}deg` }],
  }));

  return (
    <Pressable onPress={onPress} style={styles.pressable}>
      <View style={styles.shell}>
        <Animated.View style={[styles.halo, { backgroundColor: `${egg.haloColor}28` }, haloStyle]} />
        <Animated.View style={[styles.outerGlow, { backgroundColor: `${egg.accentColor}26` }, haloStyle]} />
        <Animated.View style={[styles.eggWrap, shellStyle]}>
          <LinearGradient colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']} style={styles.eggSheen} />
          <View style={[styles.eggShell, { borderColor: `${egg.accentColor}9C` }]}>
            <Animated.View style={[styles.eggCore, { backgroundColor: egg.coreColor }, coreStyle]} />
            <Animated.View style={[styles.eggSwirl, { borderColor: `${egg.accentColor}80` }, swirlStyle]} />
            <View style={[styles.spark, { backgroundColor: egg.accentColor }]} />
            <View style={[styles.sparkSecondary, { backgroundColor: `${egg.coreColor}CC` }]} />
          </View>
        </Animated.View>
      </View>
      <View style={styles.captionWrap}>
        <ThemedText type="onboardingLabel" style={styles.label} lightColor="#D7E4FF" darkColor="#D7E4FF">
          {egg.label}
        </ThemedText>
        {caption ? (
          <ThemedText style={styles.caption} lightColor="#EAF1FF" darkColor="#EAF1FF">
            {caption}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignItems: 'center',
    gap: 16,
  },
  shell: {
    alignItems: 'center',
    height: 310,
    justifyContent: 'center',
    width: '100%',
  },
  halo: {
    borderRadius: 999,
    height: 238,
    position: 'absolute',
    width: 238,
  },
  outerGlow: {
    borderRadius: 999,
    height: 282,
    position: 'absolute',
    width: 282,
  },
  eggWrap: {
    alignItems: 'center',
    height: 224,
    justifyContent: 'center',
    width: 186,
  },
  eggShell: {
    alignItems: 'center',
    backgroundColor: 'rgba(10,14,24,0.96)',
    borderRadius: 120,
    borderWidth: 1.25,
    boxShadow: KatchaDeckUI.shadows.card,
    height: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  eggSheen: {
    borderRadius: 999,
    height: 86,
    left: 24,
    opacity: 0.7,
    position: 'absolute',
    top: 26,
    width: 56,
    zIndex: 2,
  },
  eggCore: {
    borderRadius: 999,
    height: 96,
    width: 96,
  },
  eggSwirl: {
    borderRadius: 999,
    borderWidth: 2,
    height: 118,
    opacity: 0.44,
    position: 'absolute',
    transform: [{ rotateZ: '22deg' }],
    width: 88,
  },
  spark: {
    borderRadius: 999,
    height: 16,
    position: 'absolute',
    right: 42,
    top: 40,
    width: 16,
  },
  sparkSecondary: {
    borderRadius: 999,
    bottom: 46,
    height: 10,
    left: 52,
    position: 'absolute',
    width: 10,
  },
  captionWrap: {
    alignItems: 'center',
    gap: 6,
    maxWidth: 280,
  },
  label: {
    fontSize: 11,
  },
  caption: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});

