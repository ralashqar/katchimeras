import { Image as ExpoImage } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import type { WorldPropDef } from '@/utils/world-props-catalog';
import { worldAssetSource } from '@/utils/world-visuals';
import { Meadow } from '@/constants/meadow-theme';

export function StarterPropSheet({
  choices,
  onChoose,
  onClose,
}: {
  choices: WorldPropDef[];
  onChoose: (prop: WorldPropDef) => void;
  onClose: () => void;
}) {

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
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <ThemedText style={styles.kicker} lightColor={Lantern.auroraTeal} darkColor={Lantern.auroraTeal}>
            First Seed
          </ThemedText>
          <ThemedText style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            Plant the first thing your world should grow around
          </ThemedText>
          <ThemedText style={styles.summary} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            This first prop is chosen by intention. After that, real days unlock the rest.
          </ThemedText>

          <View style={styles.grid}>
            {choices.map((choice) => {
              const source = worldAssetSource(choice.assetKey);
              return (
                <Pressable
                  key={choice.id}
                  accessibilityRole="button"
                  onPress={() => onChoose(choice)}
                  style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}>
                  <View style={styles.imageWrap}>
                    {source ? <ExpoImage source={source} style={styles.image} contentFit="contain" /> : null}
                  </View>
                  <ThemedText style={styles.choiceTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                    {choice.name}
                  </ThemedText>
                  <ThemedText style={styles.choiceBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300} numberOfLines={3}>
                    {choice.description}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
          <ThemedText style={styles.closeLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            Later
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
    backgroundColor: Meadow.overlay.sheetBg,
    borderColor: Meadow.overlay.sheetBorder,
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    boxShadow: '0 18px 48px rgba(0,0,0,0.55)',
    left: 12,
    maxHeight: '80%',
    paddingBottom: 14,
    paddingHorizontal: 18,
    paddingTop: 12,
    position: 'absolute',
    right: 12,
  },
  grabber: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, height: 4, marginBottom: 6, width: 38 },
  scroll: { gap: 10, paddingBottom: 6 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 19, fontWeight: '900', lineHeight: 24 },
  summary: { fontSize: 13.5, fontWeight: '500', lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    width: '48%',
    minHeight: 172,
    gap: 6,
    padding: 10,
    borderRadius: 18,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(20,17,31,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(125,232,205,0.16)',
  },
  choicePressed: { backgroundColor: 'rgba(28,38,46,0.82)' },
  imageWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 70,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  image: { width: 64, height: 64 },
  choiceTitle: { fontSize: 13.5, fontWeight: '900', lineHeight: 18 },
  choiceBody: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
  close: { alignSelf: 'center', paddingTop: 8 },
  closeLabel: { fontSize: 13, fontWeight: '800', lineHeight: 16 },
});
