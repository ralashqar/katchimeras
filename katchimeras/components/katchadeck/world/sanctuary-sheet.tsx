import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import type { HomeDayRecord } from '@/types/home';

// The Sanctuary reader (docs/world-structures-cozy-direction.md §9) — "how today
// felt". Shows the day's reflections (feeling / day-word / meaning prompt answers)
// and how the day began (sleep). View-only; reflections are given via the prompts.

const REFLECTION_KINDS = new Set(['feeling', 'inner_weather', 'day_word', 'meaning', 'gratitude', 'highlight']);
const SLEEP_LINE: Record<string, string> = {
  good: 'The day began rested ☀️',
  normal: 'The day began steady 🌤',
  low: 'The day began on little sleep 🌙',
};

export function SanctuarySheet({
  day,
  onReflect,
  onClose,
}: {
  day: HomeDayRecord;
  onReflect?: () => void;
  onClose: () => void;
}) {
  const tabBarHeight = useBottomTabBarHeight();
  const reflections = (day.promptAnswers ?? []).filter(
    (answer) => !answer.dismissed && REFLECTION_KINDS.has(answer.kind) && answer.labels.length > 0
  );
  const sleepLine = day.sleep ? SLEEP_LINE[day.sleep.quality] : null;

  return (
    <View style={styles.overlay}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={styles.backdrop}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View entering={SlideInDown.duration(260)} exiting={SlideOutDown.duration(200)} style={[styles.sheet, { bottom: tabBarHeight + 10 }]}>
        <View style={styles.grabber} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <ThemedText style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
            The Sanctuary
          </ThemedText>
          <ThemedText style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            How today felt
          </ThemedText>

          <View style={styles.body}>
            {sleepLine ? (
              <View style={styles.sleepRow}>
                <ThemedText style={styles.sleepText} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
                  {sleepLine}
                </ThemedText>
              </View>
            ) : null}

            {reflections.length === 0 ? (
              <ThemedText style={styles.empty} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                Yet to reflect — give today a feeling.
              </ThemedText>
            ) : (
              reflections.map((answer) => (
                <View key={answer.id} style={styles.row}>
                  <View style={styles.dot} />
                  <ThemedText style={styles.rowText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                    {answer.labels.join(' · ')}
                  </ThemedText>
                </View>
              ))
            )}

            {onReflect ? (
              <Pressable accessibilityRole="button" onPress={onReflect} style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}>
                <ThemedText style={styles.addBtnEmoji}>🌿</ThemedText>
                <ThemedText style={styles.addBtnLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                  Give today a feeling
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, elevation: 24, zIndex: 50 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4, 7, 15, 0.42)' },
  sheet: {
    backgroundColor: '#161226',
    borderColor: 'rgba(255,255,255,0.12)',
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    boxShadow: '0 18px 48px rgba(0,0,0,0.55)',
    left: 12,
    maxHeight: '74%',
    paddingBottom: 14,
    paddingHorizontal: 18,
    paddingTop: 12,
    position: 'absolute',
    right: 12,
  },
  grabber: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, height: 4, marginBottom: 6, width: 38 },
  scroll: { gap: 8, paddingBottom: 4 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 18, fontWeight: '800', lineHeight: 23 },
  body: { gap: 10, paddingTop: 8 },
  sleepRow: { paddingVertical: 4 },
  sleepText: { fontSize: 14, fontWeight: '600' },
  empty: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  dot: { width: 7, height: 7, borderRadius: 999, backgroundColor: '#A8C99A' },
  rowText: { flex: 1, fontSize: 14, fontWeight: '700' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(168,201,154,0.45)',
    backgroundColor: 'rgba(168,201,154,0.12)',
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  addBtnPressed: { backgroundColor: 'rgba(168,201,154,0.22)' },
  addBtnEmoji: { fontSize: 16 },
  addBtnLabel: { fontSize: 13.5, fontWeight: '800' },
});
