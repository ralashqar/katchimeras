import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenCloseButton } from '@/components/katchadeck/ui/screen-close-button';
import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import {
  CAPTURE_MEANINGS,
  meaningsForMediaKind,
  selectCaptureMeanings,
  type CaptureMeaning,
  type MeaningTag,
} from '@/utils/capture-energy';
import { suggestFoundationMeanings } from '@/utils/foundation-meaning';
import { resolveSceneRead, type SceneRead } from '@/utils/scene-classify';
import { detectStudioInVision, isGenericStudioLabel, studioDetectionFromMedia } from '@/utils/studio-detect';
import { pickProminentTags } from '@/utils/vision-signals';
import type { DayVisionSummary } from '@/types/home';

// The shared "read the moment" experience: a photo's on-device essence animates
// into the centre, the user says what it meant, and the tags then stream down
// like particles being absorbed into the day. Used by both the live camera
// capture and the "this photo meant something" prompt — each provides how to get
// the vision (`analyze`) and what to do with the answer (`onCommit`).
type EssenceReviewState = 'analyzing' | 'essence' | 'absorbing';

type EssenceTag = { id: string; label: string; accent: string };

const TAG_PALETTE = ['#FFC36B', '#92D7FF', '#9DDCB8', '#D5B8FF', '#F2C2A8'];

type EssenceReviewProps = {
  // The photo to show behind the essence (display only).
  photoUri: string | null;
  // Produce the on-device vision read (camera analyses a temp file; the photo
  // prompt loads the chosen asset). Null when nothing could be read.
  analyze: () => Promise<DayVisionSummary | null>;
  // Feed the day with the chosen meaning + the photo's essence, then leave.
  // `scene` is the hierarchical scene read resolved here (null if it wasn't
  // ready / available) — pass it through to applyCapturedMoment so the whole
  // pipeline acts on ONE classification.
  onCommit: (meaning: MeaningTag, vision: DayVisionSummary | null, label: string, scene: SceneRead | null) => void;
  onClose: () => void;
};

export function EssenceReview({ photoUri, analyze, onCommit, onClose }: EssenceReviewProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [state, setState] = useState<EssenceReviewState>('analyzing');
  const [tags, setTags] = useState<EssenceTag[]>([]);
  const [meanings, setMeanings] = useState<readonly CaptureMeaning[]>(CAPTURE_MEANINGS);
  const visionRef = useRef<DayVisionSummary | null>(null);
  const sceneRef = useRef<SceneRead | null>(null);
  // Once the user picks a meaning, late LLM upgrades must not reshuffle the UI.
  const committedRef = useRef(false);
  const intro = useSharedValue(0);
  const absorb = useSharedValue(0);
  const fallDistance = height * 0.5;

  useEffect(() => {
    let active = true;
    void (async () => {
      const vision = await analyze();
      if (!active) {
        return;
      }
      visionRef.current = vision;
      sceneRef.current = null;
      committedRef.current = false;
      // PROGRESSIVE reveal: the rule engine answers in microseconds — show the
      // screen NOW with its chips + meanings, then let the on-device LLM reads
      // upgrade them in place when they land (typically ~1s later). The commit
      // still gets whatever scene has resolved by then (engine falls back to
      // rules when it hasn't).
      setTags(buildEssenceTags(vision, null));
      setMeanings(selectCaptureMeanings(vision));
      setState('essence');
      intro.value = withTiming(1, { duration: 460, easing: Easing.out(Easing.cubic) });
      if (!vision) return;
      // Upgrade 1 — the hierarchical scene read (chips + media-owned options).
      void resolveSceneRead(vision)
        .then((read) => {
          sceneRef.current = read;
          if (!active || !read || committedRef.current) return;
          setTags(buildEssenceTags(vision, read));
          if (read.type === 'media' && read.media) {
            const mediaMeanings = meaningsForMediaKind(read.media.mediaType);
            if (mediaMeanings) setMeanings(mediaMeanings);
          }
        })
        .catch(() => {});
      // Upgrade 2 — Foundation Models phrasing for the meaning options (media
      // scenes keep their owned options; see the guard).
      void suggestFoundationMeanings(vision)
        .then((llm) => {
          if (!active || !llm || committedRef.current) return;
          const scene = sceneRef.current;
          if (scene?.type === 'media' && scene.media && meaningsForMediaKind(scene.media.mediaType)) return;
          setMeanings(llm);
        })
        .catch(() => {});
    })();
    return () => {
      active = false;
    };
  }, [analyze, intro]);

  const handleMeaning = (meaning: MeaningTag) => {
    if (state !== 'essence') {
      return;
    }
    committedRef.current = true;
    const label = meanings.find((option) => option.id === meaning)?.label ?? '';
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setState('absorbing');
    absorb.value = withTiming(1, { duration: 680, easing: Easing.in(Easing.cubic) });
    setTimeout(() => onCommit(meaning, visionRef.current, label, sceneRef.current), 740);
  };

  return (
    <View style={styles.fill}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.darkFill]} />
      )}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim]} />

      <ScreenCloseButton onPress={onClose} />

      {state === 'analyzing' ? (
        <Animated.View entering={FadeIn.duration(260)} style={styles.center} pointerEvents="none">
          <View style={styles.readingPulse} />
          <ThemedText type="onboardingLabel" style={styles.essenceKicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
            Reading the moment
          </ThemedText>
        </Animated.View>
      ) : null}

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

      {state === 'essence' ? (
        <Animated.View entering={FadeInDown.delay(220).duration(320)} style={[styles.captured, { paddingBottom: insets.bottom + 36 }]}>
          <ThemedText type="display" style={styles.meaningTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            What did this mean?
          </ThemedText>
          <View style={styles.meaningGrid}>
            {meanings.map((option, index) => (
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

// The photo's essence = what the on-device vision read in it, as tags the user
// can watch being captured into the day.
function buildEssenceTags(vision: DayVisionSummary | null, scene: SceneRead | null): EssenceTag[] {
  const tags: EssenceTag[] = [];
  // When the work was identified (a cover/poster read as a real title), it
  // leads — the user sees '📖 Norwegian Wood', not just scene labels. The
  // scene read is the arbiter; the direct vision check only fills in when no
  // scene resolved in time.
  const studio =
    scene?.type === 'media' && scene.media
      ? studioDetectionFromMedia(scene.media.mediaType, scene.media.title)
      : !scene && vision
        ? detectStudioInVision(vision)
        : null;
  if (studio?.detected && studio.label && !isGenericStudioLabel(studio.label)) {
    tags.push({ id: 'studio-title', label: `${studio.emoji ?? '📖'} ${studio.label}`, accent: '#E8C87A' });
  }
  if (vision && vision.maxFaceCount >= 2) {
    tags.push({ id: 'together', label: 'Together', accent: '#F2C2A8' });
  }
  // Lower confidence bar than the nightly line: a single snapped photo's weaker
  // reads (a soda can, a plate) are still worth surfacing as essence tags.
  const names = vision ? pickProminentTags(vision, 4, 0.16) : [];
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
  fill: { flex: 1 },
  darkFill: { backgroundColor: '#06040D' },
  scrim: { backgroundColor: 'rgba(6,4,13,0.5)' },
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
