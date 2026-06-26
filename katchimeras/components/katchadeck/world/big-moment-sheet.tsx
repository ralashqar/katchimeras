import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import { BIG_MOMENT_META } from '@/components/katchadeck/world/big-moment-picker-sheet';
import type { BigMoment, DayNote } from '@/types/home';

// The bespoke reader for the Big Moment landmark (celebration / milestone / trip…)
// — tapping that object opens THIS, not the generic patch inspector. Lists the
// day's big moments with their kind + the note they came from.
type BigMomentSheetProps = {
  bigMoments: BigMoment[];
  notes: DayNote[];
  onClose: () => void;
};

export function BigMomentSheet({ bigMoments, notes, onClose }: BigMomentSheetProps) {
  const tabBarHeight = useBottomTabBarHeight();
  const noteById = new Map(notes.map((note) => [note.id, note]));
  const ordered = [...bigMoments].reverse(); // most recent first

  return (
    <View style={styles.overlay}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={styles.backdrop}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <Animated.View
        entering={SlideInDown.duration(260)}
        exiting={SlideOutDown.duration(200)}
        style={[styles.sheet, { bottom: tabBarHeight + 10 }]}>
        <View style={styles.grabber} />
        <ThemedText style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
          {ordered.length === 1 ? 'A big moment' : 'Big moments'}
        </ThemedText>
        <ThemedText style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          {ordered.length === 1 ? 'What made today matter' : 'What made the day matter'}
        </ThemedText>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {ordered.length === 0 ? (
            <ThemedText style={styles.empty} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              Nothing marked yet.
            </ThemedText>
          ) : null}
          {ordered.map((moment) => {
            const meta = BIG_MOMENT_META[moment.type] ?? { emoji: '✨', label: moment.type };
            const note = moment.noteId ? noteById.get(moment.noteId) : undefined;
            return (
              <View key={moment.id} style={styles.row}>
                <ThemedText style={styles.emoji}>{meta.emoji}</ThemedText>
                <View style={styles.body}>
                  <ThemedText style={styles.kind} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
                    {meta.label}
                  </ThemedText>
                  <ThemedText style={styles.label} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                    {moment.subject ? `${moment.label} · ${moment.subject}` : moment.label}
                  </ThemedText>
                  {note?.text ? (
                    <ThemedText style={styles.note} numberOfLines={3} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
                      “{note.text.trim()}”
                    </ThemedText>
                  ) : null}
                </View>
              </View>
            );
          })}
        </ScrollView>

        <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
          <ThemedText style={styles.closeLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            Close
          </ThemedText>
        </Pressable>
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
    gap: 8,
    left: 12,
    maxHeight: '74%',
    paddingBottom: 14,
    paddingHorizontal: 18,
    paddingTop: 12,
    position: 'absolute',
    right: 12,
  },
  grabber: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, height: 4, marginBottom: 4, width: 38 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 18, fontWeight: '800', lineHeight: 23 },
  list: { gap: 10, paddingTop: 8, paddingBottom: 4 },
  empty: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  row: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  emoji: { fontSize: 26, lineHeight: 30 },
  body: { flex: 1, gap: 2 },
  kind: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  label: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  note: { fontSize: 13, fontWeight: '500', lineHeight: 18, fontStyle: 'italic', marginTop: 2 },
  close: { alignSelf: 'center', paddingTop: 6 },
  closeLabel: { fontSize: 13, fontWeight: '800', lineHeight: 16 },
});
