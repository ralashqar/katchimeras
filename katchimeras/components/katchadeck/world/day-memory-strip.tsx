import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import type { HomeDayRecord } from '@/types/home';
import { dayMemories } from '@/utils/day-memories';

// A small "View memories" reference strip (docs/world-structures-cozy-direction.md
// §9.1) — buildings REFERENCE the one memory store, never copy it. Drop into any
// reader (Chronicle/Crossroads/Journey/…) to surface the day's captures with a tap
// through to the full Memory Vault. Renders nothing when the day has no memories.

export function DayMemoryStrip({
  day,
  title = 'Memories',
  onViewAll,
}: {
  day: HomeDayRecord;
  title?: string;
  onViewAll?: () => void;
}) {
  const memories = dayMemories(day);
  if (memories.total === 0) return null;

  const voiceNotes = memories.voice.length + memories.notes.length;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <ThemedText style={styles.title} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
          {title}
        </ThemedText>
        {onViewAll ? (
          <Pressable onPress={onViewAll} hitSlop={8}>
            <ThemedText style={styles.viewAll} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
              View all →
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
      {memories.photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {memories.photos.slice(0, 10).map((photo) => (
            <Image key={photo.id} source={{ uri: photo.thumbnailUri }} style={styles.thumb} contentFit="cover" transition={120} />
          ))}
        </ScrollView>
      ) : null}
      {voiceNotes > 0 ? (
        <ThemedText style={styles.meta} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
          {memories.voice.length > 0 ? `${memories.voice.length} voice` : ''}
          {memories.voice.length > 0 && memories.notes.length > 0 ? ' · ' : ''}
          {memories.notes.length > 0 ? `${memories.notes.length} ${memories.notes.length === 1 ? 'note' : 'notes'}` : ''}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, paddingTop: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  viewAll: { fontSize: 12.5, fontWeight: '800' },
  row: { gap: 8, paddingRight: 8 },
  thumb: { width: 60, height: 60, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)' },
  meta: { fontSize: 12.5, fontWeight: '600' },
});
