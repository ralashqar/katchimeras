import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EssenceReview } from '@/components/katchadeck/capture/essence-review';
import { ScreenCloseButton } from '@/components/katchadeck/ui/screen-close-button';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { Lantern } from '@/constants/theme';
import { useHomeScreenState } from '@/hooks/use-home-screen-state';
import { buildCaptureEnergy, type MeaningTag } from '@/utils/capture-energy';
import { queueCaptureFeed } from '@/utils/capture-feed-signal';
import { resolvePhotoCategory } from '@/utils/photo-category';
import { analyzePhoto } from '@/utils/photo-vision';
import { aggregatePhotoVision, CAPTURE_PHOTO_CONFIDENCE_FLOOR } from '@/utils/vision-signals';
import { confirmationsRejectDomain } from '@/utils/intelligence/classification-policy';
import type { SceneRead } from '@/utils/scene-classify';
import type { DayInputTarget, DayVisionSummary, ManualJournalSubmission, PhotoVisionResult, UserConfirmation } from '@/types/home';
import { cancelQuestCapture, completeQuestCapture } from '@/utils/quest-capture-session';
import { saveDevLastPhotoAnalysis } from '@/utils/dev-photo-analysis';
import { buildPhotoIntelligence } from '@/utils/intelligence/photo-intelligence';
import type { PhotoAnalysisInput, ReviewedPhotoAnalysis } from '@/utils/intelligence/photo-analysis';
import { evaluatePhotoForQuest } from '@/utils/quests/photo-evaluation';
import { safeGoBack } from '@/utils/safe-navigation';

// live → capturing (shutter + flash, no particles) → captured (the shared
// EssenceReview reads the photo, shows its essence, asks what it meant, then
// streams the tags into the day and exits).
type CaptureState = 'live' | 'capturing' | 'captured';

