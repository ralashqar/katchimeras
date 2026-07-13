import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
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
import { foundationSceneAvailability, isFoundationSceneAvailable } from '@/utils/foundation-scene';
import { buildPhotoClassifiedMemory } from '@/utils/intelligence/classification';
import { buildPhotoEvidence } from '@/utils/intelligence/evidence';
import type { PhotoAnalysisInput, ReviewedPhotoAnalysis } from '@/utils/intelligence/photo-analysis';
import {
  answerClarification,
  currentClarificationNode,
  dismissClarification,
  skipClarificationGoal,
  type ClarificationOption,
} from '@/utils/intelligence/clarification';
import { classifyScene, resolveSceneRead, type SceneRead } from '@/utils/scene-classify';
import { detectStudioInVision, extractTitleFromVisionText, isGenericStudioLabel, studioDetectionFromMedia } from '@/utils/studio-detect';
import { pickProminentTags } from '@/utils/vision-signals';
import type { ClassifiedMemory, DayVisionSummary, PhotoVisionResult, UserConfirmation } from '@/types/home';

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
  questId?: string | null;
  // Produce the on-device vision read (camera analyses a temp file; the photo
  // prompt loads the chosen asset). Null when nothing could be read.
  analyze: () => Promise<PhotoAnalysisInput>;
  sourceId?: string | null;
  observedAt?: string | null;
  // Feed the day with the chosen meaning + the photo's essence, then leave.
  // `scene` is the hierarchical scene read resolved here (null if it wasn't
  // ready / available) — pass it through to applyCapturedMoment so the whole
  // pipeline acts on ONE classification.
  onCommit: (
    meaning: MeaningTag,
    vision: DayVisionSummary | null,
    label: string,
    scene: SceneRead | null,
    confirmations: UserConfirmation[],
    analysis: ReviewedPhotoAnalysis
  ) => void;
  onClose: () => void;
};

