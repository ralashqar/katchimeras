import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { type ComponentProps, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, type View as ViewType } from 'react-native';
import Animated, {
  Easing,
  FadeInUp,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import type { CompanionQuickGoalCompletionReceipt } from '@/hooks/use-companion-quick-goals';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { katchimeraFamilyById } from '@/constants/katchimera-skins';
import { KatchaUI } from '@/constants/katcha-ui';
import { Meadow } from '@/constants/meadow-theme';
import { AppFontFamilies } from '@/constants/theme';
import {
  quickGoalCadenceLabel,
  type CompanionQuickGoalForDay,
} from '@/utils/companion-quick-goals';
import { resolveCreatureArtSource } from '@/utils/creature-art';

import { GoalCompletionCelebration } from './goal-completion-celebration';
import type { GoalTaskSourceRect } from './goal-task-row';

type GoalAction = 'complete' | 'done' | 'remember' | 'skip' | 'snooze' | 'undo';

export function QuickGoalActionModal({
  item,
  onComplete,
  onCompleteFromOrigin,
  onDismiss,
  onRemember,
  onSkip,
  onSnooze,
  onUndo,
}: {
  item: CompanionQuickGoalForDay;
  onComplete: () => CompanionQuickGoalCompletionReceipt;
  onCompleteFromOrigin?: () => void;
  onDismiss: () => void;
  onRemember: () => void;
  onSkip: () => void;
  onSnooze: () => void;
  onUndo: () => boolean;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const visibility = useSharedValue(reduceMotion ? 1 : 0);
  const cardPulse = useSharedValue(1);
  const creatureX = useSharedValue(0);
  const creatureRotation = useSharedValue(0);
  const creatureScale = useSharedValue(1);
  const artWellRef = useRef<ViewType | null>(null);
  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const [busy, setBusy] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [awardedPoints, setAwardedPoints] = useState<number | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [celebrationSource, setCelebrationSource] = useState<GoalTaskSourceRect | null>(null);
  const complete = Boolean(item.completion) || justCompleted;

  useEffect(() => {
    visibility.value = withTiming(1, {
      duration: reduceMotion ? 80 : KatchaUI.motion.contentIn,
      easing: Easing.out(Easing.cubic),
    });
  }, [reduceMotion, visibility]);

  useEffect(() => () => {
    if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
  }, []);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(visibility.value, [0, 1], [0, 1]),
  }));
  const stageStyle = useAnimatedStyle(() => ({
    opacity: interpolate(visibility.value, [0, 0.35, 1], [0, 0.8, 1]),
    transform: [
      { translateY: interpolate(visibility.value, [0, 1], [reduceMotion ? 0 : 20, 0]) },
      { scale: interpolate(visibility.value, [0, 1], [reduceMotion ? 1 : 0.965, 1]) * cardPulse.value },
    ],
  }));
  const creatureStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: creatureX.value },
      { rotate: `${creatureRotation.value}deg` },
      { scale: creatureScale.value },
    ],
  }));

  const showCompletionBurst = (source: GoalTaskSourceRect | null) => {
    if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
    setCelebrationSource(source);
    setCelebrating(true);
    celebrationTimerRef.current = setTimeout(() => {
      setCelebrating(false);
      celebrationTimerRef.current = null;
    }, reduceMotion ? 320 : 1050);
  };

  const celebrateCreature = () => {
    if (reduceMotion) {
      creatureScale.value = withSequence(
        withTiming(1.06, { duration: 90 }),
        withTiming(1, { duration: 120 })
      );
    } else {
      creatureX.value = withSequence(
        withTiming(-6, { duration: 55 }),
        withTiming(7, { duration: 65 }),
        withTiming(-5, { duration: 60 }),
        withTiming(4, { duration: 55 }),
        withTiming(0, { duration: 75 })
      );
      creatureRotation.value = withSequence(
        withTiming(-5, { duration: 55 }),
        withTiming(6, { duration: 65 }),
        withTiming(-4, { duration: 60 }),
        withTiming(3, { duration: 55 }),
        withTiming(0, { duration: 75 })
      );
      creatureScale.value = withSequence(
        withTiming(1.14, { duration: 145, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 210, easing: Easing.out(Easing.back(1.2)) })
      );
    }

    if (artWellRef.current) {
      artWellRef.current.measureInWindow((x, y, width, height) => {
        showCompletionBurst({ height, width, x, y });
      });
    } else {
      showCompletionBurst(null);
    }
  };

  const finishDismiss = () => {
    pendingActionRef.current?.();
    pendingActionRef.current = null;
    onDismiss();
  };
  const dismiss = (action?: () => void) => {
    if (busy) return;
    setBusy(true);
    pendingActionRef.current = action ?? null;
    visibility.value = withTiming(
      0,
      {
        duration: reduceMotion ? 70 : KatchaUI.motion.contentOut,
        easing: Easing.in(Easing.cubic),
      },
      (finished) => {
        if (finished) runOnJS(finishDismiss)();
      }
    );
  };
  const acknowledgeCompletion = () => {
    setJustCompleted(true);
    setBusy(false);
    celebrateCreature();
    cardPulse.value = reduceMotion
      ? 1
      : withSequence(
          withTiming(1.025, { duration: 120, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 170, easing: Easing.out(Easing.cubic) })
        );
  };
  const handleAction = (action: GoalAction) => {
    if (busy) return;
    if (action === 'complete') {
      if (onCompleteFromOrigin) {
        dismiss(onCompleteFromOrigin);
        return;
      }
      setBusy(true);
      const receipt = onComplete();
      if (!receipt.completion) {
        setBusy(false);
        return;
      }
      setAwardedPoints(receipt.bondAward?.points ?? null);
      if (process.env.EXPO_OS === 'ios') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      acknowledgeCompletion();
      return;
    }
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    if (action === 'undo') {
      const undone = onUndo();
      if (undone) {
        setJustCompleted(false);
        dismiss();
      }
      return;
    }
    if (action === 'remember') return dismiss(onRemember);
    if (action === 'snooze') return dismiss(onSnooze);
    if (action === 'skip') return dismiss(onSkip);
    dismiss();
  };

  const family = katchimeraFamilyById.get(item.goal.familyId);
  const familyName = family?.displayName ?? item.goal.familyId;
  const visualKey = family?.anchorVisualKey ?? null;

  return (
    <Modal
      animationType="none"
      navigationBarTranslucent
      onRequestClose={() => dismiss()}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible>
      <View accessibilityViewIsModal style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable
            accessibilityLabel="Close goal actions"
            onPress={() => dismiss()}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.stage,
            stageStyle,
            { marginBottom: Math.max(insets.bottom, 18), marginTop: Math.max(insets.top, 18) },
          ]}>
          <View style={styles.stageHeader}>
            <View style={styles.headingCopy}>
              <ThemedText style={styles.eyebrow} lightColor={Meadow.goldDeep} darkColor={Meadow.goldDeep}>
                {complete ? 'GOAL COMPLETE' : 'TODAY’S GOAL'}
              </ThemedText>
              <ThemedText style={styles.heading} lightColor={Meadow.ink} darkColor={Meadow.ink}>
                {complete ? 'A small win, noticed' : 'What feels right?'}
              </ThemedText>
            </View>
            <Pressable
              accessibilityLabel="Close"
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => dismiss()}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
              <IconSymbol color={Meadow.inkSoft} name="xmark" size={14} />
            </Pressable>
          </View>

          <View style={[styles.goalCard, complete && styles.goalCardComplete]}>
            <View collapsable={false} pointerEvents="none" ref={artWellRef} style={styles.artWell}>
              <Animated.View style={[styles.artWellMotion, creatureStyle]}>
                {visualKey ? (
                  <Image
                    contentFit="contain"
                    source={resolveCreatureArtSource(visualKey, { lod: 'thumb' })}
                    style={styles.creatureArt}
                    transition={0}
                  />
                ) : (
                  <IconSymbol color={Meadow.goldDeep} name="sparkles" size={38} />
                )}
              </Animated.View>
            </View>
            <View style={styles.goalCopy}>
              <ThemedText
                accessibilityRole="header"
                selectable
                style={[styles.goalTitle, complete && styles.goalTitleComplete]}
                lightColor={Meadow.ink}
                darkColor={Meadow.ink}>
                {item.goal.title}
              </ThemedText>
              <View style={styles.tags}>
                <GoalTag label={familyName} />
                <GoalTag label={quickGoalCadenceLabel(item.goal.cadence)} />
              </View>
            </View>
            <Animated.View
              key={complete ? 'complete' : 'open'}
              entering={reduceMotion ? undefined : FadeInUp.duration(180)}
              style={[styles.goalStatus, complete && styles.goalStatusComplete]}>
              <IconSymbol
                color={complete ? '#FFF9E9' : Meadow.goldDeep}
                name={complete ? 'checkmark' : 'sparkles'}
                size={complete ? 25 : 19}
              />
            </Animated.View>
          </View>

          <ThemedText
            accessibilityLiveRegion="polite"
            style={styles.prompt}
            lightColor={complete ? Meadow.leafDeep : Meadow.inkSoft}
            darkColor={complete ? Meadow.leafDeep : Meadow.inkSoft}>
            {complete
              ? awardedPoints
                ? `Nicely done · +${awardedPoints} bond`
                : 'Nicely done. That small step counts.'
              : 'Choose one action for this goal.'}
          </ThemedText>

          <View style={styles.actions}>
            <GoalActionButton
              disabled={busy}
              icon={complete ? 'arrow.counterclockwise' : 'clock'}
              label={complete ? 'Undo' : 'Snooze'}
              onPress={() => handleAction(complete ? 'undo' : 'snooze')}
              reduceMotion={reduceMotion}
            />
            <GoalActionButton
              disabled={busy}
              emphasized
              icon="checkmark"
              label={complete ? 'Done' : 'Complete'}
              onPress={() => handleAction(complete ? 'done' : 'complete')}
              reduceMotion={reduceMotion}
            />
            <GoalActionButton
              disabled={busy}
              icon={complete ? 'square.and.pencil' : 'arrow.right'}
              label={complete ? 'Remember' : 'Skip'}
              onPress={() => handleAction(complete ? 'remember' : 'skip')}
              reduceMotion={reduceMotion}
            />
          </View>
        </Animated.View>
        {celebrating ? (
          <GoalCompletionCelebration
            embedded
            reducedMotion={reduceMotion}
            source={celebrationSource}
          />
        ) : null}
      </View>
    </Modal>
  );
}

