import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EssenceReview } from '@/components/katchadeck/capture/essence-review';
import { ScreenCloseButton } from '@/components/katchadeck/ui/screen-close-button';
import { KatchimeraBackButton } from '@/components/katchadeck/ui/katchimera-back-button';
import { ThemedText } from '@/components/themed-text';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { DayActionCardSurface, DayActionIcon } from '@/components/katchadeck/ui/day-action-card';
import { GameSurface } from '@/components/katchadeck/ui/game-surface';
import { Meadow } from '@/constants/meadow-theme';
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
import { cancelMossproutNatureCapture, finishMossproutNatureCapture } from '@/utils/mossprout-life-activity-storage';
import { beginQuestCapture, cancelQuestCapture, completeQuestCapture } from '@/utils/quest-capture-session';
import { saveDevLastPhotoAnalysis } from '@/utils/dev-photo-analysis';
import { buildPhotoIntelligence } from '@/utils/intelligence/photo-intelligence';
import type { PhotoAnalysisInput, ReviewedPhotoAnalysis } from '@/utils/intelligence/photo-analysis';
import { evaluatePhotoForQuest } from '@/utils/quests/photo-evaluation';
import { safeDismissModal, safeGoBack } from '@/utils/safe-navigation';
import { resolvePhotoPlace } from '@/utils/photo-place-resolution';
import type { PhotoPlaceResolution } from '@/types/photo-place';

// live → capturing (shutter + flash, no particles) → captured (the shared
// EssenceReview reads the photo, shows its essence, asks what it meant, then
// streams the tags into the day and exits).
type CaptureState = 'live' | 'capturing' | 'captured' | 'evaluating';

