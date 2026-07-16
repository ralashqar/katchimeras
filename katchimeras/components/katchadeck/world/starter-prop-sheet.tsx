import { Image as ExpoImage } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';

import { ThemedText } from '@/components/themed-text';
import { KatchaSurfacePalette } from '@/constants/katcha-ui';
import type { WorldPropDef } from '@/utils/world-props-catalog';
import { worldAssetSource } from '@/utils/world-visuals';
import { Meadow } from '@/constants/meadow-theme';
const PARCHMENT = KatchaSurfacePalette.parchment;

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
    <KatchaSheet header={{ eyebrow: 'First Seed', title: 'Plant the first thing your world should grow around', subtitle: 'Choose by intention. After this, real days unlock the rest.' }} onRequestClose={onClose} size="tall" surface="parchment">
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

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
                  <ThemedText style={styles.choiceTitle} lightColor={PARCHMENT.text} darkColor={PARCHMENT.text}>
                    {choice.name}
                  </ThemedText>
                  <ThemedText style={styles.choiceBody} lightColor={PARCHMENT.textSecondary} darkColor={PARCHMENT.textSecondary} numberOfLines={3}>
                    {choice.description}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
          <ThemedText style={styles.closeLabel} lightColor={PARCHMENT.textSecondary} darkColor={PARCHMENT.textSecondary}>
            Later
          </ThemedText>
        </Pressable>
    </KatchaSheet>
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
    backgroundColor: PARCHMENT.subtle,
    borderWidth: 1,
    borderColor: PARCHMENT.border,
    boxShadow: PARCHMENT.cardShadow,
  },
  choicePressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  imageWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 70,
    borderRadius: 14,
    backgroundColor: PARCHMENT.elevated,
  },
  image: { width: 64, height: 64 },
  choiceTitle: { fontSize: 13.5, fontWeight: '900', lineHeight: 18 },
  choiceBody: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
  close: { alignSelf: 'center', paddingTop: 8 },
  closeLabel: { fontSize: 13, fontWeight: '800', lineHeight: 16 },
});
