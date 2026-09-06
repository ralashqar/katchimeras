import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { AppFontFamilies } from '@/constants/theme';

/** Shared oversized milestone number used by Streak and Journey celebrations. */
export function CelebrationHeroNumber({ accessibilityLabel, label, numberSize = 72, value }: {
  accessibilityLabel: string;
  label: string;
  numberSize?: number;
  value: number | string;
}) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(scale);
    if (reduceMotion) {
      scale.value = 1;
      return;
    }
    scale.value = 0.985;
    scale.value = withRepeat(
      withTiming(1.035, { duration: 1_450, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(scale);
  }, [reduceMotion, scale]);

  const breathingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const numberStyle = { fontSize: numberSize, lineHeight: numberSize + 2 };

  return (
    <View accessibilityLabel={accessibilityLabel} style={styles.block}>
      <Animated.View style={[styles.numberStack, breathingStyle]}>
        <ThemedText accessibilityElementsHidden style={[styles.number, styles.numberShadow, numberStyle]} lightColor="#704207" darkColor="#704207">{value}</ThemedText>
        <ThemedText selectable style={[styles.number, numberStyle]} lightColor="#F6C653" darkColor="#F6C653">{value}</ThemedText>
      </Animated.View>
      <ThemedText selectable style={styles.label} lightColor="#75450A" darkColor="#75450A">{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { alignItems: 'center' },
  numberStack: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  number: {
    fontFamily: AppFontFamilies.fredokaBold,
    fontVariant: ['tabular-nums'],
    letterSpacing: -2.5,
    overflow: 'visible',
    paddingBottom: 10,
    paddingHorizontal: 14,
    paddingTop: 4,
    textShadowColor: 'rgba(255,250,207,0.9)',
    textShadowOffset: { height: -1, width: 0 },
    textShadowRadius: 1.5,
  },
  numberShadow: {
    position: 'absolute',
    textShadowColor: 'rgba(92,53,7,0.26)',
    textShadowOffset: { height: 0, width: 0 },
    textShadowRadius: 9,
    transform: [{ translateY: 5 }],
  },
  label: {
    fontFamily: AppFontFamilies.manrope,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2.25,
    paddingHorizontal: 8,
    paddingVertical: 3,
    textShadowColor: 'rgba(255,249,214,0.94)',
    textShadowOffset: { height: 0, width: 0 },
    textShadowRadius: 5,
  },
});
