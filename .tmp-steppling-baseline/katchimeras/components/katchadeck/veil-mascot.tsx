import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useFloatingMotion, usePulseMotion, usePressMotion } from '@/components/katchadeck/motion';
import { KatchaDeckUI } from '@/constants/theme';

export type VeilMascotVariant = 'companion' | 'guide' | 'halo';
export type VeilMascotMood = 'calm' | 'curious' | 'bright' | 'guide';

type VeilMascotProps = {
  variant?: VeilMascotVariant;
  mood?: VeilMascotMood;
  size?: number;
  glow?: boolean;
  interactive?: boolean;
};

const moodColors: Record<VeilMascotMood, readonly [string, string]> = {
  calm: ['#D2E1FF', '#8E9FFF'],
  curious: ['#F2D7FF', '#A3A2FF'],
  bright: ['#FFF1D4', '#E4A06E'],
  guide: ['#D8E5FF', '#6A5FE8'],
};

export function VeilMascot({
  variant = 'companion',
  mood = 'calm',
  size = 108,
  glow = true,
  interactive = false,
}: VeilMascotProps) {
  const press = usePressMotion();
  const floatStyle = useFloatingMotion(variant === 'halo' ? 6 : 10, 120);
  const pulseStyle = usePulseMotion(0.94, 1.05, 220);
  const blink = useSharedValue(1);

  useEffect(() => {
    blink.value = withRepeat(
      withSequence(
        withDelay(
          1700,
          withTiming(0.1, {
            duration: 110,
          })
        ),
        withTiming(1, {
          duration: 120,
        })
      ),
      -1,
      false
    );
  }, [blink]);

  const eyeStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: blink.value }],
  }));

  const shell = (
    <Animated.View
      style={[
        styles.shell,
        { height: size, width: size },
        floatStyle,
        interactive ? press.animatedStyle : null,
      ]}>
      {glow ? (
        <Animated.View style={[styles.glow, { height: size * 0.96, width: size * 0.96 }, pulseStyle]} />
      ) : null}
      <Animated.View style={[styles.orbitRing, { height: size * 1.06, width: size * 1.06 }]} />
      <LinearGradient colors={[...moodColors[mood]]} style={[styles.core, { height: size * 0.72, width: size * 0.58 }]}>
        <LinearGradient colors={['rgba(255,255,255,0.95)', 'rgba(227, 241, 255, 0.18)']} style={styles.innerLight} />
        <View style={[styles.faceVoid, variant === 'guide' ? styles.faceVoidGuide : null]}>
          <Animated.View style={[styles.eyeRow, eyeStyle]}>
            <View style={styles.eye} />
            <View style={styles.eye} />
          </Animated.View>
        </View>
      </LinearGradient>
      <View style={[styles.ribbon, { width: size * 0.48, bottom: size * 0.08 }]} />
    </Animated.View>
  );

  if (!interactive) {
    return shell;
  }

  return (
    <Pressable
      onPressIn={() => {
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
        }
        press.onPressIn();
      }}
      onPressOut={press.onPressOut}>
      {shell}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    backgroundColor: 'rgba(200,216,255,0.24)',
    borderRadius: 999,
    position: 'absolute',
  },
  orbitRing: {
    borderColor: 'rgba(200,216,255,0.22)',
    borderRadius: 999,
    borderWidth: 1,
    opacity: 0.6,
    position: 'absolute',
  },
  core: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    boxShadow: KatchaDeckUI.shadows.soft,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  innerLight: {
    borderRadius: 999,
    height: '72%',
    left: '16%',
    opacity: 0.56,
    position: 'absolute',
    top: '8%',
    width: '34%',
  },
  faceVoid: {
    alignItems: 'center',
    backgroundColor: '#11192B',
    borderCurve: 'continuous',
    borderRadius: 24,
    height: '42%',
    justifyContent: 'center',
    width: '42%',
  },
  faceVoidGuide: {
    backgroundColor: '#101522',
  },
  eyeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  eye: {
    backgroundColor: '#EAF1FF',
    borderRadius: 999,
    height: 7,
    width: 7,
  },
  ribbon: {
    backgroundColor: 'rgba(200,216,255,0.34)',
    borderBottomLeftRadius: 999,
    borderBottomRightRadius: 999,
    borderTopLeftRadius: 999,
    height: 18,
    opacity: 0.8,
    position: 'absolute',
  },
});
