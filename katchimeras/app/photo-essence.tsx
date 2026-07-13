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
import { confirmationsRejectDomain } from '@/utils/intelligence/classification-policy';
import type { SceneRead } from '@/utils/scene-classify';
import type { DayVisionSummary, ManualJournalSubmission, PhotoVisionResult, UserConfirmation } from '@/types/home';
import { saveDevLastPhotoAnalysis } from '@/utils/dev-photo-analysis';
import type { PhotoAnalysisInput, ReviewedPhotoAnalysis } from '@/utils/intelligence/photo-analysis';
import { safeGoBack } from '@/utils/safe-navigation';

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
  const rawVisionRef = useRef<PhotoVisionResult | null>(null);

  // Load the asset's decodable local file (camera-roll candidates only carry a
  // thumbnail), then read it on-device. Best-effort — null degrades gracefully.
  const analyze = useCallback(async (): Promise<PhotoAnalysisInput> => {
    if (!assetId) {
      return { rawVision: null, summary: null };
    }
    try {
      const MediaLibrary = await import('expo-media-library');
      const info = await MediaLibrary.getAssetInfoAsync(assetId);
      const assetInfo = info as {
        localUri?: string;
        uri?: string;
        mediaSubtypes?: string[];
        location?: { latitude?: number | null; longitude?: number | null } | null;
      };
      const localUri = assetInfo.localUri ?? assetInfo.uri ?? null;
      localUriRef.current = localUri;
      if (!localUri) {
        return { rawVision: null, summary: null };
      }
      const result = await analyzePhoto(localUri);
      const enrichedResult = result ? {
        ...result,
        captureSource: 'camera_roll' as const,
        isScreenshot: assetInfo.mediaSubtypes?.includes('screenshot') ?? false,
        hasLocation:
          Number.isFinite(Number(assetInfo.location?.latitude)) &&
          Number.isFinite(Number(assetInfo.location?.longitude)),
      } : null;
      rawVisionRef.current = enrichedResult;
      return {
        rawVision: enrichedResult,
        summary: enrichedResult ? aggregatePhotoVision([enrichedResult], CAPTURE_PHOTO_CONFIDENCE_FLOOR) : null,
      };
    } catch {
      return { rawVision: null, summary: null };
    }
  }, [assetId]);

  const commit = useCallback(
    // `scene` is the hierarchical read EssenceReview resolved (and showed).
    (meaning: MeaningTag, vision: DayVisionSummary | null, label: string, scene: SceneRead | null, confirmations: UserConfirmation[], reviewed: ReviewedPhotoAnalysis, journal: ManualJournalSubmission) => {
      const energy = buildCaptureEnergy(meaning, vision, dayScores ?? undefined, {
        rejectFood: confirmationsRejectDomain(confirmations, 'food'),
        rejectMedia: confirmationsRejectDomain(confirmations, 'media'),
        rejectAnimal: confirmationsRejectDomain(confirmations, 'animal'),
      });
      const resolvedCategory = vision ? resolvePhotoCategory(vision) : null;
      const categoryRejected =
        (resolvedCategory?.id === 'food' || resolvedCategory?.id === 'drink') && confirmationsRejectDomain(confirmations, 'food') ||
        resolvedCategory?.id === 'culture' && confirmationsRejectDomain(confirmations, 'media') ||
        resolvedCategory?.id === 'pet' && confirmationsRejectDomain(confirmations, 'animal');
      const category = resolvedCategory && !categoryRejected
        ? resolvedCategory
        : { icon: 'sparkles' as const, accent: '#F1D4B4' };
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
          sourceId: assetId,
          meaning: { archetype: meaning, label, thumbnailUri: thumbnailUri || localUriRef.current || null, sourceId: assetId },
          scene: scene ?? undefined,
          confirmations,
          classifiedMemory: reviewed?.memory ?? null,
        evidence: reviewed?.evidence ?? null,
        journal,
        },
        captureTarget
      );
      queueCaptureFeed({ photoUri: thumbnailUri || localUriRef.current || '', icon: category.icon, accent: category.accent });
      saveDevLastPhotoAnalysis({
        sourceId: assetId,
        thumbnailUri: thumbnailUri || localUriRef.current || '',
        rawVision: rawVisionRef.current,
        visionSummary: vision,
        scene,
        confirmations,
      });
      safeGoBack(router);
    },
    [assetId, thumbnailUri, params.capturedAt, captureTarget, dayScores, selectHeroPhoto, applyCapturedMoment, router]
  );

  return (
    <View style={styles.screen}>
      <EssenceReview
        photoUri={thumbnailUri || null}
        sourceId={assetId}
        observedAt={params.capturedAt ?? null}
        analyze={analyze}
        onCommit={commit}
        onClose={() => safeGoBack(router)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#06040D', flex: 1 },
});
