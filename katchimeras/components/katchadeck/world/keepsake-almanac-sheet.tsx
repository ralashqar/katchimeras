import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import type { AlmanacSection } from '@/utils/kingdom-decor';
import { worldAssetSource } from '@/utils/world-visuals';
import { Meadow } from '@/constants/meadow-theme';

// The keepsake almanac — every way life earns a decoration, with earned pieces
// lit and everything else a hint of what living more unlocks.
type KeepsakeAlmanacSheetProps = {
  sections: AlmanacSection[];
  onClose: () => void;
};

export function KeepsakeAlmanacSheet({ sections, onClose }: KeepsakeAlmanacSheetProps) {
  return (
    <View style={styles.overlay}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={styles.backdrop}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.duration(260)}
        exiting={SlideOutDown.duration(200)}
        style={[styles.sheet, { bottom: Meadow.overlay.bottomClearance }]}>
        <View style={styles.grabber} />
        <ThemedText style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
          📖 Almanac
        </ThemedText>
        <ThemedText style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          How keepsakes are earned
        </ThemedText>

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
          {sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <ThemedText style={styles.sectionTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                {section.title}
              </ThemedText>
              <ThemedText style={styles.sectionBlurb} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                {section.blurb}
              </ThemedText>
              <View style={styles.grid}>
                {section.entries.map((entry) => {
                  const source = worldAssetSource(entry.assetKey);
                  return (
                    <View key={entry.id} style={[styles.cell, !entry.earned ? styles.cellLocked : null]}>
                      {source ? (
                        <Image contentFit="contain" source={source} style={styles.thumb} transition={120} />
                      ) : (
                        <View style={styles.thumb} />
                      )}
                      <ThemedText numberOfLines={1} style={styles.cellName} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                        {entry.name}
                      </ThemedText>
                      <ThemedText numberOfLines={2} style={styles.cellHint} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                        {entry.hint}
                      </ThemedText>
                      {entry.earned ? (
                        <ThemedText style={styles.earnedMark} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
                          ✓
                        </ThemedText>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
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
  overlay: { ...StyleSheet.absoluteFillObject, elevation: 26, zIndex: 60 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4, 7, 15, 0.42)' },
  sheet: {
    backgroundColor: Meadow.overlay.sheetBg,
    borderColor: Meadow.overlay.sheetBorder,
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1,
    boxShadow: '0 18px 48px rgba(0,0,0,0.55)',
    gap: 8,
    left: 14,
    maxHeight: 560,
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
  title: { fontSize: 18, fontWeight: '800', lineHeight: 23 },
  list: { flexGrow: 0 },
  listContent: { gap: 16, paddingVertical: 6 },
  section: { gap: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '800' },
  sectionBlurb: { fontSize: 12, fontWeight: '600', lineHeight: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 },
  cell: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    flexBasis: '30%',
    flexGrow: 1,
    gap: 3,
    maxWidth: '32%',
    padding: 8,
  },
  cellLocked: { opacity: 0.45 },
  thumb: { alignSelf: 'center', height: 44, width: 44 },
  cellName: { fontSize: 11.5, fontWeight: '800', textAlign: 'center' },
  cellHint: { fontSize: 10, fontWeight: '600', lineHeight: 13, textAlign: 'center' },
  earnedMark: { fontSize: 12, fontWeight: '900', position: 'absolute', right: 7, top: 5 },
  close: { alignSelf: 'center', paddingTop: 6 },
  closeLabel: { fontSize: 13, fontWeight: '800', lineHeight: 16 },
});
