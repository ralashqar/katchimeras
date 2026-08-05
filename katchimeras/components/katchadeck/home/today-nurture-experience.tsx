import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { type ReactNode, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type View as ViewType } from 'react-native';
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInUp,
  LinearTransition,
  runOnJS,
  type SharedValue,
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';
import { LanternTimeline } from '@/components/katchadeck/home/lantern-timeline';
import { TodayExplorationBackground } from '@/components/katchadeck/home/today-exploration-background';
import { TodayKingdomEggHero } from '@/components/katchadeck/home/today-kingdom-egg-hero';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { CompanionGoalPortrait } from '@/components/katchadeck/goals/goal-task-row';
import { GoalCompletionCelebration } from '@/components/katchadeck/goals/goal-completion-celebration';
import {
  MOOD_ART,
  MOOD_CHOICES,
  type MoodMonumentChoiceId,
} from '@/components/katchadeck/world/mood-monument-sheet';
import { SLEEP_ART, SLEEP_OPTIONS } from '@/components/katchadeck/world/sleep-sheet';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { AppFontFamilies } from '@/constants/theme';
import { Meadow } from '@/constants/meadow-theme';
import type { HomeDayRecord, HomeTimelineDay, SleepQuality } from '@/types/home';
import type { HomeArchetypeId } from '@/types/world-identity';
import type { RankedTodayCareAction } from '@/utils/today-care';
import type { TodayGrowthSummary } from '@/utils/today-growth';
import type { CompanionQuickGoalCompletionReceipt } from '@/hooks/use-companion-quick-goals';
import {
  TODAY_EXPLORATION_HERO_STAGE_TOP_AFTER_SAFE_AREA,
  TODAY_KINGDOM_STAGE_HEIGHT,
} from '@/utils/today-kingdom-hero-layout';

type TodayNurtureExperienceProps = {
  actions: RankedTodayCareAction[];
  completionEvent: TodayCareCompletionEvent | null;
  day: HomeDayRecord;
  feedbackKey: number;
  growth: TodayGrowthSummary;
  homeArchetypeId?: HomeArchetypeId | null;
  onAddJournal: () => void;
  onAddPhoto: () => void;
  onAddTextNote: () => void;
  onAddVoiceNote: () => void;
  onCareNotToday: (action: RankedTodayCareAction) => void;
  onCareStart: (action: RankedTodayCareAction) => void;
  onCompleteQuickGoal: (goalId: string) => CompanionQuickGoalCompletionReceipt;
  onCompletionAnimationEnd: (eventId: string) => void;
  onOpenQuickGoal: (goalId: string) => void;
  onChooseMood: (choiceId: MoodMonumentChoiceId, label: string, from: FeedSourceRect, imageSource: number, accent: string) => void;
  onChooseSleep: (quality: SleepQuality, label: string, from: FeedSourceRect, imageSource: number, accent: string) => void;
  onReveal: () => void;
  onSelectDay: (dayId: string) => void;
  careSwipeExternalGesture: GestureType;
  sceneTranslateX: SharedValue<number>;
  topInset: number;
  bottomInset: number;
  timelineDays: HomeTimelineDay[];
  eggTargetRef: RefObject<View | null>;
};

export type TodayCareCompletionEvent = {
  id: string;
  action: RankedTodayCareAction;
};

type CheckInSelection = {
  accent: string;
  action: RankedTodayCareAction;
  id: string;
  image: number;
  kind: 'mood' | 'sleep';
  label: string;
};

