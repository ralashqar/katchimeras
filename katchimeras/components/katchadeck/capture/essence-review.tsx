import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
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
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';
import {
  type MeaningTag,
} from '@/utils/capture-energy';
import { buildPhotoEvidence } from '@/utils/intelligence/evidence';
import type { PhotoAnalysisInput, ReviewedPhotoAnalysis } from '@/utils/intelligence/photo-analysis';
import type { SceneRead } from '@/utils/scene-classify';
import type { DayVisionSummary, JournalRouteProposal, ManualJournalSubmission, PhotoVisionResult, StudioMediaType, UserConfirmation } from '@/types/home';
import { reviewPhotoJournalSubmission } from '@/utils/intelligence/photo-journal-commit';
import { usePhotoAnalysisSession } from '@/hooks/use-photo-analysis-session';
import { preparePhotoJournalAnalysis, enrichPhotoJournalRoute, type PhotoJournalCandidate, type PhotoJournalClassification, type PhotoJournalFieldProposal } from '@/utils/photo-journal-analysis';
import { buildPhotoJournalEvidence, photoJournalEssenceLabels } from '@/utils/photo-journal-evidence';
import { buildPhotoClassifiedMemory } from '@/utils/intelligence/classification';
import { sceneFromPhotoSemanticFrame } from '@/utils/scene-classify';
import type { PhotoSemanticFrame } from '@/utils/photo-semantic-frame';
import { journalRouteForIds } from '@/utils/journal-routing';
import { saveDevLastPhotoAnalysis } from '@/utils/dev-photo-analysis';

// The shared "read the moment" experience: a photo's on-device essence animates
// into the centre, the user says what it meant, and the tags then stream down
// like particles being absorbed into the day. Used by both the live camera
// capture and the "this photo meant something" prompt — each provides how to get
// the vision (`analyze`) and what to do with the answer (`onCommit`).
type EssenceReviewState = 'analyzing' | 'essence' | 'absorbing';
type JournalAnalysisState = 'waiting' | 'classifying' | 'refining' | 'ready' | 'failed';

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

