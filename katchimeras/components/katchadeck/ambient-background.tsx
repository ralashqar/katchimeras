import { LinearGradient } from 'expo-linear-gradient';
import { MeshGradientView } from 'expo-mesh-gradient';
import { StyleSheet, View } from 'react-native';

type AmbientBackgroundProps = {
  colors: readonly [string, string, string];
  meshColors?: readonly [string, string, string, string];
  // Kept for caller compatibility — the floating accent orbs were removed, so
  // the accent no longer paints anything.
  accentColor?: string;
  showOrbs?: boolean;
};

// The screens' ambient backdrop: a vertical gradient with a soft mesh wash.
// (The old floating "orb" circles are gone — they read as stray UI.)
export function AmbientBackground({
  colors,
  meshColors = ['rgba(200,216,255,0.12)', 'rgba(95,168,123,0.16)', 'rgba(227,160,110,0.12)', 'rgba(106,95,232,0.14)'],
}: AmbientBackgroundProps) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[...colors]} style={StyleSheet.absoluteFill} />
      <MeshGradientView
        columns={2}
        colors={[...meshColors]}
        rows={2}
        style={[StyleSheet.absoluteFill, styles.mesh]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mesh: {
    opacity: 0.95,
  },
});
