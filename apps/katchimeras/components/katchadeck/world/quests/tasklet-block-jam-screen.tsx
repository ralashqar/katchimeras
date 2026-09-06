import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { KatchaSurfaceProvider } from '@/components/katchadeck/ui/katcha-surface';
import { ScreenCloseButton } from '@/components/katchadeck/ui/screen-close-button';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';

const TASKLET = require('@incubator/art-cutouts/tasklet.png');
const TASKLET_INK = '#4B2C20';

type Props = {
  children: ReactNode;
  deadlineMs: number;
  failed: boolean;
  instruction: string;
  onClose: () => void;
  onExpire: () => void;
  onRestart: () => void;
  onUndo: () => void;
  sorted: number;
  tier: number;
  total: number;
  undoDisabled: boolean;
};

export function TaskletBlockJamScreen({
  children,
  deadlineMs,
  failed,
  instruction,
  onClose,
  onExpire,
  onRestart,
  onUndo,
  sorted,
  tier,
  total,
  undoDisabled,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const compact = height < 740;
  const reduceMotion = useReducedMotion();
  const enter = reduceMotion ? FadeIn.duration(80) : FadeInDown.duration(260).easing(Easing.out(Easing.cubic));

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.sceneScrim} />
      <LinearGradient
        colors={['rgba(32,20,11,0.42)', 'rgba(37,23,13,0.18)', 'rgba(28,17,10,0.5)']}
        locations={[0, 0.48, 1]}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />

      <ScreenCloseButton align="left" onPress={onClose} variant="back" />

      <View
        pointerEvents="box-none"
        style={[
          styles.safeContent,
          compact && styles.safeContentCompact,
          {
            paddingBottom: Math.max(8, insets.bottom + 6),
            paddingLeft: Math.max(10, insets.left + 10),
            paddingRight: Math.max(10, insets.right + 10),
            paddingTop: insets.top + 58,
          },
        ]}>
        <Animated.View entering={enter} style={[styles.header, compact && styles.headerCompact]}>
          <View pointerEvents="none" style={styles.headerInnerRim} />
          <LinearGradient
            colors={['rgba(255,255,255,0.34)', 'rgba(255,255,255,0)']}
            end={{ x: 0, y: 1 }}
            pointerEvents="none"
            start={{ x: 0, y: 0 }}
            style={styles.headerShine}
          />
          <View pointerEvents="none" style={[styles.taskletStage, compact && styles.taskletStageCompact]}>
            <Image accessibilityIgnoresInvertColors contentFit="contain" source={TASKLET} style={styles.tasklet} />
          </View>

          <View style={[styles.headerCopy, compact && styles.headerCopyCompact]}>
            <ThemedText adjustsFontSizeToFit minimumFontScale={0.76} numberOfLines={1} style={[styles.title, compact && styles.titleCompact]} lightColor={TASKLET_INK} darkColor={TASKLET_INK}>
              Tasklet Puzzle
            </ThemedText>
            <View style={styles.tierPill}>
              <ThemedText adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={styles.tierText} lightColor="#925B25" darkColor="#925B25">
                Block Jam · Tier {tier}
              </ThemedText>
            </View>
            <Animated.View key={sorted} entering={reduceMotion ? FadeIn.duration(60) : FadeInDown.duration(170)} style={styles.progressRow}>
              <ThemedText accessibilityLabel={`${sorted} of ${total} blocks sorted`} style={styles.progressNumber} lightColor={TASKLET_INK} darkColor={TASKLET_INK}>
                {sorted}/{total}
              </ThemedText>
              <ThemedText style={styles.progressLabel} lightColor={TASKLET_INK} darkColor={TASKLET_INK}>sorted</ThemedText>
            </Animated.View>
          </View>

          <TaskletTimer deadlineMs={deadlineMs} onExpire={onExpire} />
        </Animated.View>

        <View style={styles.boardArea}>{children}</View>

        <Animated.View entering={enter} style={[styles.bottomArea, compact && styles.bottomAreaCompact]}>
          <View accessibilityLiveRegion="polite" style={[styles.instruction, failed && styles.instructionFailed]}>
            <View style={[styles.instructionIcon, failed && styles.instructionIconFailed]}>
              <IconSymbol color={failed ? '#A6483E' : '#B47B22'} name={failed ? 'timer' : 'star.fill'} size={18} />
            </View>
            <ThemedText style={styles.instructionText} lightColor={TASKLET_INK} darkColor={TASKLET_INK}>
              {instruction}
            </ThemedText>
          </View>

          <View style={styles.controls}>
            <TaskletControlButton disabled={undoDisabled} icon="arrow.counterclockwise" label="Undo" onPress={onUndo} />
            <TaskletControlButton emphasized icon="arrow.counterclockwise" label="Restart" onPress={onRestart} />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

export function TaskletBlockJamResultScreen({
  blocks,
  completionTime,
  firstClear,
  moves,
  onClose,
  onComplete,
  personalBest,
  undos,
}: {
  blocks: number;
  completionTime: string;
  firstClear: boolean;
  moves: number;
  onClose: () => void;
  onComplete: () => void;
  personalBest: boolean;
  undos: number;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const compact = height < 740;
  const reduceMotion = useReducedMotion();
  const enter = reduceMotion ? FadeIn.duration(80) : FadeInDown.duration(280).easing(Easing.out(Easing.cubic));

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.sceneScrim} />
      <LinearGradient
        colors={['rgba(32,20,11,0.5)', 'rgba(37,23,13,0.2)', 'rgba(28,17,10,0.58)']}
        locations={[0, 0.48, 1]}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <ScreenCloseButton align="left" onPress={onClose} variant="back" />

      <ScrollView
        contentContainerStyle={[
          styles.resultSafeContent,
          {
            paddingBottom: Math.max(12, insets.bottom + 10),
            paddingLeft: Math.max(14, insets.left + 14),
            paddingRight: Math.max(14, insets.right + 14),
            paddingTop: insets.top + (compact ? 66 : 76),
          },
        ]}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}>
        <Animated.View accessibilityLiveRegion="polite" entering={enter} style={styles.resultFrame}>
          <View style={[styles.resultCard, compact && styles.resultCardCompact]}>
            <View pointerEvents="none" style={[styles.resultTaskletStage, compact && styles.resultTaskletStageCompact]}>
              <View style={styles.resultTaskletHalo} />
              <Image accessibilityIgnoresInvertColors contentFit="contain" source={TASKLET} style={styles.tasklet} />
            </View>
            <View style={styles.resultIcon}>
              <IconSymbol color="#617E32" name="sparkles" size={27} />
            </View>
            <ThemedText style={styles.resultEyebrow} lightColor="#986020" darkColor="#986020">Block Jam cleared</ThemedText>
            <ThemedText adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={2} style={styles.resultTitle} lightColor={TASKLET_INK} darkColor={TASKLET_INK}>
              Tasklet’s desk is sorted
            </ThemedText>
            <ThemedText style={styles.resultBody} lightColor="#75513D" darkColor="#75513D">
              Every one of the {blocks} bright blocks found its matching rail.
            </ThemedText>

            <View accessibilityLabel={`Completion time ${completionTime}`} style={styles.resultScorePanel}>
              <IconSymbol color="#A46120" name="timer" size={20} />
              <ThemedText style={styles.resultScoreValue} lightColor={TASKLET_INK} darkColor={TASKLET_INK}>{completionTime}</ThemedText>
              <ThemedText style={styles.resultScoreLabel} lightColor="#856246" darkColor="#856246">Completion time</ThemedText>
            </View>

            <View style={styles.resultMetricRow}>
              <TaskletResultMetric label="Moves" value={String(moves)} />
              <TaskletResultMetric label="Undos" value={String(undos)} />
            </View>
            {personalBest ? (
              <View style={styles.bestPill}>
                <IconSymbol color="#7B5A1E" name="star.fill" size={12} />
                <ThemedText style={styles.bestText} lightColor="#7B5A1E" darkColor="#7B5A1E">
                  {firstClear ? 'First clear recorded' : 'New local best'}
                </ThemedText>
              </View>
            ) : null}
          </View>

          <KatchaSurfaceProvider surface="parchment">
            <KatchaButton fullWidth icon="arrow.right" label="Return to Tasklet" onPress={onComplete} variant="primary" />
          </KatchaSurfaceProvider>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function TaskletResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <View accessibilityLabel={`${label} ${value}`} style={styles.resultMetric}>
      <ThemedText style={styles.resultMetricValue} lightColor={TASKLET_INK} darkColor={TASKLET_INK}>{value}</ThemedText>
      <ThemedText style={styles.resultMetricLabel} lightColor="#856246" darkColor="#856246">{label}</ThemedText>
    </View>
  );
}

