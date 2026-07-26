import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { type ComponentProps, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
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
import { IconSymbol } from '@/components/ui/icon-symbol';
import { katchimeraFamilyById } from '@/constants/katchimera-skins';
import { KatchaUI } from '@/constants/katcha-ui';
import { Meadow } from '@/constants/meadow-theme';
import { AppFontFamilies } from '@/constants/theme';
import {
  quickGoalCadenceLabel,
  type CompanionQuickGoalCompletion,
  type CompanionQuickGoalForDay,
} from '@/utils/companion-quick-goals';
import { resolveCreatureArtSource } from '@/utils/creature-art';

type GoalAction = 'complete' | 'done' | 'remember' | 'skip' | 'snooze' | 'undo';

export function QuickGoalActionModal({
  item,
  onComplete,
  onDismiss,
  onRemember,
  onSkip,
  onSnooze,
  onUndo,
}: {
  item: CompanionQuickGoalForDay;
  onComplete: () => CompanionQuickGoalCompletion | null;
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
  const pendingActionRef = useRef<(() => void) | null>(null);
  const [busy, setBusy] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const complete = Boolean(item.completion) || justCompleted;

  useEffect(() => {
    visibility.value = withTiming(1, {
      duration: reduceMotion ? 80 : KatchaUI.motion.contentIn,
      easing: Easing.out(Easing.cubic),
    });
  }, [reduceMotion, visibility]);

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
      setBusy(true);
      const completion = onComplete();
      if (!completion) {
        setBusy(false);
        return;
      }
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
            <View pointerEvents="none" style={styles.artWell}>
              {visualKey ? (
                <Image
                  contentFit="contain"
                  source={resolveCreatureArtSource(visualKey, { lod: 'thumb', stage: 'hatchling' })}
                  style={styles.creatureArt}
                  transition={0}
                />
              ) : (
                <IconSymbol color={Meadow.goldDeep} name="sparkles" size={38} />
              )}
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
            {complete ? 'Nicely done · +5 bond' : 'Choose one action for this goal.'}
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
