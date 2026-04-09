import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useFloatingMotion, usePulseMotion } from '@/components/katchadeck/motion';
import { KatchaDeckUI } from '@/constants/theme';

type HoodedAvatarProps = {
  size?: number;
};

export function HoodedAvatar({ size = 184 }: HoodedAvatarProps) {
  const shellSize = size;
  const hoodWidth = size * 0.58;
  const hoodHeight = size * 0.72;
  const floatStyle = useFloatingMotion(8, 120);
  const pulseStyle = usePulseMotion(0.96, 1.04, 180);

  return (
    <Animated.View style={[styles.shell, { height: shellSize, width: shellSize }, floatStyle]}>
      <Animated.View style={[styles.glowRing, { height: shellSize * 0.86, width: shellSize * 0.86 }, pulseStyle]} />
      <View style={styles.ringOutline} />
      <LinearGradient colors={['#2A314A', '#141725']} style={[styles.hood, { height: hoodHeight, width: hoodWidth }]}>
        <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.02)']} style={styles.hoodSheen} />
        <View style={styles.faceVoid}>
          <View style={styles.eyeLine} />
        </View>
      </LinearGradient>
      <LinearGradient colors={[...KatchaDeckUI.gradients.hoodedAura]} style={styles.aura} />
    </Animated.View>
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
    position: 'absolute',
  },
  ringOutline: {
    borderColor: 'rgba(200,216,255,0.16)',
    borderRadius: 999,
    borderWidth: 1,
    height: '92%',
    opacity: 0.74,
    position: 'absolute',
    width: '92%',
  },
  hood: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    boxShadow: KatchaDeckUI.shadows.card,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingTop: 20,
  },
  hoodSheen: {
    borderRadius: 999,
    height: '72%',
    left: '18%',
    opacity: 0.6,
    position: 'absolute',
    top: '8%',
    width: '28%',
  },
  faceVoid: {
    alignItems: 'center',
    backgroundColor: '#0A0D16',
    borderCurve: 'continuous',
    borderRadius: 28,
    height: '44%',
    justifyContent: 'center',
    width: '34%',
  },
  eyeLine: {
    backgroundColor: 'rgba(200,216,255,0.32)',
    borderRadius: 999,
    height: 6,
    width: '56%',
  },
  aura: {
    borderRadius: 999,
    bottom: 8,
    height: '26%',
    position: 'absolute',
    width: '72%',
  },
});
