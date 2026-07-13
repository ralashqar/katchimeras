import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
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
import { ManualJournalSheet } from '@/components/katchadeck/home/manual-journal-sheet';
import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import {
  type MeaningTag,
} from '@/utils/capture-energy';
import { foundationSceneAvailability, isFoundationSceneAvailable } from '@/utils/foundation-scene';
import { applyManualJournalFacets, buildPhotoClassifiedMemory } from '@/utils/intelligence/classification';
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
import { pickProminentTags } from '@/utils/vision-signals';
import { manualJournalFlow } from '@/utils/manual-journal-registry';
import {
  fallbackPhotoJournalRoute,
  photoJournalQuestion,
  photoJournalRouteForConfirmation,
  photoJournalRouteProposals,
  photoJournalSuggestions,
  type PhotoJournalRouteProposal,
} from '@/utils/intelligence/photo-journal-routing';
import type { ClassifiedMemory, DayVisionSummary, ManualJournalSubmission, PhotoVisionResult, StudioMediaType, UserConfirmation } from '@/types/home';

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
    analysis: ReviewedPhotoAnalysis,
    journal: ManualJournalSubmission
  ) => void;
  onClose: () => void;
};

export function EssenceReview({ photoUri, analyze, sourceId, observedAt, onCommit, onClose }: EssenceReviewProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [state, setState] = useState<EssenceReviewState>('analyzing');
  const [tags, setTags] = useState<EssenceTag[]>([]);
  const [clarificationMemory, setClarificationMemory] = useState<ClassifiedMemory | null>(null);
  const [journalRoute, setJournalRoute] = useState<PhotoJournalRouteProposal | null>(null);
  const [journalPickerOpen, setJournalPickerOpen] = useState(false);
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
      setTags(buildEssenceTags(vision, initialMemory));
      setState('essence');
      intro.value = withTiming(1, { duration: 460, easing: Easing.out(Easing.cubic) });
      if (!vision) return;
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
          setTags(buildEssenceTags(vision, reconciledMemory));
          clarificationRef.current = reconciledMemory;
          setClarificationMemory(reconciledMemory);
        })
        .catch(() => {});
      // Upgrade 2 — Foundation Models phrasing for the meaning options (media
      // scenes keep their owned options; see the guard).
    })();
    return () => {
      active = false;
    };
  }, [analyze, intro, photoUri, sourceId]);

  const commitMeaning = (meaning: MeaningTag, label: string, journal: ManualJournalSubmission, memory = clarificationRef.current) => {
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
      () => onCommit(meaning, visionRef.current, label, sceneRef.current, memory?.confirmations ?? [], reviewed, journal),
      740
    );
  };

  const handleClarification = (option: ClarificationOption) => {
    const memory = clarificationRef.current;
    const node = memory ? currentClarificationNode(memory) : null;
    if (!memory || !node || state !== 'essence') return;
    const next = answerClarification(memory, node, option);
    clarificationRef.current = next;
    setClarificationMemory(next);
    void Haptics.selectionAsync();
    const route = photoJournalRouteForConfirmation(option.facetKey, option.facetValue);
    if (route) {
      setJournalRoute(route);
      return;
    }
    if (next.promptState.status === 'answered') {
      setJournalPickerOpen(true);
    }
  };

  const handleJournalSave = (submission: ManualJournalSubmission) => {
    const memory = clarificationRef.current;
    const flow = manualJournalFlow(submission.flowId);
    const choice = flow?.choices.find((item) => item.id === submission.categoryId);
    if (!memory || !flow || !choice || state !== 'essence') return;
    const specificValue = submission.fields.specific;
    const specific = typeof specificValue === 'string' ? specificValue.trim() : '';
    const createdAt = new Date().toISOString();
    const routeFacets = journalRoute?.confirmedFacets ?? [];
    const finalFacets = dedupeJournalFacets([
      ...routeFacets,
      ...(choice.mediaType ? [{ key: 'media_type', value: choice.mediaType }] : []),
      ...(choice.mediaType && specific ? [{ key: 'media_title', value: specific }] : []),
      ...(flow.adapter === 'food' ? [{ key: 'food_item', value: specific || choice.label }] : []),
      ...(submission.feeling ? [{ key: flow.adapter === 'studio' ? 'media_rating' : 'journal_feeling', value: submission.feeling }] : []),
    ]);
    const allowedRoutingFacets = routingFacetsForJournalAdapter(flow.adapter);
    const routingFacetKeys = new Set(['media_type', 'media_title', 'food_kind', 'food_item', 'place_category', 'movement_mode', 'movement_subtype', 'activity_kind', 'device_activity', 'relationship', 'work_kind', 'life_event']);
    const memoryWithoutMachineText = {
      ...memory,
      facets: memory.facets.filter((facet) =>
        (!routingFacetKeys.has(facet.key) || allowedRoutingFacets.has(facet.key)) &&
        (facet.key !== 'media_title' || facet.confirmed)
      ),
      confirmations: memory.confirmations.filter((confirmation) =>
        !routingFacetKeys.has(confirmation.facetKey) || allowedRoutingFacets.has(confirmation.facetKey)
      ),
      dominantDomain: domainForJournalAdapter(flow.adapter),
    };
    const confirmed = applyManualJournalFacets(
      memoryWithoutMachineText,
      finalFacets,
      createdAt
    );
    clarificationRef.current = confirmed;
    setClarificationMemory(confirmed);
    setJournalRoute(null);
    setJournalPickerOpen(false);
    if (choice.mediaType) {
      const priorScene = sceneRef.current;
      sceneRef.current = { memoryDomain: 'media', type: 'media', label: 'An inspiration', detail: specific || choice.label, media: { mediaType: choice.mediaType as StudioMediaType, title: specific || null, creator: null }, source: priorScene?.source ?? 'rules', supportingSubjects: priorScene?.supportingSubjects, representation: priorScene?.representation, promptVersion: priorScene?.promptVersion };
    }
    const reactionLabel = flow.feelings.find((item) => item.id === submission.feeling)?.label ?? choice.label;
    commitMeaning(meaningForJournal(submission.feeling), specific || reactionLabel, submission, confirmed);
  };

  const handleSkipClarification = () => {
    const memory = clarificationRef.current;
    if (!memory || state !== 'essence') return;
    const skipped = skipClarificationGoal(memory);
    clarificationRef.current = skipped;
    setClarificationMemory(skipped);
    if (skipped.promptState.status !== 'pending') {
      setJournalPickerOpen(true);
    }
  };

  const handleDoneClarifying = () => {
    const memory = clarificationRef.current;
    if (!memory || state !== 'essence') return;
    const dismissed = dismissClarification(memory);
    clarificationRef.current = dismissed;
    setClarificationMemory(dismissed);
    setJournalPickerOpen(true);
  };

  const plannedClarificationNode = clarificationMemory ? currentClarificationNode(clarificationMemory) : null;
  const clarificationNode = plannedClarificationNode && !/reaction|meaning|title/.test(plannedClarificationNode.id) ? plannedClarificationNode : null;
  const routeProposals = clarificationMemory ? photoJournalRouteProposals(clarificationMemory) : [];
  const showRouteConfirmation = !clarificationNode && !journalRoute && !journalPickerOpen;
  const displayedOptions = clarificationNode?.options ?? [];
  const visibleRoutes = routeProposals.length ? routeProposals : [fallbackPhotoJournalRoute()];
  const fieldSuggestions = journalRoute ? photoJournalSuggestions({ route: journalRoute, rawVision: rawVisionRef.current, vision: visionRef.current, scene: sceneRef.current }) : [];
  const prefilledSpecific = fieldSuggestions.find((item) => item.prefill)?.value ?? '';

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
        <ScrollView
          style={styles.reviewScroll}
          contentContainerStyle={[
            styles.reviewContent,
            { paddingTop: insets.top + 72, paddingBottom: insets.bottom + 28 },
          ]}
          bounces={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.tagSection} pointerEvents="none">
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
          {state === 'essence' ? (
            <Animated.View entering={FadeInDown.delay(220).duration(320)} style={styles.captured}>
              <ThemedText type="display" style={styles.meaningTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                {clarificationNode?.question ?? photoJournalQuestion(visibleRoutes)}
              </ThemedText>
              <View style={styles.meaningGrid}>
                {clarificationNode ? displayedOptions.map((option, index) => (
                  <Animated.View key={option.id} entering={FadeInDown.delay(280 + index * 50).duration(280)}>
                    <Pressable
                      onPress={() => handleClarification(option as ClarificationOption)}
                      style={styles.meaningChip}
                      accessibilityRole="button">
                      <ThemedText style={styles.meaningEmoji}>{option.emoji}</ThemedText>
                      <ThemedText style={styles.meaningLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                        {option.label}
                      </ThemedText>
                    </Pressable>
                  </Animated.View>
                )) : visibleRoutes.map((route, index) => (
                  <Animated.View key={route.id} entering={FadeInDown.delay(280 + index * 50).duration(280)}>
                    <Pressable onPress={() => setJournalRoute(route)} style={styles.meaningChip} accessibilityRole="button">
                      <ThemedText style={styles.meaningEmoji}>✨</ThemedText><ThemedText style={styles.meaningLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{route.label}</ThemedText>
                    </Pressable>
                  </Animated.View>
                ))}
                {showRouteConfirmation ? <Pressable onPress={() => setJournalPickerOpen(true)} style={styles.meaningChip} accessibilityRole="button"><ThemedText style={styles.meaningEmoji}>＋</ThemedText><ThemedText style={styles.meaningLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>Something else</ThemedText></Pressable> : null}
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
        </ScrollView>
      ) : null}

      {state === 'essence' && journalRoute ? (
        <ManualJournalSheet
          initialFlowId={journalRoute.flowId}
          initialChoiceId={journalRoute.choiceId}
          initialSpecific={prefilledSpecific}
          initialSpecificSuggestions={fieldSuggestions}
          sourceType="photo"
          sourceId={sourceId ?? photoUri}
          thumbnailUri={photoUri}
          onBackFromInitial={() => setJournalRoute(null)}
          onClose={onClose}
          onSave={handleJournalSave}
        />
      ) : null}
      {state === 'essence' && journalPickerOpen ? <ManualJournalSheet sourceType="photo" sourceId={sourceId ?? photoUri} thumbnailUri={photoUri} onBackFromInitial={() => setJournalPickerOpen(false)} onClose={onClose} onSave={handleJournalSave} /> : null}
    </View>
  );
}

function meaningForJournal(reaction: string | null | undefined): MeaningTag {
  if (reaction === 'loved') return 'together';
  if (reaction === 'inspired') return 'meaningful';
  return 'calm';
}

function domainForJournalAdapter(adapter: string): ClassifiedMemory['dominantDomain'] {
  return ({ food: 'food', studio: 'media', place: 'place', movement: 'movement', relationship: 'people', work: 'work', big_event: 'life_event' } as Record<string, ClassifiedMemory['dominantDomain']>)[adapter] ?? 'other';
}

function routingFacetsForJournalAdapter(adapter: string): Set<string> {
  const keys = ({
    studio: ['media_type', 'media_title', 'device_activity'],
    food: ['food_kind', 'food_item'],
    place: ['place_category'],
    movement: ['movement_mode', 'movement_subtype', 'activity_kind'],
    relationship: ['relationship'],
    work: ['work_kind', 'device_activity'],
    general: ['device_activity'],
    big_event: ['life_event'],
  } as Record<string, string[]>)[adapter] ?? [];
  return new Set(keys);
}

function dedupeJournalFacets(values: { key: string; value: string; sensitive?: boolean }[]) {
  const byKey = new Map<string, { key: string; value: string; sensitive?: boolean }>();
  values.forEach((value) => byKey.set(value.key, value));
  return [...byKey.values()];
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
  memory: ClassifiedMemory | null
): EssenceTag[] {
  const tags: EssenceTag[] = [];
  if (vision && vision.maxFaceCount >= 2) {
    tags.push({ id: 'together', label: 'Together', accent: '#F2C2A8' });
  }
  // Lower confidence bar than the nightly line: a single snapped photo's weaker
  // reads (a soda can, a plate) are still worth surfacing as essence tags.
  const canonicalNames = (memory?.photoAnalysis?.subjects ?? [])
    .filter((subject) => subject.role !== 'incidental' && subject.score >= 0.35)
    .sort((left, right) => (left.role === 'primary' ? -1 : right.role === 'primary' ? 1 : right.score - left.score))
    .map((subject) => subject.domain === 'media' ? subject.canonicalValue : subject.label || subject.canonicalValue)
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
  reviewScroll: { ...StyleSheet.absoluteFillObject },
  reviewContent: {
    alignItems: 'center',
    flexGrow: 1,
    gap: 28,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  tagSection: { alignItems: 'center', gap: 12, width: '100%' },
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
  captured: { alignItems: 'center', gap: 8, width: '100%' },
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