function GoalTag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <ThemedText style={styles.tagText} lightColor={Meadow.goldDeep} darkColor={Meadow.goldDeep}>
        {label}
      </ThemedText>
    </View>
  );
}

function GoalActionButton({
  disabled,
  emphasized = false,
  icon,
  label,
  onPress,
  reduceMotion,
}: {
  disabled: boolean;
  emphasized?: boolean;
  icon: ComponentProps<typeof IconSymbol>['name'];
  label: string;
  onPress: () => void;
  reduceMotion: boolean;
}) {
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInUp.delay(emphasized ? 70 : 110).duration(190)}
      style={styles.actionSlot}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.actionButton,
          emphasized && styles.actionButtonPrimary,
          pressed && !disabled && styles.actionButtonPressed,
          disabled && styles.actionButtonDisabled,
        ]}>
        <IconSymbol color={emphasized ? '#FFF9E9' : Meadow.inkSoft} name={icon} size={emphasized ? 27 : 22} />
      </Pressable>
      <ThemedText
        style={[styles.actionLabel, emphasized && styles.actionLabelPrimary]}
        lightColor={emphasized ? Meadow.ink : Meadow.inkSoft}
        darkColor={emphasized ? Meadow.ink : Meadow.inkSoft}>
        {label}
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: 18 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(31,22,16,0.72)' },
  stage: {
    backgroundColor: '#EAD3AA',
    borderColor: 'rgba(255,244,217,0.72)',
    borderCurve: 'continuous',
    borderRadius: 30,
    borderWidth: 1,
    boxShadow: '0 26px 70px rgba(30,18,8,0.52), inset 0 1px 0 rgba(255,248,230,0.70)',
    gap: 18,
    maxWidth: 520,
    padding: 18,
    width: '100%',
  },
  stageHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  headingCopy: { flex: 1, gap: 2, paddingLeft: 2 },
  eyebrow: { ...KatchaUI.type.label, fontSize: 10 },
  heading: { ...KatchaUI.type.display, fontSize: 25, lineHeight: 29 },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,249,234,0.50)',
    borderColor: 'rgba(119,86,43,0.18)',
    borderRadius: 999,
    borderWidth: 1,
    height: KatchaUI.touchTarget,
    justifyContent: 'center',
    width: KatchaUI.touchTarget,
  },
  goalCard: {
    alignItems: 'center',
    backgroundColor: '#FFF9EC',
    borderColor: 'rgba(184,137,54,0.46)',
    borderCurve: 'continuous',
    borderRadius: 23,
    borderWidth: 1.5,
    boxShadow: '0 13px 30px rgba(100,66,25,0.20), inset 0 1px 0 rgba(255,255,255,0.82)',
    flexDirection: 'row',
    gap: 12,
    minHeight: 118,
    paddingBottom: 13,
    paddingLeft: 6,
    paddingRight: 14,
    paddingTop: 13,
  },
  goalCardComplete: { backgroundColor: '#F5F7E8', borderColor: 'rgba(78,112,72,0.42)' },
  artWell: { alignItems: 'center', height: 92, justifyContent: 'center', overflow: 'visible', width: 98 },
  artWellMotion: { alignItems: 'center', height: '100%', justifyContent: 'center', width: '100%' },
  creatureArt: { height: 118, width: 118 },
  goalCopy: { flex: 1, gap: 10, minWidth: 0 },
  goalTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 18, fontWeight: '900', letterSpacing: -0.3, lineHeight: 23 },
  goalTitleComplete: { opacity: 0.68 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: 'rgba(223,181,94,0.18)', borderRadius: 999, justifyContent: 'center', minHeight: 24, paddingHorizontal: 8 },
  tagText: { fontFamily: AppFontFamilies.manrope, fontSize: 9, fontWeight: '900' },
  goalStatus: { alignItems: 'center', borderColor: Meadow.goldDeep, borderRadius: 999, borderWidth: 1.5, height: 48, justifyContent: 'center', width: 48 },
  goalStatusComplete: { backgroundColor: Meadow.leafDeep, borderColor: Meadow.leafDeep },
  prompt: { ...KatchaUI.type.body, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  actions: { alignItems: 'flex-start', flexDirection: 'row', gap: 8, justifyContent: 'space-around' },
  actionSlot: { alignItems: 'center', flex: 1, gap: 7 },
  actionButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,249,234,0.58)',
    borderColor: 'rgba(119,86,43,0.24)',
    borderRadius: 999,
    borderWidth: 1,
    height: 62,
    justifyContent: 'center',
    width: 62,
  },
  actionButtonPrimary: { backgroundColor: Meadow.leafDeep, borderColor: Meadow.leafDeep, boxShadow: '0 8px 18px rgba(58,91,53,0.30)', height: 72, marginTop: -5, width: 72 },
  actionButtonPressed: { opacity: 0.82, transform: [{ scale: 0.94 }] },
  actionButtonDisabled: { opacity: 0.64 },
  actionLabel: { ...KatchaUI.type.action, fontSize: 11, lineHeight: 15 },
  actionLabelPrimary: { fontWeight: '900' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.96 }] },
});
