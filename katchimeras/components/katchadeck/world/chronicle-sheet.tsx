import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';
import type { HomeDayRecord } from '@/types/home';
import type { DayChronicle, ChronicleTimeOfDay } from '@/utils/chronicle-engine';
import { DayMemoryStrip } from '@/components/katchadeck/world/day-memory-strip';

// The Chronicle reader — "what was this day about?". A day theme + story summary,
// what shaped the day, a light timeline, and linked memories. NOT a calendar list.

const TIME_LABEL: Record<ChronicleTimeOfDay, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Night',
};
const TIME_ORDER: ChronicleTimeOfDay[] = ['morning', 'afternoon', 'evening', 'night'];

type ChronicleSheetProps = {
  chronicle: DayChronicle;
  day: HomeDayRecord;
  onViewMemories?: () => void;
  onClose: () => void;
};

export function ChronicleSheet({ chronicle, day, onViewMemories, onClose }: ChronicleSheetProps) {
  const tabBarHeight = useBottomTabBarHeight();

  const grouped = TIME_ORDER.map((slot) => ({
    slot,
    items: chronicle.timeline.filter((item) => item.timeOfDay === slot),
  })).filter((group) => group.items.length > 0);

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
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <ThemedText style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
            Chronicle
          </ThemedText>
          <ThemedText type="hero" lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            {chronicle.title}
          </ThemedText>
          <ThemedText style={styles.summary} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            {chronicle.summary}
          </ThemedText>

          {chronicle.shaped.length > 0 ? (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                What shaped this day
              </ThemedText>
              {chronicle.shaped.map((line, index) => (
                <View key={index} style={styles.shapedRow}>
                  <View style={styles.bullet} />
                  <ThemedText style={styles.shapedText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                    {line}
                  </ThemedText>
                </View>
              ))}
            </View>
          ) : null}

          {grouped.length > 0 ? (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                Story timeline
              </ThemedText>
              {grouped.map((group) => (
                <View key={group.slot} style={styles.timelineRow}>
                  <ThemedText style={styles.timeOfDay} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
                    {TIME_LABEL[group.slot]}
                  </ThemedText>
                  <View style={styles.timelineItems}>
                    {group.items.map((item) => (
                      <ThemedText key={item.id} style={styles.timelineLabel} numberOfLines={1} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                        {item.label}
                      </ThemedText>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.section}>
            <DayMemoryStrip day={day} title="Linked memories" onViewAll={onViewMemories} />
          </View>

          {day.creature ? (
            <View style={styles.creatureRow}>
              <IconSymbol name="sparkles" size={13} color={Lantern.auroraTeal} />
              <ThemedText style={styles.creatureText} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
                {`Hatched ${day.creature.name}`}
              </ThemedText>
            </View>
          ) : null}
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
    left: 12,
    maxHeight: '78%',
    paddingBottom: 14,
    paddingHorizontal: 18,
    paddingTop: 12,
    position: 'absolute',
    right: 12,
  },
  grabber: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, height: 4, marginBottom: 6, width: 38 },
  scroll: { gap: 10, paddingBottom: 4 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  summary: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  section: { gap: 8, marginTop: 6 },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  shapedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bullet: { width: 6, height: 6, borderRadius: 999, backgroundColor: Lantern.auroraTeal },
  shapedText: { flex: 1, fontSize: 14, fontWeight: '600' },
  timelineRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  timeOfDay: { width: 78, fontSize: 12, fontWeight: '800' },
  timelineItems: { flex: 1, gap: 2 },
  timelineLabel: { fontSize: 13.5, fontWeight: '600' },
  photoRow: { gap: 8, paddingVertical: 2 },
  photo: { width: 84, height: 84, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)' },
  creatureRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
  creatureText: { fontSize: 13, fontWeight: '700' },
  close: { alignSelf: 'center', paddingTop: 8 },
  closeLabel: { fontSize: 13, fontWeight: '800', lineHeight: 16 },
});
