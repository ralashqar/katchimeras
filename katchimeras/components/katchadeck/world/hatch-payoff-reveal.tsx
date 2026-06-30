import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';

type HatchPayoffRevealProps = {
  creatureName: string;
  chronicleTitle: string;
  sources: string[];
  onOpenChronicle: () => void;
  onOpenMemories: () => void;
  onClose: () => void;
};

export function HatchPayoffReveal({
  creatureName,
  chronicleTitle,
  sources,
  onOpenChronicle,
  onOpenMemories,
  onClose,
}: HatchPayoffRevealProps) {
  return (
    <View style={styles.overlay}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={styles.backdrop}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <Animated.View entering={ZoomIn.springify().damping(15).mass(0.9)} exiting={FadeOut.duration(160)} style={styles.card}>
        <ThemedText style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
          Today became
        </ThemedText>
        <ThemedText type="display" style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          {chronicleTitle}
        </ThemedText>
        <View style={styles.creatureLine}>
          <IconSymbol name="sparkles" size={14} color={Lantern.auroraTeal} />
          <ThemedText style={styles.creatureText} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            {creatureName} hatched from this day.
          </ThemedText>
        </View>

        {sources.length > 0 ? (
          <View style={styles.sources}>
            {sources.map((source) => (
              <View key={source} style={styles.sourcePill}>
                <View style={styles.sourceDot} />
                <ThemedText style={styles.sourceText} numberOfLines={1} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                  {source}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={onOpenChronicle} style={styles.primary}>
            <ThemedText style={styles.primaryLabel} lightColor={Lantern.emberInk} darkColor={Lantern.emberInk}>
              Read Chronicle
            </ThemedText>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onOpenMemories} style={styles.secondary}>
            <ThemedText style={styles.secondaryLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              View Memories
            </ThemedText>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 58, elevation: 58 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4, 7, 15, 0.62)' },
  card: {
    alignSelf: 'stretch',
    marginHorizontal: 18,
    paddingHorizontal: 22,
    paddingVertical: 24,
    borderRadius: 28,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,195,107,0.32)',
    backgroundColor: '#161226',
    boxShadow: '0 18px 52px rgba(0,0,0,0.58)',
    gap: 10,
  },
  kicker: { fontSize: 11, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { fontSize: 31, lineHeight: 37, fontStyle: 'italic' },
  creatureLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  creatureText: { flex: 1, fontSize: 14, fontWeight: '700', lineHeight: 19 },
  sources: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 },
  sourcePill: {
    minHeight: 32,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  sourceDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: Lantern.auroraTeal },
  sourceText: { maxWidth: '92%', fontSize: 12.5, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 10, paddingTop: 8 },
  primary: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderCurve: 'continuous',
    backgroundColor: Lantern.ember300,
  },
  primaryLabel: { fontSize: 13.5, fontWeight: '900' },
  secondary: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  secondaryLabel: { fontSize: 13.5, fontWeight: '900' },
});