export function TodayNurtureExperience({
  actions,
  bottomInset,
  completionEvent,
  day,
  eggTargetRef,
  feedbackKey,
  growth,
  homeArchetypeId,
  onAddJournal,
  onAddPhoto,
  onAddTextNote,
  onAddVoiceNote,
  onCareNotToday,
  onCareStart,
  onCompleteQuickGoal,
  onCompletionAnimationEnd,
  onOpenQuickGoal,
  onChooseMood,
  onChooseSleep,
  onReveal,
  onSelectDay,
  careSwipeExternalGesture,
  sceneTranslateX,
  timelineDays,
  topInset,
}: TodayNurtureExperienceProps) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [checkInSelection, setCheckInSelection] = useState<CheckInSelection | null>(null);
  const checkInSelectionRef = useRef<CheckInSelection | null>(null);
  const checkInLaunchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotion = useReducedMotion();
  const ready = day.canHatch || growth.isReady;
  const moodAction = actions.find((action) => action.id === 'mood');
  const sleepAction = actions.find((action) => action.id === 'sleep');
  const displayedMoodAction = moodAction ?? (checkInSelection?.kind === 'mood' ? checkInSelection.action : undefined);
  const displayedSleepAction = sleepAction ?? (checkInSelection?.kind === 'sleep' ? checkInSelection.action : undefined);
  const remainingActions = actions.filter((action) => action.id !== 'mood' && action.id !== 'sleep');
  const completionIsCheckIn = completionEvent?.action.category === 'check_in';
  const completionIsStandard = completionEvent != null
    && completionEvent.action.category !== 'check_in'
    && completionEvent.action.destination.kind !== 'quick_goal';
  const stageTop = topInset + TODAY_EXPLORATION_HERO_STAGE_TOP_AFTER_SAFE_AREA;
  const sceneVerticalNudge = 10;
  const contentVerticalNudge = 18;
  const sceneLift = -100 + sceneVerticalNudge;
  const panelStart = Math.max(316, windowHeight * 0.465) + contentVerticalNudge;
  const sceneSpacerHeight = Math.max(240, panelStart - topInset - 8);
  const eggPanStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sceneTranslateX.value }],
  }));
  useEffect(() => () => {
    if (checkInLaunchTimerRef.current) clearTimeout(checkInLaunchTimerRef.current);
  }, []);
  const beginCheckInSelection = useCallback((selection: CheckInSelection, from: FeedSourceRect) => {
    if (checkInSelectionRef.current) return;
    checkInSelectionRef.current = selection;
    setCheckInSelection(selection);
    const launchFeed = () => {
      checkInLaunchTimerRef.current = null;
      if (selection.kind === 'mood') {
        onChooseMood(selection.id as MoodMonumentChoiceId, selection.label, from, selection.image, selection.accent);
      } else {
        onChooseSleep(selection.id as SleepQuality, selection.label, from, selection.image, selection.accent);
      }
    };
    if (reduceMotion) {
      launchFeed();
    } else {
      // Let the source artwork complete its short in-panel shake before the
      // flying copy is mounted over it, so both beats remain readable.
      checkInLaunchTimerRef.current = setTimeout(launchFeed, 230);
    }
  }, [onChooseMood, onChooseSleep, reduceMotion]);
  const finishCheckInSelection = useCallback((eventId: string) => {
    if (checkInLaunchTimerRef.current) {
      clearTimeout(checkInLaunchTimerRef.current);
      checkInLaunchTimerRef.current = null;
    }
    checkInSelectionRef.current = null;
    setCheckInSelection(null);
    onCompletionAnimationEnd(eventId);
  }, [onCompletionAnimationEnd]);

  return (
    <View style={styles.root}>
      <TodayExplorationBackground
        backgroundKey="home"
        imageSize={Math.max(windowHeight, windowWidth)}
        translateX={sceneTranslateX}
        verticalOffset={sceneLift}
      />
      <View pointerEvents="none" style={styles.environmentFade} />
      <Animated.View pointerEvents="none" style={[styles.eggStage, { top: stageTop + sceneLift }, eggPanStyle]}>
        <TodayKingdomEggHero
          accentColor={day.egg.accentColor}
          coreColor={day.egg.coreColor}
          explorationStageTop={stageTop}
          feedbackKey={feedbackKey}
          growthStage={growth.stage}
          hideKingdomEnvironmentArt
          homeArchetypeId={homeArchetypeId}
          isReady={ready}
          targetRef={eggTargetRef}
        />
      </Animated.View>
      <View pointerEvents="none" style={[styles.meterAnchor, { top: stageTop - 8 }]}>
        <GrowthMeter growth={growth} />
      </View>
      <Animated.View
        entering={reduceMotion ? FadeIn.duration(80) : FadeIn.duration(220)}
        style={[styles.timelineFixed, { top: topInset + 8 }]}>
        <LanternTimeline days={timelineDays} interactionLocked={false} onSelect={onSelectDay} selectedId={day.id} />
      </Animated.View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: Math.max(104, bottomInset + 70), paddingTop: topInset + 8 }}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        style={styles.contentScroll}>
        <View pointerEvents="none" style={{ height: sceneSpacerHeight }} />

        {ready ? (
          <View style={styles.pageInset}>
            <Pressable accessibilityRole="button" onPress={onReveal} style={({ pressed }) => [styles.reveal, pressed && styles.pressed]}>
              <IconSymbol color={Meadow.ink} name="sparkles" size={22} />
              <ThemedText style={styles.revealLabel} lightColor={Meadow.ink} darkColor={Meadow.ink}>Reveal the hatch</ThemedText>
            </Pressable>
          </View>
        ) : (
          <AddMemoryButton onPress={() => setAddSheetOpen(true)} />
        )}

        <Animated.View
          layout={reduceMotion ? undefined : LinearTransition.duration(220).easing(Easing.out(Easing.cubic))}
          style={styles.careSection}>
          {displayedMoodAction || displayedSleepAction ? (
            <Animated.View
              layout={reduceMotion ? undefined : LinearTransition.duration(220).easing(Easing.out(Easing.cubic))}
              style={styles.checkInGroup}>
              {displayedMoodAction ? (
                <InlineMood
                  action={displayedMoodAction}
                  completionEvent={completionIsCheckIn && completionEvent?.action.instanceId === displayedMoodAction.instanceId ? completionEvent : null}
                  interactionLocked={checkInSelection != null}
                  onChoose={(selection, from) => beginCheckInSelection({ ...selection, action: displayedMoodAction, kind: 'mood' }, from)}
                  onFinished={finishCheckInSelection}
                  reduceMotion={reduceMotion}
                  selection={checkInSelection?.kind === 'mood' ? checkInSelection : null}
                />
              ) : null}
              {displayedSleepAction ? (
                <InlineSleep
                  action={displayedSleepAction}
                  completionEvent={completionIsCheckIn && completionEvent?.action.instanceId === displayedSleepAction.instanceId ? completionEvent : null}
                  interactionLocked={checkInSelection != null}
                  onChoose={(selection, from) => beginCheckInSelection({ ...selection, action: displayedSleepAction, kind: 'sleep' }, from)}
                  onFinished={finishCheckInSelection}
                  reduceMotion={reduceMotion}
                  selection={checkInSelection?.kind === 'sleep' ? checkInSelection : null}
                />
              ) : null}
            </Animated.View>
          ) : null}

          {completionIsStandard && completionEvent ? (
            <CompletedCareRow event={completionEvent} key={completionEvent.id} onFinished={onCompletionAnimationEnd} reduceMotion={reduceMotion} />
          ) : null}

          {remainingActions.map((action, index) => action.destination.kind === 'quick_goal' ? (
            <TodayCareGoalRow
              action={action}
              familyId={action.destination.familyId}
              goalId={action.destination.goalId}
              index={index}
              key={action.instanceId}
              onCompleteQuickGoal={onCompleteQuickGoal}
              onNotToday={() => onCareNotToday(action)}
              onOpenQuickGoal={onOpenQuickGoal}
              swipeExternalGesture={careSwipeExternalGesture}
              reduceMotion={reduceMotion}
            />
          ) : (
            <CareRow
              action={action}
              index={index}
              key={action.instanceId}
              onNotToday={() => onCareNotToday(action)}
              onStart={() => {
                if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
                onCareStart(action);
              }}
              swipeExternalGesture={careSwipeExternalGesture}
              reduceMotion={reduceMotion}
            />
          ))}

          {!actions.length && !checkInSelection ? (
            <Animated.View entering={FadeIn.duration(180)} style={styles.thriving}>
              <View style={styles.smallIconWell}><IconSymbol color={Meadow.leafDeep} name="leaf.fill" size={20} /></View>
              <View style={styles.flexCopy}>
                <ThemedText style={styles.rowTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>Your egg is thriving</ThemedText>
                <ThemedText style={styles.rowBody} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>Add another memory whenever it feels right.</ThemedText>
              </View>
            </Animated.View>
          ) : null}
        </Animated.View>
      </ScrollView>
      <AddMemorySheet
        onClose={() => setAddSheetOpen(false)}
        onJournal={onAddJournal}
        onPhoto={onAddPhoto}
        onTextNote={onAddTextNote}
        onVoiceNote={onAddVoiceNote}
        open={addSheetOpen}
      />
    </View>
  );
}

