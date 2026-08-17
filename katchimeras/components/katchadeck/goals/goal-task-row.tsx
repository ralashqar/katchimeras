import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type View as ViewType } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  Easing,
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { GameSurface } from '@/components/katchadeck/ui/game-surface';
import { katchimeraFamilyById } from '@/constants/katchimera-skins';
import { Meadow } from '@/constants/meadow-theme';
import { AppFontFamilies } from '@/constants/theme';
import type { CompanionQuickGoalCompletionReceipt } from '@/hooks/use-companion-quick-goals';
import { resolveCreatureArtSource } from '@/utils/creature-art';
import {
  quickGoalCadenceLabel,
  type CompanionQuickGoalForDay,
} from '@/utils/companion-quick-goals';

import { GoalCompletionCelebration } from './goal-completion-celebration';

export type GoalTaskSourceRect = { height: number; width: number; x: number; y: number };

export type GoalTaskRowHandle = { close: () => void };

export function GoalTaskRow({
  item,
  onComplete,
  onCompleted,
  onOpen,
  onOpened,
  onSkip,
  registerHandle,
  rewardPoints,
  showCompanion,
}: {
  item: CompanionQuickGoalForDay;
  onComplete: () => CompanionQuickGoalCompletionReceipt;
  onCompleted?: (receipt: CompanionQuickGoalCompletionReceipt, source: GoalTaskSourceRect | null) => void;
  onOpen: () => void;
  onOpened?: () => void;
  onSkip: () => void;
  registerHandle?: (handle: GoalTaskRowHandle | null) => void;
  rewardPoints?: number | null;
  showCompanion: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const swipeRef = useRef<SwipeableMethods | null>(null);
  const tickRef = useRef<ViewType | null>(null);
  const completionTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const celebratingRef = useRef(false);
  const [celebrating, setCelebrating] = useState(false);
  const [celebrationSource, setCelebrationSource] = useState<GoalTaskSourceRect | null>(null);
  const portraitX = useSharedValue(0);
  const portraitRotation = useSharedValue(0);
  const portraitScale = useSharedValue(1);
  const rowOpacity = useSharedValue(1);
  const rowScale = useSharedValue(1);
  const rowX = useSharedValue(0);
  const tickScale = useSharedValue(1);
  const complete = Boolean(item.completion);
  const visuallyComplete = complete || celebrating;
  const family = katchimeraFamilyById.get(item.goal.familyId);
  const familyName = family?.displayName ?? item.goal.familyId;

  useEffect(() => {
    if (complete) return;
    const handle = { close: () => swipeRef.current?.close() };
    registerHandle?.(handle);
    return () => registerHandle?.(null);
  }, [complete, registerHandle]);

  useEffect(() => () => {
    completionTimersRef.current.forEach(clearTimeout);
    completionTimersRef.current = [];
  }, []);

  const rowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: rowOpacity.value,
    transform: [{ translateX: rowX.value }, { scale: rowScale.value }],
  }));
  const portraitAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: portraitX.value },
      { rotate: `${portraitRotation.value}deg` },
      { scale: portraitScale.value },
    ],
  }));
  const tickAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: tickScale.value }],
  }));

  const schedule = (callback: () => void, delay: number) => {
    completionTimersRef.current.push(setTimeout(callback, delay));
  };

  const beginCompletionCelebration = (source: GoalTaskSourceRect | null) => {
    if (complete || celebratingRef.current) return;
    celebratingRef.current = true;
    swipeRef.current?.close();
    setCelebrationSource(source);
    setCelebrating(true);

    if (process.env.EXPO_OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (reduceMotion) {
      tickScale.value = withSequence(withTiming(1.08, { duration: 80 }), withTiming(1, { duration: 100 }));
    } else {
      portraitX.value = withSequence(
        withTiming(-5, { duration: 55 }),
        withTiming(6, { duration: 65 }),
        withTiming(-4, { duration: 60 }),
        withTiming(3, { duration: 55 }),
        withTiming(0, { duration: 75 }),
      );
      portraitRotation.value = withSequence(
        withTiming(-5, { duration: 55 }),
        withTiming(6, { duration: 65 }),
        withTiming(-4, { duration: 60 }),
        withTiming(3, { duration: 55 }),
        withTiming(0, { duration: 75 }),
      );
      portraitScale.value = withSequence(
        withTiming(1.13, { duration: 145, easing: Easing.out(Easing.cubic) }),
        withSpring(1, { damping: 8, stiffness: 240 }),
      );
      tickScale.value = withSequence(
        withTiming(0.78, { duration: 90 }),
        withSpring(1.2, { damping: 9, stiffness: 280 }),
        withSpring(1, { damping: 10, stiffness: 240 }),
      );
      rowScale.value = withDelay(
        230,
        withSequence(
          withTiming(1.025, { duration: 130, easing: Easing.out(Easing.cubic) }),
          withSpring(1, { damping: 11, stiffness: 220 }),
        ),
      );
      rowX.value = withDelay(620, withTiming(42, { duration: 260, easing: Easing.in(Easing.cubic) }));
      rowOpacity.value = withDelay(680, withTiming(0, { duration: 210, easing: Easing.in(Easing.quad) }));
    }

    schedule(() => {
      if (process.env.EXPO_OS === 'ios') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }, reduceMotion ? 60 : 230);
    schedule(() => {
      const receipt = onComplete();
      onCompleted?.(receipt, source);
    }, reduceMotion ? 220 : 900);
  };

  const handleComplete = () => {
    if (complete) return onOpen();
    if (celebratingRef.current) return;
    if (tickRef.current) {
      tickRef.current.measureInWindow((x, y, width, height) => {
        beginCompletionCelebration({ height, width, x, y });
      });
    } else {
      beginCompletionCelebration(null);
    }
  };

  const content = (
    <Animated.View style={rowAnimatedStyle}>
      <GameSurface contentStyle={styles.rowContent} style={styles.row} tone={complete ? 'sage' : celebrating ? 'gold' : 'cream'}>
      {showCompanion ? (
        <Animated.View style={[styles.portraitRewardWrap, portraitAnimatedStyle]}>
          <CompanionGoalPortrait familyId={item.goal.familyId} />
          {rewardPoints ? (
            <Animated.View
              accessibilityLiveRegion="polite"
              entering={reduceMotion ? undefined : ZoomIn.duration(210).easing(Easing.out(Easing.back(1.08)))}
              style={styles.portraitReward}>
              <IconSymbol color="#FFF9E9" name="heart.fill" size={11} />
              <ThemedText style={styles.portraitRewardText} lightColor="#FFF9E9" darkColor="#FFF9E9">+{rewardPoints}</ThemedText>
            </Animated.View>
          ) : null}
        </Animated.View>
      ) : null}
      <Pressable
        accessibilityActions={visuallyComplete ? undefined : [
          { label: 'Complete goal', name: 'complete' },
          { label: 'Skip for today', name: 'skip' },
        ]}
        accessibilityHint={complete ? 'Opens Undo and Remember actions' : 'Opens Complete, Snooze, and Skip actions'}
        accessibilityLabel={`${item.goal.title}. ${familyName}. ${visuallyComplete ? 'Completed' : 'Active'}`}
        accessibilityRole="button"
        accessibilityState={{ disabled: celebrating, selected: visuallyComplete }}
        disabled={celebrating}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'complete') {
            beginCompletionCelebration(null);
          } else if (event.nativeEvent.actionName === 'skip') {
            onSkip();
          }
        }}
        onPress={onOpen}
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}>
        <ThemedText
          numberOfLines={2}
          style={[styles.title, complete && styles.titleComplete]}
          lightColor={Meadow.ink}
          darkColor={Meadow.ink}>
          {item.goal.title}
        </ThemedText>
        <ThemedText numberOfLines={1} style={styles.meta} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
          {showCompanion ? `${familyName} · ` : ''}{quickGoalCadenceLabel(item.goal.cadence)}
        </ThemedText>
      </Pressable>
      <Animated.View style={tickAnimatedStyle}>
        <View ref={tickRef} collapsable={false}>
        <Pressable
          accessibilityHint={complete ? 'Opens completed goal actions' : 'Completes this task immediately'}
          accessibilityLabel={complete ? `${item.goal.title}, completed` : `Complete ${item.goal.title}`}
          accessibilityRole="button"
          disabled={celebrating}
          onPress={handleComplete}
          style={({ pressed }) => [
            styles.tick,
            visuallyComplete && styles.tickComplete,
            pressed && styles.tickPressed,
          ]}>
          {visuallyComplete ? (
            <Animated.View entering={reduceMotion ? undefined : ZoomIn.duration(190).easing(Easing.out(Easing.back(1.05)))}>
              <IconSymbol color="#FFF9E9" name="checkmark" size={21} />
            </Animated.View>
          ) : (
            <IconSymbol color={Meadow.goldDeep} name="checkmark" size={18} />
          )}
        </Pressable>
        </View>
      </Animated.View>
      {celebrating ? (
        <GoalCompletionCelebration reducedMotion={reduceMotion} source={celebrationSource} />
      ) : null}
      </GameSurface>
    </Animated.View>
  );

  if (complete) return content;
  return (
    <ReanimatedSwipeable
      containerStyle={styles.swipeContainer}
      enabled={!celebrating}
      friction={1.7}
      leftThreshold={42}
      onSwipeableOpen={() => onOpened?.()}
      overshootLeft={false}
      ref={swipeRef}
      renderLeftActions={(_progress, _translation, methods) => (
        <Pressable
          accessibilityLabel={`Skip ${item.goal.title} for today`}
          accessibilityRole="button"
          onPress={() => {
            methods.close();
            if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
            onSkip();
          }}
          style={({ pressed }) => [styles.skipAction, pressed && styles.skipPressed]}>
          <IconSymbol color="#FFF9E9" name="arrow.right" size={17} />
          <ThemedText style={styles.skipText} lightColor="#FFF9E9" darkColor="#FFF9E9">Skip</ThemedText>
        </Pressable>
      )}>
      {content}
    </ReanimatedSwipeable>
  );
}

