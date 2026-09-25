import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { KatchaUI } from '@/constants/katcha-ui';
import type { SanctuaryChapterState } from '@/constants/sanctuary-chapters';

/**
 * The Sanctuary's one next thing (`constants/sanctuary-chapters.ts`): the chapter, the goal and why, and its progress.
 * A tap takes the player there. A new goal arrives with a small bounce, so the change is seen.
 */
export function ChapterGoalCard({ state, need = null, onPress }: { state: SanctuaryChapterState; /** What is missing, and where it is earned. */ need?: string | null; onPress: () => void }) {
  const reduceMotion = useReducedMotion();
  const pop = useSharedValue(1);
  const goalKey = `${state.chapter.id}:${state.goal?.id ?? 'done'}`;
  useEffect(() => {
    if (reduceMotion) return;
    pop.value = withSequence(withTiming(1.06, { duration: 160, easing: Easing.out(Easing.quad) }), withSpring(1, { damping: 10, stiffness: 180 }));
  }, [goalKey, pop, reduceMotion]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const title = state.goal?.title ?? 'Chapter complete: claim your reward';
  const detail = state.goal?.detail ?? state.chapter.closing;
  return <Animated.View style={[styles.wrap, style]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Chapter ${state.chapter.number}, ${state.chapter.title}. ${title}`} accessibilityHint="Shows you where to go" onPress={onPress} style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Chapter {state.chapter.number} · {state.chapter.title}</Text>
        <Text style={styles.count}>{state.done}/{state.total}</Text>
      </View>
      <Text style={styles.title} numberOfLines={2}>{title}</Text>
      {need ? <Text style={styles.need} numberOfLines={2}>{need}</Text> : <Text style={styles.detail} numberOfLines={2}>{detail}</Text>}
      <View style={styles.bar}><View style={[styles.fill, { width: `${Math.round((state.done / Math.max(1, state.total)) * 100)}%` }]} /></View>
    </Pressable>
  </Animated.View>;
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start', maxWidth: 300 },
  card: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11, gap: 4, backgroundColor: 'rgba(22,20,40,0.78)', borderWidth: 1, borderColor: 'rgba(255,231,168,0.35)' },
  pressed: { opacity: 0.85 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  eyebrow: { ...KatchaUI.type.label, color: '#FFE7A8' },
  count: { ...KatchaUI.type.label, color: 'rgba(255,248,230,0.7)' },
  title: { ...KatchaUI.type.title, color: '#FFF8E6' },
  detail: { ...KatchaUI.type.body, fontSize: 12.5, lineHeight: 17, color: 'rgba(243,238,255,0.78)' },
  need: { ...KatchaUI.type.body, fontSize: 12.5, lineHeight: 17, fontWeight: '700', color: '#FFD36B' },
  bar: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden', marginTop: 4 },
  fill: { height: 5, borderRadius: 3, backgroundColor: '#FFD36B' },
});