function AddMemoryButton({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.addMemoryCluster}>
      <Pressable accessibilityLabel="Add memory" accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.addMemoryButton, pressed && styles.addMemoryPressed]}>
        <IconSymbol color={Meadow.ink} name="plus" size={38} />
      </Pressable>
    </View>
  );
}

function AddMemorySheet({ onClose, onJournal, onPhoto, onTextNote, onVoiceNote, open }: {
  onClose: () => void;
  onJournal: () => void;
  onPhoto: () => void;
  onTextNote: () => void;
  onVoiceNote: () => void;
  open: boolean;
}) {
  const choose = (action: () => void) => {
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    onClose();
    requestAnimationFrame(action);
  };
  return (
    <KatchaSheet
      header={{ eyebrow: 'Add to today', title: 'Choose a memory', subtitle: 'Keep one real piece of your day.' }}
      onRequestClose={onClose}
      open={open}
      surface="parchment">
      <View style={styles.addGrid}>
        <AddMemoryOption caption="Take or choose a picture" icon="camera.fill" label="Photo" onPress={() => choose(onPhoto)} reward={15} />
        <AddMemoryOption caption="Record something in your words" icon="mic.fill" label="Voice note" onPress={() => choose(onVoiceNote)} reward={18} />
        <AddMemoryOption caption="Use the guided journal" icon="square.and.pencil" label="Journal entry" onPress={() => choose(onJournal)} reward={20} />
        <AddMemoryOption caption="Write down one quick thought" icon="bubble.left.and.bubble.right.fill" label="Written note" onPress={() => choose(onTextNote)} reward={20} />
      </View>
    </KatchaSheet>
  );
}

function AddMemoryOption({ caption, icon, label, onPress, reward }: {
  caption: string;
  icon: IconSymbolName;
  label: string;
  onPress: () => void;
  reward: number;
}) {
  return (
    <Pressable accessibilityHint={caption} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.addOption, pressed && styles.addOptionPressed]}>
      <View style={styles.addOptionTop}>
        <View style={styles.addOptionIcon}><IconSymbol color={Meadow.goldDeep} name={icon} size={23} /></View>
        <Reward amount={reward} />
      </View>
      <View style={styles.addOptionCopy}>
        <ThemedText style={styles.addOptionTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>{label}</ThemedText>
        <ThemedText style={styles.addOptionBody} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>{caption}</ThemedText>
      </View>
    </Pressable>
  );
}

