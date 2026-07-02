import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import type { KingdomBuilding } from '@/types/kingdom';

// A Kingdom building's card: the human question it answers, how far a lifetime
// of living has grown it, and what grows it next. The deep readers stay on
// Today (this day's contributions) and Collection (history) — this sheet is the
// building's own story.
type KingdomBuildingSheetProps = {
  building: KingdomBuilding;
  onClose: () => void;
};

const LEVEL_NAMES = ['Unbuilt', 'Founded', 'Growing', 'Flourishing', 'Radiant'];

export function KingdomBuildingSheet({ building, onClose }: KingdomBuildingSheetProps) {
  const tabBarHeight = useBottomTabBarHeight();
  const progress =
    building.nextLevelAt !== null ? Math.min(1, building.count / building.nextLevelAt) : 1;

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
          {building.emoji} {building.label}
        </ThemedText>
        <ThemedText style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          {building.question}
        </ThemedText>

        <View style={styles.statRow}>
          <ThemedText style={styles.statValue} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            {building.countLabel}
          </ThemedText>
          <ThemedText style={styles.statLevel} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            {LEVEL_NAMES[building.level]} · level {building.level} of 4
          </ThemedText>
        </View>

        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <ThemedText style={styles.nextLine} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
          {building.nextLevelAt !== null
            ? `Grows again at ${building.nextLevelAt.toLocaleString()}`
            : 'Fully grown — a lifetime landmark'}
        </ThemedText>

        <ThemedText style={styles.hint} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
          Everything you capture on Today feeds it. Revisit the days themselves in Collection.
        </ThemedText>

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
    borderRadius: 24,
    borderWidth: 1,
    boxShadow: '0 18px 48px rgba(0,0,0,0.55)',
    gap: 10,
    left: 14,
    padding: 18,
    position: 'absolute',
    right: 14,
  },
  grabber: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    height: 4,
    marginBottom: 4,
    width: 38,
  },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 19, fontWeight: '800', lineHeight: 24 },
  statRow: { alignItems: 'baseline', flexDirection: 'row', gap: 10, marginTop: 2 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLevel: { fontSize: 12.5, fontWeight: '700' },
  track: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    height: 8,
    marginTop: 2,
    overflow: 'hidden',
  },
  fill: {
    backgroundColor: Lantern.ember300,
    borderRadius: 999,
    height: 8,
  },
  nextLine: { fontSize: 12, fontWeight: '600' },
  hint: { fontSize: 12.5, fontWeight: '600', lineHeight: 17, marginTop: 4 },
  close: { alignSelf: 'center', paddingTop: 6 },
  closeLabel: { fontSize: 13, fontWeight: '800', lineHeight: 16 },
});
