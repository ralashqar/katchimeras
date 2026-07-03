import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { MeadowSheet } from '@/components/katchadeck/ui/meadow-sheet';
import { Lantern } from '@/constants/theme';
import type { StudioMediaType, StudioMoment, StudioRating } from '@/types/home';

// The Studio — your inspiration archive. Books, films, shows, games, music you took
// in, kept with how they landed. NOT a review tracker. A two-step add (what + how it
// landed) and a small reader, mirroring the Food Vault.

type StudioType = { mediaType: StudioMediaType; label: string; emoji: string };
const STUDIO_TYPES: StudioType[] = [
  { mediaType: 'book', label: 'A book', emoji: '📖' },
  { mediaType: 'film', label: 'A film', emoji: '🎬' },
  { mediaType: 'show', label: 'A show', emoji: '📺' },
  { mediaType: 'game', label: 'A game', emoji: '🎮' },
  { mediaType: 'music', label: 'Music', emoji: '🎵' },
  { mediaType: 'art', label: 'Art', emoji: '🎨' },
  { mediaType: 'other', label: 'Something', emoji: '✨' },
];

// The graded "how did it land" scale, most positive first. "Inspired" sits with
// "loved" — a thing can be cherished for moving you, not just for being enjoyed.
export const STUDIO_RATINGS: { id: StudioRating; emoji: string; label: string; tint: string }[] = [
  { id: 'loved', emoji: '❤️', label: 'Loved it', tint: '#F49AC1' },
  { id: 'inspired', emoji: '✨', label: 'Inspired me', tint: '#FFC36B' },
  { id: 'liked', emoji: '🙂', label: 'Liked it', tint: '#92D7FF' },
  { id: 'meh', emoji: '😕', label: 'Not so much', tint: '#9AA3B2' },
];
const RATING_LABEL: Record<StudioRating, string> = Object.fromEntries(
  STUDIO_RATINGS.map((rating) => [rating.id, rating.label])
) as Record<StudioRating, string>;
const RATING_TINT: Record<StudioRating, string> = Object.fromEntries(
  STUDIO_RATINGS.map((rating) => [rating.id, rating.tint])
) as Record<StudioRating, string>;
// Shown under an item when there's no note excerpt — where it came from.
const SOURCE_LABEL: Record<NonNullable<StudioMoment['source']>, string> = {
  manual: 'Saved',
  photo: 'From a photo',
  note: 'From a note',
};

