import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import type { AbsorptionPayload } from '@/types/home';
import { getOrbitOffset } from '@/components/katchadeck/home/add-moment-orbit-geometry';

type MomentAbsorptionOverlayProps = {
  payload: AbsorptionPayload;
  radius?: number;
};

export function MomentAbsorptionOverlay({ payload, radius = 126 }: MomentAbsorptionOverlayProps) {
  const progress = useSharedValue(0);
  const offset = getOrbitOffset(payload.orbitIndex, payload.orbitCount, radius);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: 420,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);

  const movingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.72, 1], [1, 0.92, 0]),
    transform: [
      { translateX: offset.x * (1 - progress.value) },
      { translateY: offset.y * (1 - progress.value) - progress.value * 16 },
      { scale: interpolate(progress.value, [0, 0.55, 1], [1, 1.08, 0.44]) },
    ],
  }));

  const trailStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4, 1], [0.08, 0.2, 0]),
    transform: [{ scale: 0.74 + progress.value * 0.34 }],
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.trail, { backgroundColor: `${payload.accentColor}30` }, trailStyle]} />
      <Animated.View style={[styles.payloadWrap, movingStyle]}>
        {payload.kind === 'photo' && payload.previewUri ? (
          <View style={styles.photoShell}>
            <Image contentFit="cover" source={{ uri: payload.previewUri }} style={styles.photo} transition={0} />
          </View>
        ) : (
          <View style={[styles.tagShell, { backgroundColor: `${payload.accentColor}22`, borderColor: `${payload.accentColor}72` }]}>
            {payload.icon ? <IconSymbol color={payload.accentColor} name={payload.icon} size={18} /> : null}
            <ThemedText style={styles.label} lightColor="#FFF8F4" darkColor="#FFF8F4">
              {payload.label}
            </ThemedText>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  trail: {
    borderRadius: 999,
    height: 98,
    left: '50%',
    marginLeft: -49,
    marginTop: -49,
    position: 'absolute',
    top: '50%',
    width: 98,
  },
  payloadWrap: {
    left: '50%',
    marginLeft: -34,
    marginTop: -34,
    position: 'absolute',
    top: '50%',
  },
  photoShell: {
    borderRadius: 22,
    height: 68,
    overflow: 'hidden',
    width: 68,
  },
  photo: {
    height: '100%',
    width: '100%',
  },
  tagShell: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
  },
});
