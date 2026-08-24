import { Image, type ImageRef } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { memo, type RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type ImageSourcePropType, type LayoutChangeEvent, type View as ViewType } from 'react-native';
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  LinearTransition,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';
import { EGG_FEED_PAYOUT_DURATION_MS } from '@/components/katchadeck/home/egg-feed-overlay';
import { TodayTopHud } from '@/components/katchadeck/home/today-top-hud';
import { MicrocopyToast } from '@/components/katchadeck/home/microcopy-toast';
import { TodayExplorationBackground } from '@/components/katchadeck/home/today-exploration-background';
import { TODAY_DORMANT_ZZZ_TOP_OFFSET, TodayDormantEggIndicator, TodayKingdomEggHero } from '@/components/katchadeck/home/today-kingdom-egg-hero';
import { WorldActionStack } from '@/components/katchadeck/world/world-action-stack';
import { CompanionGoalPortrait } from '@/components/katchadeck/goals/goal-task-row';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { DayActionCardSurface } from '@/components/katchadeck/ui/day-action-card';
import { DayActionGoalRow } from '@/components/katchadeck/ui/day-action-goal-row';
import { DayActionActiveRow, DayActionCompletedRow, DayActionSwipeShell, useDayActionStackPresentation } from '@/components/katchadeck/ui/day-action-row';
import { AnimatedIntegerText } from '@/components/katchadeck/ui/animated-integer-text';
import {
  MOOD_ART,
  MOOD_CHOICES,
  type MoodMonumentChoiceId,
} from '@/components/katchadeck/world/mood-monument-sheet';
import { SLEEP_ART, SLEEP_OPTIONS } from '@/components/katchadeck/world/sleep-sheet';
import { CelebrationParticles } from '@/components/katchadeck/world/companion-achievement-celebration';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { AppFontFamilies, KatchaDeckUI } from '@/constants/theme';
import {
  homeTabBarHeight,
  HOME_ACTIONS_TAB_BAR_GAP,
  HOME_ACTIONS_Y_OFFSET,
  HOME_EGG_ACTIONS_GAP,
  HOME_FTUE_CAMERA_SCALE,
  HOME_FTUE_CAMERA_Y_OFFSET,
  HOME_SCENE_Y_OFFSET,
} from '@/constants/home-loop-layout';
import { Meadow } from '@/constants/meadow-theme';
import { todayCareArt } from '@/constants/today-care-art';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import { DASHBOARD_STAT_ART, MANUAL_JOURNAL_ART } from '@/constants/journal-art-sources';
import { GameRewardChip, GameSurface } from '@/components/katchadeck/ui/game-surface';
import { runRewardIconArrivalPulse } from '@/components/katchadeck/ui/reward-arrival-motion';
import type { HomeDayRecord, HomeTimelineDay, SleepQuality } from '@/types/home';
import type { SceneVariantId } from '@/types/scene';
import type { HomeArchetypeId } from '@/types/world-identity';
import type { WispId } from '@/types/wisp';
import type { RankedTodayCareAction } from '@/utils/today-care';
import type { TodayGrowthSummary } from '@/utils/today-growth';
import type { CompanionQuickGoalCompletionReceipt } from '@/hooks/use-companion-quick-goals';
import {
  TodayEnvironmentViewportMotionLayer,
  useTodayEnvironmentMotionValues,
} from '@/components/katchadeck/home/today-environment-motion';
import {
  todayExplorationEggStageFrame,
  TODAY_EXPLORATION_HERO_STAGE_TOP_AFTER_SAFE_AREA,
  TODAY_KINGDOM_STAGE_HEIGHT,
} from '@/utils/today-kingdom-hero-layout';
import { useTodayEnergyFeedback } from '@/features/today/today-energy-feedback';
import { eggAvatarCustomizerCamera } from '@/utils/egg-avatar-customizer-camera';
import { ScriptedActionList } from '@/components/katchadeck/onboarding/scripted-action-list';
import { FtueGuideCopy } from '@/components/katchadeck/onboarding/ftue-guide-copy';
import type { FtueActionDefinition, FtueChoiceOption } from '@/features/onboarding/ftue-types';
import { clampFtueCameraPanToCoverage } from '@/features/onboarding/ftue-home-camera';
import type { TodayHatchPresentation } from '@/utils/today-hatch-presentation';
import type { YesterdayStepEnergyOffer } from '@/utils/merge-world/economy-policy';
import { CompanionJourneyHookCard } from '@/components/katchadeck/home/companion-journey-hook-card';
import type { MossproutJourneyHandoffViewModel } from '@/game/katchimeras/mossprout-journey-handoff';

type TodayNurtureExperienceProps = {
  actionListLocked: boolean;
  actionListHidden?: boolean;
  actionTransitionActive: boolean;
  actions: RankedTodayCareAction[];
  completionEvent: TodayCareCompletionEvent | null;
  day: HomeDayRecord;
  companionWispId?: WispId | null;
  companionJourneyHook?: MossproutJourneyHandoffViewModel | null;
  feedbackKey: number;
  feedExpressionKey?: number;
  focusMode?: boolean;
  hatchReadyFocus?: boolean;
  hatchReadyLabel?: string;
  growth: TodayGrowthSummary;
  homeArchetypeId?: HomeArchetypeId | null;
  microcopy: string | null;
  onAddJournal: () => void;
  onAddPhoto: () => void;
  onAddTextNote: () => void;
  onCareNotToday: (action: RankedTodayCareAction) => void;
  onCareStart: (action: RankedTodayCareAction, rewardFrom: FeedSourceRect) => void;
  onCompleteQuickGoal: (goalId: string) => CompanionQuickGoalCompletionReceipt;
  onCompletionAnimationEnd: (eventId: string, onHandoff?: () => void) => void;
  onOpenQuickGoal: (goalId: string, completeFromOrigin: () => void) => void;
  onOpenCompanionJourney?: () => void;
  onChooseMood: (choiceId: MoodMonumentChoiceId, label: string, from: FeedSourceRect, imageSource: number, accent: string, currencyFrom: FeedSourceRect) => void;
  onChooseSleep: (quality: SleepQuality, label: string, from: FeedSourceRect, imageSource: number, accent: string, currencyFrom: FeedSourceRect) => void;
  onReveal: () => void;
  onRewardFlight: (from: FeedSourceRect, action: RankedTodayCareAction, onArrive: () => void) => void;
  onSelectDay: (dayId: string) => void;
  careSwipeExternalGesture: GestureType;
  environmentGesture: GestureType;
  sceneTranslateX: SharedValue<number>;
  sceneId: SceneVariantId;
  topInset: number;
  bottomInset: number;
  timelineDays: HomeTimelineDay[];
  eggTargetRef: RefObject<View | null>;
  energyHudPulseNonce?: number;
  energyHudTargetRef?: RefObject<View | null>;
  energyHudValueOverride?: number | null;
  onboardingGuide?: {
    eyebrow: string;
    title: string;
    body: string;
  } | null;
  onboardingCameraDurationMs?: number;
  onboardingCameraPanY?: number;
  onboardingFocus?: boolean;
  newDayIntro?: boolean;
  onboardingTopHudVisible?: boolean;
  onboardingUiVisible?: boolean;
  hatchPresentation?: TodayHatchPresentation | null;
  onHatchAssetsReady?: () => void;
  onHatchAssetsError?: () => void;
  scriptedActions?: readonly FtueActionDefinition[];
  scriptedPanelCareAction?: RankedTodayCareAction | null;
  onScriptedAction?: (action: FtueActionDefinition, from: FeedSourceRect) => void;
  onScriptedChoice?: (action: FtueActionDefinition, option: FtueChoiceOption, from: FeedSourceRect, currencyFrom?: FeedSourceRect) => void;
  scriptedChoiceCompletionNonce?: number;
  scriptedStepCount?: number | null;
  scriptedStepEnergy?: number | null;
  onScriptedChoiceFinished?: () => void;
  yesterdayStepEnergyOffer?: YesterdayStepEnergyOffer | null;
  yesterdayStepEnergyBusy?: boolean;
  yesterdayStepEnergyCompletionKey?: string | null;
  yesterdayStepEnergyDisplayedSteps?: number | null;
  onConvertYesterdaySteps?: (from: FeedSourceRect) => void;
  onYesterdayStepEnergyPanelFinished: (completionKey: string) => void;
};

export type TodayCareCompletionEvent = {
  id: string;
  action: RankedTodayCareAction;
  rewardAlreadyAnimated?: boolean;
};

type CheckInSelection = {
  accent: string;
  action: RankedTodayCareAction;
  id: string;
  image: number;
  kind: 'mood' | 'scripted' | 'sleep';
  label: string;
};

const DAILY_HATCH_SHAKE_CAMERA_SCALE = 1.04;
const DAILY_HATCH_REVEAL_CAMERA_SCALE = 1.085;

