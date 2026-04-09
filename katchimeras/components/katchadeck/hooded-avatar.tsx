import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

type HoodedAvatarProps = {
  size?: number;
};

export function HoodedAvatar({ size = 184 }: HoodedAvatarProps) {
  const shellSize = size;
  const hoodWidth = size * 0.58;
  const hoodHeight = size * 0.72;

  return (
    <View style={[styles.shell, { height: shellSize, width: shellSize }]}>
      <View style={styles.glowRing} />
      <LinearGradient colors={['#2f2540', '#14111f']} style={[styles.hood, { height: hoodHeight, width: hoodWidth }]}>
        <View style={styles.faceVoid} />
      </LinearGradient>
      <LinearGradient colors={['rgba(228,194,255,0.4)', 'rgba(113,126,255,0)']} style={styles.aura} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    backgroundColor: 'rgba(137, 152, 255, 0.18)',
    borderRadius: 999,
    height: '86%',
    position: 'absolute',
    width: '86%',
  },
  hood: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    justifyContent: 'center',
    paddingTop: 20,
  },
  faceVoid: {
    backgroundColor: '#0c0a14',
    borderRadius: 28,
    height: '44%',
    width: '34%',
  },
  aura: {
    borderRadius: 999,
    bottom: 8,
    height: '26%',
    position: 'absolute',
    width: '72%',
  },
});