// --- Add sheet: what was it → how did it land ---
export function StudioMomentSheet({
  onConfirm,
  onClose,
  suggested,
}: {
  onConfirm: (input: { label: string; mediaType: StudioMediaType; emoji: string; rating: StudioRating }) => void;
  onClose: () => void;
  // Pre-fill the "what" from on-device detection — user still gives how it landed.
  suggested?: { mediaType: StudioMediaType; label: string; emoji: string } | null;
}) {
  const [media, setMedia] = useState<StudioType | null>(
    suggested ? { mediaType: suggested.mediaType, label: suggested.label, emoji: suggested.emoji } : null
  );

  return (
    <MeadowSheet
      onClose={onClose}
      kicker="An inspiration"
      title={media ? `${media.emoji} ${media.label} · how did it land?` : 'What did you take in?'}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {!media ? (
          <Animated.View entering={FadeInDown.duration(220)} style={styles.section}>
            <View style={styles.grid}>
              {STUDIO_TYPES.map((option) => (
                <Pressable key={option.mediaType} onPress={() => setMedia(option)} style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}>
                  <ThemedText style={styles.chipEmoji}>{option.emoji}</ThemedText>
                  <ThemedText style={styles.chipLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                    {option.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.duration(220)} style={styles.section}>
            <View style={styles.grid}>
              {STUDIO_RATINGS.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => onConfirm({ label: media.label, mediaType: media.mediaType, emoji: media.emoji, rating: option.id })}
                  style={({ pressed }) => [styles.chip, { borderColor: `${option.tint}66` }, pressed && styles.chipPressed]}>
                  <ThemedText style={styles.chipEmoji}>{option.emoji}</ThemedText>
                  <ThemedText style={styles.chipLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                    {option.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            <Pressable accessibilityRole="button" onPress={() => setMedia(null)} style={styles.back}>
              <ThemedText style={styles.backLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                Back
              </ThemedText>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
    </MeadowSheet>
  );
}

// --- Reader: the day's inspirations ---
export function StudioVaultSheet({
  studioMoments,
  onAddStudio,
  onClose,
}: {
  studioMoments: StudioMoment[];
  onAddStudio?: () => void;
  onClose: () => void;
}) {
  return (
    <MeadowSheet
      onClose={onClose}
      kicker="The Studio"
      title={studioMoments.length > 0 ? 'Today’s inspirations' : 'Your inspirations'}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.body}>
          {onAddStudio ? (
            <Pressable accessibilityRole="button" onPress={onAddStudio} style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}>
              <ThemedText style={styles.addBtnEmoji}>📖</ThemedText>
              <ThemedText style={styles.addBtnLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                Keep an inspiration
              </ThemedText>
            </Pressable>
          ) : null}
          {studioMoments.length === 0 ? (
            <ThemedText style={styles.empty} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              Nothing here yet — keep a book, a film, a song that stayed with you.
            </ThemedText>
          ) : null}
          {studioMoments.map((moment) => (
            <View key={moment.id} style={styles.row}>
              {moment.thumbnailUri ? (
                <Image source={{ uri: moment.thumbnailUri }} style={styles.photo} contentFit="cover" transition={120} />
              ) : (
                <ThemedText style={styles.rowEmoji}>{moment.emoji}</ThemedText>
              )}
              <View style={styles.rowText}>
                <ThemedText style={styles.rowLabel} numberOfLines={1} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                  {moment.label}
                </ThemedText>
                {moment.detail || moment.source ? (
                  <ThemedText style={styles.rowDetail} numberOfLines={1} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                    {moment.detail ? `“${moment.detail}”` : SOURCE_LABEL[moment.source ?? 'manual']}
                  </ThemedText>
                ) : null}
              </View>
              <View style={[styles.ratingChip, { borderColor: `${RATING_TINT[moment.rating] ?? Lantern.moon300}66` }]}>
                <View style={[styles.ratingDot, { backgroundColor: RATING_TINT[moment.rating] ?? Lantern.moon300 }]} />
                <ThemedText style={styles.ratingLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                  {RATING_LABEL[moment.rating] ?? moment.rating}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </MeadowSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 8, paddingBottom: 4 },
  section: { gap: 10, paddingTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(12,10,20,0.7)',
  },
  chipPressed: { backgroundColor: 'rgba(40,34,60,0.9)' },
  chipEmoji: { fontSize: 16 },
  chipLabel: { fontSize: 13, fontWeight: '700' },
  back: { alignSelf: 'flex-start', paddingTop: 2 },
  backLabel: { fontSize: 12.5, fontWeight: '700' },
  body: { gap: 10, paddingTop: 6 },
  empty: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,195,107,0.45)',
    backgroundColor: 'rgba(255,195,107,0.12)',
    alignSelf: 'flex-start',
  },
  addBtnPressed: { backgroundColor: 'rgba(255,195,107,0.22)' },
  addBtnEmoji: { fontSize: 16 },
  addBtnLabel: { fontSize: 13.5, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  rowEmoji: { fontSize: 22, width: 28, textAlign: 'center' },
  photo: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)' },
  rowText: { flex: 1, gap: 1 },
  rowLabel: { fontSize: 14, fontWeight: '700' },
  rowDetail: { fontSize: 11.5, fontWeight: '600' },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(12,10,20,0.6)',
  },
  ratingDot: { width: 7, height: 7, borderRadius: 999 },
  ratingLabel: { fontSize: 12, fontWeight: '700' },
});