export function EssenceReview({ photoUri, questId, analyze, sourceId, observedAt, onCommit, onClose }: EssenceReviewProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [state, setState] = useState<EssenceReviewState>('analyzing');
  const [tags, setTags] = useState<EssenceTag[]>([]);
  const [journalRoute, setJournalRoute] = useState<JournalRouteProposal | null>(null);
  const [journalPickerOpen, setJournalPickerOpen] = useState(false);
  const [journalFlowId, setJournalFlowId] = useState<string | null>(null);
  const [journalAnalysis, setJournalAnalysis] = useState<PhotoJournalClassification | null>(null);
  const [journalAnalysisState, setJournalAnalysisState] = useState<JournalAnalysisState>('waiting');
  const [journalSpecific, setJournalSpecific] = useState<string | null>(null);
  const [journalSpecificLoading, setJournalSpecificLoading] = useState(false);
  const [journalEnrichment, setJournalEnrichment] = useState<PhotoJournalFieldProposal | null>(null);
  const journalAnalysisStartedRef = useRef(false);
  const journalRequestRef = useRef(0);
  const enrichmentRequestRef = useRef(0);
  const enrichmentRouteRef = useRef<string | null>(null);
  const journalInteractionLockedRef = useRef(false);
  const intro = useSharedValue(0);
  const absorb = useSharedValue(0);
  const fallDistance = height * 0.5;

  const cacheDevelopmentAnalysis = (
    analysis: PhotoJournalClassification,
    vision: DayVisionSummary,
    rawVision: PhotoVisionResult | null
  ) => {
    const semanticScene = analysis.semanticFrame?.stage === 'foundation_reconciled'
      ? sceneFromPhotoSemanticFrame(analysis.semanticFrame)
      : sceneRef.current;
    saveDevLastPhotoAnalysis({
      sourceId: sourceId ?? photoUri ?? 'capture-preview',
      thumbnailUri: photoUri ?? '',
      rawVision,
      visionSummary: vision,
      scene: semanticScene,
      confirmations: clarificationRef.current?.confirmations ?? [],
      journalClassification: analysis,
      journalEnrichment: null,
      questId: questId ?? null,
    });
  };

  const startJournalAnalysis = (vision: DayVisionSummary | null, rawVision: PhotoVisionResult | null) => {
    if (!vision || journalAnalysisStartedRef.current) {
      if (!vision) setJournalAnalysisState('failed');
      return;
    }
    journalAnalysisStartedRef.current = true;
    const requestId = ++journalRequestRef.current;
    const progressive = preparePhotoJournalAnalysis(vision, rawVision);
    cacheDevelopmentAnalysis(progressive.initial, vision, rawVision);
    setTags(buildEssenceTags(rawVision, vision, progressive.initial.semanticFrame));
    applyJournalAnalysis(progressive.initial);
    if (!progressive.refinement || progressive.initial.selected) return;
    setJournalAnalysisState('refining');
    void progressive.refinement
      .then((analysis) => {
        // Persist the completed model trace even if the review UI was closed or
        // the user chose not to journal/save this photo.
        cacheDevelopmentAnalysis(analysis, vision, rawVision);
        if (journalRequestRef.current === requestId && !journalInteractionLockedRef.current) applyJournalAnalysis(analysis);
      })
      .catch(() => {
        if (journalRequestRef.current === requestId && !journalInteractionLockedRef.current) setJournalAnalysisState(progressive.initial.kind === 'unrouted' ? 'failed' : 'ready');
      });
  };

  const { visionRef, rawVisionRef, sceneRef, memoryRef: clarificationRef, committedRef } = usePhotoAnalysisSession({
    analyze, photoUri, sourceId, observedAt,
    onReady: ({ rawVision, vision, scene, memory }) => {
      setState('essence');
      intro.value = withTiming(1, { duration: 460, easing: Easing.out(Easing.cubic) });
      startJournalAnalysis(vision, rawVision);
    },
  });

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
      journalClassification: journalAnalysis,
      journalEnrichment,
    };
    setTimeout(
      () => onCommit(meaning, visionRef.current, label, sceneRef.current, memory?.confirmations ?? [], reviewed, journal),
      740
    );
  };

  const startRouteEnrichment = (route: JournalRouteProposal, analysis = journalAnalysis) => {
    const requestId = ++enrichmentRequestRef.current;
    enrichmentRouteRef.current = route.id;
    setJournalSpecific(route.prefilledSpecific ?? null);
    setJournalEnrichment(null);
    setJournalSpecificLoading(route.id === 'studio.book');
    const vision = visionRef.current;
    if (!vision) {
      setJournalSpecificLoading(false);
      return;
    }
    void enrichPhotoJournalRoute(route, analysis?.visualSubject ?? null, vision, rawVisionRef.current)
      .then((proposal) => {
        if (enrichmentRequestRef.current !== requestId
          || enrichmentRouteRef.current !== route.id
          || proposal?.routeKey !== route.id) return;
        setJournalEnrichment(proposal);
        if (proposal.prefill) setJournalSpecific(proposal.value);
      })
      .catch(() => {})
      .finally(() => {
        if (enrichmentRequestRef.current === requestId && enrichmentRouteRef.current === route.id) {
          setJournalSpecificLoading(false);
        }
      });
  };

  const clearJournalRoute = () => {
    enrichmentRequestRef.current += 1;
    enrichmentRouteRef.current = null;
    setJournalRoute(null);
    setJournalSpecific(null);
    setJournalSpecificLoading(false);
    setJournalEnrichment(null);
  };

  const openJournalRoute = (route: JournalRouteProposal, analysis = journalAnalysis) => {
    journalInteractionLockedRef.current = true;
    setJournalRoute(route);
    setJournalFlowId(route.flowId);
    setJournalPickerOpen(false);
    startRouteEnrichment(route, analysis);
    void Haptics.selectionAsync();
  };

  const applyJournalAnalysis = (analysis: PhotoJournalClassification) => {
    setJournalAnalysis(analysis);
    syncSemanticSnapshot(analysis);
    setTags(buildEssenceTags(rawVisionRef.current, visionRef.current, analysis.semanticFrame));
    setJournalAnalysisState(analysis.kind === 'unrouted' ? 'failed' : 'ready');
    if (analysis.selected) {
      openJournalRoute(analysis.selected, analysis);
    } else if (analysis.reason?.startsWith('foundation_top_level_')) {
      setJournalFlowId(null);
      setJournalPickerOpen(true);
    } else if (analysis.kind === 'flow_only' && analysis.selectedFlowId) {
      setJournalFlowId(analysis.selectedFlowId);
      setJournalPickerOpen(true);
    }
  };

  const syncSemanticSnapshot = (analysis: PhotoJournalClassification) => {
    const frame = analysis.semanticFrame;
    const vision = visionRef.current;
    if (!frame || !vision || frame.stage !== 'foundation_reconciled') return;
    const scene = sceneFromPhotoSemanticFrame(frame);
    sceneRef.current = scene;
    clarificationRef.current = buildPhotoClassifiedMemory({
      sourceId: sourceId ?? photoUri ?? 'capture-preview',
      observedAt: clarificationRef.current?.createdAt ?? observedAt ?? new Date().toISOString(),
      vision,
      rawVision: rawVisionRef.current,
      scene,
      confirmations: clarificationRef.current?.confirmations ?? [],
    });
  };

  const handleJournalCandidate = (candidate: PhotoJournalCandidate) => {
    journalInteractionLockedRef.current = true;
    if (candidate.route) {
      const confirmed = journalAnalysis ? {
        ...journalAnalysis,
        kind: 'exact' as const,
        stage: 'enum_route' as const,
        flowId: candidate.route.flowId,
        categoryId: candidate.route.choiceId,
        selected: candidate.route,
        selectedFlowId: null,
        reason: 'user_confirmed_foundation_category',
        navigationAction: 'open_details' as const,
      } : null;
      if (confirmed) setJournalAnalysis(confirmed);
      openJournalRoute(candidate.route, confirmed);
      return;
    }
    setJournalFlowId(candidate.flowId);
    setJournalPickerOpen(true);
  };

  const handleOrdinaryMoment = () => {
    const route = journalRouteForIds('general', 'ordinary', 1, 'User chose an ordinary moment after automatic classification was unavailable');
    if (route) openJournalRoute(route);
  };

  const handleJournalRouteResolved = (flowId: string, categoryId: string) => {
    const route = journalRouteForIds(flowId, categoryId, 1, 'User selected this photo category');
    if (!route) return;

    // ManualJournalSheet already advances from category -> details itself.
    // Do not close that sheet and mount a second one here: on iOS the outgoing
    // sheet's dismissal can also dismiss the replacement, leaving the user on
    // the photo review. We only adopt the resolved route in the parent so save
    // and OCR enrichment use the category the user selected.
    setJournalRoute(route);
    setJournalFlowId(route.flowId);
    setJournalAnalysis((current) => current ? {
      ...current,
      kind: 'exact',
      stage: 'enum_route',
      flowId: route.flowId,
      categoryId: route.choiceId,
      selected: route,
      selectedFlowId: null,
      reason: 'user_confirmed_manual_category',
      navigationAction: 'open_details',
    } : current);
    startRouteEnrichment(route);
  };

  const handleJournalSave = (submission: ManualJournalSubmission) => {
    const memory = clarificationRef.current;
    if (!memory || state !== 'essence') return;
    const createdAt = new Date().toISOString();
    const reviewedSubmission = reviewPhotoJournalSubmission({ memory, route: journalRoute, submission, createdAt });
    if (!reviewedSubmission) return;
    const { memory: confirmed, specific, choiceLabel, mediaType, reactionLabel } = reviewedSubmission;
    clarificationRef.current = confirmed;
    clearJournalRoute();
    setJournalPickerOpen(false);
    if (mediaType) {
      const priorScene = sceneRef.current;
      sceneRef.current = { memoryDomain: 'media', type: 'media', label: 'An inspiration', detail: specific || choiceLabel, media: { mediaType: mediaType as StudioMediaType, title: specific || null, creator: null }, source: priorScene?.source ?? 'rules', supportingSubjects: priorScene?.supportingSubjects, representation: priorScene?.representation, promptVersion: priorScene?.promptVersion };
    }
    commitMeaning(meaningForJournal(submission.feeling), specific || reactionLabel, submission, confirmed);
  };

  const visibleCandidates = journalAnalysisState === 'ready' || journalAnalysisState === 'failed' || journalAnalysisState === 'refining'
    ? (journalAnalysis?.candidates ?? []).slice(0, 3)
    : [];
  const routingQuestion = journalAnalysisState === 'classifying' || journalAnalysisState === 'waiting'
    ? 'Choosing the right journal section...'
    : journalAnalysisState === 'refining'
      ? 'Refining the result...'
    : journalAnalysisState === 'failed'
      ? journalRoutingFailureMessage(journalAnalysis)
    : !journalAnalysis
    ? 'Choosing the right journal sectionâ€¦'
    : journalAnalysis.reason === 'grounded_semantic_cross_flow_ambiguity'
      ? 'What is this photo mainly about?'
    : journalAnalysis.kind === 'ambiguous'
      ? journalAnalysis.flowId ? 'Which kind fits this photo?' : 'What should this photo remember?'
      : 'Choose the best journal section';

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
                {routingQuestion}
              </ThemedText>
              <View style={styles.meaningGrid}>
                {journalAnalysisState === 'classifying' || journalAnalysisState === 'refining' || journalAnalysisState === 'waiting'
                  ? <ActivityIndicator color={Lantern.ember300} size="small" />
                  : null}
                {visibleCandidates.map((candidate, index) => (
                  <Animated.View key={candidate.id} entering={FadeInDown.delay(280 + index * 50).duration(280)}>
                    <Pressable onPress={() => handleJournalCandidate(candidate)} style={styles.meaningChip} accessibilityRole="button">
                      <IconSymbol name={candidate.icon} size={18} color={Lantern.moon50} /><ThemedText style={styles.meaningLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{candidate.label}</ThemedText>
                    </Pressable>
                  </Animated.View>
                ))}
                {journalAnalysisState === 'failed' ? <Pressable onPress={handleOrdinaryMoment} style={styles.meaningChip} accessibilityRole="button"><IconSymbol name="circle.fill" size={18} color={Lantern.moon50} /><ThemedText style={styles.meaningLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>Something ordinary</ThemedText></Pressable> : null}
                {journalAnalysis ? <Pressable onPress={() => { journalInteractionLockedRef.current = true; setJournalFlowId(journalAnalysis.flowId); setJournalPickerOpen(true); }} style={styles.meaningChip} accessibilityRole="button"><IconSymbol name={journalAnalysisState === 'failed' ? 'square.and.pencil' : 'plus'} size={18} color={Lantern.moon50} /><ThemedText style={styles.meaningLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{journalAnalysisState === 'failed' ? 'Classify manually' : 'Something else'}</ThemedText></Pressable> : null}
              </View>
            </Animated.View>
          ) : null}
        </ScrollView>
      ) : null}

      {state === 'essence' && journalRoute && !journalPickerOpen ? (
        <ManualJournalSheet
          initialFlowId={journalRoute.flowId}
          initialChoiceId={journalRoute.choiceId}
          initialSpecific={journalSpecific}
          liveSpecific={journalSpecific}
          liveSpecificLoading={journalSpecificLoading}
          initialConfirmedFacets={journalRoute.confirmedFacets}
          sourceType="photo"
          sourceId={sourceId ?? photoUri}
          thumbnailUri={photoUri}
          onRouteResolved={handleJournalRouteResolved}
          onBackFromInitial={clearJournalRoute}
          onClose={onClose}
          onSave={handleJournalSave}
        />
      ) : null}
      {state === 'essence' && journalPickerOpen ? <ManualJournalSheet initialFlowId={journalFlowId} suggestedRoutes={journalAnalysis?.candidates.flatMap((candidate) => candidate.route ? [candidate.route] : [])} sourceType="photo" sourceId={sourceId ?? photoUri} thumbnailUri={photoUri} liveSpecific={journalSpecific} liveSpecificLoading={journalSpecificLoading} onRouteResolved={handleJournalRouteResolved} onBackFromInitial={() => setJournalPickerOpen(false)} onClose={onClose} onSave={handleJournalSave} /> : null}
    </View>
  );
}

