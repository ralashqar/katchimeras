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

export function GlassPanel({
  children,
  style,
  contentStyle,
  radius = KatchaDeckUI.radii.lg,
  intensity = 32,
  borderColor = Colors.dark.border,
  fillColor = Colors.dark.glass,
  gradientColors,
}: GlassPanelProps) {
  return (
    <View
      style={[
        styles.shell,
        {
          backgroundColor: 'transparent',
          borderColor,
          borderRadius: radius,
        },
        style,
      ]}>
      {gradientColors ? <LinearGradient colors={[...gradientColors]} style={StyleSheet.absoluteFill} /> : null}
      <BlurView intensity={intensity} style={StyleSheet.absoluteFill} tint="dark" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: fillColor }]} />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
  },
  content: {
    padding: KatchaDeckUI.spacing.lg,
  },
});
