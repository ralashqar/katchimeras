import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppFontFamilies, Lantern } from '@/constants/theme';
import type { QuestResult } from '@/utils/quests/experiences/types';
import { QuestExperiencePreview } from './quest-experience-ui';

type Config = { challengeId: 'step_sprint' | 'step_time_trial'; target: number; durationMs: number | null; tier: number };
type Phase = 'intro' | 'starting' | 'countdown' | 'running' | 'failed' | 'cancelled' | 'success';

const PEDOMETER_WARMUP_MS = 700;

export function LiveStepQuest({ config, onAttemptStart, onAttemptCancel, onComplete, onRunningChange }: {
  config: Config;
  onAttemptStart: (config: Record<string, unknown>) => string;
  onAttemptCancel: (attemptId: string) => void;
  onComplete: (attemptId: string, result: QuestResult) => void;
  onRunningChange: (running: boolean, attemptId?: string | null) => void;
}) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [steps, setSteps] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const attemptId = useRef<string | null>(null);
  const startedAt = useRef(0);
  const watch = useRef<{ remove: () => void } | null>(null);
  const restartWatchAtGo = useRef<(() => void) | null>(null);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const displayInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const preparationTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const finished = useRef(false);
  const attemptActive = useRef(false);
  const counting = useRef(false);
  const rawSteps = useRef(0);
  const baselineSteps = useRef(0);
  const confirmedSteps = useRef(0);
  const displayTarget = useRef(0);

  const cleanup = useCallback(() => {
    watch.current?.remove();
    watch.current = null;
    restartWatchAtGo.current = null;
    if (interval.current) clearInterval(interval.current);
    interval.current = null;
    if (displayInterval.current) clearInterval(displayInterval.current);
    displayInterval.current = null;
    preparationTimers.current.forEach(clearTimeout);
    preparationTimers.current = [];
    counting.current = false;
  }, []);

  const animateDisplayedSteps = useCallback((target: number) => {
    displayTarget.current = Math.max(displayTarget.current, target);
    if (displayInterval.current) return;
    displayInterval.current = setInterval(() => {
      setSteps((current) => {
        const remaining = displayTarget.current - current;
        if (remaining <= 0) {
          if (displayInterval.current) clearInterval(displayInterval.current);
          displayInterval.current = null;
          return current;
        }
        return current + Math.max(1, Math.ceil(remaining / 4));
      });
    }, 35);
  }, []);

  const cancel = useCallback((reason = 'Attempt ended. You can retry whenever you are ready.') => {
    if (!attemptActive.current || finished.current) return;
    finished.current = true;
    attemptActive.current = false;
    cleanup();
    if (attemptId.current) onAttemptCancel(attemptId.current);
    onRunningChange(false);
    setMessage(reason);
    setPhase('cancelled');
  }, [cleanup, onAttemptCancel, onRunningChange]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && (phase === 'running' || phase === 'starting' || phase === 'countdown')) {
        cancel('The attempt stopped when the app left the foreground so the live count stays fair.');
      }
    });
    return () => subscription.remove();
  }, [cancel, phase]);

  useEffect(() => cleanup, [cleanup]);

  const succeed = useCallback((finalSteps: number, finalElapsed: number) => {
    if (finished.current || !attemptId.current) return;
    finished.current = true;
    counting.current = false;
    cleanup();
    setSteps(finalSteps);
    setElapsedMs(finalElapsed);
    setPhase('success');
    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [cleanup]);

  const startClock = useCallback(() => {
    // Restarting at Go gives the authoritative watcher an exact session
    // boundary; the first subscription exists only to warm Core Motion up.
    restartWatchAtGo.current?.();
    baselineSteps.current = rawSteps.current;
    confirmedSteps.current = 0;
    displayTarget.current = 0;
    setSteps(0);
    setCountdown(null);
    startedAt.current = Date.now();
    counting.current = true;
    setPhase('running');
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    interval.current = setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      setElapsedMs(elapsed);
      if (config.durationMs != null && elapsed >= config.durationMs && !finished.current) {
        finished.current = true;
        attemptActive.current = false;
        const finalSteps = confirmedSteps.current;
        cleanup();
        setSteps(finalSteps);
        setPhase('failed');
        if (attemptId.current) onAttemptCancel(attemptId.current);
        onRunningChange(false);
      }
    }, 100);
  }, [cleanup, config.durationMs, onAttemptCancel, onRunningChange]);

  const start = useCallback(async () => {
    if (phase === 'starting' || phase === 'countdown' || phase === 'running') return;
    setPhase('starting');
    setCountdown(null);
    setMessage(null);
    setSteps(0);
    setElapsedMs(0);
    finished.current = false;
    attemptActive.current = false;
    counting.current = false;
    rawSteps.current = 0;
    baselineSteps.current = 0;
    confirmedSteps.current = 0;
    displayTarget.current = 0;
    try {
      const { Pedometer } = await import('expo-sensors');
      if (!(await Pedometer.isAvailableAsync())) {
        setMessage('Live step tracking is not available on this device.');
        setPhase('cancelled');
        return;
      }
      let permission = await Pedometer.getPermissionsAsync();
      if (!permission.granted && permission.canAskAgain !== false) permission = await Pedometer.requestPermissionsAsync();
      if (!permission.granted) {
        setMessage('Allow Motion & Fitness access to play this quest.');
        setPhase('cancelled');
        return;
      }
      attemptId.current = onAttemptStart(config);
      attemptActive.current = true;
      onRunningChange(true, attemptId.current);
      const handleReading = (reading: { steps: number }) => {
        rawSteps.current = Math.max(0, reading.steps ?? 0);
        if (!counting.current || finished.current) return;
        const next = Math.max(0, rawSteps.current - baselineSteps.current);
        confirmedSteps.current = next;
        const elapsed = Date.now() - startedAt.current;
        animateDisplayedSteps(next);
        if (next >= config.target) succeed(next, elapsed);
      };
      const beginWatching = () => Pedometer.watchStepCount(handleReading);
      watch.current = beginWatching();
      restartWatchAtGo.current = () => {
        watch.current?.remove();
        rawSteps.current = 0;
        baselineSteps.current = 0;
        watch.current = beginWatching();
      };
      preparationTimers.current.push(setTimeout(() => {
        setPhase('countdown');
        setCountdown(3);
        if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
      }, PEDOMETER_WARMUP_MS));
      [2, 1].forEach((value, index) => preparationTimers.current.push(setTimeout(() => {
        setCountdown(value);
        if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
      }, PEDOMETER_WARMUP_MS + (index + 1) * 1000)));
      preparationTimers.current.push(setTimeout(startClock, PEDOMETER_WARMUP_MS + 3000));
    } catch {
      cleanup();
      attemptActive.current = false;
      onRunningChange(false);
      setMessage('Live steps could not start. Please try again.');
      setPhase('cancelled');
    }
  }, [animateDisplayedSteps, cleanup, config, onAttemptStart, onRunningChange, phase, startClock, succeed]);

  const duration = config.durationMs ?? Math.max(elapsedMs, 1);
  const remaining = config.durationMs == null ? null : Math.max(0, config.durationMs - elapsedMs);
  const ratio = phase === 'starting' || phase === 'countdown'
    ? 1
    : config.durationMs == null
      ? Math.min(1, steps / config.target)
      : Math.max(0, remaining! / duration);
  const ring = useMemo(() => arcPath(ratio), [ratio]);

  if (phase === 'intro') return (
    <QuestExperiencePreview
      eyebrow={`Steppling · Tier ${config.tier}`}
      title={config.challengeId === 'step_sprint' ? 'One-minute step challenge' : 'Step target challenge'}
      body={config.challengeId === 'step_sprint' ? `Move at a pace that feels safe. Reach ${config.target} steps in one minute.` : `Reach ${config.target} steps at a pace that feels safe and set a time.`}
      icon="figure.walk"
      meta="Motion sensors only · no GPS"
      actionLabel="Start challenge"
      onAction={() => void start()}
    />
  );

  return (
    <View style={styles.root}>
      <View style={styles.heading}>
        <ThemedText style={styles.eyebrow} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>STEPPLING CHALLENGE · TIER {config.tier}</ThemedText>
        <ThemedText selectable style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{config.challengeId === 'step_sprint' ? 'One-minute step challenge' : 'Step target challenge'}</ThemedText>
        <ThemedText selectable style={styles.body} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
          {config.challengeId === 'step_sprint' ? `Move at a pace that feels safe. Reach ${config.target} steps in one minute.` : `Reach ${config.target} steps at a pace that feels safe and set a time.`}
        </ThemedText>
      </View>

      <View accessibilityRole="progressbar" accessibilityLabel="Live step challenge" accessibilityValue={{ min: 0, max: config.target, now: steps }} style={styles.clock}>
        <Canvas style={styles.canvas}>
          <Circle cx={88} cy={88} r={76} color="rgba(201,194,232,0.15)" style="stroke" strokeWidth={10} />
          <Path path={ring} color={phase === 'success' ? Lantern.auroraTeal : Lantern.ember300} style="stroke" strokeWidth={10} strokeCap="round" />
        </Canvas>
        <View style={styles.clockText}>
          {phase === 'starting' || phase === 'countdown' ? (
            <>
              <ThemedText accessibilityLiveRegion="polite" style={styles.steps} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{countdown ?? '·'}</ThemedText>
              <ThemedText style={styles.unit} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>{phase === 'starting' ? 'Calibrating' : 'Get ready'}</ThemedText>
            </>
          ) : (
            <>
              <ThemedText style={styles.steps} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{steps}</ThemedText>
              <ThemedText style={styles.unit} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>of {config.target} steps</ThemedText>
              <ThemedText style={styles.timer} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>{formatDuration(remaining ?? elapsedMs)}</ThemedText>
            </>
          )}
        </View>
      </View>

      {message ? <ThemedText accessibilityLiveRegion="polite" selectable style={styles.message} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{message}</ThemedText> : null}
      {phase === 'failed' ? <ThemedText accessibilityLiveRegion="polite" style={styles.message} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>That round is complete. You reached {steps} steps. Try again only if you want to.</ThemedText> : null}
      <ThemedText style={styles.safety} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>Uses Motion & Fitness sensors only — no GPS. Choose a clear, safe place to move.</ThemedText>

      {phase === 'running' || phase === 'starting' || phase === 'countdown' ? null : phase === 'success' && attemptId.current ? (
        <Action label="Complete and return" icon="checkmark" onPress={() => onComplete(attemptId.current!, { kind: 'live_steps', success: true, steps, target: config.target, durationMs: elapsedMs, personalBest: false })} />
      ) : (
        <Action label="Try again" icon="figure.walk" onPress={() => void start()} />
      )}
    </View>
  );
}

