import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { Lantern } from '@/constants/theme';
import type { KingdomGift } from '@/utils/kingdom-decor';
import { worldAssetSource } from '@/utils/world-visuals';

// The Kingdom's keepsake shelf — everything life has earned that isn't planted
// yet, each with its art, name and provenance. Plant drops it at the camera
// centre and opens decorate mode to drag it home.
type KeepsakesSheetProps = {
  gifts: KingdomGift[];
  onPlant: (gift: KingdomGift) => void;
  onDecorate: () => void;
  onOpenAlmanac: () => void;
  onClose: () => void;
};

export function KeepsakesSheet({ gifts, onPlant, onDecorate, onOpenAlmanac, onClose }: KeepsakesSheetProps) {
  const tabBarHeight = useBottomTabBarHeight();
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
          🎁 Keepsakes
        </ThemedText>
        <ThemedText style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          {gifts.length > 0
            ? `${gifts.length} earned by living, waiting to be planted`
            : 'Everything earned is planted'}
        </ThemedText>
        <ThemedText style={styles.sub} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
          Plant them any time — rearranging is always free
        </ThemedText>

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
          {gifts.map((gift) => {
            const source = worldAssetSource(gift.assetKey);
            return (
              <View key={gift.id} style={styles.row}>
                {source ? (
                  <Image contentFit="contain" source={source} style={styles.thumb} transition={120} />
                ) : (
                  <View style={styles.thumb} />
                )}
                <View style={styles.rowBody}>
                  <ThemedText style={styles.rowName} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                    {gift.name}
                  </ThemedText>
                  <ThemedText numberOfLines={2} style={styles.rowSource} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                    {gift.provenance.label}
                    {gift.provenance.isoDate ? ` · ${gift.provenance.isoDate}` : ''}
                  </ThemedText>
                </View>
                <Pressable accessibilityRole="button" onPress={() => onPlant(gift)} style={styles.plantBtn}>
                  <ThemedText style={styles.plantLabel} lightColor={Lantern.ink900} darkColor={Lantern.ink900}>
                    Plant
                  </ThemedText>
                </Pressable>
              </View>
            );
          })}
          {gifts.length === 0 ? (
            <ThemedText style={styles.empty} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
              Live more days — photos, walks, meals, reflections and discoveries all earn keepsakes.
            </ThemedText>
          ) : null}
        </ScrollView>

        <Pressable accessibilityRole="button" onPress={onOpenAlmanac} style={styles.almanacLink}>
          <ThemedText style={styles.almanacLabel} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
            📖 How keepsakes are earned
          </ThemedText>
        </Pressable>

        <View style={styles.actions}>
          <KatchaButton label="Rearrange the Kingdom" variant="secondary" onPress={onDecorate} style={styles.actionBtn} />
          <KatchaButton label="Done" variant="primary" onPress={onClose} style={styles.actionBtn} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, elevation: 24, zIndex: 55 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4, 7, 15, 0.42)' },
  sheet: {
    backgroundColor: '#161226',
    borderColor: 'rgba(255,255,255,0.12)',
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1,
    boxShadow: '0 18px 48px rgba(0,0,0,0.55)',
    gap: 8,
    left: 14,
    maxHeight: 520,
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
  sub: { fontSize: 12.5, fontWeight: '700' },
  list: { flexGrow: 0 },
  listContent: { gap: 8, paddingVertical: 4 },
  row: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 10,
  },
  thumb: { height: 52, width: 52 },
  rowBody: { flex: 1, gap: 2 },
  rowName: { fontSize: 14.5, fontWeight: '800' },
  rowSource: { fontSize: 11.5, fontWeight: '600', lineHeight: 15 },
  plantBtn: {
    backgroundColor: Lantern.ember300,
    borderCurve: 'continuous',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  plantLabel: { fontSize: 13, fontWeight: '900' },
  empty: { fontSize: 13.5, fontWeight: '600', lineHeight: 19, paddingVertical: 8 },
  almanacLink: { alignSelf: 'center', paddingVertical: 2 },
  almanacLabel: { fontSize: 12.5, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionBtn: { flex: 1 },
});
