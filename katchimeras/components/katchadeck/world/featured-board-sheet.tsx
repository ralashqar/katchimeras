import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import type { HomeDayRecord } from '@/types/home';
import { dayMemories, type DayMemoryPhoto } from '@/utils/day-memories';

// The Featured Memory Board picker (docs/world-structures-cozy-direction.md §9.3) —
// choose the ONE photo that defines the day, shown billboard-style by the Memory
// Vault. Pulls from the unified media layer (dayMemories). Display-only cover.

export function FeaturedBoardSheet({
  day,
  onPick,
  onClose,
}: {
  day: HomeDayRecord;
  onPick: (photo: DayMemoryPhoto) => void;
  onClose: () => void;
}) {
  const tabBarHeight = useBottomTabBarHeight();
  const photos = dayMemories(day).photos;
  const featuredUri = day.featuredMemory?.thumbnailUri ?? null;

  return (
    <View style={styles.overlay}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={styles.backdrop}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View entering={SlideInDown.duration(260)} exiting={SlideOutDown.duration(200)} style={[styles.sheet, { bottom: tabBarHeight + 10 }]}>
        <View style={styles.grabber} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <ThemedText style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
            Featured memory
          </ThemedText>
          <ThemedText style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            Pick today’s cover
          </ThemedText>

          {photos.length === 0 ? (
            <ThemedText style={styles.empty} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              No photos to feature yet — capture a moment and it’ll appear here.
            </ThemedText>
          ) : (
            <View style={styles.grid}>
              {photos.map((photo) => {
                const isFeatured = featuredUri === photo.thumbnailUri;
                return (
                  <Pressable
                    key={photo.id}
                    onPress={() => onPick(photo)}
                    style={({ pressed }) => [styles.cell, isFeatured && styles.cellFeatured, pressed && styles.cellPressed]}>
                    <Image source={{ uri: photo.thumbnailUri }} style={styles.photo} contentFit="cover" transition={120} />
                    {isFeatured ? (
                      <View style={styles.badge}>
                        <ThemedText style={styles.badgeText}>★</ThemedText>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const GAP = 8;
const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, elevation: 24, zIndex: 50 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4, 7, 15, 0.42)' },
  sheet: {
    backgroundColor: '#161226',
    borderColor: 'rgba(255,255,255,0.12)',
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    boxShadow: '0 18px 48px rgba(0,0,0,0.55)',
    left: 12,
    maxHeight: '74%',
    paddingBottom: 14,
    paddingHorizontal: 18,
    paddingTop: 12,
    position: 'absolute',
    right: 12,
  },
  grabber: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, height: 4, marginBottom: 6, width: 38 },
  scroll: { gap: 10, paddingBottom: 4 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 18, fontWeight: '800', lineHeight: 23 },
  empty: { fontSize: 14, fontWeight: '600', lineHeight: 20, paddingTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingTop: 6 },
  cell: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cellFeatured: { borderColor: '#92D7FF' },
  cellPressed: { opacity: 0.8 },
  photo: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#92D7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: Lantern.ink950, fontSize: 13, fontWeight: '900', lineHeight: 15 },
});
