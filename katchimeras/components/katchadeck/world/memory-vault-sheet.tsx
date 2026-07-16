import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { SegmentedControl } from '@/components/katchadeck/ui/segmented-control';
import { KatchaSurfacePalette } from '@/constants/katcha-ui';
import { Lantern } from '@/constants/theme';
import type { HomeDayRecord } from '@/types/home';
import { dayAlbums, dayMemories } from '@/utils/day-memories';

// The Memory Vault reader (docs/world-structures-cozy-direction.md §9.2) — the ONE
// place that owns the day's captured media: Featured cover · Photos · Voice · Notes.
// Other buildings (Crossroads/Journey/Study/Chronicle) reference this same store.
// Apple Photos + Notes + Voice Memos, merged.

export type MemoryVaultTab = 'featured' | 'photos' | 'voice' | 'notes' | 'albums';
const NIGHT = KatchaSurfacePalette.night;

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
  onAddPhoto,
  onRecordVoice,
  onAddNote,
  onClose,
}: {
  day: HomeDayRecord;
  initialTab?: MemoryVaultTab;
  onChangeFeatured?: () => void;
  onAddPhoto?: () => void;
  onRecordVoice?: () => void;
  onAddNote?: () => void;
  onClose: () => void;
}) {
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
    <KatchaSheet
      header={{
        eyebrow: 'Memory Vault',
        title: memories.total > 0 ? `${memories.total} ${memories.total === 1 ? 'memory' : 'memories'} kept` : 'A quiet vault, so far',
        subtitle: 'Photos, notes and voices from this day.',
      }}
      onRequestClose={onClose}
      scroll
      scrollContentStyle={styles.scroll}
      size="tall"
      surface="night">
      <SegmentedControl
        options={TABS.map((item) => ({ value: item.id, label: `${item.label}${item.count ? ` ${item.count}` : ''}` }))}
        onChange={setTab}
        style={styles.tabs}
        value={tab}
        variant="bar"
      />
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
              <View style={styles.emptyActionCard}>
                <ThemedText style={styles.empty} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                  No photos yet.
                </ThemedText>
                {onAddPhoto ? (
                  <Pressable onPress={onAddPhoto} style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}>
                    <ThemedText style={styles.pillLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>Add photo</ThemedText>
                  </Pressable>
                ) : null}
              </View>
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
              <View style={styles.emptyActionCard}>
                <ThemedText style={styles.empty} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>No voice memories yet.</ThemedText>
                {onRecordVoice ? (
                  <Pressable onPress={onRecordVoice} style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}>
                    <ThemedText style={styles.pillLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>Record voice</ThemedText>
                  </Pressable>
                ) : null}
              </View>
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
              <View style={styles.emptyActionCard}>
                <ThemedText style={styles.empty} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>No notes yet.</ThemedText>
                {onAddNote ? (
                  <Pressable onPress={onAddNote} style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}>
                    <ThemedText style={styles.pillLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>Add note</ThemedText>
                  </Pressable>
                ) : null}
              </View>
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
    </KatchaSheet>
  );
}

const GAP = 8;
const styles = StyleSheet.create({
  tabs: { marginBottom: 4 },
  scroll: { paddingBottom: 8 },
  body: { gap: 10 },
  emptyActionCard: { alignItems: 'flex-start', gap: 10, paddingVertical: 4 },
  featuredWrap: { gap: 10, alignItems: 'flex-start' },
  featured: { width: '100%', aspectRatio: 4 / 3, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)' },
  featuredEmpty: { gap: 10, paddingVertical: 8 },
  pill: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: NIGHT.borderStrong, backgroundColor: NIGHT.subtle, boxShadow: NIGHT.cardShadow },
  pillPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
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
    backgroundColor: NIGHT.subtle,
    borderColor: NIGHT.border,
    borderWidth: 1,
    boxShadow: '0 5px 14px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.045)',
  },
  rowEmoji: { fontSize: 20, width: 26, textAlign: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { flex: 1, fontSize: 13.5, fontWeight: '600', lineHeight: 19 },
  rowMeta: { fontSize: 11.5, fontWeight: '700' },
});