type InlineChoice = {
  accent: string;
  id: string;
  image: number;
  label: string;
};

function InlineMood({ action, completionEvent, interactionLocked, onChoose, onFinished, reduceMotion, selection }: {
  action: RankedTodayCareAction;
  completionEvent: TodayCareCompletionEvent | null;
  interactionLocked: boolean;
  onChoose: (selection: Omit<CheckInSelection, 'action' | 'kind'>, from: FeedSourceRect) => void;
  onFinished: (eventId: string) => void;
  reduceMotion: boolean;
  selection: CheckInSelection | null;
}) {
  return (
    <InlineCheckInPanel
      action={action}
      choices={MOOD_CHOICES.map((choice) => ({ accent: choice.accent, id: choice.id, image: MOOD_ART[choice.state], label: choice.label }))}
      completionEvent={completionEvent}
      interactionLocked={interactionLocked}
      onChoose={onChoose}
      onFinished={onFinished}
      reduceMotion={reduceMotion}
      selection={selection}
    />
  );
}

function InlineSleep({ action, completionEvent, interactionLocked, onChoose, onFinished, reduceMotion, selection }: {
  action: RankedTodayCareAction;
  completionEvent: TodayCareCompletionEvent | null;
  interactionLocked: boolean;
  onChoose: (selection: Omit<CheckInSelection, 'action' | 'kind'>, from: FeedSourceRect) => void;
  onFinished: (eventId: string) => void;
  reduceMotion: boolean;
  selection: CheckInSelection | null;
}) {
  return (
    <InlineCheckInPanel
      action={action}
      choices={SLEEP_OPTIONS.map((option) => ({ accent: option.accent, id: option.quality, image: SLEEP_ART[option.quality], label: option.label }))}
      completionEvent={completionEvent}
      interactionLocked={interactionLocked}
      onChoose={onChoose}
      onFinished={onFinished}
      reduceMotion={reduceMotion}
      selection={selection}
      wide
    />
  );
}