function TaskletTimer({ deadlineMs, onExpire }: { deadlineMs: number; onExpire: () => void }) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const [remainingSeconds, setRemainingSeconds] = useState(() => Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000)));
  const expired = useRef(false);

  useEffect(() => {
    expired.current = false;
    const tick = () => {
      const next = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
      setRemainingSeconds((current) => current === next ? current : next);
      if (next === 0 && !expired.current) {
        expired.current = true;
        onExpire();
      }
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [deadlineMs, onExpire]);

  const warning = remainingSeconds <= 30;
  const value = `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`;

  useEffect(() => {
    if (!warning || reduceMotion) {
      scale.value = 1;
      return;
    }
    scale.value = withSequence(
      withTiming(1.06, { duration: 130, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 190, easing: Easing.out(Easing.cubic) }),
    );
  }, [reduceMotion, scale, warning]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View
      accessibilityLabel={`${value} remaining`}
      style={[styles.timer, warning && styles.timerWarning, animatedStyle]}>
      <IconSymbol color={warning ? '#A9473C' : '#A46623'} name="timer" size={16} />
      <ThemedText style={styles.timerValue} lightColor={warning ? '#A9473C' : TASKLET_INK} darkColor={warning ? '#A9473C' : TASKLET_INK}>
        {value}
      </ThemedText>
      <ThemedText style={styles.timerLabel} lightColor="#87634E" darkColor="#87634E">Time</ThemedText>
    </Animated.View>
  );
}

function TaskletControlButton({
  disabled = false,
  emphasized = false,
  icon,
  label,
  onPress,
}: {
  disabled?: boolean;
  emphasized?: boolean;
  icon: 'arrow.counterclockwise';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.controlPressable,
        emphasized && styles.controlPressableWide,
        disabled && styles.controlDisabled,
        pressed && styles.controlPressed,
      ]}>
      <View style={[styles.controlRim, emphasized && styles.controlRimEmphasized]}>
        <View style={[styles.controlFill, emphasized && styles.controlFillEmphasized]}>
          {emphasized ? (
            <LinearGradient colors={['#FFD86A', '#E9A92F']} end={{ x: 0.7, y: 1 }} start={{ x: 0.25, y: 0 }} style={StyleSheet.absoluteFill} />
          ) : null}
          <View pointerEvents="none" style={styles.controlRimLight} />
          <IconSymbol color={TASKLET_INK} name={icon} size={emphasized ? 20 : 18} />
          <ThemedText style={[styles.controlLabel, emphasized && styles.controlLabelEmphasized]} lightColor={TASKLET_INK} darkColor={TASKLET_INK}>
            {label}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: 'transparent', flex: 1 },
  sceneScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(43, 27, 14, 0.22)' },
  safeContent: { alignSelf: 'center', flex: 1, gap: 8, maxWidth: 660, width: '100%' },
  safeContentCompact: { gap: 5 },
  header: {
    backgroundColor: 'rgba(255, 235, 191, 0.97)',
    borderColor: 'rgba(158, 101, 43, 0.72)',
    borderCurve: 'continuous',
    borderRadius: 25,
    borderWidth: 2,
    boxShadow: '0 7px 18px rgba(57,31,12,0.34), inset 0 2px 0 rgba(255,255,255,0.72), inset 0 -3px 0 rgba(178,112,44,0.18)',
    minHeight: 126,
    overflow: 'hidden',
    position: 'relative',
  },
  headerCompact: { minHeight: 106 },
  headerInnerRim: { borderColor: 'rgba(255,255,255,0.5)', borderCurve: 'continuous', borderRadius: 21, borderWidth: 1, bottom: 4, left: 4, position: 'absolute', right: 4, top: 4 },
  headerShine: { height: 40, left: 12, position: 'absolute', right: 72, top: 4 },
  taskletStage: { bottom: -7, height: 126, left: -3, position: 'absolute', width: 112 },
  taskletStageCompact: { height: 106, width: 94 },
  tasklet: { height: '100%', width: '100%' },
  headerCopy: { bottom: 9, gap: 5, justifyContent: 'center', left: 104, position: 'absolute', right: 82, top: 9 },
  headerCopyCompact: { bottom: 7, gap: 3, left: 86, right: 78, top: 7 },
  title: { fontSize: 20, fontWeight: '900', letterSpacing: 0.25, lineHeight: 24, textTransform: 'uppercase' },
  titleCompact: { fontSize: 17, lineHeight: 20 },
  tierPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 214, 113, 0.42)',
    borderColor: 'rgba(188, 125, 47, 0.42)',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    maxWidth: '100%',
    minHeight: 29,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tierText: { fontSize: 12, fontWeight: '900', letterSpacing: 0.55, lineHeight: 15, textTransform: 'uppercase' },
  progressRow: { alignItems: 'baseline', flexDirection: 'row', gap: 6 },
  progressNumber: { fontSize: 25, fontVariant: ['tabular-nums'], fontWeight: '900', lineHeight: 29 },
  progressLabel: { fontSize: 12, fontWeight: '900' },
  timer: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 247, 224, 0.9)',
    borderColor: 'rgba(155, 99, 43, 0.46)',
    borderCurve: 'continuous',
    borderRadius: 17,
    borderWidth: 1,
    boxShadow: '0 3px 8px rgba(76,42,17,0.18), inset 0 1px 0 rgba(255,255,255,0.9)',
    justifyContent: 'center',
    minHeight: 70,
    paddingHorizontal: 8,
    position: 'absolute',
    right: 8,
    top: 45,
    width: 68,
  },
  timerWarning: { backgroundColor: 'rgba(255, 220, 195, 0.96)', borderColor: 'rgba(169, 71, 60, 0.58)' },
  timerValue: { fontSize: 19, fontVariant: ['tabular-nums'], fontWeight: '900', lineHeight: 22 },
  timerLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  boardArea: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 0, width: '100%' },
  bottomArea: { alignSelf: 'center', gap: 8, maxWidth: 500, width: '100%' },
  bottomAreaCompact: { gap: 5 },
  instruction: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 239, 204, 0.97)',
    borderColor: 'rgba(144, 91, 37, 0.62)',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    boxShadow: '0 4px 12px rgba(52,29,12,0.3), inset 0 1px 0 rgba(255,255,255,0.76)',
    flexDirection: 'row',
    gap: 9,
    minHeight: 48,
    paddingHorizontal: 12,
    width: '94%',
  },
  instructionFailed: { backgroundColor: 'rgba(255, 224, 199, 0.98)', borderColor: 'rgba(166, 72, 62, 0.62)' },
  instructionIcon: { alignItems: 'center', backgroundColor: '#FFE190', borderRadius: 99, height: 30, justifyContent: 'center', width: 30 },
  instructionIconFailed: { backgroundColor: '#FFD0BE' },
  instructionText: { flex: 1, fontSize: 12, fontWeight: '800', lineHeight: 16, textAlign: 'center' },
  controls: { alignItems: 'stretch', alignSelf: 'center', flexDirection: 'row', gap: 8, justifyContent: 'center', width: '94%' },
  controlPressable: { flex: 0.74, minHeight: 54 },
  controlPressableWide: { flex: 1.26 },
  controlRim: {
    backgroundColor: '#D9B377',
    borderColor: 'rgba(117, 70, 29, 0.72)',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    boxShadow: '0 4px 9px rgba(64,35,14,0.32)',
    flex: 1,
    padding: 2,
  },
  controlRimEmphasized: { backgroundColor: '#C9821D', borderColor: '#8A541C' },
  controlFill: {
    alignItems: 'center',
    backgroundColor: '#FFECC5',
    borderCurve: 'continuous',
    borderRadius: 15,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 48,
    overflow: 'hidden',
    position: 'relative',
  },
  controlFillEmphasized: { backgroundColor: '#F1B839' },
  controlRimLight: { backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 99, height: 1, left: 10, position: 'absolute', right: 10, top: 2 },
  controlLabel: { fontSize: 13, fontWeight: '900' },
  controlLabelEmphasized: { fontSize: 16 },
  controlDisabled: { opacity: 0.42 },
  controlPressed: { opacity: 0.86, transform: [{ scale: 0.98 }] },
  resultSafeContent: { alignSelf: 'center', flexGrow: 1, justifyContent: 'center', maxWidth: 560, width: '100%' },
  resultFrame: { alignSelf: 'center', gap: 14, justifyContent: 'center', maxWidth: 480, width: '100%' },
  resultCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 239, 202, 0.98)',
    borderColor: '#8EA24E',
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    boxShadow: '0 14px 30px rgba(57,29,13,0.4), inset 0 2px 0 rgba(255,255,255,0.82), inset 0 -3px 0 rgba(178,112,44,0.14)',
    gap: 8,
    paddingBottom: 22,
    paddingHorizontal: 22,
    paddingTop: 76,
    position: 'relative',
  },
  resultCardCompact: { gap: 6, paddingBottom: 16, paddingHorizontal: 18, paddingTop: 58 },
  resultTaskletStage: { height: 126, position: 'absolute', right: 18, top: -56, width: 128 },
  resultTaskletStageCompact: { height: 104, top: -47, width: 108 },
  resultTaskletHalo: { backgroundColor: 'rgba(255, 215, 102, 0.36)', borderRadius: 999, bottom: 8, left: 16, position: 'absolute', right: 16, top: 16 },
  resultIcon: { alignItems: 'center', backgroundColor: 'rgba(188, 211, 106, 0.24)', borderColor: 'rgba(97,126,50,0.26)', borderRadius: 20, borderWidth: 1, height: 52, justifyContent: 'center', width: 52 },
  resultEyebrow: { fontSize: 10.5, fontWeight: '900', letterSpacing: 1.15, textTransform: 'uppercase' },
  resultTitle: { fontSize: 25, fontWeight: '900', lineHeight: 30, maxWidth: 340, textAlign: 'center' },
  resultBody: { fontSize: 13.5, lineHeight: 20, maxWidth: 340, textAlign: 'center' },
  resultScorePanel: { alignItems: 'center', backgroundColor: 'rgba(233,169,46,0.15)', borderColor: 'rgba(165,95,31,0.28)', borderRadius: 18, borderWidth: 1, gap: 1, paddingHorizontal: 18, paddingVertical: 10, width: '100%' },
  resultScoreValue: { fontSize: 28, fontVariant: ['tabular-nums'], fontWeight: '900', lineHeight: 32 },
  resultScoreLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' },
  resultMetricRow: { flexDirection: 'row', gap: 7, paddingTop: 3, width: '100%' },
  resultMetric: { alignItems: 'center', backgroundColor: 'rgba(136,86,47,0.07)', borderColor: 'rgba(136,86,47,0.16)', borderRadius: 14, borderWidth: 1, flex: 1, gap: 2, paddingHorizontal: 5, paddingVertical: 8 },
  resultMetricValue: { fontSize: 16, fontVariant: ['tabular-nums'], fontWeight: '900' },
  resultMetricLabel: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.45, textTransform: 'uppercase' },
  bestPill: { alignItems: 'center', backgroundColor: 'rgba(232,188,78,0.16)', borderRadius: 999, flexDirection: 'row', gap: 5, paddingHorizontal: 10, paddingVertical: 5 },
  bestText: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.55, textTransform: 'uppercase' },
});
