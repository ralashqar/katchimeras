import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { ThemedText } from '@/components/themed-text';
import type { RecentPhotoAsset } from '@/types/home';
import { getOrbitOffset } from '@/components/katchadeck/home/add-moment-orbit-geometry';

type PhotoOrbitRingProps = {
  photos: RecentPhotoAsset[];
  radius?: number;
  onSelectPhoto: (assetId: string) => void;
};

export function PhotoOrbitRing({ photos, radius = 126, onSelectPhoto }: PhotoOrbitRingProps) {
  const visiblePhotos = photos.slice(0, 8);

  return (
    <View style={styles.shell}>
      {visiblePhotos.map((photo, index) => (
        <PhotoOrbitNode
          count={visiblePhotos.length}
          index={index}
          key={photo.id}
          onPress={() => onSelectPhoto(photo.id)}
          photo={photo}
          radius={radius}
        />
      ))}
    </View>
  );
}

function PhotoOrbitNode({
  count,
  index,
  onPress,
  photo,
  radius,
}: {
  count: number;
  index: number;
  onPress: () => void;
  photo: RecentPhotoAsset;
  radius: number;
}) {
  const progress = useSharedValue(0);
  const bob = useSharedValue(0);
  const offset = getOrbitOffset(index, count, radius);

  useEffect(() => {
    progress.value = withSpring(1, {
      damping: 16,
      stiffness: 180,
      mass: 0.85,
    });
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800 + index * 80, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1800 + index * 80, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, [bob, index, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateX: offset.x * progress.value },
      { translateY: offset.y * progress.value - bob.value * 5 },
      { scale: 0.72 + progress.value * 0.28 },
      { rotateZ: `${(1 - progress.value) * -16}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.nodeWrap,
        {
          left: '50%',
          marginLeft: -36,
          marginTop: -42,
          top: '50%',
        },
        animatedStyle,
      ]}>
      <Pressable onPress={onPress} style={styles.pressable}>
        <View style={[styles.thumbFrame, { borderColor: photo.isScreenshot ? 'rgba(214, 223, 255, 0.28)' : 'rgba(255, 241, 228, 0.42)' }]}>
          <Image contentFit="cover" source={{ uri: photo.thumbnailUri || photo.uri }} style={styles.thumb} transition={120} />
        </View>
        {photo.isScreenshot ? (
          <ThemedText style={styles.caption} lightColor="#AEB8D5" darkColor="#AEB8D5">
            Screen
          </ThemedText>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    height: '100%',
    width: '100%',
  },
  nodeWrap: {
    position: 'absolute',
    width: 72,
  },
  pressable: {
    alignItems: 'center',
    gap: 6,
  },
  thumbFrame: {
    backgroundColor: 'rgba(9,13,24,0.84)',
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1,
    height: 72,
    overflow: 'hidden',
    width: 72,
  },
  thumb: {
    height: '100%',
    width: '100%',
  },
  caption: {
    fontSize: 10,
    lineHeight: 12,
  },
});