function Action({ label, icon, onPress, quiet = false }: { label: string; icon: 'xmark' | 'checkmark' | 'figure.walk'; onPress: () => void; quiet?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.action, quiet && styles.actionQuiet, pressed && styles.pressed]}><IconSymbol name={icon} size={18} color={quiet ? Lantern.moon300 : Lantern.emberInk} /><ThemedText style={styles.actionLabel} lightColor={quiet ? Lantern.moon300 : Lantern.emberInk} darkColor={quiet ? Lantern.moon300 : Lantern.emberInk}>{label}</ThemedText></Pressable>;
}

function arcPath(ratio: number) {
  const path = Skia.Path.Make();
  path.addArc({ x: 12, y: 12, width: 152, height: 152 }, -90, Math.max(0.1, ratio * 360));
  return path;
}

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', flex: 1, gap: 14, justifyContent: 'space-between', paddingBottom: 8, paddingTop: 8 },
  heading: { alignSelf: 'stretch', gap: 8 }, eyebrow: { fontSize: 10.5, fontWeight: '900', letterSpacing: 1.05 },
  title: { fontFamily: AppFontFamilies.instrumentSerif, fontSize: 29, lineHeight: 34 }, body: { fontSize: 14, lineHeight: 21 },
  clock: { height: 176, width: 176 }, canvas: { height: 176, width: 176 }, clockText: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  steps: { fontSize: 42, fontVariant: ['tabular-nums'], fontWeight: '900', lineHeight: 45 }, unit: { fontSize: 11.5, fontWeight: '700' }, timer: { fontSize: 15, fontVariant: ['tabular-nums'], fontWeight: '900', paddingTop: 5 },
  message: { fontSize: 13, lineHeight: 19, textAlign: 'center' }, safety: { fontSize: 11.5, lineHeight: 17, textAlign: 'center' },
  action: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: Lantern.ember300, borderCurve: 'continuous', borderRadius: 18, flexDirection: 'row', gap: 9, justifyContent: 'center', minHeight: 54, paddingHorizontal: 18 },
  actionQuiet: { backgroundColor: 'transparent', borderColor: 'rgba(201,194,232,0.2)', borderWidth: 1 }, actionLabel: { fontSize: 15, fontWeight: '900' }, pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