export function EssenceReview({ photoUri, analyze, sourceId, observedAt, onCommit, onClose }: EssenceReviewProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [state, setState] = useState<EssenceReviewState>('analyzing');
  const [tags, setTags] = useState<EssenceTag[]>([]);
  const [meanings, setMeanings] = useState<readonly CaptureMeaning[]>(CAPTURE_MEANINGS);
  const [clarificationMemory, setClarificationMemory] = useState<ClassifiedMemory | null>(null);
  const visionRef = useRef<DayVisionSummary | null>(null);
  const rawVisionRef = useRef<PhotoVisionResult | null>(null);
  const sceneRef = useRef<SceneRead | null>(null);
  const clarificationRef = useRef<ClassifiedMemory | null>(null);
  const observedAtRef = useRef(observedAt ?? new Date().toISOString());
  // Once the user picks a meaning, late LLM upgrades must not reshuffle the UI.
  const committedRef = useRef(false);
  const intro = useSharedValue(0);
  const absorb = useSharedValue(0);
  const fallDistance = height * 0.5;

  useEffect(() => {
    let active = true;
    void (async () => {
      const analyzed = await analyze();
      const vision = analyzed.summary;
      if (!active) {
        return;
      }
      rawVisionRef.current = analyzed.rawVision;
      visionRef.current = vision;
      const fastScene = classifyScene(vision);
      // Foundation Models run locally. On supported devices, wait for their
      // structured read before exposing questions. A quick answer used to
      // freeze the deterministic preview before Foundation could replace it.
      const foundationAvailable = !!vision && isFoundationSceneAvailable();
      const initialScene = foundationAvailable
        ? await resolveSceneRead(vision, photoUri, analyzed.rawVision)
        : {
            ...fastScene,
            foundationStatus: 'unavailable' as const,
            foundationReason: foundationSceneAvailability().reason,
          };
      if (!active) return;
      sceneRef.current = initialScene;
      committedRef.current = false;
      const initialMemory = vision
        ? buildPhotoClassifiedMemory({
            sourceId: sourceId ?? photoUri ?? 'capture-preview',
            observedAt: observedAtRef.current,
            vision,
            rawVision: analyzed.rawVision,
            scene: initialScene,
          })
        : null;
      clarificationRef.current = initialMemory;
      setClarificationMemory(initialMemory);
      // PROGRESSIVE reveal: the rule engine answers in microseconds — show the
      // screen NOW with its chips + meanings, then let the on-device LLM reads
      // upgrade them in place when they land (typically ~1s later). The commit
      // still gets whatever scene has resolved by then (engine falls back to
      // rules when it hasn't).
      setTags(buildEssenceTags(vision, initialScene, initialMemory));
      setMeanings(selectCaptureMeanings(vision));
      setState('essence');
      intro.value = withTiming(1, { duration: 460, easing: Easing.out(Easing.cubic) });
      if (!vision) return;
      if (initialScene.type === 'media' && initialScene.media) {
        const mediaMeanings = meaningsForMediaKind(initialScene.media.mediaType);
        if (mediaMeanings) setMeanings(mediaMeanings);
      }
      // Upgrade 1 — the hierarchical scene read (chips + media-owned options).
      if (!foundationAvailable) void resolveSceneRead(vision, photoUri, analyzed.rawVision)
        .then((read) => {
          sceneRef.current = read;
          if (!active || !read || committedRef.current) return;
          const currentMemory = clarificationRef.current;
          const upgradedMemory = buildPhotoClassifiedMemory({
            sourceId: sourceId ?? photoUri ?? 'capture-preview',
            observedAt: currentMemory?.createdAt ?? new Date().toISOString(),
            vision,
            rawVision: analyzed.rawVision,
            scene: read,
            confirmations: currentMemory?.confirmations ?? [],
          });
          const reconciledMemory = reconcileProgressiveUpgrade(currentMemory, upgradedMemory);
          setTags(buildEssenceTags(vision, read, reconciledMemory));
          clarificationRef.current = reconciledMemory;
          setClarificationMemory(reconciledMemory);
          if (read.type === 'media' && read.media) {
            const mediaMeanings = meaningsForMediaKind(read.media.mediaType);
            if (mediaMeanings) setMeanings(mediaMeanings);
          }
        })
        .catch(() => {});
      // Upgrade 2 — Foundation Models phrasing for the meaning options (media
      // scenes keep their owned options; see the guard).
    })();
    return () => {
      active = false;
    };
  }, [analyze, intro, photoUri, sourceId]);

  const commitMeaning = (meaning: MeaningTag, label: string, memory = clarificationRef.current) => {
    if (state !== 'essence') {
      return;
    }
    committedRef.current = true;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setState('absorbing');
    absorb.value = withTiming(1, { duration: 680, easing: Easing.in(Easing.cubic) });
    const evidence = memory
      ? buildPhotoEvidence({
          sourceId: memory.sourceId,
          observedAt: memory.createdAt,
          thumbnailUri: photoUri,
          vision: visionRef.current,
          rawVision: rawVisionRef.current,
          scene: sceneRef.current,
          memory,
        })
      : null;
    const reviewed: ReviewedPhotoAnalysis = {
      rawVision: rawVisionRef.current,
      summary: visionRef.current,
      scene: sceneRef.current,
      memory,
      evidence,
    };
    setTimeout(
      () => onCommit(meaning, visionRef.current, label, sceneRef.current, memory?.confirmations ?? [], reviewed),
      740
    );
  };

  const handleMeaning = (meaning: MeaningTag) => {
    commitMeaning(meaning, meanings.find((option) => option.id === meaning)?.label ?? '');
  };

  const handleClarification = (option: ClarificationOption) => {
    let memory = clarificationRef.current;
    let resolvedOption = option;
    const node = memory ? currentClarificationNode(memory) : null;
    if (!memory || !node || state !== 'essence') return;
    if (option.facetKey === 'media_type' && option.facetValue === 'book') {
      const title = extractTitleFromVisionText(visionRef.current?.textTokens);
      if (title) {
        const existingScene = sceneRef.current;
        sceneRef.current = {
          memoryDomain: 'media',
          type: 'media',
          label: 'An inspiration',
          detail: title,
          media: { mediaType: 'book', title, creator: null },
          source: existingScene?.source ?? 'rules',
          supportingSubjects: existingScene?.supportingSubjects,
          representation: existingScene?.representation,
          promptVersion: existingScene?.promptVersion,
        };
        memory = {
          ...memory,
          facets: [
            ...memory.facets.filter((facet) => facet.key !== 'media_title'),
            { key: 'media_title', value: title, confidence: 0.78, sensitive: false, confirmed: false },
          ],
        };
        resolvedOption = { ...option, nextNodeId: 'title' };
      }
    }
    const next = answerClarification(memory, node, resolvedOption);
    clarificationRef.current = next;
    setClarificationMemory(next);
    void Haptics.selectionAsync();
    if (next.promptState.status === 'answered') {
      commitMeaning(option.meaning ?? 'meaningful', option.label, next);
    }
  };

  const handleSkipClarification = () => {
    const memory = clarificationRef.current;
    if (!memory || state !== 'essence') return;
    const skipped = skipClarificationGoal(memory);
    clarificationRef.current = skipped;
    setClarificationMemory(skipped);
    if (skipped.promptState.status !== 'pending') {
      commitMeaning('meaningful', sceneRef.current?.label ?? 'A moment', skipped);
    }
  };

  const handleDoneClarifying = () => {
    const memory = clarificationRef.current;
    if (!memory || state !== 'essence') return;
    const dismissed = dismissClarification(memory);
    clarificationRef.current = dismissed;
    setClarificationMemory(dismissed);
    commitMeaning('meaningful', sceneRef.current?.label ?? 'A moment', dismissed);
  };

  const clarificationNode = clarificationMemory ? currentClarificationNode(clarificationMemory) : null;
  const displayedOptions = clarificationNode?.options ?? meanings;

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
          <View style={styles.readingPulse} accessibilityRole="progressbar" accessibilityLabel="Reading the moment">
            <ActivityIndicator color={Lantern.ember300} size="large" />
          </View>
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
            {clarificationNode?.question ?? 'What did this mean?'}
          </ThemedText>
          <View style={styles.meaningGrid}>
            {displayedOptions.map((option, index) => (
              <Animated.View key={option.id} entering={FadeInDown.delay(280 + index * 50).duration(280)}>
                <Pressable
                  onPress={() => clarificationNode
                    ? handleClarification(option as ClarificationOption)
                    : handleMeaning(option.id as MeaningTag)}
                  style={styles.meaningChip}
                  accessibilityRole="button">
                  <ThemedText style={styles.meaningEmoji}>{option.emoji}</ThemedText>
                  <ThemedText style={styles.meaningLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                    {option.label}
                  </ThemedText>
                </Pressable>
              </Animated.View>
            ))}
          </View>
          {clarificationNode ? (
            <View style={styles.clarificationActions}>
              <Pressable accessibilityRole="button" onPress={handleSkipClarification} style={styles.skipAction}>
                <ThemedText style={styles.skipLabel} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
                  Skip this
                </ThemedText>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={handleDoneClarifying} style={styles.skipAction}>
                <ThemedText style={styles.skipLabel} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
                  Done
                </ThemedText>
              </Pressable>
            </View>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

function reconcileProgressiveUpgrade(
  current: ClassifiedMemory | null,
  upgraded: ClassifiedMemory
): ClassifiedMemory {
  if (!current || current.confirmations.length === 0) return upgraded;
  const questionFamilyChanged =
    !!current.promptState.graphId &&
    !!upgraded.promptState.graphId &&
    current.promptState.graphId !== upgraded.promptState.graphId;
  const confirmedMediaType = upgraded.facets.some(
    (facet) => facet.key === 'media_type' && facet.confirmed && facet.value !== 'other'
  );
  const hasUnconfirmedTitle = upgraded.facets.some(
    (facet) => facet.key === 'media_title' && !facet.confirmed && facet.value !== 'unknown'
  );
  const titleAlreadyAsked = current.confirmations.some((confirmation) => confirmation.facetKey === 'media_title');
  const canAskTitle = (current.promptState.microQuestionCount ?? 0) < 1;
  const shouldInsertTitleQuestion =
    confirmedMediaType &&
    hasUnconfirmedTitle &&
    !titleAlreadyAsked &&
    canAskTitle &&
    current.promptState.graphId === 'media-context';

  return {
    ...upgraded,
    createdAt: current.createdAt,
    promptState: {
      // Semantic routing comes from the upgraded canonical interpretation;
      // only interaction history is carried forward. Preserving the old graph
      // here caused tags to update while an obsolete question stayed visible.
      ...(questionFamilyChanged ? current.promptState : upgraded.promptState),
      answeredNodeIds: current.promptState.answeredNodeIds,
      askedQuestionIds: current.promptState.askedQuestionIds,
      resolvedGoalIds: current.promptState.resolvedGoalIds,
      skippedGoalIds: current.promptState.skippedGoalIds,
      completedGoalIds: current.promptState.completedGoalIds,
      questionCount: current.promptState.questionCount,
      microQuestionCount: current.promptState.microQuestionCount,
      status: shouldInsertTitleQuestion ? 'pending' : questionFamilyChanged ? current.promptState.status : upgraded.promptState.status,
      currentNodeId: shouldInsertTitleQuestion ? 'title' : questionFamilyChanged ? current.promptState.currentNodeId : upgraded.promptState.currentNodeId,
      currentQuestionId: shouldInsertTitleQuestion ? 'media-context.title' : questionFamilyChanged ? current.promptState.currentQuestionId : upgraded.promptState.currentQuestionId,
    },
  };
}

// The photo's essence = what the on-device vision read in it, as tags the user
// can watch being captured into the day.
function buildEssenceTags(
  vision: DayVisionSummary | null,
  scene: SceneRead | null,
  memory: ClassifiedMemory | null
): EssenceTag[] {
  const tags: EssenceTag[] = [];
  // When the work was identified (a cover/poster read as a real title), it
  // leads — the user sees '📖 Norwegian Wood', not just scene labels. The
  // scene read is the arbiter; the direct vision check only fills in when no
  // scene resolved in time.
  const studio =
    scene?.type === 'media' && scene.media
      ? studioDetectionFromMedia(scene.media.mediaType, scene.media.title)
      : vision
        ? detectStudioInVision(vision)
        : null;
  if (studio?.detected && studio.label && !isGenericStudioLabel(studio.label)) {
    tags.push({ id: 'studio-title', label: `${studio.emoji ?? '📖'} ${studio.label}`, accent: '#E8C87A' });
  } else if (scene?.type === 'media' && scene.media?.mediaType) {
    const mediaLabel = scene.media.mediaType === 'film'
      ? 'Movie'
      : scene.media.mediaType.charAt(0).toUpperCase() + scene.media.mediaType.slice(1);
    const mediaEmoji = scene.media.mediaType === 'book' ? '📖' : scene.media.mediaType === 'game' ? '🎮' : '✨';
    tags.push({ id: `studio-${scene.media.mediaType}`, label: `${mediaEmoji} ${mediaLabel}`, accent: '#E8C87A' });
  }
  if (vision && vision.maxFaceCount >= 2) {
    tags.push({ id: 'together', label: 'Together', accent: '#F2C2A8' });
  }
  // Lower confidence bar than the nightly line: a single snapped photo's weaker
  // reads (a soda can, a plate) are still worth surfacing as essence tags.
  const canonicalNames = (memory?.photoAnalysis?.subjects ?? [])
    .filter((subject) => subject.role !== 'incidental' && subject.score >= 0.35)
    .sort((left, right) => (left.role === 'primary' ? -1 : right.role === 'primary' ? 1 : right.score - left.score))
    .map((subject) => subject.label || subject.canonicalValue)
    .filter((name) => !/^(machine|material|structure|consumer electronics|wood processed|conveyance)$/i.test(name))
    .filter((name, index, names) => {
      const normalized = name.trim().toLocaleLowerCase();
      return names.findIndex((candidate) => candidate.trim().toLocaleLowerCase() === normalized) === index;
    });
  const rawNames = canonicalNames.length > 0
    ? canonicalNames.slice(0, 4)
    : vision
      ? pickProminentTags(vision, 4, 0.16)
      : [];
  const names = rawNames;
  names.forEach((name, index) => {
    const normalizedId = name.trim().toLocaleLowerCase().replace(/\s+/g, '-');
    tags.push({ id: `subject-${normalizedId}-${index}`, label: humanizeTag(name), accent: TAG_PALETTE[tags.length % TAG_PALETTE.length] });
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
    alignItems: 'center',
    backgroundColor: 'rgba(255,243,224,0.16)',
    borderColor: 'rgba(255,243,224,0.4)',
    borderRadius: 999,
    borderWidth: 1,
    height: 64,
    justifyContent: 'center',
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
  clarificationActions: { flexDirection: 'row', justifyContent: 'center', marginTop: 6 },
  skipAction: { marginTop: 6, paddingHorizontal: 18, paddingVertical: 10 },
  skipLabel: { fontSize: 13, fontWeight: '800' },
});