export const TodayNurtureExperience = memo(function TodayNurtureExperience({
  actionListLocked,
  actionListHidden = false,
  actionTransitionActive,
  actions,
  bottomInset,
  completionEvent,
  companionWispId,
  companionJourneyHook = null,
  day,
  eggTargetRef,
  energyHudPulseNonce,
  energyHudTargetRef,
  energyHudValueOverride = null,
  feedbackKey,
  feedExpressionKey,
  focusMode = false,
  hatchReadyFocus = false,
  hatchReadyLabel = 'Reveal Yesterday',
  growth,
  homeArchetypeId,
  microcopy,
  onAddJournal,
  onAddPhoto,
  onAddTextNote,
  onCareNotToday,
  onCareStart,
  onCompleteQuickGoal,
  onCompletionAnimationEnd,
  onOpenQuickGoal,
  onOpenCompanionJourney,
  onChooseMood,
  onChooseSleep,
  onReveal,
  onRewardFlight,
  onSelectDay,
  onboardingCameraDurationMs = 360,
  onboardingCameraPanY = 0,
  onboardingGuide = null,
  onboardingFocus = false,
  newDayIntro = false,
  onboardingTopHudVisible = false,
  onboardingUiVisible = true,
  hatchPresentation = null,
  onHatchAssetsReady,
  onHatchAssetsError,
  scriptedActions = [],
  scriptedPanelCareAction = null,
  onScriptedAction,
  onScriptedChoice,
  scriptedChoiceCompletionNonce = 0,
  scriptedStepCount = null,
  scriptedStepEnergy = null,
  onScriptedChoiceFinished,
  yesterdayStepEnergyOffer = null,
  yesterdayStepEnergyBusy = false,
  yesterdayStepEnergyCompletionKey = null,
  yesterdayStepEnergyDisplayedSteps = null,
  onConvertYesterdaySteps,
  onYesterdayStepEnergyPanelFinished,
  careSwipeExternalGesture,
  environmentGesture,
  sceneTranslateX,
  sceneId,
  timelineDays,
  topInset,
}: TodayNurtureExperienceProps) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [actionContentHeight, setActionContentHeight] = useState(0);
  const [scriptedMoodSelection, setScriptedMoodSelection] = useState<CheckInSelection | null>(null);
  const [scriptedMoodCompletion, setScriptedMoodCompletion] = useState<TodayCareCompletionEvent | null>(null);
  const [scriptedTextSelection, setScriptedTextSelection] = useState<CheckInSelection | null>(null);
  const [scriptedTextCompletion, setScriptedTextCompletion] = useState<TodayCareCompletionEvent | null>(null);
  const [scriptedRouteSelection, setScriptedRouteSelection] = useState<CheckInSelection | null>(null);
  const scriptedMoodSourceRef = useRef<ViewType | null>(null);
  const pendingActionContentHeightRef = useRef(0);
  const actionStackRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionStackRevealFrameRef = useRef<number | null>(null);
  const actionStackRevealedRef = useRef(false);
  const [actionStackInteractive, setActionStackInteractive] = useState(false);
  const [fixedActionClusterHeight, setFixedActionClusterHeight] = useState(0);
  const [checkInSelection, setCheckInSelection] = useState<CheckInSelection | null>(null);
  const [checkInSlotHeight, setCheckInSlotHeight] = useState(0);
  const [preloadedSleepArt, setPreloadedSleepArt] = useState<Partial<Record<SleepQuality, ImageRef>>>({});
  const checkInSelectionRef = useRef<CheckInSelection | null>(null);
  const reduceMotion = useReducedMotion();
  const actionStackOpacity = useSharedValue(0);
  const actionStackTranslateY = useSharedValue(reduceMotion ? 0 : 22);
  const focusProgress = useSharedValue(focusMode ? 1 : 0);
  const onboardingCameraProgress = useSharedValue(onboardingFocus ? 1 : 0);
  const newDayEggEntry = useSharedValue(newDayIntro ? 0 : 1);
  const hatchCameraScale = useSharedValue(1);
  const onboardingCameraPanTranslateY = useSharedValue(0);
  const environmentMotion = useTodayEnvironmentMotionValues();
  const dailyHatchPhase = hatchPresentation?.policy === 'daily' ? hatchPresentation.phase : 'idle';
  const ready = day.canHatch || growth.isReady;
  const quietDayAvailable = false;
  const scriptedMoodAction = scriptedActions.length === 1 && scriptedActions[0]?.promptKind === 'feeling'
    ? scriptedActions[0]
    : null;
  const scriptedTextChoiceAction = scriptedActions.length === 1
    && scriptedActions[0]?.presentation === 'inline_choice'
    && scriptedActions[0]?.promptKind !== 'feeling'
      ? scriptedActions[0]
      : null;
  const scriptedRouteChoiceActions = scriptedActions.filter((action) => action.presentation === 'route_action');
  const scriptedTextActionInstanceId = scriptedTextChoiceAction
    ? `${day.isoDate}:${scriptedTextChoiceAction.id}`
    : null;
  const currentScriptedTextSelection = scriptedTextSelection?.action.instanceId === scriptedTextActionInstanceId
    ? scriptedTextSelection
    : null;
  const currentScriptedTextCompletion = scriptedTextCompletion?.action.instanceId === scriptedTextActionInstanceId
    ? scriptedTextCompletion
    : null;
  const scriptedRowActions = scriptedActions.filter((action) => action.presentation !== 'inline_choice' && action.presentation !== 'route_action');
  const moodAction = actions.find((action) => action.id === 'mood');
  const sleepAction = actions.find((action) => action.id === 'sleep');
  useEffect(() => {
    setScriptedMoodSelection(null);
    setScriptedMoodCompletion(null);
  }, [scriptedMoodAction?.id]);
  useEffect(() => {
    setScriptedTextSelection(null);
    setScriptedTextCompletion(null);
  }, [scriptedTextChoiceAction?.id]);
  const scriptedRouteActionKey = scriptedRouteChoiceActions.map((action) => action.id).join(':');
  useEffect(() => setScriptedRouteSelection(null), [scriptedRouteActionKey]);
  useEffect(() => {
    if (
      scriptedTextChoiceAction?.id !== 'energy.steps_context'
      || scriptedChoiceCompletionNonce <= 0
      || !currentScriptedTextSelection
    ) return;
    setScriptedTextCompletion({
      action: currentScriptedTextSelection.action,
      id: `ftue:steps:${scriptedChoiceCompletionNonce}`,
    });
  }, [currentScriptedTextSelection, scriptedChoiceCompletionNonce, scriptedTextChoiceAction?.id]);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const retainedRefs: ImageRef[] = [];
    const task = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => {
        void Promise.all(SLEEP_OPTIONS.map(async (option) => {
          try {
            const imageRef = await Image.loadAsync(SLEEP_ART[option.quality], {
              maxHeight: 96,
              maxWidth: 96,
            });
            if (!active) {
              imageRef.release();
              return null;
            }
            retainedRefs.push(imageRef);
            return [option.quality, imageRef] as const;
          } catch {
            return null;
          }
        })).then((entries) => {
          if (!active) return;
          const nextArt: Partial<Record<SleepQuality, ImageRef>> = {};
          entries.forEach((entry) => {
            if (entry) nextArt[entry[0]] = entry[1];
          });
          setPreloadedSleepArt(nextArt);
        });
      }, 250);
    });
    return () => {
      active = false;
      task.cancel();
      if (timer) clearTimeout(timer);
      retainedRefs.forEach((imageRef) => imageRef.release());
    };
  }, []);
  // Keep the completed check-in mounted until its own exit finishes. The next
  // sequential check-in may already be active in state, but mounting both at
  // once makes the incoming panel reflow twice as the outgoing panel leaves.
  const displayedMoodAction = checkInSelection
    ? checkInSelection.kind === 'mood' ? checkInSelection.action : undefined
    : moodAction;
  const displayedSleepAction = checkInSelection
    ? checkInSelection.kind === 'sleep' ? checkInSelection.action : undefined
    : sleepAction;
  const stepEnergyGateActive = Boolean(yesterdayStepEnergyOffer && onConvertYesterdaySteps);
  const primaryActionGateActive = stepEnergyGateActive
    || displayedMoodAction != null
    || displayedSleepAction != null;
  const remainingActions = actions.filter((action) => action.id !== 'mood' && action.id !== 'sleep');
  const completionIsCheckIn = completionEvent?.action.category === 'check_in';
  const completionIsStandard = completionEvent != null
    && completionEvent.action.category !== 'check_in'
    && completionEvent.action.destination.kind !== 'quick_goal';
  const checkInTransitionActive = checkInSelection != null
    || (completionIsCheckIn && completionEvent != null);
  const standardActionStack = useDayActionStackPresentation({
    frozen: actionListLocked || completionIsStandard || checkInTransitionActive,
    getId: (action: RankedTodayCareAction) => action.instanceId,
    items: remainingActions,
  });
  const displayedStandardRows = completionIsStandard && completionEvent
    ? standardActionStack.presentedItems.map((action) => action.instanceId === completionEvent.action.instanceId
      ? { event: completionEvent, kind: 'completed' as const }
      : { action, kind: 'active' as const })
    : standardActionStack.presentedItems.map((action) => ({ action, kind: 'active' as const }));
  const stageTop = topInset + TODAY_EXPLORATION_HERO_STAGE_TOP_AFTER_SAFE_AREA;
  const sceneVerticalNudge = HOME_SCENE_Y_OFFSET;
  const contentVerticalNudge = HOME_ACTIONS_Y_OFFSET;
  // With its tab bar hidden, the authored opening can use the same centered
  // vertical composition as a settled hatched day. The normal forming camera
  // stays lifted to reserve room for its persistent action/navigation dock.
  const sceneLift = onboardingFocus ? HOME_SCENE_Y_OFFSET : -100 + sceneVerticalNudge;
  const tabBarHeight = homeTabBarHeight(bottomInset);
  const actionDockBottom = onboardingFocus
    ? bottomInset + HOME_ACTIONS_TAB_BAR_GAP
    : tabBarHeight + HOME_ACTIONS_TAB_BAR_GAP;
  const tabBarTop = windowHeight - tabBarHeight;
  const explorationEggFrame = todayExplorationEggStageFrame(
    windowWidth,
    windowHeight,
    stageTop,
  );
  const sceneImageSize = Math.max(windowHeight, windowWidth);
  const eggVisualTop = stageTop + sceneLift + explorationEggFrame.top;
  // The compact cluster is 63px tall at full size; this leaves an 18px
  // world-space buffer before the egg's measured visual top.
  const growthMeterTop = eggVisualTop - 81;
  const scenePinchFocusY = stageTop + sceneLift + explorationEggFrame.centerY;
  const onboardingEggSleeping = Boolean(onboardingFocus && scriptedMoodAction && !scriptedMoodSelection);
  // A fresh regular Today Egg begins in the same dormant visual state as the
  // Discovery Egg. The first real-life action owns the wake-up: its feed
  // expression plays immediately, then its persisted Growth receipt keeps the
  // equipped face active across remounts.
  const regularEggSleeping = Boolean(!onboardingFocus && growth.energyRatio <= 0);
  const eggSleeping = onboardingEggSleeping || regularEggSleeping;
  const onboardingZzzTopBeforeCamera = stageTop
    + sceneLift
    + explorationEggFrame.top
    + TODAY_DORMANT_ZZZ_TOP_OFFSET * explorationEggFrame.scale;
  // The FTUE sleep marker lives outside the zoomed scene so native text stays
  // sharp. Map only its anchor into the camera's final screen coordinates.
  const onboardingZzzTop = windowHeight / 2
    + (onboardingZzzTopBeforeCamera - windowHeight / 2) * HOME_FTUE_CAMERA_SCALE
    + HOME_FTUE_CAMERA_Y_OFFSET
    + onboardingCameraPanY;
  const customizerCamera = useMemo(() => eggAvatarCustomizerCamera({
    bottomInset,
    subjectCenterY: scenePinchFocusY,
    topInset,
    viewportHeight: windowHeight,
  }), [bottomInset, scenePinchFocusY, topInset, windowHeight]);
  const fixedActionClusterTop = explorationEggFrame.contactY + sceneLift + HOME_EGG_ACTIONS_GAP;
  const basePanelStart = Math.max(316, windowHeight * 0.465) + contentVerticalNudge;
  const minimumPanelStart = fixedActionClusterHeight === 0
    ? basePanelStart
    : Math.max(basePanelStart, fixedActionClusterTop + fixedActionClusterHeight + 8);
  const anchoredPanelStart = tabBarTop - HOME_ACTIONS_TAB_BAR_GAP - actionContentHeight;
  const panelStart = actionContentHeight > 0
    ? Math.max(minimumPanelStart, anchoredPanelStart)
    : minimumPanelStart;
  const sceneSpacerHeight = Math.max(240, panelStart - topInset - 8);
  const nurtureToastTop = fixedActionClusterTop
    + Math.max(fixedActionClusterHeight, NURTURE_ACTION_CLUSTER_FALLBACK_HEIGHT)
    + NURTURE_TOAST_TOP_GAP;
  const actionHandoffLayout = useMemo(
    () => reduceMotion
      ? undefined
      : LinearTransition.duration(300).easing(Easing.inOut(Easing.cubic)),
    [reduceMotion],
  );
  const actionScrollGesture = useMemo(
    () => Gesture.Native().simultaneousWithExternalGesture(
      careSwipeExternalGesture,
      environmentGesture,
    ),
    [careSwipeExternalGesture, environmentGesture],
  );
  useEffect(() => {
    focusProgress.value = reduceMotion
      ? focusMode ? 1 : 0
      : withTiming(focusMode ? 1 : 0, {
          duration: 360,
          easing: Easing.inOut(Easing.cubic),
        });
  }, [focusMode, focusProgress, reduceMotion]);
  useLayoutEffect(() => {
    cancelAnimation(newDayEggEntry);
    if (!newDayIntro) {
      newDayEggEntry.value = 1;
      return;
    }
    newDayEggEntry.value = 0;
    newDayEggEntry.value = withDelay(
      reduceMotion ? 1 : 90,
      withTiming(1, { duration: reduceMotion ? 120 : 820, easing: Easing.out(Easing.cubic) }),
    );
  }, [newDayEggEntry, newDayIntro, reduceMotion]);
  useEffect(() => {
    cancelAnimation(hatchCameraScale);
    if (reduceMotion) {
      hatchCameraScale.value = 1;
      return;
    }
    if (dailyHatchPhase === 'shaking') {
      hatchCameraScale.value = withTiming(DAILY_HATCH_SHAKE_CAMERA_SCALE, {
        duration: 460,
        easing: Easing.inOut(Easing.cubic),
      });
      return;
    }
    if (dailyHatchPhase === 'cracking') {
      hatchCameraScale.value = withTiming(DAILY_HATCH_REVEAL_CAMERA_SCALE, {
        duration: 550,
        easing: Easing.inOut(Easing.cubic),
      });
      return;
    }
    if (dailyHatchPhase === 'crossfading_subject' || dailyHatchPhase === 'subject_settling') {
      hatchCameraScale.value = withTiming(DAILY_HATCH_REVEAL_CAMERA_SCALE, {
        duration: 100,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }
    hatchCameraScale.value = withTiming(1, {
      duration: dailyHatchPhase === 'forming_card' ? 420 : 180,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [dailyHatchPhase, hatchCameraScale, reduceMotion]);
  useEffect(() => {
    onboardingCameraProgress.value = reduceMotion
      ? onboardingFocus ? 1 : 0
      : withTiming(onboardingFocus ? 1 : 0, {
          duration: 360,
          easing: Easing.inOut(Easing.cubic),
        });
  }, [onboardingCameraProgress, onboardingFocus, reduceMotion]);
  useEffect(() => {
    cancelAnimation(onboardingCameraPanTranslateY);
    onboardingCameraPanTranslateY.value = reduceMotion
      ? onboardingCameraPanY
      : withTiming(onboardingCameraPanY, {
          duration: onboardingCameraDurationMs,
          easing: Easing.inOut(Easing.cubic),
        });
  }, [onboardingCameraDurationMs, onboardingCameraPanTranslateY, onboardingCameraPanY, reduceMotion]);
  const clampedOnboardingCameraPanY = useDerivedValue(() => {
    // Coverage correction belongs exclusively to the authored FTUE camera.
    // Applying it to a player pinch makes the lifted normal scene jump
    // vertically until its bottom edge happens to cover the viewport.
    if (onboardingCameraProgress.value <= 0) return 0;
    const pinchScale = (environmentMotion?.pinchScale.value ?? 1) * hatchCameraScale.value;
    const focusScale = 1 + (customizerCamera.scale - 1) * focusProgress.value;
    const onboardingScale = 1 + (HOME_FTUE_CAMERA_SCALE - 1) * onboardingCameraProgress.value;
    const outerScale = focusScale * onboardingScale;
    const outerTranslateY = customizerCamera.translateY * focusProgress.value
      + HOME_FTUE_CAMERA_Y_OFFSET * onboardingCameraProgress.value;
    const imageTop = (windowHeight - sceneImageSize) / 2 + sceneLift;
    const imageBottom = imageTop + sceneImageSize;
    const pinchedTop = scenePinchFocusY + (imageTop - scenePinchFocusY) * pinchScale;
    const pinchedBottom = scenePinchFocusY + (imageBottom - scenePinchFocusY) * pinchScale;
    const projectedTop = windowHeight / 2
      + (pinchedTop - windowHeight / 2) * outerScale
      + outerTranslateY;
    const projectedBottom = windowHeight / 2
      + (pinchedBottom - windowHeight / 2) * outerScale
      + outerTranslateY;
    return clampFtueCameraPanToCoverage({
      edgeBleed: FTUE_CAMERA_COVERAGE_BLEED,
      projectedBottom,
      projectedTop,
      requestedPanY: onboardingCameraPanTranslateY.value,
      viewportHeight: windowHeight,
    });
  });
  const focusSceneStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: customizerCamera.translateY * focusProgress.value
          + HOME_FTUE_CAMERA_Y_OFFSET * onboardingCameraProgress.value
          + clampedOnboardingCameraPanY.value,
      },
      {
        scale: (1 + (customizerCamera.scale - 1) * focusProgress.value)
          * (1 + (HOME_FTUE_CAMERA_SCALE - 1) * onboardingCameraProgress.value),
      },
    ],
  }));
  const projectedEggCameraScale = useDerivedValue(() => {
    const focusScale = 1 + (customizerCamera.scale - 1) * focusProgress.value;
    const onboardingScale = 1 + (HOME_FTUE_CAMERA_SCALE - 1) * onboardingCameraProgress.value;
    return (environmentMotion?.pinchScale.value ?? 1)
      * hatchCameraScale.value
      * focusScale
      * onboardingScale;
  });
  const projectedEggStageStyle = useAnimatedStyle(() => {
    const focusScale = 1 + (customizerCamera.scale - 1) * focusProgress.value;
    const onboardingScale = 1 + (HOME_FTUE_CAMERA_SCALE - 1) * onboardingCameraProgress.value;
    const outerScale = focusScale * onboardingScale;
    const pinchScale = (environmentMotion?.pinchScale.value ?? 1) * hatchCameraScale.value;
    const outerTranslateY = customizerCamera.translateY * focusProgress.value
      + HOME_FTUE_CAMERA_Y_OFFSET * onboardingCameraProgress.value
      + clampedOnboardingCameraPanY.value;
    // Project the bottom-centre of the Egg image through the exact same camera
    // transforms as the environment. The detached high-resolution plane stays
    // crisp while this world anchor remains planted during every zoom level.
    const baseEggBottomY = stageTop
      + sceneLift
      + explorationEggFrame.top
      + explorationEggFrame.height;
    const pinchedEggBottomY = scenePinchFocusY
      + (baseEggBottomY - scenePinchFocusY) * pinchScale;
    const projectedEggBottomY = windowHeight / 2
      + (pinchedEggBottomY - windowHeight / 2) * outerScale
      + outerTranslateY;
    return {
      opacity: newDayEggEntry.value,
      transform: [
        {
          translateX: sceneTranslateX.value
            * pinchScale
            * outerScale,
        },
        { translateY: projectedEggBottomY - baseEggBottomY },
      ],
    };
  });
  const actionStackRevealStyle = useAnimatedStyle(() => ({
    opacity: actionStackOpacity.value,
    transform: [{ translateY: actionStackTranslateY.value }],
  }));
  const scheduleActionStackReveal = useCallback(() => {
    if (actionStackRevealedRef.current) return;
    if (actionStackRevealTimerRef.current) clearTimeout(actionStackRevealTimerRef.current);
    actionStackRevealTimerRef.current = setTimeout(() => {
      actionStackRevealTimerRef.current = null;
      actionStackRevealFrameRef.current = requestAnimationFrame(() => {
        actionStackRevealFrameRef.current = requestAnimationFrame(() => {
          actionStackRevealFrameRef.current = null;
          if (actionStackRevealedRef.current) return;
          actionStackRevealedRef.current = true;
          setActionStackInteractive(true);
          actionStackOpacity.value = withTiming(1, {
            duration: reduceMotion ? 100 : 360,
            easing: Easing.out(Easing.cubic),
          });
          actionStackTranslateY.value = withTiming(0, {
            duration: reduceMotion ? 100 : 360,
            easing: Easing.out(Easing.cubic),
          });
        });
      });
    }, reduceMotion ? 100 : INITIAL_ACTION_STACK_SETTLE_MS);
  }, [actionStackOpacity, actionStackTranslateY, reduceMotion]);
  const handleActionContentLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    pendingActionContentHeightRef.current = nextHeight;
    if (nextHeight > 0 && !actionStackRevealedRef.current) scheduleActionStackReveal();
    if (actionTransitionActive) return;
    setActionContentHeight((current) => Math.abs(current - nextHeight) < 0.5 ? current : nextHeight);
  }, [actionTransitionActive, scheduleActionStackReveal]);
  useEffect(() => () => {
    if (actionStackRevealTimerRef.current) clearTimeout(actionStackRevealTimerRef.current);
    if (actionStackRevealFrameRef.current != null) cancelAnimationFrame(actionStackRevealFrameRef.current);
  }, []);
  useEffect(() => {
    if (actionTransitionActive) return;
    const nextHeight = pendingActionContentHeightRef.current;
    if (nextHeight <= 0) return;
    setActionContentHeight((current) => Math.abs(current - nextHeight) < 0.5 ? current : nextHeight);
  }, [actionTransitionActive]);
  const handleFixedActionClusterLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    setFixedActionClusterHeight((current) => Math.abs(current - nextHeight) < 0.5 ? current : nextHeight);
  }, []);
  const beginCheckInSelection = useCallback((selection: CheckInSelection, from: FeedSourceRect, currencyFrom: FeedSourceRect) => {
    if (checkInSelectionRef.current) return;
    checkInSelectionRef.current = selection;
    setCheckInSelection(selection);
    // The panel response, selected mood/sleep icon, and energy burst all begin
    // from the same tap. FeedPayout mounts the source mote and coins together.
    if (selection.kind === 'mood') {
      onChooseMood(selection.id as MoodMonumentChoiceId, selection.label, from, selection.image, selection.accent, currencyFrom);
    } else {
      onChooseSleep(selection.id as SleepQuality, selection.label, from, selection.image, selection.accent, currencyFrom);
    }
  }, [onChooseMood, onChooseSleep]);
  const finishCheckInSelection = useCallback((eventId: string) => {
    // The loop controller reserves the next compositor frame for the incoming
    // action. Release the outgoing check-in inside that handoff so clearing the
    // completion and mounting Sleep are one React commit, not adjacent commits.
    onCompletionAnimationEnd(eventId, () => {
      checkInSelectionRef.current = null;
      setCheckInSelection(null);
    });
  }, [onCompletionAnimationEnd]);
  const handleCheckInGroupLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    // Mood uses two rows while Sleep uses one. Retain the largest live slot for
    // the sequential check-in so the incoming card can anchor to the same
    // bottom edge instead of inheriting a one-frame parent reflow.
    setCheckInSlotHeight((current) => nextHeight > current + 0.5 ? nextHeight : current);
  }, []);
  useEffect(() => {
    if (displayedMoodAction || displayedSleepAction || checkInTransitionActive) return;
    setCheckInSlotHeight(0);
  }, [checkInTransitionActive, displayedMoodAction, displayedSleepAction]);

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.focusSceneViewport}>
        <Animated.View style={[styles.focusSceneCamera, focusSceneStyle]}>
          <TodayEnvironmentViewportMotionLayer
            additionalScale={hatchCameraScale}
            focusY={scenePinchFocusY}
            viewportHeight={windowHeight}>
            <TodayExplorationBackground
              backgroundKey={sceneId}
              imageSize={sceneImageSize}
              translateX={sceneTranslateX}
              verticalOffset={sceneLift}
            />
          </TodayEnvironmentViewportMotionLayer>
        </Animated.View>
      </View>
      <Animated.View
        pointerEvents="box-none"
        style={[styles.eggStage, { top: stageTop + sceneLift }, projectedEggStageStyle]}>
        {newDayIntro ? (
          <CelebrationParticles
            layerStyle={[styles.newDayConfetti, { top: explorationEggFrame.centerY }]}
            tier={2}
            tint="#E4B34B"
          />
        ) : null}
        <TodayKingdomEggHero
          accentColor={day.egg.accentColor}
          companionWispId={hatchPresentation ? null : companionWispId}
          coreColor={day.egg.coreColor}
          deferGrowthUntilEnergyArrival
          discoveryHatch={hatchPresentation}
          explorationStageTop={stageTop}
          feedbackKey={feedbackKey}
          feedExpressionKey={feedExpressionKey}
          forceSleeping={eggSleeping}
          growthProgress={growth.energyRatio}
          growthStage={growth.stage}
          hideKingdomEnvironmentArt
          homeArchetypeId={homeArchetypeId}
          isActivated={growth.isActivated}
          isReady={hatchPresentation ? false : hatchReadyFocus || ready}
          onDiscoveryCreatureError={onHatchAssetsError}
          onDiscoveryCreatureReady={onHatchAssetsReady}
          pinchStrength={0}
          projectedCameraScale={projectedEggCameraScale}
          showDormantIndicator={false}
          showForcedSleepIndicator={false}
          targetRef={eggTargetRef}
        />
      </Animated.View>
      {onboardingEggSleeping ? (
        <TodayDormantEggIndicator
          energyRatio={growth.energyRatio}
          focusX={windowWidth / 2}
          focusY={windowHeight / 2 + (scenePinchFocusY - windowHeight / 2) * HOME_FTUE_CAMERA_SCALE + HOME_FTUE_CAMERA_Y_OFFSET + onboardingCameraPanY}
          left={windowWidth / 2 + 4 * explorationEggFrame.scale * HOME_FTUE_CAMERA_SCALE}
          sceneTranslateX={sceneTranslateX}
          stageScale={explorationEggFrame.scale * HOME_FTUE_CAMERA_SCALE}
          top={onboardingZzzTop}
        />
      ) : null}
      <View
        pointerEvents={focusMode ? 'none' : 'box-none'}
        style={[styles.chrome, focusMode && styles.chromeHidden]}>
      {!hatchReadyFocus && regularEggSleeping ? (
        <TodayDormantEggIndicator
          energyRatio={growth.energyRatio}
          focusX={windowWidth / 2}
          focusY={scenePinchFocusY}
          left={windowWidth / 2 + 4 * explorationEggFrame.scale}
          sceneTranslateX={sceneTranslateX}
          stageScale={explorationEggFrame.scale}
          top={stageTop + sceneLift + explorationEggFrame.top + TODAY_DORMANT_ZZZ_TOP_OFFSET * explorationEggFrame.scale}
        />
      ) : null}
      {!onboardingFocus ? <View pointerEvents="none" style={styles.environmentFade} /> : null}
      {!hatchReadyFocus && !onboardingFocus && !newDayIntro ? <Animated.View
        entering={FadeIn.duration(reduceMotion ? 100 : 320)}
        pointerEvents="none"
        style={[styles.meterAnchor, { top: growthMeterTop }]}>
        <GrowthMeter growth={growth} />
      </Animated.View> : null}
      {!hatchReadyFocus && !newDayIntro && (!onboardingFocus || onboardingTopHudVisible) ? <Animated.View
        entering={reduceMotion ? FadeIn.duration(80) : FadeIn.duration(220)}
        style={[styles.topHudFixed, { top: topInset + 8 }]}>
        <TodayTopHud days={timelineDays} energyPulseNonce={energyHudPulseNonce} energyTargetRef={energyHudTargetRef} energyValueOverride={energyHudValueOverride} interactionLocked={false} onSelectDay={onSelectDay} selectedId={day.id} />
      </Animated.View> : null}
      {!hatchReadyFocus && !actionListHidden && !onboardingFocus && !primaryActionGateActive ? (
      <View onLayout={handleFixedActionClusterLayout} style={[styles.fixedActionCluster, { top: fixedActionClusterTop }]}>
        {quietDayAvailable ? (
          <Pressable accessibilityHint="Opens a short note so this quiet day can hatch" accessibilityRole="button" onPress={onAddTextNote} style={({ pressed }) => [styles.quietDayAction, pressed && styles.actionPressed]}>
            <IconSymbol color={Meadow.goldDeep} name="moon.stars.fill" size={15} />
            <ThemedText style={styles.quietDayLabel} lightColor={Meadow.ink} darkColor={Meadow.ink}>Keep today as a quiet day</ThemedText>
          </Pressable>
        ) : null}
        {ready ? (
          <HatchRevealAction onAdd={onAddJournal} onReveal={onReveal} reduceMotion={reduceMotion} />
        ) : (
          <FormingActionCluster
            onAdd={onAddJournal}
            onCamera={onAddPhoto}
            onNote={onAddTextNote}
          />
        )}
      </View>
      ) : null}
      {hatchReadyFocus && !hatchPresentation ? (
        <Animated.View
          entering={reduceMotion ? FadeIn.duration(80) : FadeInDown.duration(260).easing(Easing.out(Easing.cubic))}
          style={[styles.hatchReadyAction, { top: fixedActionClusterTop }]}>
          <KatchaButton
            fullWidth
            glow
            icon="sparkles"
            label={hatchReadyLabel.toUpperCase()}
            labelStyle={styles.hatchReadyActionLabel}
            onPress={onReveal}
            variant="primary"
          />
        </Animated.View>
      ) : null}
      {!hatchReadyFocus && !onboardingFocus ? <MicrocopyToast message={microcopy} placementStyle={{ top: nurtureToastTop }} /> : null}
      {onboardingFocus && onboardingUiVisible && onboardingGuide && !actionListHidden ? (
        <>
          <Animated.View
            entering={FadeInDown.duration(260).easing(Easing.out(Easing.cubic))}
            key={`focus:${onboardingGuide.title}`}
            pointerEvents="none"
            style={[styles.onboardingHeroGuide, { top: topInset + (onboardingTopHudVisible ? 82 : 22) }]}>
            <FtueGuideCopy guide={onboardingGuide} hero />
          </Animated.View>
          {scriptedRouteChoiceActions.length > 1 && scriptedPanelCareAction && onScriptedAction ? (
            <View style={[styles.onboardingActionStage, { bottom: actionDockBottom }]}>
              <InlineRouteActionChoice
                action={{
                  ...scriptedPanelCareAction,
                  id: 'ftue:route-choice',
                  instanceId: `${day.isoDate}:ftue:route-choice`,
                  title: 'Choose one little piece.',
                  description: onboardingGuide.body,
                }}
                actions={scriptedRouteChoiceActions}
                interactionLocked={actionListLocked}
                onChoose={(action, from) => {
                  const panelAction = {
                    ...scriptedPanelCareAction,
                    id: 'ftue:route-choice',
                    instanceId: `${day.isoDate}:ftue:route-choice`,
                    title: 'Choose one little piece.',
                    description: onboardingGuide.body,
                  };
                  setScriptedRouteSelection({
                    accent: Meadow.gold,
                    action: panelAction,
                    id: action.id,
                    image: GAME_CURRENCY_ART.energy,
                    kind: 'scripted',
                    label: action.title,
                  });
                  onScriptedAction(action, from);
                }}
                reduceMotion={reduceMotion}
                selection={scriptedRouteSelection}
                swipeExternalGesture={careSwipeExternalGesture}
              />
            </View>
          ) : scriptedMoodAction && scriptedPanelCareAction && onScriptedChoice ? (
            <View collapsable={false} ref={scriptedMoodSourceRef} style={[styles.onboardingActionStage, { bottom: actionDockBottom }]}>
              <InlineMood
                action={{ ...scriptedPanelCareAction, title: scriptedMoodAction.title, growthReward: scriptedMoodAction.growthReward ?? scriptedPanelCareAction.growthReward }}
                allowSkip={false}
                completionEvent={scriptedMoodCompletion}
                enterFromBottom
                interactionLocked={actionListLocked}
                onChoose={(selection, from) => {
                  const option = scriptedMoodAction.options?.find((candidate) => candidate.domainChoiceId === selection.id);
                  if (!option) return;
                  const careAction = { ...scriptedPanelCareAction, title: scriptedMoodAction.title, growthReward: scriptedMoodAction.growthReward ?? scriptedPanelCareAction.growthReward };
                  setScriptedMoodSelection({ ...selection, action: careAction, kind: 'mood' });
                  setScriptedMoodCompletion({ action: careAction, id: `ftue:${scriptedMoodAction.id}:${selection.id}` });
                  onScriptedChoice(scriptedMoodAction, option, from);
                }}
                onFinished={() => {}}
                onSkip={() => scriptedMoodSourceRef.current?.measureInWindow((x, y, w, h) => {
                  const option = scriptedMoodAction.options?.find((candidate) => candidate.private);
                  if (!option) return;
                  const careAction = { ...scriptedPanelCareAction, title: scriptedMoodAction.title, growthReward: scriptedMoodAction.growthReward ?? scriptedPanelCareAction.growthReward };
                  setScriptedMoodCompletion({ action: careAction, id: `ftue:${scriptedMoodAction.id}:private` });
                  onScriptedChoice(scriptedMoodAction, option, { x, y, w, h });
                })}
                key={scriptedMoodAction.id}
                reduceMotion={reduceMotion}
                selection={scriptedMoodSelection}
                swipeExternalGesture={careSwipeExternalGesture}
              />
            </View>
          ) : scriptedTextChoiceAction && scriptedPanelCareAction && onScriptedChoice ? (
            <View style={[styles.onboardingActionStage, { bottom: actionDockBottom }]}>
              <InlineScriptedChoice
                action={{
                  ...scriptedPanelCareAction,
                  id: scriptedTextChoiceAction.id,
                  instanceId: `${day.isoDate}:${scriptedTextChoiceAction.id}`,
                  title: scriptedTextChoiceAction.title,
                  description: scriptedTextChoiceAction.description,
                  growthReward: scriptedTextChoiceAction.growthReward ?? scriptedPanelCareAction.growthReward,
                }}
                completionEvent={currentScriptedTextCompletion}
                enterFromBottom
                interactionLocked={actionListLocked}
                key={scriptedTextChoiceAction.id}
                metric={scriptedTextChoiceAction.id === 'energy.steps_context' && scriptedStepCount != null ? {
                  art: DASHBOARD_STAT_ART.steps,
                  label: 'steps yesterday',
                  value: scriptedStepCount,
                } : undefined}
                onChoose={(option, from, currencyFrom) => {
                  const careAction = {
                    ...scriptedPanelCareAction,
                    id: scriptedTextChoiceAction.id,
                    instanceId: `${day.isoDate}:${scriptedTextChoiceAction.id}`,
                    title: scriptedTextChoiceAction.title,
                    description: scriptedTextChoiceAction.description,
                    growthReward: scriptedTextChoiceAction.growthReward ?? scriptedPanelCareAction.growthReward,
                  };
                  setScriptedTextSelection({
                    accent: Meadow.gold,
                    action: careAction,
                    id: option.id,
                    image: GAME_CURRENCY_ART.energy,
                    kind: 'scripted',
                    label: option.label,
                  });
                  if (scriptedTextChoiceAction.id !== 'energy.steps_context') {
                    setScriptedTextCompletion({ action: careAction, id: `ftue:${scriptedTextChoiceAction.id}:${option.id}` });
                  }
                  onScriptedChoice(scriptedTextChoiceAction, option, from, currencyFrom);
                }}
                onFinished={() => {
                  if (scriptedTextChoiceAction.id === 'energy.steps_context') onScriptedChoiceFinished?.();
                }}
                onSkip={(from) => {
                  const option = scriptedTextChoiceAction.options?.find((candidate) => candidate.private);
                  if (!option) return;
                  const careAction = {
                    ...scriptedPanelCareAction,
                    id: scriptedTextChoiceAction.id,
                    instanceId: `${day.isoDate}:${scriptedTextChoiceAction.id}`,
                    title: scriptedTextChoiceAction.title,
                    description: scriptedTextChoiceAction.description,
                    growthReward: scriptedTextChoiceAction.growthReward ?? scriptedPanelCareAction.growthReward,
                  };
                  setScriptedTextCompletion({ action: careAction, id: `ftue:${scriptedTextChoiceAction.id}:private` });
                  onScriptedChoice(scriptedTextChoiceAction, option, from);
                }}
                options={scriptedTextChoiceAction.options?.filter((option) => !option.private) ?? []}
                reduceMotion={reduceMotion}
                selection={currentScriptedTextSelection}
                swipeExternalGesture={careSwipeExternalGesture}
              />
            </View>
          ) : scriptedRowActions.length && onScriptedAction ? (
            <Animated.View
              entering={FadeInDown.delay(100).duration(260).easing(Easing.out(Easing.cubic))}
              style={[styles.onboardingActionStage, { bottom: actionDockBottom }]}>
              <ScriptedActionList
                actions={scriptedRowActions}
                locked={actionListLocked}
                onAction={onScriptedAction}
                stepCount={scriptedStepCount}
                stepEnergy={scriptedStepEnergy}
              />
            </Animated.View>
          ) : null}
        </>
      ) : null}
      {!hatchReadyFocus && !actionListHidden && !onboardingFocus ? (
      <GestureDetector gesture={actionScrollGesture}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: tabBarHeight + HOME_ACTIONS_TAB_BAR_GAP, paddingTop: topInset + 8 }}
          contentInsetAdjustmentBehavior="never"
          directionalLockEnabled
          showsVerticalScrollIndicator={false}
          style={styles.contentScroll}>
        <Animated.View
          layout={actionHandoffLayout}
          pointerEvents="none"
          style={{ height: sceneSpacerHeight }}
        />

        <Animated.View
          onLayout={handleActionContentLayout}
          pointerEvents={actionStackInteractive ? 'auto' : 'none'}
          style={actionStackRevealStyle}>
          <Animated.View style={styles.careSection}>
          {companionJourneyHook && onOpenCompanionJourney ? (
            <CompanionJourneyHookCard model={companionJourneyHook} onPress={onOpenCompanionJourney} />
          ) : null}
          {onboardingGuide ? (
            <Animated.View entering={FadeInUp.duration(260)} key={onboardingGuide.title} style={styles.onboardingGuide}>
              <FtueGuideCopy guide={onboardingGuide} />
            </Animated.View>
          ) : null}
          {scriptedRowActions.length && onScriptedAction ? (
            <ScriptedActionList
              actions={scriptedRowActions}
              locked={actionListLocked}
              onAction={onScriptedAction}
            />
          ) : null}
          {!scriptedActions.length ? <>
          {stepEnergyGateActive && yesterdayStepEnergyOffer && onConvertYesterdaySteps ? (
            <YesterdayStepEnergyRow
              busy={yesterdayStepEnergyBusy}
              completionKey={yesterdayStepEnergyCompletionKey}
              displayedSteps={yesterdayStepEnergyDisplayedSteps ?? yesterdayStepEnergyOffer.observedSteps}
              energy={yesterdayStepEnergyOffer.energy}
              onConvert={onConvertYesterdaySteps}
              onFinished={onYesterdayStepEnergyPanelFinished}
              reduceMotion={reduceMotion}
            />
          ) : <>
          {displayedMoodAction || displayedSleepAction ? (
            <Animated.View
              layout={actionHandoffLayout}
              onLayout={handleCheckInGroupLayout}
              style={[styles.checkInGroup, checkInSlotHeight > 0 && { minHeight: checkInSlotHeight }]}>
              {displayedMoodAction ? (
                <InlineMood
                  action={displayedMoodAction}
                  completionEvent={completionIsCheckIn && completionEvent?.action.instanceId === displayedMoodAction.instanceId ? completionEvent : null}
                  interactionLocked={checkInSelection != null}
                  onChoose={(selection, from, currencyFrom) => beginCheckInSelection({ ...selection, action: displayedMoodAction, kind: 'mood' }, from, currencyFrom)}
                  onFinished={finishCheckInSelection}
                  onSkip={() => onCareNotToday(displayedMoodAction)}
                  key={displayedMoodAction.instanceId}
                  reduceMotion={reduceMotion}
                  selection={checkInSelection?.kind === 'mood' ? checkInSelection : null}
                  swipeExternalGesture={careSwipeExternalGesture}
                />
              ) : null}
              {displayedSleepAction ? (
                <InlineSleep
                  action={displayedSleepAction}
                  completionEvent={completionIsCheckIn && completionEvent?.action.instanceId === displayedSleepAction.instanceId ? completionEvent : null}
                  interactionLocked={checkInSelection != null}
                  onChoose={(selection, from, currencyFrom) => beginCheckInSelection({ ...selection, action: displayedSleepAction, kind: 'sleep' }, from, currencyFrom)}
                  onFinished={finishCheckInSelection}
                  onSkip={() => onCareNotToday(displayedSleepAction)}
                  key={displayedSleepAction.instanceId}
                  preloadedArt={preloadedSleepArt}
                  reduceMotion={reduceMotion}
                  selection={checkInSelection?.kind === 'sleep' ? checkInSelection : null}
                  swipeExternalGesture={careSwipeExternalGesture}
                />
              ) : null}
            </Animated.View>
          ) : null}

          {displayedStandardRows.map((row, index) => {
            if (row.kind === 'completed') return (
              <CompletedCareRow
                event={row.event}
                key={row.event.action.instanceId}
                onFinished={onCompletionAnimationEnd}
                onRewardFlight={onRewardFlight}
                reduceMotion={reduceMotion}
              />
            );
            const action = row.action;
            const entryDelayMs = standardActionStack.entryDelayMs(action.instanceId, index);
            const animateLayout = standardActionStack.isMoving(action.instanceId);
            const quickGoalDestination = action.destination.kind === 'quick_goal' ? action.destination : null;
            return quickGoalDestination ? (
              <DayActionGoalRow
                animateLayout={animateLayout}
                artwork={<CompanionGoalPortrait familyId={quickGoalDestination.familyId} size={38} />}
                entryDelayMs={entryDelayMs}
                externalGesture={careSwipeExternalGesture}
                key={action.instanceId}
                label={action.title}
                onCompletionRequest={(source, onRewardArrive) => {
                  const complete = () => {
                    onRewardArrive();
                    requestAnimationFrame(() => onCompleteQuickGoal(quickGoalDestination.goalId));
                  };
                  if (source) {
                    onRewardFlight({ h: source.height, w: source.width, x: source.x, y: source.y }, action, complete);
                  } else {
                    complete();
                  }
                }}
                onOpen={(completeFromOrigin) => onOpenQuickGoal(quickGoalDestination.goalId, completeFromOrigin)}
                onSkip={() => onCareNotToday(action)}
                reward={<Reward amount={action.growthReward} />}
                title={action.title}
              />
            ) : (
              <CareRow
                action={action}
                animateLayout={animateLayout}
                entryDelayMs={entryDelayMs}
                key={action.instanceId}
                onNotToday={() => onCareNotToday(action)}
                onStart={(rewardFrom) => {
                  if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
                  onCareStart(action, rewardFrom);
                }}
                swipeExternalGesture={careSwipeExternalGesture}
              />
            );
          })}

          {!actions.length && !checkInSelection && !completionIsStandard ? (
            <Animated.View entering={FadeIn.duration(180)} style={styles.thriving}>
              <View style={styles.smallIconWell}><Image contentFit="contain" source={GAME_CURRENCY_ART.energy} style={styles.smallEnergyArt} transition={0} /></View>
              <View style={styles.flexCopy}>
                <ThemedText style={styles.rowTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>Your egg is thriving</ThemedText>
                <ThemedText style={styles.rowBody} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>Add another memory whenever it feels right.</ThemedText>
              </View>
            </Animated.View>
          ) : null}
          </>}
          </> : null}
          </Animated.View>
        </Animated.View>
          </ScrollView>
      </GestureDetector>
      ) : null}
      </View>
    </View>
  );
});

