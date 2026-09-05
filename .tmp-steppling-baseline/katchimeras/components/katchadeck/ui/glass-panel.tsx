import type { ReactNode } from 'react';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, type StyleProp, type ViewStyle, View } from 'react-native';

import { Colors, KatchaDeckUI } from '@/constants/theme';

type GlassPanelProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  radius?: number;
  intensity?: number;
  borderColor?: string;
  fillColor?: string;
  gradientColors?: readonly [string, string] | readonly [string, string, string];
};

// Lantern: panels are borderless solid surfaces - elevation by shadow, not
// blur or hairline. The glass API (fill/gradient/intensity) is kept so call
// sites still compose, but blur only renders for translucent custom fills.
export function GlassPanel({
  children,
  style,
  contentStyle,
  radius = KatchaDeckUI.radii.lg,
  intensity = 0,
  borderColor: _borderColor,
  fillColor = Colors.dark.surface,
  gradientColors,
}: GlassPanelProps) {
  return (
    <View
      style={[
        styles.shell,
        {
          backgroundColor: 'transparent',
          borderRadius: radius,
        },
        style,
      ]}>
      {gradientColors ? <LinearGradient colors={[...gradientColors]} style={StyleSheet.absoluteFill} /> : null}
      {intensity > 0 ? <BlurView intensity={intensity} style={StyleSheet.absoluteFill} tint="dark" /> : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: fillColor }]} />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderCurve: 'continuous',
    boxShadow: '0 14px 40px rgba(0,0,0,0.35)',
    overflow: 'hidden',
  },
  content: {
    padding: KatchaDeckUI.spacing.lg,
  },
});
