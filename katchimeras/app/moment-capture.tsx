import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { Lantern } from '@/constants/theme';
import { useHomeScreenState } from '@/hooks/use-home-screen-state';
import { buildCaptureEnergy, CAPTURE_MEANINGS, type MeaningTag } from '@/utils/capture-energy';
import { queueCaptureFeed } from '@/utils/capture-feed-signal';
import { resolvePhotoCategory } from '@/utils/photo-category';
import { analyzePhoto } from '@/utils/photo-vision';
import { aggregatePhotoVision, pickProminentTags } from '@/utils/vision-signals';
import type { DayVisionSummary } from '@/types/home';

// live → capturing (shutter + flash, no particles) → analyzing (vision pass) →
// essence (tags animate in, pick what it meant) → absorbing (tags stream down
// like particles into the day, then exit home).
type CaptureState = 'live' | 'capturing' | 'analyzing' | 'essence' | 'absorbing';

type EssenceTag = { id: string; label: string; accent: string };

const TAG_PALETTE = ['#FFC36B', '#92D7FF', '#9DDCB8', '#D5B8FF', '#F2C2A8'];

// The "essence" of the photo = what the on-device vision read in it, surfaced as
// tags the user can see being captured into the day.
function buildEssenceTags(vision: DayVisionSummary | null): EssenceTag[] {
  const tags: EssenceTag[] = [];
  if (vision && vision.maxFaceCount >= 2) {
    tags.push({ id: 'together', label: 'Together', accent: '#F2C2A8' });
  }
  const names = vision ? pickProminentTags(vision, 4) : [];
  names.forEach((name) => {
    tags.push({ id: name, label: humanizeTag(name), accent: TAG_PALETTE[tags.length % TAG_PALETTE.length] });
  });
  if (tags.length === 0) {
    tags.push({ id: 'moment', label: 'A still moment', accent: '#C6D2F2' });
  }
  return tags.slice(0, 5);
}

