import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import type { HomeDayRecord } from '@/types/home';
import { dayAlbums, dayMemories } from '@/utils/day-memories';

// The Memory Vault reader (docs/world-structures-cozy-direction.md §9.2) — the ONE
// place that owns the day's captured media: Featured cover · Photos · Voice · Notes.
// Other buildings (Crossroads/Journey/Study/Chronicle) reference this same store.
// Apple Photos + Notes + Voice Memos, merged.

export type MemoryVaultTab = 'featured' | 'photos' | 'voice' | 'notes' | 'albums';

function formatDuration(ms: number | null | undefined): string | null {
  if (!ms || ms <= 0) return null;
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function MemoryVaultSheet({
  day,
  initialTab = 'featured',
  onChangeFeatured,
  onClose,
}: {
  day: HomeDayRecord;
  initialTab?: MemoryVaultTab;
  onChangeFeatured?: () => void;
  onClose: () => void;
}) {
  const tabBarHeight = useBottomTabBarHeight();
  const memories = dayMemories(day);
  const albums = dayAlbums(day);
  const [tab, setTab] = useState<MemoryVaultTab>(initialTab);
  const featuredUri = day.featuredMemory?.thumbnailUri ?? null;

  const TABS: { id: MemoryVaultTab; label: string; count?: number }[] = [
    { id: 'featured', label: 'Featured' },
    { id: 'photos', label: 'Photos', count: memories.photos.length },
    { id: 'voice', label: 'Voice', count: memories.voice.length },
    { id: 'notes', label: 'Notes', count: memories.notes.length },
    { id: 'albums', label: 'Albums', count: albums.length },
  ];

  return (
    <View style={styles.overlay}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={styles.backdrop}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View entering={SlideInDown.duration(260)} exiting={SlideOutDown.duration(200)} style={[styles.sheet, { bottom: tabBarHeight + 10 }]}>
        <View style={styles.grabber} />
        <ThemedText style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
          Memory Vault
        </ThemedText>
        <ThemedText style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          {memories.total > 0 ? `${memories.total} ${memories.total === 1 ? 'memory' : 'memories'} kept` : 'A quiet vault, so far'}
        </ThemedText>

        <View style={styles.tabs}>
          {TABS.map((t) => (
            <Pressable key={t.id} onPress={() => setTab(t.id)} style={[styles.tab, tab === t.id && styles.tabActive]}>
              <ThemedText style={[styles.tabLabel, tab === t.id && styles.tabLabelActive]} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
                {t.label}
                {t.count !== undefined && t.count > 0 ? ` ${t.count}` : ''}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <Animated.View key={tab} entering={FadeInDown.duration(200)} style={styles.body}>
            {tab === 'featured' ? (
              featuredUri ? (
                <View style={styles.featuredWrap}>
                  <Image source={{ uri: featuredUri }} style={styles.featured} contentFit="cover" transition={140} />
                  {onChangeFeatured ? (
                    <Pressable onPress={onChangeFeatured} style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}>
                      <ThemedText style={styles.pillLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>Change cover</ThemedText>
                    </Pressable>
                  ) : null}
                </View>
              ) : (
                <View style={styles.featuredEmpty}>
                  <ThemedText style={styles.empty} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                    No cover yet — pick the photo that defines today.
                  </ThemedText>
                  {onChangeFeatured ? (
                    <Pressable onPress={onChangeFeatured} style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}>
                      <ThemedText style={styles.pillLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>Pick a cover</ThemedText>
                    </Pressable>
                  ) : null}
                </View>
              )
            ) : null}

            {tab === 'photos' ? (
              memories.photos.length === 0 ? (
                <ThemedText style={styles.empty} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>No photos yet.</ThemedText>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
                  {memories.photos.map((photo) => (
                    <Image key={photo.id} source={{ uri: photo.thumbnailUri }} style={styles.stripPhoto} contentFit="cover" transition={120} />
                  ))}
                </ScrollView>
              )
            ) : null}

            {tab === 'voice' ? (
              memories.voice.length === 0 ? (
                <ThemedText style={styles.empty} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>No voice memories yet.</ThemedText>
              ) : (
                memories.voice.map((note) => (
                  <View key={note.id} style={styles.row}>
                    <ThemedText style={styles.rowEmoji}>🎤</ThemedText>
                    <View style={styles.rowText}>
                      <ThemedText style={styles.rowLabel} numberOfLines={2} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                        {note.text || note.label}
                      </ThemedText>
                      {formatDuration(note.durationMs) ? (
                        <ThemedText style={styles.rowMeta} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>{formatDuration(note.durationMs)}</ThemedText>
                      ) : null}
                    </View>
                  </View>
                ))
              )
            ) : null}

            {tab === 'notes' ? (
              memories.notes.length === 0 ? (
                <ThemedText style={styles.empty} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>No notes yet.</ThemedText>
              ) : (
                memories.notes.map((note) => (
                  <View key={note.id} style={styles.row}>
                    <ThemedText style={styles.rowEmoji}>📝</ThemedText>
                    <ThemedText style={styles.rowLabel} numberOfLines={3} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                      {note.text || note.label}
                    </ThemedText>
                  </View>
                ))
              )
            ) : null}

            {tab === 'albums' ? (
              albums.length === 0 ? (
                <ThemedText style={styles.empty} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                  No place albums yet — photos group by where you took them.
                </ThemedText>
              ) : (
                albums.map((album) => (
                  <View key={album.id} style={styles.album}>
                    <ThemedText style={styles.albumName} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                      {album.name} · {album.photos.length}
                    </ThemedText>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
                      {album.photos.map((photo) => (
                        <Image key={photo.id} source={{ uri: photo.thumbnailUri }} style={styles.stripPhoto} contentFit="cover" transition={120} />
                      ))}
                    </ScrollView>
                  </View>
                ))
              )
            ) : null}
          </Animated.View>
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
    maxHeight: '78%',
    paddingBottom: 14,
    paddingHorizontal: 18,
    paddingTop: 12,
    position: 'absolute',
    right: 12,
  },
  grabber: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, height: 4, marginBottom: 6, width: 38 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 18, fontWeight: '800', lineHeight: 23, marginBottom: 10 },
  tabs: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  tab: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.05)' },
  tabActive: { backgroundColor: 'rgba(146,215,255,0.18)' },
  tabLabel: { fontSize: 12.5, fontWeight: '700' },
  tabLabelActive: { color: Lantern.moon50 },
  scroll: { paddingBottom: 6, paddingTop: 8 },
  body: { gap: 10 },
  featuredWrap: { gap: 10, alignItems: 'flex-start' },
  featured: { width: '100%', aspectRatio: 4 / 3, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)' },
  featuredEmpty: { gap: 10, paddingVertical: 8 },
  pill: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(146,215,255,0.5)', backgroundColor: 'rgba(146,215,255,0.14)' },
  pillPressed: { backgroundColor: 'rgba(146,215,255,0.24)' },
  pillLabel: { fontSize: 13.5, fontWeight: '800' },
  empty: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  gridPhoto: { width: '31%', aspectRatio: 1, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)' },
  // Fixed-size horizontal strip (robust — no %-width/aspectRatio zero-height issue).
  strip: { gap: GAP, paddingVertical: 2, paddingRight: 8 },
  stripPhoto: { width: 104, height: 104, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)' },
  album: { gap: 8 },
  albumName: { fontSize: 13.5, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  rowEmoji: { fontSize: 20, width: 26, textAlign: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { flex: 1, fontSize: 13.5, fontWeight: '600', lineHeight: 19 },
  rowMeta: { fontSize: 11.5, fontWeight: '700' },
});
