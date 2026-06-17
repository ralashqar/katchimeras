import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EssenceOverlay } from '@/components/katchadeck/capture/essence-overlay';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { Lantern } from '@/constants/theme';
import { useHomeScreenState } from '@/hooks/use-home-screen-state';
import { buildCaptureEnergy, CAPTURE_MEANINGS, type MeaningTag } from '@/utils/capture-energy';
import { queueCaptureFeed } from '@/utils/capture-feed-signal';
import { resolvePhotoCategory } from '@/utils/photo-category';
import { analyzePhoto } from '@/utils/photo-vision';
import { aggregatePhotoVision } from '@/utils/vision-signals';
import type { DayVisionSummary } from '@/types/home';

type CaptureState = 'permission' | 'live' | 'capturing' | 'preview' | 'saving';

export default function MomentCaptureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const { selectedDay, applyCapturedMoment } = useHomeScreenState();
  const dayScores = selectedDay?.kind === 'day' ? selectedDay.scores : null;

  const cameraRef = useRef<CameraView | null>(null);
  const [state, setState] = useState<CaptureState>('live');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const visionRef = useRef<DayVisionSummary | null>(null);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  // Analyse the still in the background as soon as it's captured, so the chosen
  // meaning + subject are ready the instant the user taps an option.
  useEffect(() => {
    if (!photoUri) return;
    let active = true;
    void (async () => {
      const result = await analyzePhoto(photoUri);
      if (active) {
        visionRef.current = result ? aggregatePhotoVision([result]) : null;
      }
    })();
    return () => {
      active = false;
    };
  }, [photoUri]);

  const handleCapture = useCallback(async () => {
    if (state !== 'live' || !cameraRef.current) return;
    setState('capturing');
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6, skipProcessing: true });
      setPhotoUri(photo?.uri ?? null);
    } catch {
      setPhotoUri(null);
    }
    // Let the particle collapse + flash play before revealing the meaning step.
    setTimeout(() => setState('preview'), 620);
  }, [state]);

  const handleMeaning = useCallback(
    (meaning: MeaningTag) => {
      if (!photoUri) {
        router.back();
        return;
      }
      setState('saving');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const vision = visionRef.current;
      const energy = buildCaptureEnergy(meaning, vision, dayScores ?? undefined);
      const category = vision
        ? resolvePhotoCategory(vision)
        : { icon: 'sparkles' as const, accent: '#F1D4B4' };

      applyCapturedMoment({ energy, vision });
      queueCaptureFeed({ photoUri, icon: category.icon, accent: category.accent });
      router.back();
    },
    [applyCapturedMoment, dayScores, photoUri, router]
  );

  // --- Permission gate ---
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

  return (
    <View style={styles.screen}>
      {state !== 'preview' && state !== 'saving' ? (
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      ) : photoUri ? (
        <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.darkFill]} />
      )}

      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.vignette]} />

      {state === 'live' || state === 'capturing' ? (
        <EssenceOverlay dayScores={dayScores} phase={state === 'capturing' ? 'capturing' : 'live'} />
      ) : null}

      {/* capture flash */}
      {state === 'capturing' ? (
        <Animated.View
          entering={FadeIn.duration(120)}
          exiting={FadeOut.duration(360)}
          pointerEvents="none"
          style={styles.flash}
        />
      ) : null}

      {/* close */}
      <Pressable onPress={() => router.back()} style={[styles.close, { top: insets.top + 12 }]} accessibilityRole="button">
        <IconSymbol name="xmark" size={18} color={Lantern.moon50} />
      </Pressable>

      {/* live prompt */}
      {state === 'live' ? (
        <Animated.View entering={FadeInDown.duration(320)} style={[styles.prompt, { top: insets.top + 18 }]}>
          <ThemedText style={styles.promptText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            What stands out?
          </ThemedText>
        </Animated.View>
      ) : null}

      {/* shutter */}
      {state === 'live' || state === 'capturing' ? (
        <View style={[styles.shutterRow, { bottom: insets.bottom + 36 }]}>
          <Pressable
            disabled={state !== 'live'}
            onPress={handleCapture}
            style={styles.shutter}
            accessibilityRole="button"
            accessibilityLabel="Capture moment">
            <View style={styles.shutterInner} />
          </Pressable>
        </View>
      ) : null}

      {/* captured → meaning */}
      {state === 'preview' || state === 'saving' ? (
        <Animated.View entering={FadeIn.duration(260)} style={[styles.captured, { paddingBottom: insets.bottom + 36 }]}>
          <ThemedText type="onboardingLabel" style={styles.essenceLabel} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
            Essence captured
          </ThemedText>
          <ThemedText type="display" style={styles.meaningTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            What stood out here?
          </ThemedText>
          {state === 'saving' ? (
            <ActivityIndicator color={Lantern.moon50} style={styles.savingSpinner} />
          ) : (
            <View style={styles.meaningGrid}>
              {CAPTURE_MEANINGS.map((option, index) => (
                <Animated.View key={option.id} entering={FadeInDown.delay(60 + index * 50).duration(280)}>
                  <Pressable onPress={() => handleMeaning(option.id)} style={styles.meaningChip} accessibilityRole="button">
                    <ThemedText style={styles.meaningEmoji}>{option.emoji}</ThemedText>
                    <ThemedText style={styles.meaningLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                      {option.label}
                    </ThemedText>
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          )}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#06040D',
    flex: 1,
  },
  darkFill: {
    backgroundColor: '#06040D',
  },
  vignette: {
    backgroundColor: 'rgba(6,4,13,0.18)',
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,243,224,0.85)',
  },
  permission: {
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 28,
  },
  permTitle: {
    fontSize: 30,
    fontStyle: 'italic',
    lineHeight: 36,
    textAlign: 'center',
  },
  permBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  permButtons: {
    alignSelf: 'stretch',
    gap: 10,
    marginTop: 8,
  },
  close: {
    alignItems: 'center',
    backgroundColor: 'rgba(8,6,16,0.5)',
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    position: 'absolute',
    right: 18,
    width: 38,
  },
  prompt: {
    alignItems: 'center',
    alignSelf: 'center',
    position: 'absolute',
  },
  promptText: {
    fontSize: 15,
    fontWeight: '700',
    opacity: 0.9,
  },
  shutterRow: {
    alignItems: 'center',
    alignSelf: 'center',
    position: 'absolute',
  },
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
  shutterInner: {
    backgroundColor: Lantern.moon50,
    borderRadius: 999,
    height: 60,
    width: 60,
  },
  captured: {
    alignItems: 'center',
    bottom: 0,
    gap: 8,
    left: 0,
    paddingHorizontal: 24,
    position: 'absolute',
    right: 0,
  },
  essenceLabel: {
    fontSize: 12,
  },
  meaningTitle: {
    fontSize: 26,
    fontStyle: 'italic',
    lineHeight: 31,
    marginBottom: 10,
    textAlign: 'center',
  },
  savingSpinner: {
    marginVertical: 24,
  },
  meaningGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  meaningChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(20,17,31,0.86)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  meaningEmoji: {
    fontSize: 17,
  },
  meaningLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
});
