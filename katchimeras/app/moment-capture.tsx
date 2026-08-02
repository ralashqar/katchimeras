import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
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
import { beginQuestCapture, cancelQuestCapture, completeQuestCapture } from '@/utils/quest-capture-session';
import { saveDevLastPhotoAnalysis } from '@/utils/dev-photo-analysis';
import { buildPhotoIntelligence } from '@/utils/intelligence/photo-intelligence';
import type { PhotoAnalysisInput, ReviewedPhotoAnalysis } from '@/utils/intelligence/photo-analysis';
import { evaluatePhotoForQuest } from '@/utils/quests/photo-evaluation';
import { safeDismissModal } from '@/utils/safe-navigation';
import { resolvePhotoPlace } from '@/utils/photo-place-resolution';
import type { PhotoPlaceResolution } from '@/types/photo-place';

// live → capturing (shutter + flash, no particles) → captured (the shared
// EssenceReview reads the photo, shows its essence, asks what it meant, then
// streams the tags into the day and exits).
type CaptureState = 'live' | 'capturing' | 'captured' | 'evaluating';

export default function MomentCaptureScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ target?: string; questId?: string; questCreatureId?: string; questRunId?: string }>();
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
  const placeResolutionRef = useRef<PhotoPlaceResolution | null>(null);
  const directQuestCaptureRef = useRef(false);
  const closingRef = useRef(false);
  const [state, setState] = useState<CaptureState>('live');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const questId = typeof params.questId === 'string' ? params.questId : null;
  const questCreatureId = typeof params.questCreatureId === 'string' ? params.questCreatureId : null;
  const questRunId = typeof params.questRunId === 'string' ? params.questRunId : null;

  useEffect(() => {
    if (questId && questCreatureId && questRunId) beginQuestCapture(questId, questCreatureId, questRunId);
  }, [questCreatureId, questId, questRunId]);

  const closeCapture = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    cancelQuestCapture(questId);
    safeDismissModal(router);
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
    let coordinate: { latitude: number; longitude: number } | undefined;
    let horizontalAccuracyMeters: number | undefined;
    try {
      const Location = await import('expo-location');
      const permission = await Location.getForegroundPermissionsAsync();
      if (permission.granted) {
        const position = await Location.getLastKnownPositionAsync({
          maxAge: 2 * 60 * 1000,
          requiredAccuracy: 100,
        });
        if (position) {
          coordinate = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          horizontalAccuracyMeters = position.coords.accuracy ?? undefined;
        }
      }
    } catch {
      coordinate = undefined;
    }
    placeResolutionRef.current = await resolvePhotoPlace({
      photoId: photoUri,
      coordinate,
      horizontalAccuracyMeters,
      capturedAt: new Date().toISOString(),
      ocrText: [
        ...(result?.recognizedText?.map((item) => item.text) ?? []),
        ...(result?.text ?? []),
      ],
      visualTags: (result?.labels ?? []).map((label) => ({
        label: label.name,
        confidence: label.confidence,
      })),
      imageSource: 'camera',
    });
    return {
      rawVision: rawVisionRef.current,
      summary: result
        ? aggregatePhotoVision([{ ...result, captureSource: 'camera' }], CAPTURE_PHOTO_CONFIDENCE_FLOOR)
        : null,
      placeResolution: placeResolutionRef.current,
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
          placeResolution: reviewed?.placeResolution ?? placeResolutionRef.current,
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
          journalClassification: reviewed?.journalClassification ?? null,
          journalEnrichment: reviewed?.journalEnrichment ?? null,
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
        completeQuestCapture(
          questId,
          questCreatureId,
          photoUri,
          evaluatePhotoForQuest(memory, questId, reviewed?.placeResolution ?? placeResolutionRef.current)
        );
      }
      closingRef.current = true;
      safeDismissModal(router);
    },
    [applyCapturedMoment, captureTarget, dayScores, photoUri, questCreatureId, questId, router]
  );

  // Quest camera captures only need the on-device photo intelligence. Persist
  // that evidence directly, evaluate it, and return to the quest without
  // routing through the generic photo journal / Essence Review flow.
  useEffect(() => {
    if (
      state !== 'captured'
      || !photoUri
      || !questId
      || !questCreatureId
      || directQuestCaptureRef.current
    ) return;
    directQuestCaptureRef.current = true;
    setState('evaluating');

    void (async () => {
      const observedAt = new Date().toISOString();
      let analysis: PhotoAnalysisInput = { rawVision: null, summary: null, placeResolution: null };
      try {
        analysis = await analyzeCaptured();
      } catch {
        // A failed Vision read still returns an explicit no-match result rather
        // than dropping the user back into the quest with no explanation.
      }
      const intelligence = buildPhotoIntelligence({
        sourceId: photoUri,
        observedAt,
        thumbnailUri: photoUri,
        rawVision: analysis.rawVision,
        vision: analysis.summary,
      });
      const placeResolution = analysis.placeResolution ?? placeResolutionRef.current;
      applyCapturedMoment(
        {
          captureMode: 'evidence_only',
          energy: {},
          vision: analysis.summary,
          sourceId: photoUri,
          classifiedMemory: intelligence.memory,
          evidence: intelligence.evidence,
          placeResolution,
        },
        captureTarget
      );
      saveDevLastPhotoAnalysis({
        sourceId: photoUri,
        thumbnailUri: photoUri,
        rawVision: analysis.rawVision,
        visionSummary: analysis.summary,
        scene: null,
        confirmations: [],
        journalClassification: null,
        journalEnrichment: null,
        questId,
        creatureId: questCreatureId,
      });
      completeQuestCapture(
        questId,
        questCreatureId,
        photoUri,
        evaluatePhotoForQuest(intelligence.memory, questId, placeResolution)
      );
      if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      closingRef.current = true;
      safeDismissModal(router);
    })();
  }, [analyzeCaptured, applyCapturedMoment, captureTarget, photoUri, questCreatureId, questId, router, state]);

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

  if ((state === 'captured' || state === 'evaluating') && photoUri && questId && questCreatureId) {
    return (
      <View style={styles.screen}>
        <Image contentFit="cover" source={{ uri: photoUri }} style={StyleSheet.absoluteFill} transition={80} />
        <View style={styles.questCheckScrim} />
        <Animated.View entering={FadeIn.duration(180)} style={styles.questCheckCard}>
          <View style={styles.questCheckIcon}>
            <ActivityIndicator color={Lantern.ember300} size="small" />
          </View>
          <ThemedText type="display" style={styles.questCheckTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            Checking your photo
          </ThemedText>
          <ThemedText style={styles.questCheckBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            Looking for the detail this quest needs…
          </ThemedText>
        </Animated.View>
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
  questCheckScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,12,8,0.56)' },
  questCheckCard: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(31,24,19,0.92)',
    borderColor: 'rgba(255,239,197,0.22)',
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    gap: 8,
    marginHorizontal: 28,
    marginTop: 'auto',
    marginBottom: 'auto',
    paddingHorizontal: 28,
    paddingVertical: 26,
  },
  questCheckIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,241,205,0.1)',
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    marginBottom: 4,
    width: 48,
  },
  questCheckTitle: { fontSize: 27, lineHeight: 31, textAlign: 'center' },
  questCheckBody: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
});