export function CompanionGoalPortrait({
  familyId,
  size = 58,
}: {
  familyId: CompanionQuickGoalForDay['goal']['familyId'];
  size?: number;
}) {
  const family = katchimeraFamilyById.get(familyId);
  const visualKey = family?.anchorVisualKey ?? null;
  return (
    <View style={[styles.portrait, { height: size, width: size }]}>
      {visualKey ? (
        <Image
          contentFit="contain"
          source={resolveCreatureArtSource(visualKey, { lod: 'thumb' })}
          style={{ height: size * 1.38, width: size * 1.38 }}
          transition={100}
        />
      ) : <IconSymbol color={Meadow.goldDeep} name="sparkles" size={22} />}
    </View>
  );
}

const styles = StyleSheet.create({
  swipeContainer: { borderCurve: 'continuous', borderRadius: 19, overflow: 'hidden' },
  row: {
    minHeight: 74,
  },
  rowContent: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 71, paddingHorizontal: 8, paddingVertical: 6 },
  body: { flex: 1, justifyContent: 'center', minHeight: 58, minWidth: 0, paddingHorizontal: 4 },
  title: { fontFamily: AppFontFamilies.manrope, fontSize: 13.5, fontWeight: '900', lineHeight: 18 },
  titleComplete: { opacity: 0.62, textDecorationLine: 'line-through' },
  meta: { fontFamily: AppFontFamilies.manrope, fontSize: 10, fontWeight: '700', lineHeight: 15, marginTop: 2 },
  tick: {
    alignItems: 'center', borderColor: Meadow.goldDeep, borderRadius: 999, borderWidth: 1.5,
    height: 48, justifyContent: 'center', width: 48,
  },
  tickComplete: { backgroundColor: Meadow.leafDeep, borderColor: Meadow.leafDeep },
  tickPressed: { opacity: 0.76, transform: [{ scale: 0.94 }] },
  portrait: { alignItems: 'center', justifyContent: 'center' },
  portraitRewardWrap: { position: 'relative' },
  portraitReward: {
    alignItems: 'center', backgroundColor: Meadow.leafDeep, borderColor: '#F5D887', borderRadius: 999,
    borderWidth: 1.5, bottom: -2, flexDirection: 'row', gap: 2, justifyContent: 'center', minHeight: 24,
    paddingHorizontal: 6, position: 'absolute', right: -4,
  },
  portraitRewardText: { fontFamily: AppFontFamilies.manrope, fontSize: 8.5, fontWeight: '900' },
  skipAction: {
    alignItems: 'center', backgroundColor: '#8F6046', flexDirection: 'row', gap: 5,
    justifyContent: 'center', paddingHorizontal: 17,
  },
  skipPressed: { backgroundColor: '#744A35' },
  skipText: { fontFamily: AppFontFamilies.manrope, fontSize: 11.5, fontWeight: '900' },
  pressed: { opacity: 0.78 },
});
