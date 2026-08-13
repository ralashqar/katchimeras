import { Image, type ImageRef } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { memo, type ReactNode, type RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent, type View as ViewType } from 'react-native';
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInUp,
  LinearTransition,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';
import { TodayTopHud } from '@/components/katchadeck/home/today-top-hud';
import { MicrocopyToast } from '@/components/katchadeck/home/microcopy-toast';
import { TodayExplorationBackground } from '@/components/katchadeck/home/today-exploration-background';
import { TodayDormantEggIndicator, TodayKingdomEggHero } from '@/components/katchadeck/home/today-kingdom-egg-hero';
import { WorldActionStack } from '@/components/katchadeck/world/world-action-stack';
import { CompanionGoalPortrait } from '@/components/katchadeck/goals/goal-task-row';
import { GoalCompletionCelebration } from '@/components/katchadeck/goals/goal-completion-celebration';
import {
  MOOD_ART,
  MOOD_CHOICES,
  type MoodMonumentChoiceId,
} from '@/components/katchadeck/world/mood-monument-sheet';
import { SLEEP_ART, SLEEP_OPTIONS } from '@/components/katchadeck/world/sleep-sheet';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppFontFamilies } from '@/constants/theme';
import {
  homeTabBarHeight,
  HOME_ACTIONS_TAB_BAR_GAP,
  HOME_ACTIONS_Y_OFFSET,
  HOME_EGG_ACTIONS_GAP,
  HOME_SCENE_Y_OFFSET,
} from '@/constants/home-loop-layout';
import { Meadow } from '@/constants/meadow-theme';
import { todayCareArt } from '@/constants/today-care-art';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import type { HomeDayRecord, HomeTimelineDay, SleepQuality } from '@/types/home';
import type { HomeArchetypeId } from '@/types/world-identity';
import type { WispId } from '@/types/wisp';
import type { RankedTodayCareAction } from '@/utils/today-care';
import type { TodayGrowthSummary } from '@/utils/today-growth';
import type { CompanionQuickGoalCompletionReceipt } from '@/hooks/use-companion-quick-goals';
import {
  TodayEnvironmentViewportMotionLayer,
} from '@/components/katchadeck/home/today-environment-motion';
import {
  todayExplorationEggStageFrame,
  TODAY_EXPLORATION_HERO_STAGE_TOP_AFTER_SAFE_AREA,
  TODAY_KINGDOM_STAGE_HEIGHT,
} from '@/utils/today-kingdom-hero-layout';
import { useTodayEnergyFeedback } from '@/features/today/today-energy-feedback';
import { eggAvatarCustomizerCamera } from '@/utils/egg-avatar-customizer-camera';

type TodayNurtureExperienceProps = {
  actionListLocked: boolean;
  actionListHidden?: boolean;
  actionTransitionActive: boolean;
  actions: RankedTodayCareAction[];
  completionEvent: TodayCareCompletionEvent | null;
  day: HomeDayRecord;
  companionWispId?: WispId | null;
  feedbackKey: number;
  focusMode?: boolean;
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
  onChooseMood: (choiceId: MoodMonumentChoiceId, label: string, from: FeedSourceRect, imageSource: number, accent: string, currencyFrom: FeedSourceRect) => void;
  onChooseSleep: (quality: SleepQuality, label: string, from: FeedSourceRect, imageSource: number, accent: string, currencyFrom: FeedSourceRect) => void;
  onReveal: () => void;
  onRewardFlight: (from: FeedSourceRect, action: RankedTodayCareAction, onArrive: () => void) => void;
  onSelectDay: (dayId: string) => void;
  careSwipeExternalGesture: GestureType;
  environmentGesture: GestureType;
  sceneTranslateX: SharedValue<number>;
  topInset: number;
  bottomInset: number;
  timelineDays: HomeTimelineDay[];
  eggTargetRef: RefObject<View | null>;
  energyHudPulseNonce?: number;
  energyHudTargetRef?: RefObject<View | null>;
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
  kind: 'mood' | 'sleep';
  label: string;
};