function FormingActionCluster({ onAdd, onCamera, onNote }: {
  onAdd: () => void;
  onCamera: () => void;
  onNote: () => void;
}) {
  return (
    <View style={styles.addMemoryCluster}>
      <WorldActionStack
        onAdd={onAdd}
        onCamera={onCamera}
        onMicPressIn={() => {}}
        onMicPressOut={() => {}}
        onMicTap={onNote}
        onNote={onNote}
        orientation="horizontal"
      />
    </View>
  );
}

function HatchRevealAction({ onAdd, onReveal, reduceMotion }: {
  onAdd: () => void;
  onReveal: () => void;
  reduceMotion: boolean;
}) {
  const handleReveal = () => {
    if (process.env.EXPO_OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onReveal();
  };

  return (
    <Animated.View
      entering={reduceMotion
        ? FadeIn.duration(80)
        : FadeIn.duration(220).easing(Easing.out(Easing.cubic))}
      style={styles.hatchRevealCluster}>
      <Pressable
        accessibilityLabel="Reveal the hatch"
        accessibilityRole="button"
        onPress={handleReveal}
        style={({ pressed }) => [styles.reveal, pressed && styles.revealPressed]}>
        <IconSymbol color={Meadow.ink} name="sparkles" size={22} />
        <ThemedText style={styles.revealLabel} lightColor={Meadow.ink} darkColor={Meadow.ink}>Reveal the hatch</ThemedText>
      </Pressable>
      <Pressable
        accessibilityLabel="Add another journal entry"
        accessibilityRole="button"
        onPress={onAdd}
        style={({ pressed }) => [styles.readyAdd, pressed && styles.revealPressed]}>
        <IconSymbol color={Meadow.ink} name="plus" size={22} />
      </Pressable>
    </Animated.View>
  );
}

type InlineChoice = {
  accent: string;
  feedImage: number;
  id: string;
  icon?: IconSymbolName;
  image?: ImageSourcePropType | ImageRef;
  label: string;
  surface?: string;
};

const FTUE_CHOICE_TONES = [
  { accent: '#78A952', surface: '#F0F5D9' },
  { accent: '#D5A32C', surface: '#FFF1CE' },
  { accent: '#57AAA6', surface: '#E1F2EE' },
  { accent: '#D887AF', surface: '#F8E3ED' },
  { accent: '#8D79C7', surface: '#EEE7F8' },
  { accent: '#6F98B5', surface: '#E8F0F4' },
] as const;

function getFtueChoiceArt(option: FtueChoiceOption): ImageSourcePropType {
  switch (option.domainChoiceId ?? option.id) {
    case 'work':
    case 'progress':
      return MANUAL_JOURNAL_ART.work;
    case 'family':
    case 'friends':
    case 'people':
      return MANUAL_JOURNAL_ART.people;
    case 'outdoors':
    case 'places':
      return MANUAL_JOURNAL_ART.place;
    case 'resting':
    case 'rest':
    case 'quiet':
      return SLEEP_ART.good;
    case 'new':
    case 'fun':
      return MANUAL_JOURNAL_ART.event;
    case 'full':
      return MANUAL_JOURNAL_ART.movement;
    case 'lovely':
      return MOOD_ART.radiant;
    case 'getting_through':
    case 'hard':
      return MOOD_ART.stormy;
    default:
      return MANUAL_JOURNAL_ART.general;
  }
}

function getFtueChoiceColumnCount(choiceCount: number): number {
  if (choiceCount <= 3) return Math.max(1, choiceCount);
  if (choiceCount === 4) return 2;
  return 3;
}

const INITIAL_ACTION_STACK_SETTLE_MS = 560;
const FTUE_CAMERA_COVERAGE_BLEED = 2;
const NURTURE_ACTION_CLUSTER_FALLBACK_HEIGHT = 67;
const NURTURE_TOAST_TOP_GAP = 6;

/**
 * One lifecycle for every specialized Today action panel. Content can vary,
 * but selection feedback, entry, and the completion handoff must not.
 */
function useSharedActionPanelLifecycle({
  completionKey,
  enterFromBottom = false,
  onFinished,
  reduceMotion,
  selectionActive,
}: {
  completionKey?: string | null;
  enterFromBottom?: boolean;
  onFinished: (completionKey: string) => void;
  reduceMotion: boolean;
  selectionActive: boolean;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const panelPulse = useSharedValue(0);
  const panelScale = useSharedValue(1);
  const panelX = useSharedValue(0);
  const panelOpacity = useSharedValue(1);
  const completedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selectionActive) {
      if (!completionKey) {
        panelPulse.value = withTiming(0, { duration: reduceMotion ? 60 : 140 });
        panelScale.value = withTiming(1, { duration: reduceMotion ? 60 : 180 });
      }
      return;
    }
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (reduceMotion) {
      panelPulse.value = withTiming(0.55, { duration: 100 });
      return;
    }
    panelPulse.value = withSequence(
      withTiming(1, { duration: 120, easing: Easing.out(Easing.cubic) }),
      withTiming(0.62, { duration: 240, easing: Easing.out(Easing.cubic) }),
    );
    panelScale.value = withSequence(
      withTiming(1.024, { duration: 115, easing: Easing.out(Easing.cubic) }),
      withTiming(1.012, { duration: 180, easing: Easing.out(Easing.cubic) }),
    );
  }, [completionKey, panelPulse, panelScale, reduceMotion, selectionActive]);

  useEffect(() => {
    if (!completionKey || completedKeyRef.current === completionKey) return;
    completedKeyRef.current = completionKey;
    const exitDelay = reduceMotion ? 40 : 220;
    if (!reduceMotion) {
      panelPulse.value = withSequence(
        withTiming(1, { duration: 90, easing: Easing.out(Easing.cubic) }),
        withDelay(70, withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) })),
      );
      panelScale.value = withSequence(
        withTiming(1.032, { duration: 105, easing: Easing.out(Easing.cubic) }),
        withDelay(45, withTiming(0.99, { duration: 280, easing: Easing.in(Easing.cubic) })),
      );
    }
    panelX.value = withDelay(
      exitDelay,
      withTiming(windowWidth + 24, {
        duration: reduceMotion ? 100 : 330,
        easing: Easing.in(Easing.cubic),
      }, (finished) => {
        if (finished) runOnJS(onFinished)(completionKey);
      }),
    );
    panelOpacity.value = withDelay(
      exitDelay + (reduceMotion ? 20 : 105),
      withTiming(0, {
        duration: reduceMotion ? 80 : 190,
        easing: Easing.in(Easing.quad),
      }),
    );
  }, [completionKey, onFinished, panelOpacity, panelPulse, panelScale, panelX, reduceMotion, windowWidth]);

  const entering = useMemo(
    () => reduceMotion
      ? FadeIn.duration(70)
      : (enterFromBottom ? FadeInDown : FadeInUp).delay(55).duration(320).easing(Easing.out(Easing.cubic)),
    [enterFromBottom, reduceMotion],
  );
  const panelStyle = useAnimatedStyle(() => ({
    opacity: panelOpacity.value,
    transform: [{ translateX: panelX.value }, { scale: panelScale.value }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({ opacity: panelPulse.value * 0.28 }));

  return { entering, panelStyle, pulseStyle };
}

function InlineMood({ action, allowSkip = true, completionEvent, enterFromBottom = false, interactionLocked, onChoose, onFinished, onSkip, reduceMotion, selection, swipeExternalGesture }: {
  action: RankedTodayCareAction;
  allowSkip?: boolean;
  completionEvent: TodayCareCompletionEvent | null;
  enterFromBottom?: boolean;
  interactionLocked: boolean;
  onChoose: (selection: Omit<CheckInSelection, 'action' | 'kind'>, from: FeedSourceRect, currencyFrom: FeedSourceRect) => void;
  onFinished: (eventId: string) => void;
  onSkip: () => void;
  reduceMotion: boolean;
  selection: CheckInSelection | null;
  swipeExternalGesture: GestureType;
}) {
  return (
    <InlineCheckInPanel
      action={action}
      allowSkip={allowSkip}
      choices={MOOD_CHOICES.map((choice, index) => ({
        accent: choice.accent,
        feedImage: MOOD_ART[choice.state],
        id: choice.id,
        image: MOOD_ART[choice.state],
        label: choice.label,
        surface: FTUE_CHOICE_TONES[index % FTUE_CHOICE_TONES.length].surface,
      }))}
      completionEvent={completionEvent}
      enterFromBottom={enterFromBottom}
      illustratedChoices
      interactionLocked={interactionLocked}
      onChoose={onChoose}
      onFinished={onFinished}
      onSkip={onSkip}
      reduceMotion={reduceMotion}
      selection={selection}
      swipeExternalGesture={swipeExternalGesture}
    />
  );
}

function InlineSleep({ action, completionEvent, interactionLocked, onChoose, onFinished, onSkip, preloadedArt, reduceMotion, selection, swipeExternalGesture }: {
  action: RankedTodayCareAction;
  completionEvent: TodayCareCompletionEvent | null;
  interactionLocked: boolean;
  onChoose: (selection: Omit<CheckInSelection, 'action' | 'kind'>, from: FeedSourceRect, currencyFrom: FeedSourceRect) => void;
  onFinished: (eventId: string) => void;
  onSkip: () => void;
  preloadedArt: Partial<Record<SleepQuality, ImageRef>>;
  reduceMotion: boolean;
  selection: CheckInSelection | null;
  swipeExternalGesture: GestureType;
}) {
  return (
    <InlineCheckInPanel
      action={action}
      choices={SLEEP_OPTIONS.map((option, index) => ({
        accent: option.accent,
        feedImage: SLEEP_ART[option.quality],
        id: option.quality,
        image: preloadedArt[option.quality] ?? SLEEP_ART[option.quality],
        label: option.label,
        surface: FTUE_CHOICE_TONES[index % FTUE_CHOICE_TONES.length].surface,
      }))}
      completionEvent={completionEvent}
      illustratedChoices
      interactionLocked={interactionLocked}
      onChoose={onChoose}
      onFinished={onFinished}
      onSkip={onSkip}
      reduceMotion={reduceMotion}
      selection={selection}
      swipeExternalGesture={swipeExternalGesture}
    />
  );
}

function InlineCheckInPanel({ action, allowSkip = true, choices, completionEvent, enterFromBottom = false, illustratedChoices = false, interactionLocked, metric, onChoose, onFinished, onSkip, reduceMotion, selection, swipeExternalGesture, textChoices = false, wide = false }: {
  action: RankedTodayCareAction;
  allowSkip?: boolean;
  choices: InlineChoice[];
  completionEvent: TodayCareCompletionEvent | null;
  enterFromBottom?: boolean;
  illustratedChoices?: boolean;
  interactionLocked: boolean;
  metric?: InlineMetric;
  onChoose: (selection: Omit<CheckInSelection, 'action' | 'kind'>, from: FeedSourceRect, currencyFrom: FeedSourceRect) => void;
  onFinished: (eventId: string) => void;
  onSkip: () => void;
  reduceMotion: boolean;
  selection: CheckInSelection | null;
  swipeExternalGesture: GestureType;
  textChoices?: boolean;
  wide?: boolean;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const [illustratedGridWidth, setIllustratedGridWidth] = useState(0);
  const illustratedFallbackWidth = Math.min(windowWidth - Meadow.space.page * 2, 980) - 28;
  const illustratedAvailableWidth = illustratedGridWidth || illustratedFallbackWidth;
  const illustratedColumnCount = getFtueChoiceColumnCount(choices.length);
  const illustratedTileWidth = Math.floor(
    (illustratedAvailableWidth - (illustratedColumnCount - 1) * 6) / illustratedColumnCount,
  );
  const rewardRef = useRef<ViewType | null>(null);
  const metricRef = useRef<ViewType | null>(null);
  // Sequential panels share parent state during the render that hands one
  // action to the next. Only state created by this exact action instance may
  // pulse or dismiss it; stale state is ignored before effects can run.
  const ownedSelection = selection?.action.instanceId === action.instanceId ? selection : null;
  const ownedCompletionEvent = completionEvent?.action.instanceId === action.instanceId ? completionEvent : null;
  const { entering, panelStyle, pulseStyle } = useSharedActionPanelLifecycle({
    completionKey: ownedCompletionEvent?.id,
    enterFromBottom,
    onFinished,
    reduceMotion,
    selectionActive: ownedSelection != null,
  });

  return (
    <Animated.View
      entering={entering}>
      <DayActionSwipeShell
        disabled={interactionLocked || !allowSkip}
        externalGesture={swipeExternalGesture}
        label={action.title}
        onDismiss={onSkip}>
        <Animated.View style={panelStyle}>
          <GameSurface
            contentStyle={[styles.inlineCardContent, illustratedChoices && styles.illustratedCardContent]}
            style={[styles.inlineCard, illustratedChoices && styles.illustratedCard]}
            tone="cream">
          <Animated.View
            pointerEvents="none"
            style={[styles.inlineSelectionPulse, { backgroundColor: ownedSelection?.accent ?? 'transparent' }, pulseStyle]}
          />
          <InlineHeading action={action} allowSkip={allowSkip} disabled={interactionLocked} hideReward={metric != null} illustrated={illustratedChoices} onSkip={onSkip} rewardRef={rewardRef} />
          {metric ? (
            <View collapsable={false} ref={metricRef} style={styles.inlineMetric}>
              <Image contentFit="contain" source={metric.art} style={styles.inlineMetricArt} transition={0} />
              <View style={styles.inlineMetricCopy}>
                <ThemedText selectable style={styles.inlineMetricValue} lightColor={Meadow.ink} darkColor={Meadow.ink}>
                  {metric.value.toLocaleString()}
                </ThemedText>
                <ThemedText style={styles.inlineMetricLabel} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
                  {metric.label}
                </ThemedText>
              </View>
            </View>
          ) : null}
          <View
            onLayout={illustratedChoices ? (event) => {
              const measuredWidth = Math.floor(event.nativeEvent.layout.width);
              setIllustratedGridWidth((current) => current === measuredWidth ? current : measuredWidth);
            } : undefined}
            style={illustratedChoices ? styles.illustratedChoiceGrid : textChoices ? styles.textChoiceGrid : wide ? styles.sleepGrid : styles.moodGrid}>
            {choices.map((choice) => illustratedChoices ? (
              <MeasuredIllustratedChoice
                accent={choice.accent}
                disabled={interactionLocked}
                dimmed={ownedSelection != null && ownedSelection.id !== choice.id}
                icon={choice.icon ?? 'sparkles'}
                image={choice.image}
                key={choice.id}
                label={choice.label}
                onPress={(from) => {
                  const selectedChoice = {
                    accent: choice.accent,
                    id: choice.id,
                    image: choice.feedImage,
                    label: choice.label,
                  };
                  const currencySource = metricRef.current ?? rewardRef.current;
                  if (currencySource) {
                    currencySource.measureInWindow((x, y, width, height) => {
                      onChoose(selectedChoice, from, { h: height, w: width, x, y });
                    });
                  } else {
                    onChoose(selectedChoice, from, from);
                  }
                }}
                reduceMotion={reduceMotion}
                selected={ownedSelection?.id === choice.id}
                surface={choice.surface ?? '#FFF7E8'}
                threeColumn={illustratedColumnCount === 3}
                width={illustratedTileWidth}
              />
            ) : textChoices ? (
              <MeasuredTextChoice
                accent={choice.accent}
                disabled={interactionLocked}
                dimmed={ownedSelection != null && ownedSelection.id !== choice.id}
                icon={choice.icon ?? 'sparkles'}
                key={choice.id}
                label={choice.label}
                onPress={(from) => {
                  const selectedChoice = {
                    accent: choice.accent,
                    id: choice.id,
                    image: choice.feedImage,
                    label: choice.label,
                  };
                  const currencySource = metricRef.current ?? rewardRef.current;
                  if (currencySource) {
                    currencySource.measureInWindow((x, y, width, height) => {
                      onChoose(selectedChoice, from, { h: height, w: width, x, y });
                    });
                  } else {
                    onChoose(selectedChoice, from, from);
                  }
                }}
                selected={ownedSelection?.id === choice.id}
              />
            ) : (
              <MeasuredChoice
                accent={choice.accent}
                disabled={interactionLocked}
                dimmed={ownedSelection != null && ownedSelection.id !== choice.id}
                image={choice.image!}
                key={choice.id}
                label={choice.label}
                onPress={(from) => {
                  const selectedChoice = {
                    accent: choice.accent,
                    id: choice.id,
                    image: choice.feedImage,
                    label: choice.label,
                  };
                  const currencySource = metricRef.current ?? rewardRef.current;
                  if (currencySource) {
                    currencySource.measureInWindow((x, y, width, height) => {
                      onChoose(selectedChoice, from, { h: height, w: width, x, y });
                    });
                  } else {
                    onChoose(selectedChoice, from, from);
                  }
                }}
                reduceMotion={reduceMotion}
                selected={ownedSelection?.id === choice.id}
                wide={wide}
              />
            ))}
          </View>
          </GameSurface>
        </Animated.View>
      </DayActionSwipeShell>
    </Animated.View>
  );
}

function InlineHeading({ action, allowSkip, disabled, hideReward = false, illustrated = false, onSkip, rewardRef }: {
  action: RankedTodayCareAction;
  allowSkip: boolean;
  disabled: boolean;
  hideReward?: boolean;
  illustrated?: boolean;
  onSkip: () => void;
  rewardRef: RefObject<ViewType | null>;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const wideIllustrated = illustrated && windowWidth >= 700;
  const handleSkip = () => {
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    onSkip();
  };
  return (
    <View style={[styles.inlineHeading, illustrated && styles.illustratedHeading, wideIllustrated && styles.illustratedHeadingWide]}>
      {allowSkip ? (
        <Pressable
          accessibilityLabel={`Skip ${action.title} for today`}
          accessibilityRole="button"
          disabled={disabled}
          hitSlop={8}
          onPress={handleSkip}
          style={({ pressed }) => [styles.inlineSkip, disabled && styles.inlineSkipDisabled, pressed && styles.inlineSkipPressed]}>
          <ThemedText style={styles.inlineSkipLabel} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>Skip</ThemedText>
        </Pressable>
      ) : null}
      <View style={[
        styles.inlineQuestionAnchor,
        illustrated && styles.illustratedQuestionAnchor,
        illustrated && allowSkip && styles.illustratedQuestionAnchorSkippable,
        wideIllustrated && styles.illustratedQuestionAnchorWide,
      ]}>
        <ThemedText
          numberOfLines={2}
          style={[
            styles.inlineQuestion,
            allowSkip ? styles.inlineQuestionSkippable : hideReward ? styles.inlineQuestionCentered : styles.inlineQuestionRequired,
            illustrated && styles.illustratedQuestion,
            wideIllustrated && styles.illustratedQuestionWide,
          ]}
          lightColor={allowSkip ? Meadow.ink : KatchaDeckUI.ftue.goldDeep}
          darkColor={allowSkip ? Meadow.ink : KatchaDeckUI.ftue.goldDeep}>
          {action.title}
        </ThemedText>
        {illustrated ? (
          <ThemedText
            numberOfLines={2}
            style={[styles.illustratedQuestionBody, wideIllustrated && styles.illustratedQuestionBodyWide]}
            lightColor={Meadow.inkSoft}
            darkColor={Meadow.inkSoft}>
            {action.description}
          </ThemedText>
        ) : null}
      </View>
      {!hideReward ? (
        <View collapsable={false} ref={rewardRef} style={styles.inlineReward}>
          {illustrated ? <FtueEnergyBadge amount={action.growthReward} wide={wideIllustrated} /> : <Reward amount={action.growthReward} />}
        </View>
      ) : null}
    </View>
  );
}

function FtueEnergyBadge({ amount, wide }: { amount: number; wide: boolean }) {
  return (
    <View accessibilityLabel={`Plus ${amount} Energy`} style={[styles.ftueEnergyBadge, wide && styles.ftueEnergyBadgeWide]}>
      <Image contentFit="contain" source={GAME_CURRENCY_ART.energy} style={[styles.ftueEnergyBadgeArt, wide && styles.ftueEnergyBadgeArtWide]} transition={0} />
      <View style={styles.ftueEnergyBadgeCopy}>
        <ThemedText style={[styles.ftueEnergyBadgeAmount, wide && styles.ftueEnergyBadgeAmountWide]} lightColor={KatchaDeckUI.ftue.goldDeep} darkColor={KatchaDeckUI.ftue.goldDeep}>
          +{amount}
        </ThemedText>
        <ThemedText style={styles.ftueEnergyBadgeLabel} lightColor={KatchaDeckUI.ftue.goldDeep} darkColor={KatchaDeckUI.ftue.goldDeep}>
          Energy
        </ThemedText>
      </View>
    </View>
  );
}

function MeasuredIllustratedChoice({ accent, disabled, dimmed, icon, image, label, onPress, reduceMotion, selected, surface, threeColumn, width }: {
  accent: string;
  disabled: boolean;
  dimmed: boolean;
  icon: IconSymbolName;
  image?: ImageSourcePropType | ImageRef;
  label: string;
  onPress: (from: FeedSourceRect) => void;
  reduceMotion: boolean;
  selected: boolean;
  surface: string;
  threeColumn: boolean;
  width: number;
}) {
  const tileRef = useRef<ViewType | null>(null);
  const artScale = useSharedValue(1);
  useEffect(() => {
    if (!selected) return;
    artScale.value = reduceMotion
      ? withTiming(1.04, { duration: 90 })
      : withSequence(
        withTiming(1.12, { duration: 115, easing: Easing.out(Easing.cubic) }),
        withTiming(1.04, { duration: 170, easing: Easing.out(Easing.cubic) }),
      );
  }, [artScale, reduceMotion, selected]);
  const artStyle = useAnimatedStyle(() => ({ transform: [{ scale: artScale.value }] }));
  const handlePress = () => tileRef.current?.measureInWindow((x, y, w, h) => onPress({ x, y, w, h }));
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={handlePress}
      ref={tileRef}
      style={({ pressed }) => [
        styles.illustratedChoice,
        threeColumn && styles.illustratedChoiceThreeColumn,
        { backgroundColor: surface, borderColor: selected ? accent : `${accent}82`, width },
        selected && styles.illustratedChoiceSelected,
        dimmed && styles.choiceDimmed,
        pressed && styles.illustratedChoicePressed,
      ]}>
      <View pointerEvents="none" style={[styles.illustratedChoiceHighlight, threeColumn && styles.illustratedChoiceHighlightThreeColumn]} />
      <Animated.View style={[styles.illustratedChoiceArtFrame, threeColumn && styles.illustratedChoiceArtFrameThreeColumn, artStyle]}>
        {image ? (
          <Image contentFit="contain" source={image} style={[styles.illustratedChoiceArt, threeColumn && styles.illustratedChoiceArtThreeColumn]} transition={0} />
        ) : (
          <IconSymbol color={accent} name={icon} size={threeColumn ? 30 : 32} />
        )}
      </Animated.View>
      <ThemedText numberOfLines={2} style={[styles.illustratedChoiceLabel, threeColumn && styles.illustratedChoiceLabelThreeColumn]} lightColor={Meadow.ink} darkColor={Meadow.ink}>
        {label}
      </ThemedText>
      <View style={[styles.illustratedChoiceGlint, { backgroundColor: accent }]}>
        <IconSymbol color="#FFFDF4" name={selected ? 'checkmark' : 'sparkles'} size={selected ? 12 : 10} />
      </View>
    </Pressable>
  );
}

function MeasuredTextChoice({ accent, disabled, dimmed, icon, label, onPress, selected }: {
  accent: string;
  disabled: boolean;
  dimmed: boolean;
  icon: IconSymbolName;
  label: string;
  onPress: (from: FeedSourceRect) => void;
  selected: boolean;
}) {
  const chipRef = useRef<ViewType | null>(null);
  const handlePress = () => chipRef.current?.measureInWindow((x, y, w, h) => onPress({ x, y, w, h }));
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={handlePress}
      ref={chipRef}
      style={({ pressed }) => [
        styles.textChoice,
        { borderColor: selected ? accent : `${accent}66` },
        selected && { backgroundColor: `${accent}2E`, borderWidth: 1.5 },
        dimmed && styles.choiceDimmed,
        pressed && styles.choicePressed,
      ]}>
      <IconSymbol color={Meadow.ink} name={icon} size={16} />
      <ThemedText numberOfLines={1} style={styles.textChoiceLabel} lightColor={Meadow.ink} darkColor={Meadow.ink}>{label}</ThemedText>
    </Pressable>
  );
}

function MeasuredChoice({ accent, disabled, dimmed, image, label, onPress, reduceMotion, selected, wide = false }: {
  accent: string;
  disabled: boolean;
  dimmed: boolean;
  image: ImageSourcePropType | ImageRef;
  label: string;
  onPress: (from: FeedSourceRect) => void;
  reduceMotion: boolean;
  selected: boolean;
  wide?: boolean;
}) {
  const iconRef = useRef<View | null>(null);
  const iconShake = useSharedValue(0);
  const iconScale = useSharedValue(1);
  useEffect(() => {
    if (!selected) return;
    if (reduceMotion) {
      iconScale.value = withTiming(1.05, { duration: 100 });
      return;
    }
    iconShake.value = withSequence(
      withTiming(-1, { duration: 45, easing: Easing.linear }),
      withTiming(1, { duration: 55, easing: Easing.linear }),
      withTiming(-0.55, { duration: 50, easing: Easing.linear }),
      withTiming(0, { duration: 70, easing: Easing.out(Easing.cubic) }),
    );
    iconScale.value = withSequence(
      withTiming(1.12, { duration: 110, easing: Easing.out(Easing.cubic) }),
      withTiming(1.04, { duration: 170, easing: Easing.out(Easing.cubic) }),
    );
  }, [iconScale, iconShake, reduceMotion, selected]);
  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: iconShake.value * 3.5 },
      { rotate: `${iconShake.value * 3}deg` },
      { scale: iconScale.value },
    ],
  }));
  const handlePress = () => iconRef.current?.measureInWindow((x, y, w, h) => onPress({ x, y, w, h }));
  return (
    <View style={wide ? styles.sleepChoiceCell : styles.moodChoiceCell}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{ disabled, selected }}
        disabled={disabled}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.quickChoice,
          { borderColor: selected ? accent : `${accent}55` },
          selected && { backgroundColor: `${accent}2E`, borderWidth: 1.5 },
          dimmed && styles.choiceDimmed,
          pressed && styles.choicePressed,
        ]}>
        <Animated.View style={iconStyle}>
          <View collapsable={false} ref={iconRef}>
            <Image contentFit="contain" source={image} style={styles.quickChoiceArt} />
          </View>
        </Animated.View>
        <ThemedText style={styles.quickChoiceLabel} lightColor={Meadow.ink} darkColor={Meadow.ink}>{label}</ThemedText>
      </Pressable>
    </View>
  );
}