function humanizeTag(value: string): string {
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function clampW(value: number, lo: number, hi: number) {
  'worklet';
  return Math.min(Math.max(value, lo), hi);
}

export default function MomentCaptureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const { selectedDay, applyCapturedMoment, isTodayHatched } = useHomeScreenState();
  const dayScores = selectedDay?.kind === 'day' ? selectedDay.scores : null;
  // Once today has hatched, a capture feeds the forming tomorrow instead.
  const captureTarget = isTodayHatched ? 'tomorrow' : 'today';

  const cameraRef = useRef<CameraView | null>(null);
  const [state, setState] = useState<CaptureState>('live');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [tags, setTags] = useState<EssenceTag[]>([]);
  const visionRef = useRef<DayVisionSummary | null>(null);

  // Two timelines drive the tag chips: `intro` (0→1) floats them in when the
  // essence appears; `absorb` (0→1) streams them down into the day on commit.
  const intro = useSharedValue(0);
  const absorb = useSharedValue(0);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  // Run the on-device vision pass once a photo exists, then reveal its essence.
  useEffect(() => {
    if (!photoUri) {
      return;
    }
    let active = true;
    void (async () => {
      const result = await analyzePhoto(photoUri);
      if (!active) {
        return;
      }
      const vision = result ? aggregatePhotoVision([result]) : null;
      visionRef.current = vision;
      setTags(buildEssenceTags(vision));
      setState('essence');
      intro.value = withTiming(1, { duration: 460, easing: Easing.out(Easing.cubic) });
    })();
    return () => {
      active = false;
    };
  }, [photoUri, intro]);

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
        setState('analyzing');
      } else {
        router.back();
      }
    } catch {
      router.back();
    }
  }, [state, router]);

  const handleMeaning = useCallback(
    (meaning: MeaningTag) => {
      if (state !== 'essence' || !photoUri) {
        return;
      }
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setState('absorbing');
      // Stream the essence tags down into the day, then commit + exit.
      absorb.value = withTiming(1, { duration: 680, easing: Easing.in(Easing.cubic) });
      setTimeout(() => {
        const vision = visionRef.current;
        const energy = buildCaptureEnergy(meaning, vision, dayScores ?? undefined);
        const category = vision
          ? resolvePhotoCategory(vision)
          : { icon: 'sparkles' as const, accent: '#F1D4B4' };
        applyCapturedMoment({ energy, vision }, captureTarget);
        queueCaptureFeed({ photoUri, icon: category.icon, accent: category.accent });
        router.back();
      }, 740);
    },
    [state, photoUri, absorb, dayScores, applyCapturedMoment, captureTarget, router]
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

  const showPhoto = state !== 'live' && state !== 'capturing';
  const fallDistance = height * 0.5;

  return (
    <View style={styles.screen}>
      {!showPhoto ? (
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      ) : photoUri ? (
        <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.darkFill]} />
      )}

      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.vignette]} />
      {/* A soft scrim once we leave the live camera, so the essence reads cleanly. */}
      {showPhoto ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim]} /> : null}

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

      {/* The analysing beat. */}
      {state === 'analyzing' ? (
        <Animated.View entering={FadeIn.duration(260)} style={styles.center} pointerEvents="none">
          <View style={styles.readingPulse} />
          <ThemedText type="onboardingLabel" style={styles.essenceKicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
            Reading the moment
          </ThemedText>
        </Animated.View>
      ) : null}

      {/* The essence: the photo's read, tags floating in the middle. */}
      {state === 'essence' || state === 'absorbing' ? (
        <View style={styles.center} pointerEvents="none">
          <Animated.View entering={FadeIn.duration(360)}>
            <ThemedText type="onboardingLabel" style={styles.essenceKicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
              Essence
            </ThemedText>
          </Animated.View>
          <View style={styles.tagCloud}>
            {tags.map((tag, index) => (
              <EssenceChip key={tag.id} tag={tag} index={index} intro={intro} absorb={absorb} fallDistance={fallDistance} />
            ))}
          </View>
        </View>
      ) : null}

      {state === 'live' ? (
        <View style={[styles.shutterRow, { bottom: insets.bottom + 36 }]}>
          <Pressable
            onPress={handleCapture}
            style={styles.shutter}
            accessibilityRole="button"
            accessibilityLabel="Capture moment">
            <View style={styles.shutterInner} />
          </Pressable>
        </View>
      ) : null}

      {/* The meaning prompt — shown once the essence is in, hidden as it absorbs. */}
      {state === 'essence' ? (
        <Animated.View entering={FadeInDown.delay(220).duration(320)} exiting={FadeOut.duration(180)} style={[styles.captured, { paddingBottom: insets.bottom + 36 }]}>
          <ThemedText type="display" style={styles.meaningTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            What did this mean?
          </ThemedText>
          <View style={styles.meaningGrid}>
            {CAPTURE_MEANINGS.map((option, index) => (
              <Animated.View key={option.id} entering={FadeInDown.delay(280 + index * 50).duration(280)}>
                <Pressable onPress={() => handleMeaning(option.id)} style={styles.meaningChip} accessibilityRole="button">
                  <ThemedText style={styles.meaningEmoji}>{option.emoji}</ThemedText>
                  <ThemedText style={styles.meaningLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                    {option.label}
                  </ThemedText>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

function EssenceChip({
  tag,
  index,
  intro,
  absorb,
  fallDistance,
}: {
  tag: EssenceTag;
  index: number;
  intro: SharedValue<number>;
  absorb: SharedValue<number>;
  fallDistance: number;
}) {
  const style = useAnimatedStyle(() => {
    // Staggered per chip: each floats in, then streams down a beat after the last.
    const i = clampW(intro.value * 1.35 - index * 0.12, 0, 1);
    const a = clampW(absorb.value * 1.3 - index * 0.1, 0, 1);
    return {
      opacity: i * (1 - a),
      transform: [
        { translateY: (1 - i) * 16 + a * fallDistance },
        { scale: (0.9 + i * 0.1) * (1 - a * 0.45) },
      ],
    };
  });

  return (
    <Animated.View
      style={[styles.essenceChip, { borderColor: `${tag.accent}77`, backgroundColor: `${tag.accent}1F` }, style]}>
      <View style={[styles.essenceDot, { backgroundColor: tag.accent }]} />
      <ThemedText style={styles.essenceLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
        {tag.label}
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#06040D', flex: 1 },
  darkFill: { backgroundColor: '#06040D' },
  vignette: { backgroundColor: 'rgba(6,4,13,0.18)' },
  scrim: { backgroundColor: 'rgba(6,4,13,0.5)' },
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
  center: {
    alignItems: 'center',
    bottom: 0,
    gap: 14,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  readingPulse: {
    backgroundColor: 'rgba(255,243,224,0.16)',
    borderColor: 'rgba(255,243,224,0.4)',
    borderRadius: 999,
    borderWidth: 1,
    height: 64,
    width: 64,
  },
  essenceKicker: { fontSize: 12 },
  tagCloud: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    maxWidth: 320,
  },
  essenceChip: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  essenceDot: { borderRadius: 999, height: 8, width: 8 },
  essenceLabel: { fontSize: 15, fontWeight: '800', lineHeight: 18 },
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
  captured: { alignItems: 'center', bottom: 0, gap: 8, left: 0, paddingHorizontal: 24, position: 'absolute', right: 0 },
  meaningTitle: { fontSize: 26, fontStyle: 'italic', lineHeight: 31, marginBottom: 10, textAlign: 'center' },
  meaningGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
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
  meaningEmoji: { fontSize: 17 },
  meaningLabel: { fontSize: 15, fontWeight: '800' },
});