export const TodayNurtureExperience = memo(function TodayNurtureExperience({
  actionListLocked,
  actionListHidden = false,
  actionTransitionActive,
  actions,
  bottomInset,
  completionEvent,
  companionWispId,
  day,
  eggTargetRef,
  energyHudPulseNonce,
  energyHudTargetRef,
  feedbackKey,
  focusMode = false,
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
  onChooseMood,
  onChooseSleep,
  onReveal,
  onRewardFlight,
  onSelectDay,
  careSwipeExternalGesture,
  environmentGesture,
  sceneTranslateX,
  timelineDays,
  topInset,
}: TodayNurtureExperienceProps) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [actionContentHeight, setActionContentHeight] = useState(0);
  const pendingActionContentHeightRef = useRef(0);
  const actionStackRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionStackRevealFrameRef = useRef<number | null>(null);
  const actionStackRevealedRef = useRef(false);
  const [actionStackInteractive, setActionStackInteractive] = useState(false);
  const [fixedActionClusterHeight, setFixedActionClusterHeight] = useState(0);
  const [checkInSelection, setCheckInSelection] = useState<CheckInSelection | null>(null);
  const [preloadedSleepArt, setPreloadedSleepArt] = useState<Partial<Record<SleepQuality, ImageRef>>>({});
  const checkInSelectionRef = useRef<CheckInSelection | null>(null);
  const reduceMotion = useReducedMotion();
  const actionStackOpacity = useSharedValue(0);
  const actionStackTranslateY = useSharedValue(reduceMotion ? 0 : 22);
  const focusProgress = useSharedValue(focusMode ? 1 : 0);
  const ready = growth.isActivated && (day.canHatch || growth.isReady);
  const quietDayAvailable = !growth.isActivated && Date.now() >= growth.scheduledHatchAt.getTime();
  const moodAction = actions.find((action) => action.id === 'mood');
  const sleepAction = actions.find((action) => action.id === 'sleep');
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
  const remainingActions = actions.filter((action) => action.id !== 'mood' && action.id !== 'sleep');
  const completionIsCheckIn = completionEvent?.action.category === 'check_in';
  const completionIsStandard = completionEvent != null
    && completionEvent.action.category !== 'check_in'
    && completionEvent.action.destination.kind !== 'quick_goal';
  const checkInTransitionActive = checkInSelection != null
    || (completionIsCheckIn && completionEvent != null);
  const settledRemainingActionsRef = useRef(remainingActions);
  useLayoutEffect(() => {
    if (!actionListLocked && !completionIsStandard && !checkInTransitionActive) {
      settledRemainingActionsRef.current = remainingActions;
    }
  }, [actionListLocked, checkInTransitionActive, completionIsStandard, remainingActions]);
  const displayedRemainingActions = completionIsStandard && completionEvent
    ? settledRemainingActionsRef.current.filter((action) => action.instanceId !== completionEvent.action.instanceId)
    : checkInTransitionActive || actionListLocked
      ? settledRemainingActionsRef.current
      : remainingActions;
  const previouslySettledRemainingActionIds = new Set(
    settledRemainingActionsRef.current.map((action) => action.instanceId),
  );
  const newlyIntroducedRemainingActionIds = new Set(
    remainingActions
      .filter((action) => !previouslySettledRemainingActionIds.has(action.instanceId))
      .map((action) => action.instanceId),
  );
  const stageTop = topInset + TODAY_EXPLORATION_HERO_STAGE_TOP_AFTER_SAFE_AREA;
  const sceneVerticalNudge = HOME_SCENE_Y_OFFSET;
  const contentVerticalNudge = HOME_ACTIONS_Y_OFFSET;
  const sceneLift = -100 + sceneVerticalNudge;
  const tabBarHeight = homeTabBarHeight(bottomInset);
  const tabBarTop = windowHeight - tabBarHeight;
  const explorationEggFrame = todayExplorationEggStageFrame(
    windowWidth,
    windowHeight,
    stageTop,
  );
  const eggVisualTop = stageTop + sceneLift + explorationEggFrame.top;
  // The compact cluster is 63px tall at full size; this leaves an 18px
  // world-space buffer before the egg's measured visual top.
  const growthMeterTop = eggVisualTop - 81;
  const scenePinchFocusY = stageTop + sceneLift + explorationEggFrame.centerY;
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
  const eggPanStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sceneTranslateX.value }],
  }));
  useEffect(() => {
    focusProgress.value = reduceMotion
      ? focusMode ? 1 : 0
      : withTiming(focusMode ? 1 : 0, {
          duration: 360,
          easing: Easing.inOut(Easing.cubic),
        });
  }, [focusMode, focusProgress, reduceMotion]);
  const focusSceneStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: customizerCamera.translateY * focusProgress.value },
      { scale: 1 + (customizerCamera.scale - 1) * focusProgress.value },
    ],
  }));
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

  return (
    <View style={styles.root}>
      <Animated.View pointerEvents="none" style={[styles.focusScene, focusSceneStyle]}>
      <TodayEnvironmentViewportMotionLayer
        focusY={scenePinchFocusY}
        viewportHeight={windowHeight}>
        <TodayExplorationBackground
          backgroundKey="home"
          imageSize={Math.max(windowHeight, windowWidth)}
          translateX={sceneTranslateX}
          verticalOffset={sceneLift}
        />
        <Animated.View pointerEvents="none" style={[styles.eggStage, { top: stageTop + sceneLift }, eggPanStyle]}>
          <TodayKingdomEggHero
            accentColor={day.egg.accentColor}
            companionWispId={companionWispId}
            coreColor={day.egg.coreColor}
            deferGrowthUntilEnergyArrival
            explorationStageTop={stageTop}
            feedbackKey={feedbackKey}
            growthProgress={growth.energyRatio}
            growthStage={growth.stage}
            hideKingdomEnvironmentArt
            homeArchetypeId={homeArchetypeId}
            isActivated={growth.isActivated}
            isReady={ready}
            pinchStrength={0}
            showDormantIndicator={false}
            targetRef={eggTargetRef}
          />
        </Animated.View>
      </TodayEnvironmentViewportMotionLayer>
      </Animated.View>
      <View
        pointerEvents={focusMode ? 'none' : 'box-none'}
        style={[styles.chrome, focusMode && styles.chromeHidden]}>
      {!growth.isActivated ? (
        <TodayDormantEggIndicator
          energyRatio={growth.energyRatio}
          focusX={windowWidth / 2}
          focusY={scenePinchFocusY}
          left={windowWidth / 2 + 4 * explorationEggFrame.scale}
          sceneTranslateX={sceneTranslateX}
          stageScale={explorationEggFrame.scale}
          top={stageTop + sceneLift + explorationEggFrame.top + 62 * explorationEggFrame.scale}
        />
      ) : null}
      <View pointerEvents="none" style={styles.environmentFade} />
      <View pointerEvents="none" style={[styles.meterAnchor, { top: growthMeterTop }]}>
        <GrowthMeter growth={growth} />
      </View>
      <Animated.View
        entering={reduceMotion ? FadeIn.duration(80) : FadeIn.duration(220)}
        style={[styles.topHudFixed, { top: topInset + 8 }]}>
        <TodayTopHud days={timelineDays} energyPulseNonce={energyHudPulseNonce} energyTargetRef={energyHudTargetRef} interactionLocked={false} onSelectDay={onSelectDay} selectedId={day.id} />
      </Animated.View>
      {!actionListHidden ? (
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
      <MicrocopyToast message={microcopy} placementStyle={{ top: nurtureToastTop }} />
      {!actionListHidden ? (
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
          {displayedMoodAction || displayedSleepAction ? (
            <Animated.View layout={actionHandoffLayout} style={styles.checkInGroup}>
              {displayedMoodAction ? (
                <InlineMood
                  action={displayedMoodAction}
                  completionEvent={completionIsCheckIn && completionEvent?.action.instanceId === displayedMoodAction.instanceId ? completionEvent : null}
                  interactionLocked={checkInSelection != null}
                  onChoose={(selection, from, currencyFrom) => beginCheckInSelection({ ...selection, action: displayedMoodAction, kind: 'mood' }, from, currencyFrom)}
                  onFinished={finishCheckInSelection}
                  onSkip={() => onCareNotToday(displayedMoodAction)}
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
                  preloadedArt={preloadedSleepArt}
                  reduceMotion={reduceMotion}
                  selection={checkInSelection?.kind === 'sleep' ? checkInSelection : null}
                  swipeExternalGesture={careSwipeExternalGesture}
                />
              ) : null}
            </Animated.View>
          ) : null}

          {completionIsStandard && completionEvent ? (
            <CompletedCareRow
              event={completionEvent}
              key={completionEvent.id}
              onFinished={onCompletionAnimationEnd}
              onRewardFlight={onRewardFlight}
              reduceMotion={reduceMotion}
            />
          ) : null}

          {displayedRemainingActions.map((action, index) => action.destination.kind === 'quick_goal' ? (
            <TodayCareGoalRow
              action={action}
              entryDelayMs={newlyIntroducedRemainingActionIds.has(action.instanceId)
                ? ACTION_BATCH_LAYOUT_SETTLE_MS + index * 55
                : reduceMotion ? 0 : 55 + Math.min(index, 5) * 45}
              familyId={action.destination.familyId}
              goalId={action.destination.goalId}
              key={action.instanceId}
              onCompleteQuickGoal={onCompleteQuickGoal}
              onNotToday={() => onCareNotToday(action)}
              onOpenQuickGoal={onOpenQuickGoal}
              onRewardFlight={onRewardFlight}
              swipeExternalGesture={careSwipeExternalGesture}
              reduceMotion={reduceMotion}
            />
          ) : (
            <CareRow
              action={action}
              entryDelayMs={newlyIntroducedRemainingActionIds.has(action.instanceId)
                ? ACTION_BATCH_LAYOUT_SETTLE_MS + index * 55
                : reduceMotion ? 0 : 55 + Math.min(index, 5) * 45}
              key={action.instanceId}
              onNotToday={() => onCareNotToday(action)}
              onStart={(rewardFrom) => {
                if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
                onCareStart(action, rewardFrom);
              }}
              swipeExternalGesture={careSwipeExternalGesture}
              reduceMotion={reduceMotion}
            />
          ))}

          {!actions.length && !checkInSelection && !completionIsStandard ? (
            <Animated.View entering={FadeIn.duration(180)} style={styles.thriving}>
              <View style={styles.smallIconWell}><IconSymbol color={Meadow.leafDeep} name="leaf.fill" size={20} /></View>
              <View style={styles.flexCopy}>
                <ThemedText style={styles.rowTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>Your egg is thriving</ThemedText>
                <ThemedText style={styles.rowBody} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>Add another memory whenever it feels right.</ThemedText>
              </View>
            </Animated.View>
          ) : null}
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
        showLabels
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

function useActionRowLayout(reduceMotion: boolean) {
  return useMemo(
    () => reduceMotion
      ? undefined
      : LinearTransition.duration(300).easing(Easing.inOut(Easing.cubic)),
    [reduceMotion],
  );
}

type InlineChoice = {
  accent: string;
  feedImage: number;
  id: string;
  image: number | ImageRef;
  label: string;
};

const INITIAL_ACTION_STACK_SETTLE_MS = 560;
const ACTION_BATCH_LAYOUT_SETTLE_MS = 680;
const NURTURE_ACTION_CLUSTER_FALLBACK_HEIGHT = 67;
const NURTURE_TOAST_TOP_GAP = 6;

function InlineMood({ action, completionEvent, interactionLocked, onChoose, onFinished, onSkip, reduceMotion, selection, swipeExternalGesture }: {
  action: RankedTodayCareAction;
  completionEvent: TodayCareCompletionEvent | null;
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
      choices={MOOD_CHOICES.map((choice) => ({
        accent: choice.accent,
        feedImage: MOOD_ART[choice.state],
        id: choice.id,
        image: MOOD_ART[choice.state],
        label: choice.label,
      }))}
      completionEvent={completionEvent}
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
      choices={SLEEP_OPTIONS.map((option) => ({
        accent: option.accent,
        feedImage: SLEEP_ART[option.quality],
        id: option.quality,
        image: preloadedArt[option.quality] ?? SLEEP_ART[option.quality],
        label: option.label,
      }))}
      completionEvent={completionEvent}
      interactionLocked={interactionLocked}
      onChoose={onChoose}
      onFinished={onFinished}
      onSkip={onSkip}
      reduceMotion={reduceMotion}
      selection={selection}
      swipeExternalGesture={swipeExternalGesture}
      wide
    />
  );
}

function InlineCheckInPanel({ action, choices, completionEvent, interactionLocked, onChoose, onFinished, onSkip, reduceMotion, selection, swipeExternalGesture, wide = false }: {
  action: RankedTodayCareAction;
  choices: InlineChoice[];
  completionEvent: TodayCareCompletionEvent | null;
  interactionLocked: boolean;
  onChoose: (selection: Omit<CheckInSelection, 'action' | 'kind'>, from: FeedSourceRect, currencyFrom: FeedSourceRect) => void;
  onFinished: (eventId: string) => void;
  onSkip: () => void;
  reduceMotion: boolean;
  selection: CheckInSelection | null;
  swipeExternalGesture: GestureType;
  wide?: boolean;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const panelPulse = useSharedValue(0);
  const panelScale = useSharedValue(1);
  const panelX = useSharedValue(0);
  const panelOpacity = useSharedValue(1);
  const rewardRef = useRef<ViewType | null>(null);
  const completedEventRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selection) return;
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
  }, [panelPulse, panelScale, reduceMotion, selection]);

  useEffect(() => {
    if (!completionEvent || completedEventRef.current === completionEvent.id) return;
    completedEventRef.current = completionEvent.id;
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
        if (finished) runOnJS(onFinished)(completionEvent.id);
      }),
    );
    panelOpacity.value = withDelay(
      exitDelay + (reduceMotion ? 20 : 105),
      withTiming(0, {
        duration: reduceMotion ? 80 : 190,
        easing: Easing.in(Easing.quad),
      }),
    );
  }, [completionEvent, onFinished, panelOpacity, panelPulse, panelScale, panelX, reduceMotion, windowWidth]);

  const panelStyle = useAnimatedStyle(() => ({
    opacity: panelOpacity.value,
    transform: [{ translateX: panelX.value }, { scale: panelScale.value }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({ opacity: panelPulse.value * 0.28 }));

  return (
    <Animated.View
      entering={reduceMotion
        ? FadeIn.duration(70)
        : FadeInUp.delay(55).duration(320).easing(Easing.out(Easing.cubic))}>
      <CareSwipeShell
        disabled={interactionLocked}
        externalGesture={swipeExternalGesture}
        label={action.title}
        onDismiss={onSkip}
        reduceMotion={reduceMotion}>
        <Animated.View style={[styles.inlineCard, panelStyle]}>
          <Animated.View
            pointerEvents="none"
            style={[styles.inlineSelectionPulse, { backgroundColor: selection?.accent ?? 'transparent' }, pulseStyle]}
          />
          <InlineHeading action={action} disabled={interactionLocked} onSkip={onSkip} rewardRef={rewardRef} />
          <View style={wide ? styles.sleepGrid : styles.moodGrid}>
            {choices.map((choice) => (
              <MeasuredChoice
                accent={choice.accent}
                disabled={interactionLocked}
                dimmed={selection != null && selection.id !== choice.id}
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
                  if (rewardRef.current) {
                    rewardRef.current.measureInWindow((x, y, width, height) => {
                      onChoose(selectedChoice, from, { h: height, w: width, x, y });
                    });
                  } else {
                    onChoose(selectedChoice, from, from);
                  }
                }}
                reduceMotion={reduceMotion}
                selected={selection?.id === choice.id}
                wide={wide}
              />
            ))}
          </View>
        </Animated.View>
      </CareSwipeShell>
    </Animated.View>
  );
}

function InlineHeading({ action, disabled, onSkip, rewardRef }: {
  action: RankedTodayCareAction;
  disabled: boolean;
  onSkip: () => void;
  rewardRef: RefObject<ViewType | null>;
}) {
  const handleSkip = () => {
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    onSkip();
  };
  return (
    <View style={styles.inlineHeading}>
      <Pressable
        accessibilityLabel={`Skip ${action.title} for today`}
        accessibilityRole="button"
        disabled={disabled}
        hitSlop={8}
        onPress={handleSkip}
        style={({ pressed }) => [styles.inlineSkip, disabled && styles.inlineSkipDisabled, pressed && styles.inlineSkipPressed]}>
        <ThemedText style={styles.inlineSkipLabel} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>Skip</ThemedText>
      </Pressable>
      <ThemedText numberOfLines={1} style={[styles.rowTitle, styles.inlineQuestion]} lightColor={Meadow.ink} darkColor={Meadow.ink}>
        {action.title}
      </ThemedText>
      <View collapsable={false} ref={rewardRef} style={styles.inlineReward}>
        <Reward amount={action.growthReward} />
      </View>
    </View>
  );
}

function MeasuredChoice({ accent, disabled, dimmed, image, label, onPress, reduceMotion, selected, wide = false }: {
  accent: string;
  disabled: boolean;
  dimmed: boolean;
  image: number | ImageRef;
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

function CompletedCareRow({ event, onFinished, onRewardFlight, reduceMotion }: {
  event: TodayCareCompletionEvent;
  onFinished: (eventId: string) => void;
  onRewardFlight: (from: FeedSourceRect, action: RankedTodayCareAction, onArrive: () => void) => void;
  reduceMotion: boolean;
}) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const rowLayout = useActionRowLayout(reduceMotion);
  const sourceRef = useRef<ViewType | null>(null);
  const flightStartedRef = useRef(false);
  const rowX = useSharedValue(0);
  const rowOpacity = useSharedValue(1);
  const rowScale = useSharedValue(0.985);
  const tickScale = useSharedValue(0.72);
  const artX = useSharedValue(0);
  const artRotation = useSharedValue(0);
  const artScale = useSharedValue(1);
  const chargeGlow = useSharedValue(0);
  const rowStyle = useAnimatedStyle(() => ({
    opacity: rowOpacity.value,
    transform: [{ translateX: rowX.value }, { scale: rowScale.value }],
  }));
  const tickStyle = useAnimatedStyle(() => ({ transform: [{ scale: tickScale.value }] }));
  const artStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: artX.value },
      { rotate: `${artRotation.value}deg` },
      { scale: artScale.value },
    ],
  }));
  const chargeGlowStyle = useAnimatedStyle(() => ({
    opacity: chargeGlow.value,
    transform: [{ scale: 0.985 + chargeGlow.value * 0.025 }],
  }));
  const beginExit = useCallback(() => {
    const exitDelay = reduceMotion ? 0 : 155;
    if (!reduceMotion) {
      chargeGlow.value = withSequence(
        withTiming(1, { duration: 90, easing: Easing.out(Easing.cubic) }),
        withDelay(70, withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) })),
      );
      rowScale.value = withSequence(
        withTiming(1.04, { duration: 105, easing: Easing.out(Easing.cubic) }),
        withTiming(0.985, { duration: 270, easing: Easing.in(Easing.cubic) }),
      );
    }
    rowX.value = withDelay(
      exitDelay,
      withTiming(windowWidth + 24, {
        duration: reduceMotion ? 100 : 320,
        easing: Easing.in(Easing.cubic),
      }, (finished) => {
        if (finished) runOnJS(onFinished)(event.id);
      }),
    );
    rowOpacity.value = withDelay(
      exitDelay + (reduceMotion ? 0 : 90),
      withTiming(0, { duration: reduceMotion ? 80 : 185, easing: Easing.in(Easing.quad) }),
    );
  }, [chargeGlow, event.id, onFinished, reduceMotion, rowOpacity, rowScale, rowX, windowWidth]);

  useEffect(() => {
    let rewardTimer: ReturnType<typeof setTimeout> | null = null;
    const frame = requestAnimationFrame(() => {
      const launch = (rect: FeedSourceRect) => {
        rewardTimer = setTimeout(() => {
          if (flightStartedRef.current) return;
          flightStartedRef.current = true;
          if (event.rewardAlreadyAnimated) beginExit();
          else onRewardFlight(rect, event.action, beginExit);
        }, reduceMotion ? 30 : 90);
      };
      if (sourceRef.current) {
        sourceRef.current.measureInWindow((x, y, width, height) => launch({ h: height, w: width, x, y }));
      } else {
        launch({ h: 36, w: 36, x: windowWidth / 2 - 18, y: windowHeight * 0.68 });
      }
    });
    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (reduceMotion) {
      rowScale.value = withTiming(1, { duration: 80 });
      tickScale.value = withTiming(1, { duration: 100 });
      artScale.value = withSequence(withTiming(1.06, { duration: 80 }), withTiming(1, { duration: 110 }));
    } else {
      chargeGlow.value = withSequence(
        withTiming(1, { duration: 150, easing: Easing.out(Easing.cubic) }),
        withTiming(0.62, { duration: 320, easing: Easing.out(Easing.cubic) }),
      );
      rowScale.value = withSequence(
        withTiming(1.03, { duration: 110, easing: Easing.out(Easing.cubic) }),
        withTiming(1.015, { duration: 190, easing: Easing.out(Easing.cubic) }),
      );
      tickScale.value = withSequence(
        withTiming(1.12, { duration: 120, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 170, easing: Easing.out(Easing.back(1.05)) }),
      );
      artScale.value = withSequence(
        withTiming(1.1, { duration: 100, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 170, easing: Easing.out(Easing.cubic) }),
      );
      artX.value = withSequence(
        withTiming(-3, { duration: 45 }),
        withTiming(4, { duration: 55 }),
        withTiming(-2, { duration: 50 }),
        withTiming(0, { duration: 70, easing: Easing.out(Easing.cubic) }),
      );
      artRotation.value = withSequence(
        withTiming(-3, { duration: 45 }),
        withTiming(4, { duration: 55 }),
        withTiming(-1.5, { duration: 50 }),
        withTiming(0, { duration: 70, easing: Easing.out(Easing.cubic) }),
      );
    }
    return () => {
      cancelAnimationFrame(frame);
      if (rewardTimer) clearTimeout(rewardTimer);
    };
  }, [artRotation, artScale, artX, beginExit, chargeGlow, event.action, event.rewardAlreadyAnimated, onRewardFlight, reduceMotion, rowScale, tickScale, windowHeight, windowWidth]);

  return (
    <Animated.View layout={rowLayout}>
      <Animated.View style={[styles.careDoor, styles.careDoorComplete, rowStyle]}>
        <Animated.View pointerEvents="none" style={[styles.completionChargeGlow, chargeGlowStyle]} />
        <Animated.View style={artStyle}>
          {event.action.category === 'play' && event.action.familyId ? (
            <CompanionGoalPortrait familyId={event.action.familyId} size={38} />
          ) : (
            <CareActionArt action={event.action} completed />
          )}
        </Animated.View>
        <View style={styles.flexCopy}>
          <ThemedText numberOfLines={1} style={styles.rowTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>{event.action.title}</ThemedText>
          <ThemedText numberOfLines={1} style={styles.completedBody} lightColor={Meadow.leafDeep} darkColor={Meadow.leafDeep}>
            {event.action.category === 'play' ? 'Round complete' : 'Added to today'}
          </ThemedText>
        </View>
        <View collapsable={false} ref={sourceRef}>
          <Reward amount={event.action.growthReward} />
        </View>
        <Animated.View style={tickStyle}>
          <View style={styles.completedTick}><IconSymbol color="#FFF9E9" name="checkmark" size={17} /></View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

function TodayCareGoalRow({ action, entryDelayMs, familyId, goalId, onCompleteQuickGoal, onNotToday, onOpenQuickGoal, onRewardFlight, reduceMotion, swipeExternalGesture }: {
  action: RankedTodayCareAction;
  entryDelayMs: number;
  familyId: Parameters<typeof CompanionGoalPortrait>[0]['familyId'];
  goalId: string;
  onCompleteQuickGoal: (goalId: string) => CompanionQuickGoalCompletionReceipt;
  onNotToday: () => void;
  onOpenQuickGoal: (goalId: string, completeFromOrigin: () => void) => void;
  onRewardFlight: (from: FeedSourceRect, action: RankedTodayCareAction, onArrive: () => void) => void;
  reduceMotion: boolean;
  swipeExternalGesture: GestureType;
}) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const rowLayout = useActionRowLayout(reduceMotion);
  const rewardRef = useRef<ViewType | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const celebratingRef = useRef(false);
  const [celebrating, setCelebrating] = useState(false);
  const [celebrationSource, setCelebrationSource] = useState<FeedSourceRect | null>(null);
  const rowX = useSharedValue(0);
  const rowOpacity = useSharedValue(1);
  const portraitX = useSharedValue(0);
  const portraitRotation = useSharedValue(0);
  const portraitScale = useSharedValue(1);
  const rowScale = useSharedValue(1);
  const chargeGlow = useSharedValue(0);

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  const rowStyle = useAnimatedStyle(() => ({
    opacity: rowOpacity.value,
    transform: [{ translateX: rowX.value }, { scale: rowScale.value }],
  }));
  const chargeGlowStyle = useAnimatedStyle(() => ({
    opacity: chargeGlow.value,
    transform: [{ scale: 0.985 + chargeGlow.value * 0.025 }],
  }));
  const portraitStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: portraitX.value },
      { rotate: `${portraitRotation.value}deg` },
      { scale: portraitScale.value },
    ],
  }));
  const schedule = (callback: () => void, delay: number) => timersRef.current.push(setTimeout(callback, delay));

  const beginCompletion = (source: FeedSourceRect | null) => {
    if (celebratingRef.current) return;
    celebratingRef.current = true;
    setCelebrationSource(source);
    setCelebrating(true);
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!reduceMotion) {
      chargeGlow.value = withSequence(
        withTiming(1, { duration: 150, easing: Easing.out(Easing.cubic) }),
        withTiming(0.62, { duration: 300, easing: Easing.out(Easing.cubic) }),
        withDelay(100, withTiming(1, { duration: 90, easing: Easing.out(Easing.cubic) })),
        withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) }),
      );
      rowScale.value = withSequence(
        withTiming(1.027, { duration: 120, easing: Easing.out(Easing.cubic) }),
        withTiming(1.014, { duration: 180, easing: Easing.out(Easing.cubic) }),
        withDelay(220, withTiming(1.04, { duration: 100, easing: Easing.out(Easing.cubic) })),
        withTiming(0.985, { duration: 260, easing: Easing.in(Easing.cubic) }),
      );
      portraitScale.value = withSequence(
        withTiming(1.08, { duration: 120, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 180, easing: Easing.out(Easing.back(1.05)) }),
      );
      portraitX.value = withSequence(
        withTiming(-5, { duration: 55, easing: Easing.inOut(Easing.quad) }),
        withTiming(6, { duration: 70, easing: Easing.inOut(Easing.quad) }),
        withTiming(-3, { duration: 60, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 85, easing: Easing.out(Easing.cubic) }),
      );
      portraitRotation.value = withSequence(
        withTiming(-4, { duration: 55, easing: Easing.inOut(Easing.quad) }),
        withTiming(5, { duration: 70, easing: Easing.inOut(Easing.quad) }),
        withTiming(-2.5, { duration: 60, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 85, easing: Easing.out(Easing.cubic) }),
      );
      rowX.value = withDelay(620, withTiming(42, { duration: 260, easing: Easing.in(Easing.cubic) }));
      rowOpacity.value = withDelay(680, withTiming(0, { duration: 210, easing: Easing.in(Easing.quad) }));
    }

    schedule(() => {
      const complete = () => {
        if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onCompleteQuickGoal(goalId);
      };
      if (source) onRewardFlight(source, action, complete);
      else complete();
    }, reduceMotion ? 60 : 190);
  };
  const handleComplete = () => {
    if (rewardRef.current) {
      rewardRef.current.measureInWindow((x, y, width, height) => beginCompletion({ h: height, w: width, x, y }));
    } else {
      beginCompletion({ h: 38, w: 38, x: windowWidth - 64, y: windowHeight * 0.68 });
    }
  };

  return (
    <Animated.View layout={rowLayout}>
      <Animated.View entering={reduceMotion
        ? FadeIn.delay(entryDelayMs).duration(80)
        : FadeInUp.delay(entryDelayMs).duration(300).easing(Easing.out(Easing.cubic))}>
      <CareSwipeShell
        disabled={celebrating}
        externalGesture={swipeExternalGesture}
        label={action.title}
        onDismiss={onNotToday}
        reduceMotion={reduceMotion}>
        <Animated.View style={rowStyle}>
          <Pressable
            accessibilityHint="Opens this goal"
            accessibilityLabel={action.title}
            accessibilityRole="button"
            disabled={celebrating}
            onPress={() => onOpenQuickGoal(goalId, handleComplete)}
            style={({ pressed }) => [styles.careDoor, celebrating && styles.careDoorComplete, pressed && styles.rowPressed]}>
            {celebrating ? (
              <Animated.View pointerEvents="none" style={[styles.completionChargeGlow, chargeGlowStyle]} />
            ) : null}
            <Animated.View style={portraitStyle}>
              <CompanionGoalPortrait familyId={familyId} size={38} />
            </Animated.View>
            <View style={styles.flexCopy}>
              <ThemedText numberOfLines={2} style={styles.rowTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>{action.title}</ThemedText>
            </View>
            <View collapsable={false} ref={rewardRef}>
              <Reward amount={action.growthReward} />
            </View>
            <IconSymbol color={Meadow.inkSoft} name="chevron.right" size={16} />
            {celebrating ? (
              <GoalCompletionCelebration
                reducedMotion={reduceMotion}
                source={celebrationSource ? {
                  height: celebrationSource.h,
                  width: celebrationSource.w,
                  x: celebrationSource.x,
                  y: celebrationSource.y,
                } : null}
              />
            ) : null}
          </Pressable>
        </Animated.View>
      </CareSwipeShell>
      </Animated.View>
    </Animated.View>
  );
}