function InlineCheckInPanel({ action, choices, completionEvent, interactionLocked, onChoose, onFinished, reduceMotion, selection, wide = false }: {
  action: RankedTodayCareAction;
  choices: InlineChoice[];
  completionEvent: TodayCareCompletionEvent | null;
  interactionLocked: boolean;
  onChoose: (selection: Omit<CheckInSelection, 'action' | 'kind'>, from: FeedSourceRect) => void;
  onFinished: (eventId: string) => void;
  reduceMotion: boolean;
  selection: CheckInSelection | null;
  wide?: boolean;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const panelPulse = useSharedValue(0);
  const panelScale = useSharedValue(1);
  const panelX = useSharedValue(0);
  const panelOpacity = useSharedValue(1);
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
      withTiming(0.46, { duration: 240, easing: Easing.out(Easing.cubic) }),
    );
    panelScale.value = withSequence(
      withTiming(1.012, { duration: 115, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) }),
    );
  }, [panelPulse, panelScale, reduceMotion, selection]);

  useEffect(() => {
    if (!completionEvent || completedEventRef.current === completionEvent.id) return;
    completedEventRef.current = completionEvent.id;
    const exitDelay = reduceMotion ? 40 : 100;
    panelX.value = withDelay(
      exitDelay,
      withTiming(windowWidth + 24, {
        duration: reduceMotion ? 100 : 260,
        easing: Easing.in(Easing.cubic),
      }, (finished) => {
        if (finished) runOnJS(onFinished)(completionEvent.id);
      }),
    );
    panelOpacity.value = withDelay(
      exitDelay + (reduceMotion ? 20 : 90),
      withTiming(0, {
        duration: reduceMotion ? 80 : 150,
        easing: Easing.in(Easing.quad),
      }),
    );
  }, [completionEvent, onFinished, panelOpacity, panelX, reduceMotion, windowWidth]);

  const panelStyle = useAnimatedStyle(() => ({
    opacity: panelOpacity.value,
    transform: [{ translateX: panelX.value }, { scale: panelScale.value }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({ opacity: panelPulse.value * 0.18 }));

  return (
    <Animated.View style={[styles.inlineCard, panelStyle]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.inlineSelectionPulse, { backgroundColor: selection?.accent ?? 'transparent' }, pulseStyle]}
      />
      <InlineHeading action={action} />
      <View style={wide ? styles.sleepGrid : styles.moodGrid}>
        {choices.map((choice) => (
          <MeasuredChoice
            accent={choice.accent}
            disabled={interactionLocked}
            dimmed={selection != null && selection.id !== choice.id}
            image={choice.image}
            key={choice.id}
            label={choice.label}
            onPress={(from) => onChoose(choice, from)}
            reduceMotion={reduceMotion}
            selected={selection?.id === choice.id}
            wide={wide}
          />
        ))}
      </View>
    </Animated.View>
  );
}

function InlineHeading({ action }: { action: RankedTodayCareAction }) {
  return (
    <View style={styles.inlineHeading}>
      <View style={styles.flexCopy}>
        <ThemedText style={styles.rowTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>{action.title}</ThemedText>
        <ThemedText style={styles.rowBody} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>{action.description}</ThemedText>
      </View>
      <Reward amount={action.growthReward} />
    </View>
  );
}

function MeasuredChoice({ accent, disabled, dimmed, image, label, onPress, reduceMotion, selected, wide = false }: {
  accent: string;
  disabled: boolean;
  dimmed: boolean;
  image: number;
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

function CompletedCareRow({ event, onFinished, reduceMotion }: {
  event: TodayCareCompletionEvent;
  onFinished: (eventId: string) => void;
  reduceMotion: boolean;
}) {
  const sourceRef = useRef<ViewType | null>(null);
  const [source, setSource] = useState<FeedSourceRect | null>(null);
  const rowX = useSharedValue(0);
  const rowOpacity = useSharedValue(1);
  const rowScale = useSharedValue(0.985);
  const tickScale = useSharedValue(0.72);
  const rowStyle = useAnimatedStyle(() => ({
    opacity: rowOpacity.value,
    transform: [{ translateX: rowX.value }, { scale: rowScale.value }],
  }));
  const tickStyle = useAnimatedStyle(() => ({ transform: [{ scale: tickScale.value }] }));

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      sourceRef.current?.measureInWindow((x, y, width, height) => setSource({ h: height, w: width, x, y }));
    });
    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (reduceMotion) {
      rowScale.value = withTiming(1, { duration: 80 });
      tickScale.value = withTiming(1, { duration: 100 });
    } else {
      rowScale.value = withSequence(
        withTiming(1.018, { duration: 110, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 170, easing: Easing.out(Easing.back(1.05)) }),
      );
      tickScale.value = withSequence(
        withTiming(1.12, { duration: 120, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 170, easing: Easing.out(Easing.back(1.05)) }),
      );
      rowX.value = withDelay(620, withTiming(42, { duration: 260, easing: Easing.in(Easing.cubic) }));
      rowOpacity.value = withDelay(680, withTiming(0, { duration: 210, easing: Easing.in(Easing.quad) }));
    }
    const timer = setTimeout(() => onFinished(event.id), reduceMotion ? 260 : 920);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [event.id, onFinished, reduceMotion, rowOpacity, rowScale, rowX, tickScale]);

  return (
    <Animated.View layout={reduceMotion ? undefined : LinearTransition.duration(220).easing(Easing.out(Easing.cubic))} style={[styles.careDoor, styles.careDoorComplete, rowStyle]}>
      <View style={[styles.doorIcon, styles.completedIcon]}>
        <IconSymbol color={Meadow.leafDeep} name={event.action.icon} size={20} />
      </View>
      <View style={styles.flexCopy}>
        <ThemedText numberOfLines={1} style={styles.rowTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>{event.action.title}</ThemedText>
        <ThemedText numberOfLines={1} style={styles.completedBody} lightColor={Meadow.leafDeep} darkColor={Meadow.leafDeep}>Added to today · +{event.action.growthReward} Growth</ThemedText>
      </View>
      <Animated.View style={tickStyle}>
        <View collapsable={false} ref={sourceRef} style={styles.goalTickComplete}>
          <View style={styles.completedTick}><IconSymbol color="#FFF9E9" name="checkmark" size={18} /></View>
        </View>
      </Animated.View>
      <GoalCompletionCelebration
        reducedMotion={reduceMotion}
        source={source ? { height: source.h, width: source.w, x: source.x, y: source.y } : null}
      />
    </Animated.View>
  );
}

function TodayCareGoalRow({ action, familyId, goalId, index, onCompleteQuickGoal, onNotToday, onOpenQuickGoal, reduceMotion, swipeExternalGesture }: {
  action: RankedTodayCareAction;
  familyId: Parameters<typeof CompanionGoalPortrait>[0]['familyId'];
  goalId: string;
  index: number;
  onCompleteQuickGoal: (goalId: string) => CompanionQuickGoalCompletionReceipt;
  onNotToday: () => void;
  onOpenQuickGoal: (goalId: string) => void;
  reduceMotion: boolean;
  swipeExternalGesture: GestureType;
}) {
  const tickRef = useRef<ViewType | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const celebratingRef = useRef(false);
  const [celebrating, setCelebrating] = useState(false);
  const [celebrationSource, setCelebrationSource] = useState<FeedSourceRect | null>(null);
  const rowX = useSharedValue(0);
  const rowOpacity = useSharedValue(1);
  const tickScale = useSharedValue(1);
  const portraitX = useSharedValue(0);
  const portraitRotation = useSharedValue(0);
  const portraitScale = useSharedValue(1);

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  const rowStyle = useAnimatedStyle(() => ({
    opacity: rowOpacity.value,
    transform: [{ translateX: rowX.value }],
  }));
  const tickStyle = useAnimatedStyle(() => ({ transform: [{ scale: tickScale.value }] }));
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

    if (reduceMotion) {
      tickScale.value = withSequence(withTiming(1.1, { duration: 80 }), withTiming(1, { duration: 100 }));
    } else {
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
      tickScale.value = withSequence(
        withTiming(1.13, { duration: 120, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 170, easing: Easing.out(Easing.back(1.05)) }),
      );
      rowX.value = withDelay(620, withTiming(42, { duration: 260, easing: Easing.in(Easing.cubic) }));
      rowOpacity.value = withDelay(680, withTiming(0, { duration: 210, easing: Easing.in(Easing.quad) }));
    }

    schedule(() => {
      if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, reduceMotion ? 60 : 230);
    schedule(() => onCompleteQuickGoal(goalId), reduceMotion ? 220 : 900);
  };
  const handleComplete = () => {
    if (tickRef.current) {
      tickRef.current.measureInWindow((x, y, width, height) => beginCompletion({ h: height, w: width, x, y }));
    } else {
      beginCompletion(null);
    }
  };

  return (
    <Animated.View
      layout={reduceMotion ? undefined : LinearTransition.duration(220).easing(Easing.out(Easing.cubic))}>
      <Animated.View entering={reduceMotion ? FadeIn.duration(80) : FadeInUp.delay(Math.min(index, 5) * 45).duration(220)}>
      <CareSwipeShell
        disabled={celebrating}
        externalGesture={swipeExternalGesture}
        label={action.title}
        onDismiss={onNotToday}
        reduceMotion={reduceMotion}>
        <Animated.View style={[styles.careDoor, celebrating && styles.careDoorComplete, rowStyle]}>
          <Animated.View style={portraitStyle}>
            <CompanionGoalPortrait familyId={familyId} size={38} />
          </Animated.View>
          <Pressable
            accessibilityHint="Opens this goal"
            accessibilityRole="button"
            disabled={celebrating}
            onPress={() => onOpenQuickGoal(goalId)}
            style={({ pressed }) => [styles.goalBody, pressed && styles.textPressed]}>
            <ThemedText numberOfLines={2} style={styles.rowTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>{action.title}</ThemedText>
            <ThemedText numberOfLines={1} style={styles.rowBody} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>{action.description}</ThemedText>
          </Pressable>
          <Reward amount={action.growthReward} />
          <Animated.View style={tickStyle}>
            <View collapsable={false} ref={tickRef}>
              <Pressable
                accessibilityLabel={`Complete ${action.title}`}
                accessibilityRole="button"
                disabled={celebrating}
                onPress={handleComplete}
                style={({ pressed }) => [styles.goalTick, celebrating && styles.goalTickComplete, pressed && styles.goalTickPressed]}>
                {celebrating ? (
                  <Animated.View entering={reduceMotion ? undefined : ZoomIn.duration(190)}>
                    <IconSymbol color="#FFF9E9" name="checkmark" size={18} />
                  </Animated.View>
                ) : <IconSymbol color={Meadow.goldDeep} name="checkmark" size={16} />}
              </Pressable>
            </View>
          </Animated.View>
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
        </Animated.View>
      </CareSwipeShell>
      </Animated.View>
    </Animated.View>
  );
}

function CareRow({ action, index, onNotToday, onStart, reduceMotion, swipeExternalGesture }: {
  action: RankedTodayCareAction;
  index: number;
  onNotToday: () => void;
  onStart: () => void;
  reduceMotion: boolean;
  swipeExternalGesture: GestureType;
}) {
  return (
    <Animated.View layout={reduceMotion ? undefined : LinearTransition.duration(220).easing(Easing.out(Easing.cubic))}>
      <Animated.View entering={reduceMotion ? FadeIn.duration(80) : FadeInUp.delay(Math.min(index, 5) * 45).duration(220)}>
        <CareSwipeShell
          externalGesture={swipeExternalGesture}
          label={action.title}
          onDismiss={onNotToday}
          reduceMotion={reduceMotion}>
          <Pressable
            accessibilityHint="Double tap to start. Swipe right to reveal Skip, then swipe right again to dismiss."
            accessibilityRole="button"
            onPress={onStart}
            style={({ pressed }) => [styles.careDoor, pressed && styles.rowPressed]}>
            <View style={styles.doorIcon}><IconSymbol color={Meadow.goldDeep} name={action.icon} size={20} /></View>
            <View style={styles.flexCopy}>
              <ThemedText selectable style={styles.rowTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>{action.title}</ThemedText>
              <ThemedText selectable style={styles.rowBody} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>{action.description}</ThemedText>
            </View>
            <Reward amount={action.growthReward} />
            <IconSymbol color={Meadow.inkSoft} name="chevron.right" size={16} />
          </Pressable>
        </CareSwipeShell>
      </Animated.View>
    </Animated.View>
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
    .activeOffsetX([-CARE_SWIPE_ACTIVATION_DISTANCE, CARE_SWIPE_ACTIVATION_DISTANCE])
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
      <IconSymbol color={Meadow.goldDeep} name="sparkles" size={12} />
      <ThemedText style={styles.rewardText} lightColor={Meadow.goldDeep} darkColor={Meadow.goldDeep}>+{amount}</ThemedText>
    </View>
  );
}

function GrowthMeter({ growth }: { growth: TodayGrowthSummary }) {
  const progress = useSharedValue(growth.progress / 100);
  useEffect(() => {
    progress.value = withTiming(growth.progress / 100, { duration: 620, easing: Easing.out(Easing.cubic) });
  }, [growth.progress, progress]);
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));
  const countdown = useMemo(() => formatCountdown(growth.effectiveHatchAt), [growth.effectiveHatchAt]);
  return (
    <View accessibilityLabel={`${Math.round(growth.progress)} percent grown. ${countdown}`} accessibilityRole="progressbar" style={styles.meterCard}>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
        <View style={styles.trackShine} />
        <ThemedText selectable style={styles.meterPercent} lightColor="#FFFBE9" darkColor="#FFFBE9">{Math.round(growth.progress)}%</ThemedText>
      </View>
      <View style={styles.countdownPill}>
        <IconSymbol color="#F3D37B" name="timer" size={13} />
        <ThemedText selectable style={styles.countdown} lightColor="#F6EACB" darkColor="#F6EACB">
          {countdown}{growth.earlyMinutes >= 1 ? ` · ${Math.round(growth.earlyMinutes)} min closer` : ''}
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
  contentScroll: { position: 'relative', zIndex: 6 },
  timelineFixed: { left: 0, paddingHorizontal: 2, position: 'absolute', right: 0, zIndex: 20 },
  eggStage: { alignItems: 'center', height: TODAY_KINGDOM_STAGE_HEIGHT, justifyContent: 'center', left: 0, overflow: 'visible', position: 'absolute', right: 0, zIndex: 2 },
  environmentFade: { bottom: 0, experimental_backgroundImage: 'linear-gradient(to bottom, rgba(247,241,226,0) 0%, rgba(247,241,226,0.72) 62%, #F7F1E2 100%)', height: 150, left: 0, position: 'absolute', right: 0, zIndex: 1 },
  meterAnchor: { left: 0, position: 'absolute', right: 0, zIndex: 4 },
  meterCard: { alignItems: 'center', alignSelf: 'center', gap: 8, width: '78%' },
  meterPercent: { fontFamily: AppFontFamilies.manrope, fontSize: 12.5, fontVariant: ['tabular-nums'], fontWeight: '900', left: 0, position: 'absolute', right: 0, textAlign: 'center', top: 1 },
  countdown: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontVariant: ['tabular-nums'], fontWeight: '800' },
  countdownPill: { alignItems: 'center', alignSelf: 'center', backgroundColor: 'rgba(31,27,19,0.76)', borderColor: 'rgba(255,239,196,0.18)', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 5, minHeight: 28, paddingHorizontal: 11 },
  track: { backgroundColor: 'rgba(31,27,19,0.72)', borderColor: 'rgba(255,239,196,0.32)', borderRadius: 999, borderWidth: 2, boxShadow: '0 5px 14px rgba(20,16,9,0.32), inset 0 1px 3px rgba(0,0,0,0.30)', height: 23, overflow: 'hidden', position: 'relative', width: '100%' },
  fill: { ...StyleSheet.absoluteFillObject, backgroundColor: '#82B94D', borderRadius: 999, transformOrigin: 'left' },
  trackShine: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 999, height: 4, left: 7, position: 'absolute', right: 7, top: 3 },
  pageInset: { paddingHorizontal: Meadow.space.page },
  addMemoryCluster: { alignItems: 'center', minHeight: 67, paddingBottom: 5 },
  addMemoryButton: { alignItems: 'center', backgroundColor: '#F5E6BE', borderColor: 'rgba(255,253,238,0.78)', borderCurve: 'continuous', borderRadius: 999, borderWidth: 2, boxShadow: '0 8px 22px rgba(30,20,8,0.40), inset 0 2px 0 rgba(255,255,247,0.82), inset 0 -3px 5px rgba(116,80,30,0.15)', height: 62, justifyContent: 'center', width: 62 },
  addMemoryPressed: { transform: [{ translateY: 1 }, { scale: 0.97 }] },
  addGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, paddingTop: 4 },
  addOption: { backgroundColor: 'rgba(255,248,232,0.38)', borderColor: 'rgba(122,84,44,0.16)', borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, boxShadow: '-2px 3px 7px rgba(58,38,18,0.14), inset 0 1px 0 rgba(255,248,230,0.50)', flexBasis: '47%', flexGrow: 1, gap: 12, minHeight: 130, padding: 12 },
  addOptionPressed: { backgroundColor: 'rgba(255,244,204,0.58)', borderColor: Meadow.goldDeep, transform: [{ scale: 0.975 }] },
  addOptionTop: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  addOptionIcon: { alignItems: 'center', backgroundColor: 'rgba(229,190,106,0.20)', borderCurve: 'continuous', borderRadius: 13, height: 43, justifyContent: 'center', width: 43 },
  addOptionCopy: { gap: 3 },
  addOptionTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 14, fontWeight: '800', lineHeight: 18 },
  addOptionBody: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '600', lineHeight: 14 },
  doorIcon: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.54)', borderColor: 'rgba(255,248,230,0.56)', borderCurve: 'continuous', borderRadius: 11, borderWidth: 1, height: 36, justifyContent: 'center', width: 36 },
  rowPressed: { backgroundColor: 'rgba(255,244,204,0.55)', transform: [{ scale: 0.988 }] },
  careSection: { gap: 5, paddingBottom: 24, paddingHorizontal: Meadow.space.page, paddingTop: 14 },
  checkInGroup: { gap: 6 },
  inlineCard: { backgroundColor: 'rgba(246,237,214,0.96)', borderColor: 'rgba(122,84,44,0.20)', borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, boxShadow: '0 4px 10px rgba(34,24,12,0.22), inset 0 1px 0 rgba(255,252,238,0.72)', gap: 8, overflow: 'hidden', padding: 9, position: 'relative' },
  inlineSelectionPulse: { ...StyleSheet.absoluteFillObject, borderRadius: 16 },
  inlineHeading: { alignItems: 'flex-start', flexDirection: 'row', gap: 8 },
  flexCopy: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 14, fontWeight: '800', lineHeight: 17 },
  rowBody: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '600', lineHeight: 14 },
  moodGrid: { flexDirection: 'row', gap: 5 },
  sleepGrid: { flexDirection: 'row', gap: 7 },
  moodChoiceCell: { flex: 1 },
  sleepChoiceCell: { flex: 1 },
  quickChoice: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.48)', borderCurve: 'continuous', borderRadius: 12, borderWidth: 1, gap: 1, minHeight: 55, paddingHorizontal: 3, paddingVertical: 5 },
  choiceDimmed: { opacity: 0.48 },
  choicePressed: { backgroundColor: 'rgba(255,244,204,0.58)', transform: [{ translateY: 1 }, { scale: 0.98 }] },
  quickChoiceArt: { height: 27, width: 31 },
  quickChoiceLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 9.5, fontWeight: '800', textAlign: 'center' },
  careSwipeContainer: { backgroundColor: 'transparent', borderCurve: 'continuous', borderRadius: 15, overflow: 'hidden', position: 'relative' },
  careDoor: { alignItems: 'center', backgroundColor: 'rgba(246,237,214,0.98)', borderColor: 'rgba(122,84,44,0.20)', borderCurve: 'continuous', borderRadius: 15, borderWidth: 1, boxShadow: '0 4px 10px rgba(34,24,12,0.22), inset 0 1px 0 rgba(255,252,238,0.72)', flexDirection: 'row', gap: 8, minHeight: 56, paddingHorizontal: 9, paddingVertical: 6 },
  careDoorComplete: { backgroundColor: 'rgba(235,244,211,0.98)', borderColor: 'rgba(78,112,72,0.34)' },
  completedIcon: { backgroundColor: 'rgba(123,166,91,0.16)', borderColor: 'rgba(78,112,72,0.24)' },
  completedBody: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontVariant: ['tabular-nums'], fontWeight: '800', lineHeight: 14 },
  completedTick: { alignItems: 'center', backgroundColor: Meadow.leafDeep, borderColor: '#FFF3C4', borderRadius: 999, borderWidth: 1.5, height: 36, justifyContent: 'center', width: 36 },
  goalBody: { flex: 1, gap: 2, justifyContent: 'center', minWidth: 0 },
  goalTick: { alignItems: 'center', borderColor: Meadow.goldDeep, borderRadius: 999, borderWidth: 1.5, height: 36, justifyContent: 'center', width: 36 },
  goalTickComplete: { backgroundColor: Meadow.leafDeep, borderColor: Meadow.leafDeep },
  goalTickPressed: { opacity: 0.72, transform: [{ scale: 0.94 }] },
  reward: { alignItems: 'center', backgroundColor: 'rgba(229,190,106,0.22)', borderRadius: 10, flexDirection: 'row', gap: 2, paddingHorizontal: 6, paddingVertical: 4 },
  rewardText: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontVariant: ['tabular-nums'], fontWeight: '900' },
  notTodayActionFrame: { backgroundColor: '#8F6046', bottom: 0, left: 0, position: 'absolute', top: 0, width: CARE_REVEAL_WIDTH + CARE_UNDERLAY_OVERLAP },
  notTodayAction: { alignItems: 'center', flexDirection: 'row', gap: 5, height: '100%', justifyContent: 'center', paddingHorizontal: 10, width: CARE_REVEAL_WIDTH },
  notTodayPressed: { backgroundColor: '#744A35' },
  notTodayLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '900' },
  textPressed: { opacity: 0.58 },
  thriving: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.38)', borderColor: Meadow.cardBorder, borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 11, minHeight: 76, padding: 11 },
  smallIconWell: { alignItems: 'center', backgroundColor: 'rgba(229,190,106,0.18)', borderRadius: 12, height: 40, justifyContent: 'center', width: 40 },
  reveal: { alignItems: 'center', backgroundColor: Meadow.gold, borderColor: 'rgba(255,244,204,0.72)', borderCurve: 'continuous', borderRadius: 17, borderWidth: 1, boxShadow: '-3px 6px 16px rgba(92,57,20,0.25), inset 0 1px 0 rgba(255,252,234,0.78)', flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 56, paddingHorizontal: 18 },
  revealLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 14, fontWeight: '900' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
});
