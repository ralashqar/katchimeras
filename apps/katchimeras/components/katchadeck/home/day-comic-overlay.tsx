import { Image } from 'expo-image';
import type { RefObject } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';

export type DayComicGenerationState = {
  dayId: string;
  status: 'generating' | 'done' | 'error';
  imageUrl?: string;
  error?: string;
};

type DayComicOverlayProps = {
  comic: DayComicGenerationState | null;
  selectedDayId: string | null;
  comicShotRef: RefObject<View | null>;
  canRetry: boolean;
  onClose: () => void;
  onRetry: () => void;
  onShare: () => void;
};

export function DayComicOverlay({
  comic,
  selectedDayId,
  comicShotRef,
  canRetry,
  onClose,
  onRetry,
  onShare,
}: DayComicOverlayProps) {
  if (!comic) {
    return null;
  }

  if (comic.status !== 'done' && comic.dayId === selectedDayId) {
    return (
      <Animated.View entering={FadeIn.duration(220)} style={styles.comicOverlay}>
        {comic.status === 'generating' ? (
          <View style={styles.comicCenter}>
            <ActivityIndicator color={Lantern.ember300} size="large" />
            <ThemedText style={styles.comicStatus} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              Drawing your comic page...
            </ThemedText>
            <ThemedText style={styles.comicSubStatus} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              This takes up to a minute.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.comicCenter}>
            <ThemedText style={styles.comicStatus} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              Could not draw the comic
            </ThemedText>
            <ThemedText style={styles.comicSubStatus} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              {comic.error ?? 'Please try again.'}
            </ThemedText>
            <View style={styles.comicActions}>
              <KatchaButton label="Close" onPress={onClose} variant="secondary" />
              {canRetry ? <KatchaButton label="Try again" onPress={onRetry} variant="primary" /> : null}
            </View>
          </View>
        )}
      </Animated.View>
    );
  }

  if (comic.status === 'done' && comic.imageUrl) {
    return (
      <Animated.View entering={FadeIn.duration(260)} style={styles.comicOverlay}>
        <ScrollView
          style={styles.comicViewer}
          contentContainerStyle={styles.comicViewerScroll}
          showsVerticalScrollIndicator={false}>
          <View collapsable={false} ref={comicShotRef} style={styles.comicImage}>
            <Image contentFit="contain" source={comic.imageUrl} style={StyleSheet.absoluteFill} transition={160} />
          </View>
        </ScrollView>
        <View style={styles.comicActions}>
          <KatchaButton label="Close" onPress={onClose} style={styles.comicActionButton} variant="secondary" />
          <KatchaButton
            icon="sparkles"
            label="Share comic"
            onPress={onShare}
            style={styles.comicActionButton}
            variant="primary"
          />
        </View>
      </Animated.View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  comicOverlay: {
    backgroundColor: 'rgba(6, 5, 12, 0.96)',
    bottom: 0,
    left: 0,
    paddingBottom: 32,
    paddingHorizontal: 18,
    paddingTop: 64,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 60,
  },
  comicCenter: {
    alignItems: 'center',
    flex: 1,
    gap: 10,
    justifyContent: 'center',
  },
  comicStatus: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  comicSubStatus: {
    fontSize: 14,
    textAlign: 'center',
  },
  comicViewer: {
    flex: 1,
  },
  comicViewerScroll: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 16,
  },
  comicImage: {
    aspectRatio: 3 / 4,
    backgroundColor: '#0C0A14',
    borderRadius: 18,
    overflow: 'hidden',
    width: '100%',
  },
  comicActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginTop: 12,
  },
  comicActionButton: {
    flex: 1,
  },
});
