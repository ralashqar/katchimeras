import { Image } from 'expo-image';
import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaSurfacePalette } from '@/constants/katcha-ui';
import { Meadow } from '@/constants/meadow-theme';
import type { DayPromptPhotoCandidate } from '@/utils/day-prompt-engine';

const PARCHMENT = KatchaSurfacePalette.parchment;

export type TodayPhotoLibrarySheetContent = {
  candidates: DayPromptPhotoCandidate[];
  placeName?: string;
  placeAddress?: string;
  startedAt?: string;
  endedAt?: string;
};

export function TodayPhotoLibrarySheet({
  content,
  onClose,
  onSelect,
}: {
  content: TodayPhotoLibrarySheetContent;
  onClose: () => void;
  onSelect: (photo: DayPromptPhotoCandidate, from: FeedSourceRect) => void;
}) {
  const placeTime = formatTimeRange(content.startedAt, content.endedAt);
  const clustered = Boolean(content.placeName);

  return (
    <KatchaSheet
      header={clustered
        ? {
            eyebrow: 'Place memory',
            title: content.placeName,
            subtitle: [content.placeAddress, placeTime].filter(Boolean).join(' · '),
          }
        : {
            eyebrow: 'Photo Library',
            title: content.candidates.length === 1 ? 'A photo from today' : 'Photos from today',
            subtitle: 'Choose one to turn into a journal memory.',
          }}
      maxHeight="58%"
      onRequestClose={onClose}
      portal
      size="compact"
      surface="parchment">
      <View style={styles.photoSection}>
        <View style={styles.sectionLabel}>
          <ThemedText style={styles.sectionTitle} lightColor={PARCHMENT.textTertiary} darkColor={PARCHMENT.textTertiary}>
            From Photo Library
          </ThemedText>
          <View style={styles.count}>
            <ThemedText style={styles.countText} lightColor={PARCHMENT.text} darkColor={PARCHMENT.text}>
              {content.candidates.length}
            </ThemedText>
          </View>
        </View>
        <ScrollView
          horizontal
          contentContainerStyle={styles.photoStrip}
          showsHorizontalScrollIndicator={false}>
          {content.candidates.map((photo, index) => (
            <PhotoChoice
              index={index}
              key={photo.assetId}
              onSelect={(from) => onSelect(photo, from)}
              photo={photo}
            />
          ))}
        </ScrollView>
      </View>
    </KatchaSheet>
  );
}

function PhotoChoice({
  photo,
  index,
  onSelect,
}: {
  photo: DayPromptPhotoCandidate;
  index: number;
  onSelect: (from: FeedSourceRect) => void;
}) {
  const ref = useRef<View | null>(null);
  const select = () => {
    ref.current?.measureInWindow((x, y, width, height) => onSelect({ x, y, w: width, h: height }));
  };

  return (
    <Pressable
      ref={ref}
      accessibilityLabel={`Journal Photo Library photo ${index + 1}`}
      accessibilityRole="button"
      onPress={select}
      style={({ pressed }) => [styles.photoButton, pressed && styles.pressed]}>
      <Image contentFit="cover" source={{ uri: photo.thumbnailUri }} style={styles.photo} transition={120} />
      <View style={styles.journalBadge}>
        <IconSymbol name="sparkles" size={11} color={Meadow.ink} />
        <ThemedText style={styles.journalBadgeText} lightColor={Meadow.ink} darkColor={Meadow.ink}>
          Journal
        </ThemedText>
      </View>
      <View style={styles.photoTime}>
        <ThemedText style={styles.photoTimeText} lightColor="#FFF9EE" darkColor="#FFF9EE">
          {formatTime(photo.capturedAt)}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function formatTime(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function formatTimeRange(start?: string, end?: string): string {
  const left = formatTime(start);
  const right = formatTime(end);
  if (!left) return right;
  if (!right || left === right) return left;
  return `${left} to ${right}`;
}

const styles = StyleSheet.create({
  photoSection: { gap: 8, paddingBottom: 2 },
  sectionLabel: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingTop: 2 },
  sectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 0.9, textTransform: 'uppercase' },
  count: {
    alignItems: 'center',
    backgroundColor: 'rgba(231,185,81,0.32)',
    borderRadius: 999,
    minWidth: 22,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  countText: { fontSize: 11, fontVariant: ['tabular-nums'], fontWeight: '900' },
  photoStrip: { gap: 9, paddingRight: 8 },
  photoButton: {
    borderColor: PARCHMENT.borderStrong,
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    height: 112,
    overflow: 'hidden',
    width: 112,
  },
  photo: { height: '100%', width: '100%' },
  journalBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(248,226,169,0.94)',
    borderColor: 'rgba(255,248,232,0.72)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    position: 'absolute',
    right: 7,
    top: 7,
  },
  journalBadgeText: { fontSize: 9.5, fontWeight: '900' },
  photoTime: {
    backgroundColor: 'rgba(27,18,12,0.70)',
    borderRadius: 999,
    bottom: 7,
    left: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
    position: 'absolute',
  },
  photoTimeText: { fontSize: 10.5, fontWeight: '800' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
});
