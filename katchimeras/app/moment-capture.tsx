import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EssenceReview } from '@/components/katchadeck/capture/essence-review';
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
import type { DayVisionSummary } from '@/types/home';

// live → capturing (shutter + flash, no particles) → captured (the shared
// EssenceReview reads the photo, shows its essence, asks what it meant, then
// streams the tags into the day and exits).
type CaptureState = 'live' | 'capturing' | 'captured';

export default function MomentCaptureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const { selectedDay, applyCapturedMoment, isTodayHatched } = useHomeScreenState();
  const dayScores = selectedDay?.kind === 'day' ? selectedDay.scores : null;
  // Once today has hatched, a capture feeds the forming tomorrow instead.
  const captureTarget = isTodayHatched ? 'tomorrow' : 'today';

  const cameraRef = useRef<CameraView | null>(null);
  const [state, setState] = useState<CaptureState>('live');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

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
        router.back();
      }
    } catch {
      router.back();
    }
  }, [state, router]);

  const analyzeCaptured = useCallback(async (): Promise<DayVisionSummary | null> => {
    if (!photoUri) {
      return null;
    }
    const result = await analyzePhoto(photoUri);
    return result ? aggregatePhotoVision([result], CAPTURE_PHOTO_CONFIDENCE_FLOOR) : null;
  }, [photoUri]);

  const commit = useCallback(
    (meaning: MeaningTag, vision: DayVisionSummary | null) => {
      const energy = buildCaptureEnergy(meaning, vision, dayScores ?? undefined);
      const category = vision ? resolvePhotoCategory(vision) : { icon: 'sparkles' as const, accent: '#F1D4B4' };
      applyCapturedMoment({ energy, vision }, captureTarget);
      if (photoUri) {
        queueCaptureFeed({ photoUri, icon: category.icon, accent: category.accent });
      }
      router.back();
    },
    [applyCapturedMoment, captureTarget, dayScores, photoUri, router]
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
          <KatchaButton label="Not now" onPress={() => router.back()} variant="secondary" />
        </View>
      </View>
    );
  }

  if (state === 'captured' && photoUri) {
    return (
      <View style={styles.screen}>
        <EssenceReview photoUri={photoUri} analyze={analyzeCaptured} onCommit={commit} onClose={() => router.back()} />
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

      <Pressable onPress={() => router.back()} style={[styles.close, { top: insets.top + 12 }]} accessibilityRole="button">
        <IconSymbol name="xmark" size={18} color={Lantern.moon50} />
      </Pressable>

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

const styles = StyleSheet.create({
  screen: { backgroundColor: '#06040D', flex: 1 },
  vignette: { backgroundColor: 'rgba(6,4,13,0.18)' },
  flash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,243,224,0.85)' },
  permission: { alignItems: 'center', gap: 16, paddingHorizontal: 28 },
  permTitle: { fontSize: 30, fontStyle: 'italic', lineHeight: 36, textAlign: 'center' },
  permBody: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  permButtons: { alignSelf: 'stretch', gap: 10, marginTop: 8 },
  close: {
    alignItems: 'center',
    backgroundColor: 'rgba(8,6,16,0.5)',
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    position: 'absolute',
    right: 18,
    width: 38,
    zIndex: 5,
  },
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
