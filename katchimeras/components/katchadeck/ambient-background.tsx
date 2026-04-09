import { LinearGradient } from 'expo-linear-gradient';
import { MeshGradientView } from 'expo-mesh-gradient';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useFloatingMotion, usePulseMotion } from '@/components/katchadeck/motion';

type AmbientBackgroundProps = {
  colors: readonly [string, string, string];
  meshColors?: readonly [string, string, string, string];
  accentColor?: string;
};

export function AmbientBackground({
  colors,
  meshColors = ['rgba(200,216,255,0.12)', 'rgba(95,168,123,0.16)', 'rgba(227,160,110,0.12)', 'rgba(106,95,232,0.14)'],
  accentColor = 'rgba(200,216,255,0.18)',
}: AmbientBackgroundProps) {
  const topOrbStyle = useFloatingMotion(10);
  const bottomOrbStyle = useFloatingMotion(14, 320);
  const pulseStyle = usePulseMotion(0.92, 1.04, 180);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[...colors]} style={StyleSheet.absoluteFill} />
      <MeshGradientView
        columns={2}
        colors={[...meshColors]}
        rows={2}
        style={[StyleSheet.absoluteFill, styles.mesh]}
      />
      <Animated.View style={[styles.topOrb, { backgroundColor: accentColor }, topOrbStyle, pulseStyle]} />
      <Animated.View style={[styles.bottomOrb, { backgroundColor: 'rgba(95,168,123,0.12)' }, bottomOrbStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  mesh: {
    opacity: 0.95,
  },
  topOrb: {
    borderRadius: 999,
    height: 240,
    left: -50,
    position: 'absolute',
    top: 80,
    width: 240,
  },
  bottomOrb: {
    borderRadius: 999,
    bottom: 30,
    height: 280,
    position: 'absolute',
    right: -70,
    width: 280,
  },
});
