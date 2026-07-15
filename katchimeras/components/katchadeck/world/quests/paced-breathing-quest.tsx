import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import { advanceBreathing, createBreathingState } from '@/utils/quests/experiences/paced-breathing';
import type { QuestResult } from '@/utils/quests/experiences/types';
import { ExperienceAction, ExperienceResult, QuestExperiencePreview, experienceStyles, useQuestAppActive } from './quest-experience-ui';

type Config = { inhaleMs: number; exhaleMs: number; cycles: number; tier: number };
export function PacedBreathingQuest({ config, onAttemptStart, onAttemptCancel, onComplete, onRunningChange }: QuestProps<Config>) {
  const [started, setStarted] = useState(false); const [state, setState] = useState(createBreathingState); const attempt = useRef<string | null>(null); const startedAt = useRef(0); const scale = useSharedValue(0.62); const reduce = useReducedMotion(); const appActive = useQuestAppActive();
  useEffect(() => { if (!started || state.completed || !appActive) return; scale.value = reduce ? 1 : withTiming(state.phase === 'inhale' ? 1 : 0.62, { duration: state.phase === 'inhale' ? config.inhaleMs : config.exhaleMs }); const timer = setTimeout(() => setState((current) => advanceBreathing(current, config.cycles)), state.phase === 'inhale' ? config.inhaleMs : config.exhaleMs); return () => clearTimeout(timer); }, [appActive, config, reduce, scale, started, state.completed, state.phase]);
  useEffect(() => { if (state.completed && process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }, [state.completed]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const start = () => { attempt.current = onAttemptStart(config); startedAt.current = Date.now(); setStarted(true); onRunningChange(true, attempt.current); };
  const cancel = () => { if (attempt.current) onAttemptCancel(attempt.current); onRunningChange(false); setStarted(false); setState(createBreathingState()); };
  if (!started) return <QuestExperiencePreview eyebrow="Bedrotte" title="Breathe with Bedrotte" body="Hold while the glow grows. Release and breathe out as it settles." icon="moon.stars.fill" mediaLabel="A breathing glow" actionLabel="Begin breathing" onAction={start} />;
  if (state.completed && attempt.current) return <ExperienceResult success title="A quieter moment" body="You stayed for every slow breath." metric={`${config.cycles} cycles`} onComplete={() => onComplete(attempt.current!, { kind: 'paced_breathing', success: true, completedCycles: config.cycles, durationMs: Date.now() - startedAt.current })} />;
  return <View style={experienceStyles.root}><View style={experienceStyles.center}><ThemedText style={styles.progress} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>{state.cycle + 1} OF {config.cycles}</ThemedText><Pressable accessibilityRole="button" accessibilityLabel={`${state.phase}. Hold while breathing in and release while breathing out.`} onPressIn={() => { if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync(); }} style={styles.orbWrap}><Animated.View style={[styles.orb, animated]}><ThemedText style={styles.phase} lightColor={Lantern.emberInk} darkColor={Lantern.emberInk}>{state.phase === 'inhale' ? 'Breathe in' : 'Breathe out'}</ThemedText></Animated.View></Pressable><ThemedText style={experienceStyles.help} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{state.phase === 'inhale' ? 'Hold gently as the light expands' : 'Release as the light settles'}</ThemedText></View><ExperienceAction label="End session" quiet onPress={cancel} /></View>;
}
type QuestProps<C> = { config: C; onAttemptStart: (config: Record<string, unknown>) => string; onAttemptCancel: (id: string) => void; onComplete: (id: string, result: QuestResult) => void; onRunningChange: (running: boolean, id?: string | null) => void };
const styles = StyleSheet.create({ progress: { fontSize: 12, fontWeight: '900', letterSpacing: 1 }, orbWrap: { alignItems: 'center', height: 260, justifyContent: 'center', width: 260 }, orb: { alignItems: 'center', backgroundColor: Lantern.ember300, borderRadius: 999, height: 210, justifyContent: 'center', width: 210 }, phase: { fontSize: 20, fontWeight: '900' } });
