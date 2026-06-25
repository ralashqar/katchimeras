import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { EssenceReview } from '@/components/katchadeck/capture/essence-review';
import { useHomeScreenState } from '@/hooks/use-home-screen-state';
import { buildCaptureEnergy, type MeaningTag } from '@/utils/capture-energy';
import { queueCaptureFeed } from '@/utils/capture-feed-signal';
import { resolvePhotoCategory } from '@/utils/photo-category';
import { analyzePhoto } from '@/utils/photo-vision';
import { aggregatePhotoVision, CAPTURE_PHOTO_CONFIDENCE_FLOOR } from '@/utils/vision-signals';
import { resolveSceneRead, type SceneRead } from '@/utils/scene-classify';
import type { DayVisionSummary } from '@/types/home';

// "This photo meant something" → opens the chosen photo full, reads its essence
// on-device, asks what it meant (essence-based options), then feeds the day with
// the photo's vision + the meaning's energy and marks it the day's hero photo.
// Reuses the exact EssenceReview experience the camera capture uses.
export default function PhotoEssenceRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    assetId?: string;
    thumbnailUri?: string;
    capturedAt?: string;
    target?: string;
  }>();
  const assetId = params.assetId ?? '';
  const thumbnailUri = params.thumbnailUri ?? '';
  const captureTarget = params.target === 'tomorrow' ? 'tomorrow' : 'today';

  const { selectedDay, applyCapturedMoment, selectHeroPhoto } = useHomeScreenState();
  const dayScores = selectedDay?.kind === 'day' ? selectedDay.scores : null;
  const localUriRef = useRef<string | null>(null);
  // On-device LLM scene read, resolved in the background; read at commit.
  const sceneRef = useRef<SceneRead | null>(null);

  // Load the asset's decodable local file (camera-roll candidates only carry a
  // thumbnail), then read it on-device. Best-effort — null degrades gracefully.
  const analyze = useCallback(async (): Promise<DayVisionSummary | null> => {
    if (!assetId) {
      return null;
    }
    try {
      const MediaLibrary = await import('expo-media-library');
      const info = await MediaLibrary.getAssetInfoAsync(assetId);
      const localUri = (info as { localUri?: string; uri?: string }).localUri ?? (info as { uri?: string }).uri ?? null;
      localUriRef.current = localUri;
      if (!localUri) {
        return null;
      }
      const result = await analyzePhoto(localUri);
      const vision = result ? aggregatePhotoVision([result], CAPTURE_PHOTO_CONFIDENCE_FLOOR) : null;
      sceneRef.current = null;
      if (vision) {
        void resolveSceneRead(vision)
          .then((scene) => {
            sceneRef.current = scene;
          })
          .catch(() => {});
      }
      return vision;
    } catch {
      return null;
    }
  }, [assetId]);

  const commit = useCallback(
    (meaning: MeaningTag, vision: DayVisionSummary | null, label: string) => {
      const energy = buildCaptureEnergy(meaning, vision, dayScores ?? undefined);
      const category = vision ? resolvePhotoCategory(vision) : { icon: 'sparkles' as const, accent: '#F1D4B4' };
      if (assetId) {
        // Marks it the day's hero photo (and answers the meaningful-photo prompt
        // so it doesn't re-surface).
        selectHeroPhoto(
          {
            assetId,
            thumbnailUri,
            localUri: localUriRef.current ?? undefined,
            capturedAt: params.capturedAt ?? new Date().toISOString(),
          },
          captureTarget
        );
      }
      applyCapturedMoment(
        {
          energy,
          vision,
          meaning: { archetype: meaning, label, thumbnailUri: thumbnailUri || localUriRef.current || null },
          scene: sceneRef.current ?? undefined,
        },
        captureTarget
      );
      queueCaptureFeed({ photoUri: thumbnailUri || localUriRef.current || '', icon: category.icon, accent: category.accent });
      router.back();
    },
    [assetId, thumbnailUri, params.capturedAt, captureTarget, dayScores, selectHeroPhoto, applyCapturedMoment, router]
  );

  return (
    <View style={styles.screen}>
      <EssenceReview photoUri={thumbnailUri || null} analyze={analyze} onCommit={commit} onClose={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#06040D', flex: 1 },
});