export default function MomentCaptureScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ target?: string; questId?: string; questCreatureId?: string; questRunId?: string; companionActivityId?: string; companionReturnTo?: string }>();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const { selectedDay, applyCapturedMoment, isTodayHatched, tomorrowDay } = useHomeScreenState({
    enableInteractiveServices: false,
    persistHydrationRepairs: false,
  });
  const requestedTarget = parseCaptureTarget(params.target);
  // Explicit route params win. Without one, preserve the old post-hatch default.
  const captureTarget: DayInputTarget = requestedTarget ?? (isTodayHatched ? 'tomorrow' : 'today');
  const targetDay = captureTarget === 'tomorrow' ? tomorrowDay : selectedDay?.kind === 'day' ? selectedDay : null;
  const dayScores = targetDay?.scores ?? null;

  const cameraRef = useRef<CameraView | null>(null);
  const rawVisionRef = useRef<PhotoVisionResult | null>(null);
  const placeResolutionRef = useRef<PhotoPlaceResolution | null>(null);
  const directQuestCaptureRef = useRef(false);
  const capturedAtRef = useRef(Date.now());
  const closingRef = useRef(false);
  const [state, setState] = useState<CaptureState>('live');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const companionActivityId = typeof params.companionActivityId === 'string' ? params.companionActivityId : null;
  const companionReturnTo = typeof params.companionReturnTo === 'string' ? params.companionReturnTo : '/katchimeras';
  const returnFromCamera = useCallback(() => {
    if (companionActivityId) {
      const origin = companionReturnTo === '/katchimeras' || companionReturnTo.startsWith('/katchimera/') ? companionReturnTo : '/katchimeras';
      safeGoBack(router, origin as Href);
    } else safeDismissModal(router);
  }, [companionActivityId, companionReturnTo, router]);
  const questId = typeof params.questId === 'string' ? params.questId : null;
  const questCreatureId = typeof params.questCreatureId === 'string' ? params.questCreatureId : null;
  const questRunId = typeof params.questRunId === 'string' ? params.questRunId : null;

  useEffect(() => {
    if (questId && questCreatureId && questRunId) beginQuestCapture(questId, questCreatureId, questRunId);
  }, [questCreatureId, questId, questRunId]);

  useEffect(() => { closingRef.current = false; return () => { closingRef.current = true; }; }, []);

  const closeCapture = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (companionActivityId) {
      try { cancelMossproutNatureCapture(companionActivityId); }
      catch { /* The companion destination retries clearing the session on focus. */ }
    } else cancelQuestCapture(questId);
    returnFromCamera();
  }, [companionActivityId, questId, returnFromCamera]);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  const handleCapture = useCallback(async () => {
    if (state !== 'live' || !cameraRef.current) {
      return;
    }
    capturedAtRef.current = Date.now();
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
      returnFromCamera();
    },
    [applyCapturedMoment, captureTarget, dayScores, photoUri, questCreatureId, questId, returnFromCamera]
  );

  // Companion captures return classified evidence to the existing narrative
  // destination. Saving the memory/reward waits for the player's final answer.
  useEffect(() => {
    if (!companionActivityId || state !== 'captured' || !photoUri || directQuestCaptureRef.current) return;
    directQuestCaptureRef.current = true;
    setState('evaluating');
    void (async () => {
      try {
        let analysis: PhotoAnalysisInput = { rawVision: null, summary: null };
        try { analysis = await analyzeCaptured(); } catch { /* Ask the player when Vision is unavailable. */ }
        const { prepareMossproutNaturePhoto } = await import('@/utils/mossprout-nature-capture');
        if (closingRef.current) return;
        const photo = prepareMossproutNaturePhoto(companionActivityId, photoUri, capturedAtRef.current, analysis);
        finishMossproutNatureCapture(companionActivityId, photo);
      } catch {
        if (closingRef.current) return;
        try { finishMossproutNatureCapture(companionActivityId, undefined, 'Your photo could not be saved. Shall we take it again?'); }
        catch { setCaptureError('Your photo could not be saved yet. Please try again.'); return; }
      }
      closingRef.current = true;
      returnFromCamera();
    })();
  }, [analyzeCaptured, companionActivityId, photoUri, returnFromCamera, state]);

  // Quest camera captures only need the on-device photo intelligence. Persist
  // that evidence directly, evaluate it, and return to the quest without
  // routing through the generic photo journal / Essence Review flow.
  useEffect(() => {
    if (
      companionActivityId
      || state !== 'captured'
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
      returnFromCamera();
    })();
  }, [analyzeCaptured, applyCapturedMoment, captureTarget, companionActivityId, photoUri, questCreatureId, questId, returnFromCamera, state]);

  if (!permission || !permission.granted) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={[styles.centeredContent, { paddingTop: insets.top + 68, paddingBottom: insets.bottom + 24, paddingLeft: Math.max(24, insets.left), paddingRight: Math.max(24, insets.right) }]}>
          <GameSurface tone="cream" contentStyle={styles.cameraPanel}>
            <DayActionIcon icon="camera.fill" />
            <ThemedText style={styles.panelTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>
              {companionActivityId ? 'Something growing, just for Mossprout' : 'Capture a little moment'}
            </ThemedText>
            <ThemedText style={styles.panelBody} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
              {companionActivityId ? 'Show Mossprout a plant, tree, or flower near you. A windowsill plant counts.' : 'Use your camera to keep a moment from your day.'}
            </ThemedText>
            {!permission ? <ActivityIndicator color={Meadow.leafDeep} /> : permission.canAskAgain ?
              <KatchaButton label="Enable camera" onPress={() => void requestPermission()} /> :
              <ThemedText style={styles.panelBody} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>You can allow camera access in your device settings.</ThemedText>}
            <KatchaButton label="Not now" onPress={closeCapture} variant="secondary" />
          </GameSurface>
        </ScrollView>
        <ScreenCloseButton variant="back" onPress={closeCapture} />
      </View>
    );
  }

  if ((state === 'captured' || state === 'evaluating') && photoUri && ((questId && questCreatureId) || companionActivityId)) {
    return (
      <View style={styles.screen}>
        <Image contentFit="cover" source={{ uri: photoUri }} style={StyleSheet.absoluteFill} transition={80} />
        <View style={styles.questCheckScrim} />
        <ScrollView contentContainerStyle={[styles.centeredContent, { paddingTop: insets.top + 68, paddingBottom: insets.bottom + 24, paddingLeft: Math.max(24, insets.left), paddingRight: Math.max(24, insets.right) }]}>
          <GameSurface tone="cream" contentStyle={styles.cameraPanel}>
            <DayActionIcon icon={companionActivityId ? 'leaf.fill' : 'camera.fill'} />
            <ThemedText style={styles.panelTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>
              {captureError ? 'Let’s try again' : 'A closer look'}
            </ThemedText>
            <ThemedText style={styles.panelBody} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
              {captureError ?? (companionActivityId ? 'Looking for something growing…' : 'Looking for the detail this quest needs…')}
            </ThemedText>
            {captureError ? <KatchaButton label="Try again" onPress={() => { setCaptureError(null); directQuestCaptureRef.current = false; setState('captured'); }} /> : <ActivityIndicator color={Meadow.leafDeep} />}
          </GameSurface>
        </ScrollView>
        <ScreenCloseButton variant="back" onPress={closeCapture} />
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

      <View pointerEvents="box-none"
        style={[styles.cameraHeader, { top: insets.top + 10, left: Math.max(16, insets.left), right: Math.max(16, insets.right) }]}>
        <KatchimeraBackButton accessibilityLabel="Go back" onPress={closeCapture} style={styles.headerBack} />
        {state === 'live' ? (
          <Animated.View entering={FadeInDown.duration(240)} pointerEvents="none" style={styles.prompt}>
            <DayActionCardSurface artwork={<DayActionIcon icon={companionActivityId ? 'leaf.fill' : 'camera.fill'} />}
              title={companionActivityId ? 'Show Mossprout something growing' : 'What stands out?'}
              titleNumberOfLines={3}
              subtitle={companionActivityId ? 'A plant, tree, or flower. A windowsill plant counts.' : 'Capture a little moment from your day.'}
              trailing={<View />} />
          </Animated.View>
        ) : null}
      </View>

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
  centeredContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
  cameraPanel: { gap: 14, alignItems: 'stretch', padding: 20 },
  panelTitle: { fontSize: 20, lineHeight: 25, fontWeight: '900' },
  panelBody: { fontSize: 14, lineHeight: 21, fontWeight: '600' },
  cameraHeader: { position: 'absolute', flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  headerBack: { flexShrink: 0 },
  prompt: { flex: 1, minWidth: 0 },
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
});