function meaningForJournal(reaction: string | null | undefined): MeaningTag {
  if (reaction && ['loved', 'liked', 'close', 'grateful', 'fun', 'joyful', 'tender', 'affectionate', 'funny'].includes(reaction)) return 'together';
  if (reaction && ['inspired', 'proud', 'difficult', 'worried', 'lonely'].includes(reaction)) return 'meaningful';
  if (reaction && ['exciting', 'productive', 'free'].includes(reaction)) return 'energy';
  return 'calm';
}

function journalRoutingFailureMessage(analysis: PhotoJournalClassification | null): string {
  void analysis;
  return "We couldn't auto-classify this";
}

// The photo's essence = what the on-device vision read in it, as tags the user
// can watch being captured into the day.
function buildEssenceTags(
  rawVision: PhotoVisionResult | null,
  vision: DayVisionSummary | null,
  semanticFrame?: PhotoSemanticFrame | null
): EssenceTag[] {
  const tags: EssenceTag[] = [];
  if (vision && vision.maxFaceCount >= 2) {
    tags.push({ id: 'together', label: 'Together', accent: '#F2C2A8' });
  }
  // The semantic frame has already ranked and bounded the visible Essence set.
  // Render those selected keys directly so a second UI confidence threshold
  // cannot turn Book + Document + Sign into a misleading single Sign chip.
  const semanticNames = semanticFrame?.primaryEvidenceKeys
    .map((key) => semanticFrame.hypotheses.find((item) => item.conceptKey === key)?.label ?? null)
    .filter((label): label is string => !!label)
    .slice(0, 4) ?? [];
  const names = semanticNames.length ? semanticNames : vision ? photoJournalEssenceLabels(buildPhotoJournalEvidence(vision, rawVision), 4) : [];
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