function CareRow({ action, entryDelayMs, onNotToday, onStart, reduceMotion, swipeExternalGesture }: {
  action: RankedTodayCareAction;
  entryDelayMs: number;
  onNotToday: () => void;
  onStart: (rewardFrom: FeedSourceRect) => void;
  reduceMotion: boolean;
  swipeExternalGesture: GestureType;
}) {
  const rowLayout = useActionRowLayout(reduceMotion);
  const rewardRef = useRef<ViewType | null>(null);
  const handleStart = () => {
    if (rewardRef.current) {
      rewardRef.current.measureInWindow((x, y, width, height) => onStart({ h: height, w: width, x, y }));
    } else {
      onStart({ h: 32, w: 54, x: 0, y: 0 });
    }
  };
  return (
    <Animated.View layout={rowLayout}>
      <Animated.View entering={reduceMotion
        ? FadeIn.delay(entryDelayMs).duration(80)
        : FadeInUp.delay(entryDelayMs).duration(300).easing(Easing.out(Easing.cubic))}>
        <CareSwipeShell
          externalGesture={swipeExternalGesture}
          label={action.title}
          onDismiss={onNotToday}
          reduceMotion={reduceMotion}>
          <Pressable
            accessibilityHint="Double tap to start. Swipe right to reveal Skip, then swipe right again to dismiss."
            accessibilityRole="button"
            onPress={handleStart}
            style={({ pressed }) => [styles.careDoor, pressed && styles.rowPressed]}>
            {action.category === 'play' && action.familyId ? (
              <CompanionGoalPortrait familyId={action.familyId} size={38} />
            ) : (
              <CareActionArt action={action} />
            )}
            <View style={styles.flexCopy}>
              <ThemedText numberOfLines={2} selectable style={styles.rowTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>{action.title}</ThemedText>
            </View>
            <View collapsable={false} ref={rewardRef}>
              <Reward amount={action.growthReward} />
            </View>
            <IconSymbol color={Meadow.inkSoft} name="chevron.right" size={16} />
          </Pressable>
        </CareSwipeShell>
      </Animated.View>
    </Animated.View>
  );
}

function CareActionArt({ action, completed = false }: { action: RankedTodayCareAction; completed?: boolean }) {
  const art = todayCareArt(action.artKey);
  return (
    <View style={[styles.doorIcon, completed && styles.completedIcon]}>
      {art ? (
        <Image contentFit="contain" source={art} style={styles.doorIconArt} transition={0} />
      ) : (
        <IconSymbol color={completed ? Meadow.leafDeep : Meadow.goldDeep} name={action.icon} size={20} />
      )}
    </View>
  );
}

const CARE_REVEAL_WIDTH = 96;
const CARE_UNDERLAY_OVERLAP = 36;
const CARE_SWIPE_ACTIVATION_DISTANCE = 6;
const CARE_SECOND_SWIPE_DISMISS_DISTANCE = 22;

function CareSwipeShell({ children, disabled = false, externalGesture, label, onDismiss, reduceMotion }: {
  children: ReactNode;
  disabled?: boolean;
  externalGesture: GestureType;
  label: string;
  onDismiss: () => void;
  reduceMotion: boolean;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const translateX = useSharedValue(0);
  const gestureStartX = useSharedValue(0);
  const gestureStartedOpen = useSharedValue(0);
  const gestureEnded = useSharedValue(0);
  const revealed = useSharedValue(0);
  const dismissing = useSharedValue(0);
  const dismissDistance = windowWidth + 24;
  const settleDuration = reduceMotion ? 80 : 165;
  const dismissDuration = reduceMotion ? 100 : 230;

  const notifyDismiss = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
  }, []);
  const finishDismiss = useCallback(() => onDismiss(), [onDismiss]);
  const animateDismiss = useCallback(() => {
    if (dismissing.value > 0) return;
    dismissing.value = 1;
    revealed.value = 0;
    notifyDismiss();
    translateX.value = withTiming(
      dismissDistance,
      { duration: dismissDuration, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(finishDismiss)();
      },
    );
  }, [dismissDistance, dismissDuration, dismissing, finishDismiss, notifyDismiss, revealed, translateX]);

  useEffect(() => {
    if (!disabled || dismissing.value > 0) return;
    revealed.value = 0;
    translateX.value = withTiming(0, {
      duration: reduceMotion ? 60 : 120,
      easing: Easing.out(Easing.cubic),
    });
  }, [disabled, dismissing, reduceMotion, revealed, translateX]);

  const gesture = useMemo(() => Gesture.Pan()
    .enabled(!disabled)
    .maxPointers(1)
    // Rows only own a deliberate right swipe. A left swipe fails this child
    // recognizer immediately so the parent day-page gesture remains available.
    .activeOffsetX(CARE_SWIPE_ACTIVATION_DISTANCE)
    .failOffsetX(-CARE_SWIPE_ACTIVATION_DISTANCE)
    .failOffsetY([-14, 14])
    .blocksExternalGesture(externalGesture)
    .onBegin(() => {
      if (dismissing.value > 0) return;
      cancelAnimation(translateX);
      gestureStartX.value = translateX.value;
      gestureStartedOpen.value = revealed.value;
      gestureEnded.value = 0;
    })
    .onUpdate((event) => {
      if (dismissing.value > 0) return;
      const rawX = gestureStartX.value + event.translationX;
      if (rawX < 0) {
        translateX.value = Math.max(-8, rawX * 0.12);
        return;
      }
      if (gestureStartedOpen.value > 0) {
        translateX.value = Math.min(dismissDistance, rawX);
        return;
      }
      translateX.value = rawX <= CARE_REVEAL_WIDTH
        ? rawX
        : CARE_REVEAL_WIDTH + (rawX - CARE_REVEAL_WIDTH) * 0.14;
    })
    .onEnd((event) => {
      gestureEnded.value = 1;
      if (dismissing.value > 0) return;
      const commitsSecondSwipe = gestureStartedOpen.value > 0
        && (event.translationX >= CARE_SECOND_SWIPE_DISMISS_DISTANCE || event.velocityX >= 420);
      if (commitsSecondSwipe) {
        dismissing.value = 1;
        revealed.value = 0;
        runOnJS(notifyDismiss)();
        translateX.value = withTiming(
          dismissDistance,
          { duration: dismissDuration, easing: Easing.inOut(Easing.cubic) },
          (finished) => {
            if (finished) runOnJS(finishDismiss)();
          },
        );
        return;
      }
      const shouldReveal = translateX.value >= CARE_REVEAL_WIDTH * 0.32 || event.velocityX >= 360;
      revealed.value = shouldReveal ? 1 : 0;
      translateX.value = withTiming(shouldReveal ? CARE_REVEAL_WIDTH : 0, {
        duration: settleDuration,
        easing: Easing.out(Easing.cubic),
      });
    })
    .onFinalize(() => {
      if (gestureEnded.value > 0 || dismissing.value > 0) return;
      translateX.value = withTiming(
        gestureStartedOpen.value > 0 ? CARE_REVEAL_WIDTH : 0,
        { duration: settleDuration, easing: Easing.out(Easing.cubic) },
      );
    }), [
      disabled,
      dismissDistance,
      dismissDuration,
      dismissing,
      externalGesture,
      finishDismiss,
      gestureEnded,
      gestureStartX,
      gestureStartedOpen,
      notifyDismiss,
      revealed,
      settleDuration,
      translateX,
    ]);

  const rowStyle = useAnimatedStyle(() => {
    const dismissProgress = Math.max(
      0,
      Math.min(1, (translateX.value - CARE_REVEAL_WIDTH) / Math.max(1, dismissDistance - CARE_REVEAL_WIDTH)),
    );
    return {
      opacity: 1 - dismissProgress,
      transform: [{ translateX: translateX.value }],
    };
  });
  const actionStyle = useAnimatedStyle(() => {
    const revealProgress = Math.max(0, Math.min(1, translateX.value / CARE_REVEAL_WIDTH));
    const dismissProgress = Math.max(
      0,
      Math.min(1, (translateX.value - CARE_REVEAL_WIDTH) / Math.max(1, dismissDistance - CARE_REVEAL_WIDTH)),
    );
    return {
      opacity: revealProgress * (1 - dismissProgress),
      transform: [{ translateX: -8 + revealProgress * 8 }, { scale: 0.96 + revealProgress * 0.04 }],
    };
  });

  return (
    <View style={styles.careSwipeContainer}>
      <Animated.View style={[styles.notTodayActionFrame, actionStyle]}>
        <Pressable
          accessibilityLabel={`Skip ${label} for today`}
          accessibilityRole="button"
          hitSlop={6}
          onPress={animateDismiss}
          style={({ pressed }) => [styles.notTodayAction, pressed && styles.notTodayPressed]}>
          <IconSymbol color="#FFF9E9" name="xmark" size={16} />
          <ThemedText style={styles.notTodayLabel} lightColor="#FFF9E9" darkColor="#FFF9E9">Skip</ThemedText>
        </Pressable>
      </Animated.View>
      <GestureDetector gesture={gesture}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

function Reward({ amount }: { amount: number }) {
  return (
    <View style={styles.reward}>
      <Image contentFit="contain" source={GAME_CURRENCY_ART.energy} style={styles.rewardEnergyIcon} transition={0} />
      <ThemedText style={styles.rewardText} lightColor={Meadow.goldDeep} darkColor={Meadow.goldDeep}>+{amount}</ThemedText>
    </View>
  );
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
    cancelAnimation(iconPulse);
    iconPulse.value = withSequence(
      withTiming(1, { duration: reduceMotion ? 45 : 85, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: reduceMotion ? 90 : 170, easing: Easing.out(Easing.cubic) }),
    );
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
  const countdown = useMemo(() => formatCountdown(growth.effectiveHatchAt), [growth.effectiveHatchAt]);
  const actionsRemaining = Math.max(0, growth.activationActionTarget - growth.qualifyingActionCount);
  const status = growth.isActivated
    ? `${countdown}${growth.savedMinutes >= 1 ? ` · ${Math.round(growth.savedMinutes)} min closer` : ''}`
    : actionsRemaining === 1
      ? 'Complete 1 more action to wake the egg'
      : `Complete ${actionsRemaining} actions to wake the egg`;
  return (
    <View
      accessibilityLabel={`${displayedEnergy} of ${growth.energyTarget} Growth Energy. ${status}`}
      accessibilityRole="progressbar"
      style={[styles.meterCard, compact && styles.meterCardCompact]}>
      <View style={[styles.growthProgressCard, compact && styles.growthProgressCardCompact]}>
        <View style={[styles.energyMedallion, compact && styles.energyMedallionCompact]}>
          <Animated.View style={[styles.energyMeterIconFrame, compact && styles.energyMeterIconFrameCompact, iconPulseStyle]}>
            <Image contentFit="contain" source={GAME_CURRENCY_ART.energy} style={styles.energyMeterIcon} transition={0} />
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
              {displayedEnergy} / {growth.energyTarget}
            </ThemedText>
          </View>
        </View>
        <IconSymbol color="#8F7041" name={growth.isActivated ? 'leaf.fill' : 'sparkles'} size={compact ? 14 : 17} />
      </View>
      <View style={[styles.countdownPill, compact && styles.countdownPillCompact]}>
        <IconSymbol color="#F3D37B" name={growth.isActivated ? 'timer' : 'sparkles'} size={13} />
        <ThemedText selectable style={styles.countdown} lightColor="#F6EACB" darkColor="#F6EACB">
          {status}
        </ThemedText>
      </View>
    </View>
  );
}

function formatCountdown(target: Date): string {
  const milliseconds = Math.max(0, target.getTime() - Date.now());
  if (milliseconds <= 0) return 'Ready to hatch';
  const totalMinutes = Math.ceil(milliseconds / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `Hatches in ${hours}h ${minutes}m` : `Hatches in ${minutes}m`;
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F7F1E2', zIndex: 40 },
  focusScene: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  chrome: { ...StyleSheet.absoluteFillObject },
  chromeHidden: { opacity: 0 },
  contentScroll: { position: 'relative', zIndex: 6 },
  topHudFixed: { left: 0, paddingHorizontal: 14, position: 'absolute', right: 0, zIndex: 20 },
  fixedActionCluster: { alignItems: 'center', gap: 6, left: 0, position: 'absolute', right: 0, zIndex: 12 },
  quietDayAction: { alignItems: 'center', backgroundColor: 'rgba(255,247,225,0.94)', borderColor: 'rgba(139,101,37,0.24)', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 6, minHeight: 34, paddingHorizontal: 13 },
  quietDayLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 11.5, fontWeight: '900' },
  actionPressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  eggStage: { alignItems: 'center', height: TODAY_KINGDOM_STAGE_HEIGHT, justifyContent: 'center', left: 0, overflow: 'visible', position: 'absolute', right: 0, zIndex: 2 },
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
  doorIcon: { alignItems: 'center', backgroundColor: 'rgba(244,231,193,0.68)', borderColor: 'rgba(255,252,235,0.82)', borderCurve: 'continuous', borderRadius: 12, borderWidth: 1, height: 38, justifyContent: 'center', width: 38 },
  doorIconArt: { height: 34, width: 34 },
  rowPressed: { backgroundColor: 'rgba(255,244,204,0.72)', transform: [{ translateY: 1 }, { scale: 0.985 }] },
  careSection: { gap: 6, paddingHorizontal: Meadow.space.page, paddingTop: 12 },
  checkInGroup: { gap: 6 },
  inlineCard: { backgroundColor: 'rgba(246,237,214,0.96)', borderColor: 'rgba(122,84,44,0.20)', borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, boxShadow: '0 4px 10px rgba(34,24,12,0.22), inset 0 1px 0 rgba(255,252,238,0.72)', gap: 8, overflow: 'hidden', padding: 9, position: 'relative' },
  inlineSelectionPulse: { ...StyleSheet.absoluteFillObject, borderRadius: 16 },
  inlineHeading: { alignItems: 'center', justifyContent: 'center', minHeight: 30, position: 'relative' },
  inlineQuestion: { paddingHorizontal: 66, textAlign: 'center', width: '100%' },
  inlineSkip: { alignItems: 'center', backgroundColor: 'rgba(122,84,44,0.08)', borderCurve: 'continuous', borderRadius: 999, justifyContent: 'center', left: 0, minHeight: 28, paddingHorizontal: 9, position: 'absolute', top: 1, zIndex: 2 },
  inlineSkipDisabled: { opacity: 0.42 },
  inlineSkipPressed: { backgroundColor: 'rgba(122,84,44,0.16)', transform: [{ scale: 0.96 }] },
  inlineSkipLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '800' },
  inlineReward: { position: 'absolute', right: 0, top: 1, zIndex: 2 },
  flexCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 14, fontWeight: '900', lineHeight: 17 },
  rowBody: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '600', lineHeight: 14.5 },
  moodGrid: { flexDirection: 'row', gap: 5 },
  sleepGrid: { flexDirection: 'row', gap: 7 },
  moodChoiceCell: { flex: 1 },
  sleepChoiceCell: { flex: 1 },
  quickChoice: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.48)', borderCurve: 'continuous', borderRadius: 12, borderWidth: 1, gap: 1, minHeight: 55, paddingHorizontal: 3, paddingVertical: 5 },
  choiceDimmed: { opacity: 0.48 },
  choicePressed: { backgroundColor: 'rgba(255,244,204,0.58)', transform: [{ translateY: 1 }, { scale: 0.98 }] },
  quickChoiceArt: { height: 27, width: 31 },
  quickChoiceLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 9.5, fontWeight: '800', textAlign: 'center' },
  careSwipeContainer: { backgroundColor: 'transparent', borderCurve: 'continuous', borderRadius: 20, overflow: 'hidden', position: 'relative' },
  careDoor: { alignItems: 'center', backgroundColor: 'rgba(255,248,228,0.96)', borderColor: 'rgba(255,255,244,0.78)', borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, boxShadow: '0 6px 15px rgba(50,43,25,0.18), inset 0 1px 0 rgba(255,255,255,0.88)', flexDirection: 'row', gap: 9, minHeight: 58, paddingHorizontal: 10, paddingVertical: 7 },
  careDoorComplete: { backgroundColor: 'rgba(242,245,220,0.98)', borderColor: 'rgba(78,112,72,0.28)', boxShadow: '0 5px 12px rgba(48,72,38,0.18), inset 0 1px 0 rgba(255,255,244,0.82)' },
  completionChargeGlow: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,225,126,0.18)', borderColor: 'rgba(255,229,137,0.82)', borderCurve: 'continuous', borderRadius: 15, borderWidth: 1.5, boxShadow: '0 0 22px rgba(255,210,91,0.64), inset 0 0 15px rgba(255,244,190,0.36)' },
  completedIcon: { backgroundColor: 'rgba(123,166,91,0.16)', borderColor: 'rgba(78,112,72,0.24)' },
  completedBody: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '700', lineHeight: 14 },
  completedTick: { alignItems: 'center', backgroundColor: '#527A49', borderColor: 'rgba(255,248,218,0.9)', borderRadius: 999, borderWidth: 1.5, boxShadow: '0 3px 8px rgba(49,79,42,0.24), inset 0 1px 0 rgba(255,255,255,0.2)', height: 34, justifyContent: 'center', width: 34 },
  reward: { alignItems: 'center', backgroundColor: 'rgba(246,222,157,0.44)', borderColor: 'rgba(255,250,223,0.72)', borderRadius: 13, borderWidth: 1, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.62)', flexDirection: 'row', gap: 1, minHeight: 36, paddingHorizontal: 8, paddingVertical: 5 },
  rewardEnergyIcon: { height: 25, transform: [{ scale: 1.42 }], width: 25 },
  rewardText: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 12.5, fontVariant: ['tabular-nums'], fontWeight: '700' },
  notTodayActionFrame: { backgroundColor: '#8F6046', bottom: 0, left: 0, position: 'absolute', top: 0, width: CARE_REVEAL_WIDTH + CARE_UNDERLAY_OVERLAP },
  notTodayAction: { alignItems: 'center', flexDirection: 'row', gap: 5, height: '100%', justifyContent: 'center', paddingHorizontal: 10, width: CARE_REVEAL_WIDTH },
  notTodayPressed: { backgroundColor: '#744A35' },
  notTodayLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '900' },
  thriving: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.38)', borderColor: Meadow.cardBorder, borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 11, minHeight: 76, padding: 11 },
  smallIconWell: { alignItems: 'center', backgroundColor: 'rgba(229,190,106,0.18)', borderRadius: 12, height: 40, justifyContent: 'center', width: 40 },
  reveal: { alignItems: 'center', backgroundColor: Meadow.gold, borderColor: 'rgba(255,244,204,0.72)', borderRadius: 999, borderWidth: 1, boxShadow: '-3px 6px 16px rgba(92,57,20,0.25), inset 0 1px 0 rgba(255,252,234,0.78)', flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 56, paddingHorizontal: 20 },
  revealLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 14, fontWeight: '900' },
  readyAdd: { alignItems: 'center', backgroundColor: Meadow.gold, borderColor: 'rgba(255,244,204,0.72)', borderRadius: 999, borderWidth: 1, boxShadow: '-3px 6px 16px rgba(92,57,20,0.25), inset 0 1px 0 rgba(255,252,234,0.78)', height: 56, justifyContent: 'center', width: 56 },
  revealPressed: { opacity: 0.88, transform: [{ translateY: 1 }, { scale: 0.97 }] },
});