export default function MomentCaptureScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ target?: string; questId?: string; questCreatureId?: string }>();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const { selectedDay, applyCapturedMoment, isTodayHatched, tomorrowDay } = useHomeScreenState();
  const requestedTarget = parseCaptureTarget(params.target);
  // Explicit route params win. Without one, preserve the old post-hatch default.
  const captureTarget: DayInputTarget = requestedTarget ?? (isTodayHatched ? 'tomorrow' : 'today');
  const targetDay = captureTarget === 'tomorrow' ? tomorrowDay : selectedDay?.kind === 'day' ? selectedDay : null;
  const dayScores = targetDay?.scores ?? null;

  const cameraRef = useRef<CameraView | null>(null);
  const rawVisionRef = useRef<PhotoVisionResult | null>(null);
  const [state, setState] = useState<CaptureState>('live');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const questId = typeof params.questId === 'string' ? params.questId : null;
  const questCreatureId = typeof params.questCreatureId === 'string' ? params.questCreatureId : null;

  const closeCapture = useCallback(() => {
    cancelQuestCapture(questId);
    safeGoBack(router);
  }, [questId, router]);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  const handleCapture = useCallback(async () => {
    if (state !== 'live' || !cameraRef.current) {
      return;
    }
    setState('capturing');
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6, skipProcessing: true });
      if (photo?.uri) {
        setPhotoUri(photo.uri);
        setState('captured');
      } else {
        closeCapture();
      }
    } catch {
      closeCapture();
    }
  }, [closeCapture, state]);

  const analyzeCaptured = useCallback(async (): Promise<PhotoAnalysisInput> => {
    if (!photoUri) {
      return { rawVision: null, summary: null };
    }
    const result = await analyzePhoto(photoUri);
    rawVisionRef.current = result ? { ...result, captureSource: 'camera' } : null;
    return {
      rawVision: rawVisionRef.current,
      summary: result
        ? aggregatePhotoVision([{ ...result, captureSource: 'camera' }], CAPTURE_PHOTO_CONFIDENCE_FLOOR)
        : null,
    };
  }, [photoUri]);

  const commit = useCallback(
    // `scene` is the hierarchical read EssenceReview resolved (and showed) —
    // the same classification the engine acts on.
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
      applyCapturedMoment(
        {
          energy,
          vision,
          sourceId: photoUri,
          meaning: { archetype: meaning, label, thumbnailUri: photoUri ?? null, sourceId: photoUri },
          scene: scene ?? undefined,
          confirmations,
          classifiedMemory: reviewed?.memory ?? null,
          evidence: reviewed?.evidence ?? null,
          journal,
        },
        captureTarget
      );
      if (photoUri) {
        queueCaptureFeed({ photoUri, icon: category.icon, accent: category.accent });
        saveDevLastPhotoAnalysis({
          sourceId: photoUri,
          thumbnailUri: photoUri,
          rawVision: rawVisionRef.current,
          visionSummary: vision,
          scene,
          confirmations,
          questId,
          creatureId: questCreatureId,
        });
      }
      if (questId && questCreatureId && photoUri) {
        const memory = reviewed?.memory ?? buildPhotoIntelligence({
          sourceId: photoUri,
          observedAt: new Date().toISOString(),
          thumbnailUri: photoUri,
          rawVision: rawVisionRef.current,
          vision,
          scene,
          confirmations,
        }).memory;
        completeQuestCapture(questId, questCreatureId, photoUri, evaluatePhotoForQuest(memory, questId));
      }
      safeGoBack(router);
    },
    [applyCapturedMoment, captureTarget, dayScores, photoUri, questCreatureId, questId, router]
  );

  if (permission && !permission.granted) {
    return (
      <View style={[styles.screen, styles.permission, { paddingTop: insets.top + 40 }]}>
        <IconSymbol name="camera.fill" size={40} color={Lantern.ember300} />
        <ThemedText type="display" style={styles.permTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          Capture moments as they happen
        </ThemedText>
        <ThemedText style={styles.permBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
          Katchimeras uses your camera to turn a real moment into today&apos;s egg. Photos are read on your device.
        </ThemedText>
        <View style={styles.permButtons}>
          {permission.canAskAgain ? (
            <KatchaButton label="Enable camera" onPress={() => void requestPermission()} variant="primary" />
          ) : null}
          <KatchaButton label="Not now" onPress={closeCapture} variant="secondary" />
        </View>
      </View>
    );
  }

  if (state === 'captured' && photoUri) {
    return (
      <View style={styles.screen}>
        <EssenceReview
          photoUri={photoUri}
          sourceId={photoUri}
          questId={questId}
          analyze={analyzeCaptured}
          onCommit={commit}
          onClose={closeCapture}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.vignette]} />

      {state === 'capturing' ? (
        <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(360)} pointerEvents="none" style={styles.flash} />
      ) : null}

      <ScreenCloseButton onPress={closeCapture} />

      {state === 'live' ? (
        <Animated.View entering={FadeInDown.duration(320)} style={[styles.prompt, { top: insets.top + 18 }]}>
          <ThemedText style={styles.promptText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            What stands out?
          </ThemedText>
        </Animated.View>
      ) : null}

      {state === 'live' ? (
        <View style={[styles.shutterRow, { bottom: insets.bottom + 36 }]}>
          <Pressable onPress={handleCapture} style={styles.shutter} accessibilityRole="button" accessibilityLabel="Capture moment">
            <View style={styles.shutterInner} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function parseCaptureTarget(value: string | string[] | undefined): DayInputTarget | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'tomorrow' || raw === 'today' ? raw : null;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#06040D', flex: 1 },
  vignette: { backgroundColor: 'rgba(6,4,13,0.18)' },
  flash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,243,224,0.85)' },
  permission: { alignItems: 'center', gap: 16, paddingHorizontal: 28 },
  permTitle: { fontSize: 30, fontStyle: 'italic', lineHeight: 36, textAlign: 'center' },
  permBody: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  permButtons: { alignSelf: 'stretch', gap: 10, marginTop: 8 },
  prompt: { alignItems: 'center', alignSelf: 'center', position: 'absolute' },
  promptText: { fontSize: 15, fontWeight: '700', opacity: 0.9 },
  shutterRow: { alignItems: 'center', alignSelf: 'center', position: 'absolute' },
  shutter: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: 999,
    borderWidth: 3,
    height: 78,
    justifyContent: 'center',
    width: 78,
  },
  shutterInner: { backgroundColor: Lantern.moon50, borderRadius: 999, height: 60, width: 60 },
});