function CompletedCareRow({ event, onFinished, onRewardFlight }: {
  event: TodayCareCompletionEvent;
  onFinished: (eventId: string) => void;
  onRewardFlight: (from: FeedSourceRect, action: RankedTodayCareAction, onArrive: () => void) => void;
  reduceMotion: boolean;
}) {
  return (
    <DayActionCompletedRow
      artwork={event.action.category === 'play' && event.action.familyId ? (
        <CompanionGoalPortrait familyId={event.action.familyId} size={38} />
      ) : (
        <CareActionArt action={event.action} completed />
      )}
      onFinished={() => onFinished(event.id)}
      onRewardRequest={(source, onArrive) => onRewardFlight({
        h: source.height,
        w: source.width,
        x: source.x,
        y: source.y,
      }, event.action, onArrive)}
      reward={<Reward amount={event.action.growthReward} />}
      rewardAnimationId={event.id}
      rewardAlreadyAnimated={event.rewardAlreadyAnimated}
      subtitle={event.action.category === 'play' ? 'Round complete' : 'Added to today'}
      title={event.action.title}
    />
  );
}
function YesterdayStepEnergyRow({ busy, completionKey, displayedSteps, energy, onConvert, onFinished, reduceMotion }: {
  busy: boolean;
  completionKey: string | null;
  displayedSteps: number;
  energy: number;
  onConvert: (from: FeedSourceRect) => void;
  onFinished: (completionKey: string) => void;
  reduceMotion: boolean;
}) {
  const rewardRef = useRef<ViewType | null>(null);
  const { entering, panelStyle, pulseStyle } = useSharedActionPanelLifecycle({
    completionKey,
    onFinished,
    reduceMotion,
    selectionActive: busy,
  });
  const handlePress = () => {
    if (busy) return;
    rewardRef.current?.measureInWindow((x, y, width, height) => onConvert({ h: height, w: width, x, y }));
  };
  return (
    <Animated.View
      entering={entering}
      layout={LinearTransition.duration(240)}>
      <Animated.View style={panelStyle}>
        <Pressable
          accessibilityHint="Converts yesterday's steps once. This action cannot be skipped."
          accessibilityLabel={`Turn ${displayedSteps.toLocaleString()} yesterday steps into ${energy} Energy`}
          accessibilityRole="button"
          accessibilityState={{ busy, disabled: busy }}
          disabled={busy}
          onPress={handlePress}
          style={({ pressed }) => [styles.careDoorPressable, pressed && styles.rowPressed]}>
          <GameSurface contentStyle={styles.stepEnergyContent} style={styles.careDoor} tone="cream">
            <Animated.View
              pointerEvents="none"
              style={[styles.inlineSelectionPulse, styles.stepEnergyPulse, pulseStyle]}
            />
            <View style={styles.stepEnergyMetric}>
              <Image contentFit="contain" source={DASHBOARD_STAT_ART.steps} style={styles.stepEnergyStepsArt} transition={0} />
              <View style={styles.stepEnergyCopy}>
                <AnimatedIntegerText
                  durationMs={EGG_FEED_PAYOUT_DURATION_MS}
                  easing="linear"
                  selectable
                  style={styles.stepEnergyValue}
                  lightColor={Meadow.goldDeep}
                  darkColor={Meadow.goldDeep}
                  value={displayedSteps}
                />
                <ThemedText style={styles.stepEnergyLabel} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>steps yesterday</ThemedText>
              </View>
            </View>
            <IconSymbol color={Meadow.inkFaint} name="arrow.right" size={20} />
            <View collapsable={false} ref={rewardRef} style={styles.stepEnergyReward}>
              <Image contentFit="contain" source={GAME_CURRENCY_ART.energy} style={styles.stepEnergyArt} transition={0} />
              <ThemedText selectable style={styles.stepEnergyRewardValue} lightColor={Meadow.goldDeep} darkColor={Meadow.goldDeep}>+{energy}</ThemedText>
            </View>
          </GameSurface>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

function CareRow({ action, animateLayout, entryDelayMs, onNotToday, onStart, swipeExternalGesture }: {
  action: RankedTodayCareAction;
  animateLayout: boolean;
  entryDelayMs: number;
  onNotToday: () => void;
  onStart: (rewardFrom: FeedSourceRect) => void;
  swipeExternalGesture: GestureType;
}) {
  const rewardRef = useRef<ViewType | null>(null);
  const handleStart = () => {
    if (rewardRef.current) {
      rewardRef.current.measureInWindow((x, y, width, height) => onStart({ h: height, w: width, x, y }));
    } else {
      onStart({ h: 32, w: 54, x: 0, y: 0 });
    }
  };
  return (
    <DayActionActiveRow
      animateLayout={animateLayout}
      entryDelayMs={entryDelayMs}
      externalGesture={swipeExternalGesture}
      label={action.title}
      onSkip={onNotToday}>
      <Pressable
        accessibilityHint="Double tap to start. Swipe right to reveal Skip, or swipe left to close it."
        accessibilityRole="button"
        onPress={handleStart}
        style={({ pressed }) => [styles.careDoorPressable, pressed && styles.rowPressed]}>
        <DayActionCardSurface
          artwork={action.category === 'play' && action.familyId ? (
            <CompanionGoalPortrait familyId={action.familyId} size={38} />
          ) : (
            <CareActionArt action={action} />
          )}
          reward={<View collapsable={false} ref={rewardRef}><Reward amount={action.growthReward} /></View>}
          title={action.title}
        />
      </Pressable>
    </DayActionActiveRow>
  );
}

function CareActionArt({ action, completed = false }: { action: RankedTodayCareAction; completed?: boolean }) {
  const art = todayCareArt(action.artKey);
  return (
    <View style={[styles.doorIcon, completed && styles.completedIcon]}>
      {art ? (
        <Image contentFit="contain" source={art} style={styles.doorIconArt} transition={0} />
      ) : (
        <IconSymbol color={completed ? Meadow.leafDeep : Meadow.goldDeep} name={action.icon} size={25} />
      )}
    </View>
  );
}

function InlineRouteActionChoice({ action, actions, interactionLocked, onChoose, reduceMotion, selection, swipeExternalGesture }: {
  action: RankedTodayCareAction;
  actions: readonly FtueActionDefinition[];
  interactionLocked: boolean;
  onChoose: (action: FtueActionDefinition, from: FeedSourceRect) => void;
  reduceMotion: boolean;
  selection: CheckInSelection | null;
  swipeExternalGesture: GestureType;
}) {
  return <InlineCheckInPanel
    action={action}
    allowSkip={false}
    choices={actions.map((candidate) => ({
      accent: Meadow.gold,
      feedImage: GAME_CURRENCY_ART.energy,
      icon: candidate.icon,
      id: candidate.id,
      label: candidate.title,
    }))}
    completionEvent={null}
    enterFromBottom
    interactionLocked={interactionLocked}
    onChoose={(choice, from) => {
      const selected = actions.find((candidate) => candidate.id === choice.id);
      if (selected) onChoose(selected, from);
    }}
    onFinished={() => {}}
    onSkip={() => {}}
    reduceMotion={reduceMotion}
    selection={selection}
    swipeExternalGesture={swipeExternalGesture}
    textChoices
  />;
}

type InlineMetric = {
  art: ImageSourcePropType;
  label: string;
  value: number;
};

function InlineScriptedChoice({ action, completionEvent, enterFromBottom = false, interactionLocked, metric, onChoose, onFinished, onSkip, options, reduceMotion, selection, swipeExternalGesture }: {
  action: RankedTodayCareAction;
  completionEvent: TodayCareCompletionEvent | null;
  enterFromBottom?: boolean;
  interactionLocked: boolean;
  metric?: InlineMetric;
  onChoose: (option: FtueChoiceOption, from: FeedSourceRect, currencyFrom: FeedSourceRect) => void;
  onFinished?: (eventId: string) => void;
  onSkip: (from: FeedSourceRect) => void;
  options: readonly FtueChoiceOption[];
  reduceMotion: boolean;
  selection: CheckInSelection | null;
  swipeExternalGesture: GestureType;
}) {
  const sourceRef = useRef<ViewType | null>(null);
  return (
    <View collapsable={false} ref={sourceRef}>
      <InlineCheckInPanel
        action={action}
        allowSkip={false}
        choices={options.map((option, index) => ({
          accent: FTUE_CHOICE_TONES[index % FTUE_CHOICE_TONES.length].accent,
          feedImage: GAME_CURRENCY_ART.energy,
          icon: option.icon,
          id: option.id,
          image: getFtueChoiceArt(option),
          label: option.label,
          surface: FTUE_CHOICE_TONES[index % FTUE_CHOICE_TONES.length].surface,
        }))}
        completionEvent={completionEvent}
        enterFromBottom={enterFromBottom}
        illustratedChoices
        interactionLocked={interactionLocked}
        metric={metric}
        onChoose={(choice, from, currencyFrom) => {
          const option = options.find((candidate) => candidate.id === choice.id);
          if (option) onChoose(option, from, currencyFrom);
        }}
        onFinished={onFinished ?? (() => {})}
        onSkip={() => sourceRef.current?.measureInWindow((x, y, w, h) => onSkip({ x, y, w, h }))}
        reduceMotion={reduceMotion}
        selection={selection}
        swipeExternalGesture={swipeExternalGesture}
      />
    </View>
  );
}

function Reward({ amount }: { amount: number }) {
  return <GameRewardChip amount={amount} art={GAME_CURRENCY_ART.energy} />;
}

function GrowthMeter({ growth }: { growth: TodayGrowthSummary }) {
  const feedback = useTodayEnergyFeedback();
  const reduceMotion = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();
  const compact = windowHeight < 720;
  const [meterTargetEnergy, setMeterTargetEnergy] = useState(growth.activeEnergy);
  const displayedEnergy = meterTargetEnergy;
  const previousEnergyRef = useRef(growth.activeEnergy);
  const lastLandingAtRef = useRef(0);
  const seenFeedbackKeyRef = useRef(feedback.key);
  const progress = useSharedValue(Math.min(1, growth.activeEnergy / growth.energyTarget));
  const iconPulse = useSharedValue(0);
  const targetGlow = useSharedValue(0);
  const targetReachedRef = useRef(growth.activeEnergy >= growth.energyTarget);
  useEffect(() => () => {
    cancelAnimation(progress);
    cancelAnimation(iconPulse);
    cancelAnimation(targetGlow);
  }, [iconPulse, progress, targetGlow]);
  useEffect(() => {
    if (feedback.key === seenFeedbackKeyRef.current) return;
    seenFeedbackKeyRef.current = feedback.key;
    if (feedback.index < 0) return;
    lastLandingAtRef.current = Date.now();
    setMeterTargetEnergy((current) => Math.min(growth.energyTarget, current + Math.max(0, feedback.amount)));
    runRewardIconArrivalPulse(iconPulse, reduceMotion);
  }, [feedback.amount, feedback.index, feedback.key, growth.energyTarget, iconPulse, reduceMotion]);
  useEffect(() => {
    const previous = previousEnergyRef.current;
    previousEnergyRef.current = growth.activeEnergy;
    if (growth.activeEnergy <= previous || Date.now() - lastLandingAtRef.current < 420) {
      setMeterTargetEnergy(growth.activeEnergy);
      return;
    }
    // A source-of-truth award often lands before its five visual tokens. Keep
    // the meter frozen long enough for the payout to count up one arrival at a
    // time, then reconcile as a safety net if an animation was interrupted.
    const timer = setTimeout(() => setMeterTargetEnergy(growth.activeEnergy), 1600);
    return () => clearTimeout(timer);
  }, [growth.activeEnergy]);
  useEffect(() => {
    progress.value = withTiming(Math.min(1, meterTargetEnergy / growth.energyTarget), {
      duration: reduceMotion ? 90 : 360,
      easing: Easing.out(Easing.cubic),
    });
  }, [growth.energyTarget, meterTargetEnergy, progress, reduceMotion]);
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));
  const iconPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1.46 + iconPulse.value * 0.34 }],
  }));
  useEffect(() => {
    const reached = displayedEnergy >= growth.energyTarget;
    if (reached && !targetReachedRef.current) {
      targetGlow.value = withSequence(
        withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) }),
      );
    }
    targetReachedRef.current = reached;
  }, [displayedEnergy, growth.energyTarget, targetGlow]);
  const targetGlowStyle = useAnimatedStyle(() => ({ opacity: targetGlow.value }));
  const stateLabel = ({
    fresh: 'Fresh',
    stirring: 'Stirring',
    taking_shape: 'Taking shape',
    full_of_memories: 'Full of memories',
    ready: 'Full of memories',
  } as const)[growth.contextState];
  const status = `${stateLabel} · ${Math.round(Math.min(100, growth.energyRatio * 100))}% context`;
  return (
    <View
      accessibilityLabel={`${displayedEnergy} of ${growth.energyTarget} Egg context. ${status}`}
      accessibilityRole="progressbar"
      style={[styles.meterCard, compact && styles.meterCardCompact]}>
      <View style={[styles.growthProgressCard, compact && styles.growthProgressCardCompact]}>
        <View style={[styles.energyMedallion, compact && styles.energyMedallionCompact]}>
          <Animated.View style={[styles.energyMeterIconFrame, compact && styles.energyMeterIconFrameCompact, iconPulseStyle]}>
            <IconSymbol color="#F3D37B" name="sparkles" size={compact ? 18 : 22} />
          </Animated.View>
        </View>
        <View style={styles.trackContainer}>
          <View style={styles.track}>
            <Animated.View style={[styles.fill, fillStyle]} />
            <Animated.View pointerEvents="none" style={[styles.energyTargetGlow, targetGlowStyle]} />
            <View style={styles.trackShine} />
          </View>
          <View pointerEvents="none" style={styles.energyValue}>
            <ThemedText selectable style={[styles.meterPercent, compact && styles.meterPercentCompact]} lightColor="#FFFBE9" darkColor="#FFFBE9">
              {stateLabel}
            </ThemedText>
          </View>
        </View>
        <View style={[styles.energyTailArt, compact && styles.energyTailArtCompact]}>
          <IconSymbol color="#F3D37B" name="sparkles" size={compact ? 17 : 21} />
        </View>
      </View>
      <View style={[styles.countdownPill, compact && styles.countdownPillCompact]}>
        <IconSymbol color="#F3D37B" name="sparkles" size={13} />
        <ThemedText selectable style={styles.countdown} lightColor="#F6EACB" darkColor="#F6EACB">
          {status}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F7F1E2', zIndex: 40 },
  // The viewport remains fixed while the camera plane moves within it. Moving
  // the clipping view itself exposes the page colour along the opposite edge.
  focusSceneViewport: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  focusSceneCamera: { ...StyleSheet.absoluteFillObject },
  chrome: { ...StyleSheet.absoluteFillObject },
  chromeHidden: { opacity: 0 },
  contentScroll: { position: 'relative', zIndex: 6 },
  topHudFixed: { left: 0, paddingHorizontal: 14, position: 'absolute', right: 0, zIndex: 20 },
  fixedActionCluster: { alignItems: 'center', gap: 6, left: 0, position: 'absolute', right: 0, zIndex: 12 },
  hatchReadyAction: { alignSelf: 'center', left: 30, position: 'absolute', right: 30, zIndex: 12 },
  hatchReadyActionLabel: { ...KatchaDeckUI.typography.kingdomDisplay, fontSize: 18, letterSpacing: 0.8, lineHeight: 22, textTransform: 'uppercase' },
  quietDayAction: { alignItems: 'center', backgroundColor: 'rgba(255,247,225,0.94)', borderColor: 'rgba(139,101,37,0.24)', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 6, minHeight: 34, paddingHorizontal: 13 },
  quietDayLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 11.5, fontWeight: '900' },
  actionPressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  eggStage: { alignItems: 'center', height: TODAY_KINGDOM_STAGE_HEIGHT, justifyContent: 'center', left: 0, overflow: 'visible', position: 'absolute', right: 0, zIndex: 2 },
  newDayConfetti: { left: '50%', zIndex: 0 },
  environmentFade: { bottom: 0, experimental_backgroundImage: 'linear-gradient(to bottom, rgba(247,241,226,0) 0%, rgba(247,241,226,0.72) 62%, #F7F1E2 100%)', height: 150, left: 0, position: 'absolute', right: 0, zIndex: 1 },
  meterAnchor: { left: 0, position: 'absolute', right: 0, zIndex: 4 },
  meterCard: { alignItems: 'center', alignSelf: 'center', gap: 4, width: '72%' },
  meterCardCompact: { gap: 3, width: '68%' },
  growthProgressCard: { alignItems: 'center', backgroundColor: 'rgba(246,243,224,0.78)', borderColor: 'rgba(255,255,246,0.66)', borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, boxShadow: '0 5px 14px rgba(35,65,54,0.18), inset 0 1px 0 rgba(255,255,255,0.76)', flexDirection: 'row', gap: 7, height: 36, paddingLeft: 31, paddingRight: 10, width: '100%' },
  growthProgressCardCompact: { borderRadius: 14, height: 32, paddingLeft: 27, paddingRight: 8 },
  energyMedallion: { alignItems: 'center', backgroundColor: 'rgba(250,244,218,0.96)', borderColor: 'rgba(255,255,249,0.92)', borderRadius: 999, borderWidth: 1.5, boxShadow: '0 4px 10px rgba(69,53,23,0.22), inset 0 1px 0 rgba(255,255,255,0.92)', height: 44, justifyContent: 'center', left: -9, position: 'absolute', width: 44, zIndex: 2 },
  energyMedallionCompact: { height: 38, left: -8, width: 38 },
  meterPercent: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontVariant: ['tabular-nums'], fontWeight: '900' },
  meterPercentCompact: { fontSize: 9.5 },
  energyValue: { alignItems: 'center', ...StyleSheet.absoluteFillObject, flexDirection: 'row', gap: 4, justifyContent: 'center', overflow: 'visible', zIndex: 1 },
  energyMeterIconFrame: { height: 29, width: 29 },
  energyMeterIconFrameCompact: { height: 25, width: 25 },
  energyMeterIcon: { height: '100%', width: '100%' },
  energyTailArt: { height: 20, width: 20 },
  energyTailArtCompact: { height: 17, width: 17 },
  energyTargetGlow: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,235,154,0.34)', borderRadius: 999, boxShadow: '0 0 16px rgba(255,225,116,0.72)' },
  countdown: { fontFamily: AppFontFamilies.manrope, fontSize: 9.5, fontVariant: ['tabular-nums'], fontWeight: '800' },
  countdownPill: { alignItems: 'center', alignSelf: 'center', backgroundColor: 'rgba(31,36,30,0.8)', borderColor: 'rgba(255,247,214,0.22)', borderRadius: 999, borderWidth: 1, boxShadow: '0 3px 9px rgba(20,31,25,0.16)', flexDirection: 'row', gap: 4, minHeight: 23, paddingHorizontal: 10 },
  countdownPillCompact: { minHeight: 21, paddingHorizontal: 8 },
  trackContainer: { flex: 1, height: 17, overflow: 'visible', position: 'relative' },
  track: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(31,27,19,0.72)', borderColor: 'rgba(255,239,196,0.32)', borderRadius: 999, borderWidth: 2, boxShadow: '0 5px 14px rgba(20,16,9,0.32), inset 0 1px 3px rgba(0,0,0,0.30)', overflow: 'hidden' },
  fill: { ...StyleSheet.absoluteFillObject, backgroundColor: '#82B94D', borderRadius: 999, transformOrigin: 'left' },
  trackShine: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 999, height: 4, left: 7, position: 'absolute', right: 7, top: 3 },
  addMemoryCluster: { alignItems: 'center', minHeight: 67, paddingBottom: 5 },
  hatchRevealCluster: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'center', minHeight: 72, paddingBottom: 5 },
  doorIcon: { alignItems: 'center', height: 48, justifyContent: 'center', marginLeft: -3, width: 48 },
  doorIconArt: { height: 46, width: 46 },
  rowPressed: { backgroundColor: 'rgba(255,244,204,0.72)', transform: [{ translateY: 1 }, { scale: 0.985 }] },
  careSection: { gap: 6, paddingHorizontal: Meadow.space.page, paddingTop: 12 },
  onboardingGuide: { alignItems: 'center', paddingBottom: 12, paddingHorizontal: 12 },
  onboardingHeroGuide: { alignItems: 'center', gap: 4, left: Meadow.space.page, position: 'absolute', right: Meadow.space.page, zIndex: 18 },
  onboardingActionStage: { left: Meadow.space.page, position: 'absolute', right: Meadow.space.page, zIndex: 19 },
  checkInGroup: { gap: 6, justifyContent: 'flex-end' },
  inlineCard: { overflow: 'hidden' },
  inlineCardContent: { gap: 8, padding: 9 },
  illustratedCard: { alignSelf: 'center', maxWidth: 980, width: '100%' },
  illustratedCardContent: { gap: 5, paddingHorizontal: 8, paddingVertical: 7 },
  inlineSelectionPulse: { ...StyleSheet.absoluteFillObject, borderRadius: 16 },
  inlineHeading: { alignItems: 'center', justifyContent: 'center', minHeight: 38, position: 'relative' },
  illustratedHeading: { alignItems: 'flex-start', justifyContent: 'flex-start', minHeight: 48 },
  illustratedHeadingWide: { minHeight: 64 },
  inlineQuestionAnchor: { width: '100%' },
  illustratedQuestionAnchor: { paddingLeft: 5, paddingRight: 84 },
  illustratedQuestionAnchorSkippable: { paddingLeft: 52 },
  illustratedQuestionAnchorWide: { paddingLeft: 10, paddingRight: 132 },
  inlineQuestion: { ...KatchaDeckUI.typography.ftuePanelTitle, textAlign: 'center', width: '100%' },
  illustratedQuestion: { fontSize: 18, letterSpacing: -0.3, lineHeight: 20, paddingHorizontal: 0, textAlign: 'left' },
  illustratedQuestionWide: { fontSize: 24, letterSpacing: -0.48, lineHeight: 27 },
  illustratedQuestionBody: { ...KatchaDeckUI.typography.ftuePanelBody, fontSize: 10, lineHeight: 12, marginTop: 0 },
  illustratedQuestionBodyWide: { fontSize: 12.5, lineHeight: 16, marginTop: 2 },
  inlineQuestionRequired: { paddingLeft: 8, paddingRight: 68 },
  inlineQuestionCentered: { paddingHorizontal: 8 },
  inlineQuestionSkippable: { paddingHorizontal: 66 },
  inlineSkip: { alignItems: 'center', backgroundColor: 'rgba(122,84,44,0.08)', borderCurve: 'continuous', borderRadius: 999, justifyContent: 'center', left: 0, minHeight: 28, paddingHorizontal: 9, position: 'absolute', top: 1, zIndex: 2 },
  inlineSkipDisabled: { opacity: 0.42 },
  inlineSkipPressed: { backgroundColor: 'rgba(122,84,44,0.16)', transform: [{ scale: 0.96 }] },
  inlineSkipLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '800' },
  inlineReward: { position: 'absolute', right: 0, top: 1, zIndex: 2 },
  ftueEnergyBadge: { alignItems: 'center', backgroundColor: '#FFF4C7', borderColor: 'rgba(213,163,44,0.62)', borderCurve: 'continuous', borderRadius: 15, borderWidth: 1.5, boxShadow: '0 4px 10px rgba(134,91,19,0.18), inset 0 1px 0 rgba(255,255,255,0.92)', flexDirection: 'row', gap: 2, height: 44, justifyContent: 'center', paddingHorizontal: 5, width: 76 },
  ftueEnergyBadgeWide: { borderRadius: 19, gap: 3, height: 56, paddingHorizontal: 8, width: 104 },
  ftueEnergyBadgeArt: { height: 27, width: 24 },
  ftueEnergyBadgeArtWide: { height: 37, width: 33 },
  ftueEnergyBadgeCopy: { alignItems: 'flex-start', gap: 0 },
  ftueEnergyBadgeAmount: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 15, lineHeight: 17 },
  ftueEnergyBadgeAmountWide: { fontSize: 18, lineHeight: 20 },
  ftueEnergyBadgeLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 8, fontWeight: '900', lineHeight: 9 },
  inlineMetric: { alignItems: 'center', alignSelf: 'center', flexDirection: 'row', gap: 9, justifyContent: 'center', minHeight: 62, paddingHorizontal: 12 },
  inlineMetricArt: { height: 54, width: 54 },
  inlineMetricCopy: { alignItems: 'flex-start', gap: 0 },
  inlineMetricValue: { fontFamily: AppFontFamilies.manrope, fontSize: 25, fontVariant: ['tabular-nums'], fontWeight: '900', lineHeight: 29 },
  inlineMetricLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '800', lineHeight: 14 },
  flexCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 14, fontWeight: '900', lineHeight: 17 },
  rowBody: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '600', lineHeight: 14.5 },
  moodGrid: { flexDirection: 'row', gap: 5 },
  sleepGrid: { flexDirection: 'row', gap: 7 },
  textChoiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  textChoice: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.48)', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 5, minHeight: 34, paddingHorizontal: 12, paddingVertical: 5 },
  textChoiceLabel: KatchaDeckUI.typography.ftueChipLabel,
  illustratedChoiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, justifyContent: 'center' },
  illustratedChoice: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 15, borderWidth: 1.25, boxShadow: '0 3px 8px rgba(86,66,34,0.13), inset 0 1px 0 rgba(255,255,255,0.82)', gap: 0, justifyContent: 'flex-end', minHeight: 70, overflow: 'hidden', paddingBottom: 4, paddingHorizontal: 4, paddingTop: 2, position: 'relative' },
  illustratedChoiceThreeColumn: { minHeight: 66, paddingBottom: 3, paddingTop: 2 },
  illustratedChoiceSelected: { borderWidth: 2, boxShadow: '0 5px 13px rgba(86,66,34,0.20), inset 0 1px 0 rgba(255,255,255,0.9)' },
  illustratedChoicePressed: { opacity: 0.92, transform: [{ translateY: 1 }, { scale: 0.985 }] },
  illustratedChoiceHighlight: { backgroundColor: 'rgba(255,255,255,0.28)', borderRadius: 999, height: 27, left: 7, position: 'absolute', right: 7, top: 3 },
  illustratedChoiceHighlightThreeColumn: { height: 24, left: 5, right: 5, top: 2 },
  illustratedChoiceArtFrame: { alignItems: 'center', height: 39, justifyContent: 'center', width: '100%' },
  illustratedChoiceArtFrameThreeColumn: { height: 36 },
  illustratedChoiceArt: { height: 40, width: 46 },
  illustratedChoiceArtThreeColumn: { height: 37, width: 43 },
  illustratedChoiceLabel: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 10.5, letterSpacing: -0.15, lineHeight: 11.5, minHeight: 20, textAlign: 'center', textAlignVertical: 'center', width: '100%' },
  illustratedChoiceLabelThreeColumn: { fontSize: 9.5, lineHeight: 10.5, minHeight: 19 },
  illustratedChoiceGlint: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.74)', borderRadius: 999, borderWidth: 1, bottom: 3, height: 15, justifyContent: 'center', position: 'absolute', right: 3, width: 15 },
  moodChoiceCell: { flex: 1 },
  sleepChoiceCell: { flex: 1 },
  quickChoice: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.48)', borderCurve: 'continuous', borderRadius: 12, borderWidth: 1, gap: 1, minHeight: 55, paddingHorizontal: 3, paddingVertical: 5 },
  choiceDimmed: { opacity: 0.48 },
  choicePressed: { backgroundColor: 'rgba(255,244,204,0.58)', transform: [{ translateY: 1 }, { scale: 0.98 }] },
  quickChoiceArt: { height: 27, width: 31 },
  quickChoiceLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 9.5, fontWeight: '800', textAlign: 'center' },
  careDoorPressable: { borderRadius: 18 },
  careDoor: { minHeight: 58 },
  stepEnergyContent: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 62, paddingHorizontal: 14, paddingVertical: 8 },
  stepEnergyPulse: { backgroundColor: Meadow.gold },
  stepEnergyMetric: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  stepEnergyStepsArt: { height: 44, width: 44 },
  stepEnergyCopy: { gap: 0 },
  stepEnergyValue: { fontFamily: AppFontFamilies.manrope, fontSize: 15, fontVariant: ['tabular-nums'], fontWeight: '900', lineHeight: 19 },
  stepEnergyLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 10, fontWeight: '700', lineHeight: 13 },
  stepEnergyReward: { alignItems: 'center', flexDirection: 'row', gap: 4, justifyContent: 'flex-end', minWidth: 72 },
  stepEnergyArt: { height: 34, width: 34 },
  stepEnergyRewardValue: { fontFamily: AppFontFamilies.manrope, fontSize: 15, fontVariant: ['tabular-nums'], fontWeight: '900' },
  completedIcon: { opacity: 0.92 },
  completedBody: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '700', lineHeight: 14 },
  completedTick: { alignItems: 'center', backgroundColor: '#527A49', borderColor: 'rgba(255,248,218,0.9)', borderRadius: 999, borderWidth: 1.5, boxShadow: '0 3px 8px rgba(49,79,42,0.24), inset 0 1px 0 rgba(255,255,255,0.2)', height: 34, justifyContent: 'center', width: 34 },
  thriving: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.38)', borderColor: Meadow.cardBorder, borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 11, minHeight: 76, padding: 11 },
  smallIconWell: { alignItems: 'center', backgroundColor: 'rgba(229,190,106,0.18)', borderRadius: 12, height: 40, justifyContent: 'center', width: 40 },
  smallEnergyArt: { height: 34, width: 34 },
  reveal: { alignItems: 'center', backgroundColor: Meadow.gold, borderColor: 'rgba(255,244,204,0.72)', borderRadius: 999, borderWidth: 1, boxShadow: '-3px 6px 16px rgba(92,57,20,0.25), inset 0 1px 0 rgba(255,252,234,0.78)', flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 56, paddingHorizontal: 20 },
  revealLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 14, fontWeight: '900' },
  readyAdd: { alignItems: 'center', backgroundColor: Meadow.gold, borderColor: 'rgba(255,244,204,0.72)', borderRadius: 999, borderWidth: 1, boxShadow: '-3px 6px 16px rgba(92,57,20,0.25), inset 0 1px 0 rgba(255,252,234,0.78)', height: 56, justifyContent: 'center', width: 56 },
  revealPressed: { opacity: 0.88, transform: [{ translateY: 1 }, { scale: 0.97 }] },
});
