import { useState } from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import type { HomeDayRecord } from '@/types/home';
import {
  BLOOM_POINTS_PER_GIFT,
  MAX_BLOOM_GIFTS_PER_DAY,
  bloomPointsForDay,
  signatureEarnsForDay,
} from '@/utils/kingdom-decor';
import { worldAssetSource } from '@/utils/world-visuals';

// Today's earning surface: a live bloom meter ("2/3 to your next bloom"), a
// keepsakes-waiting chip that jumps to the Kingdom shelf, and — on tap — a
// small "today's earnings" sheet showing what the day has grown so far.
// Earned gifts arrive with the hatch (kingdom-decor grants at sync).
type BloomMeterProps = {
  day: HomeDayRecord;
  // Unplanted keepsakes on the Kingdom shelf (0 hides the chip).
  keepsakesWaiting: number;
  onOpenKeepsakes: () => void;
};

export function BloomMeter({ day, keepsakesWaiting, onOpenKeepsakes }: BloomMeterProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const points = bloomPointsForDay(day);
  const earned = Math.min(MAX_BLOOM_GIFTS_PER_DAY, Math.floor(points / BLOOM_POINTS_PER_GIFT));
  const maxed = earned >= MAX_BLOOM_GIFTS_PER_DAY;
  const toNext = maxed ? 0 : BLOOM_POINTS_PER_GIFT - (points % BLOOM_POINTS_PER_GIFT);
  const progress = maxed ? 1 : (points % BLOOM_POINTS_PER_GIFT) / BLOOM_POINTS_PER_GIFT;
  const signatures = signatureEarnsForDay(day);

  const line = maxed
    ? `${earned} blooms earned today`
    : earned > 0
      ? `${earned} earned · ${toNext} more ${toNext === 1 ? 'moment' : 'moments'} to the next bloom`
      : `${toNext} ${toNext === 1 ? 'moment' : 'moments'} to your first bloom`;

  return (
    <>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" onPress={() => setSheetOpen(true)} style={styles.meter}>
          <ThemedText style={styles.meterEmoji}>🌱</ThemedText>
          <View style={styles.meterBody}>
            <ThemedText style={styles.meterLine} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              {line}
            </ThemedText>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          </View>
          {signatures.length > 0 ? (
            <View style={styles.sigBadge}>
              <ThemedText style={styles.sigBadgeLabel} lightColor={Lantern.ink950} darkColor={Lantern.ink950}>
                +{signatures.length}
              </ThemedText>
            </View>
          ) : null}
        </Pressable>
        {keepsakesWaiting > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${keepsakesWaiting} keepsakes waiting to be planted`}
            onPress={onOpenKeepsakes}
            style={styles.chip}>
            <ThemedText style={styles.chipEmoji}>🎁</ThemedText>
            <ThemedText style={styles.chipLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              {keepsakesWaiting}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      {sheetOpen ? (
        <EarningsSheet
          day={day}
          points={points}
          earned={earned}
          signatures={signatures}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}
    </>
  );
}

function EarningsSheet({
  day,
  points,
  earned,
  signatures,
  onClose,
}: {
  day: HomeDayRecord;
  points: number;
  earned: number;
  signatures: { id: string; name: string; assetKey: string; label: string }[];
  onClose: () => void;
}) {
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
          Today’s earnings
        </ThemedText>
        <ThemedText style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          Living today grows your Kingdom
        </ThemedText>

        <View style={styles.earnRow}>
          <ThemedText style={styles.earnEmoji}>🌱</ThemedText>
          <View style={styles.earnBody}>
            <ThemedText style={styles.earnName} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              {earned} {earned === 1 ? 'bloom' : 'blooms'} · {points} {points === 1 ? 'moment' : 'moments'} lived
            </ThemedText>
            <ThemedText style={styles.earnSub} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              Every ~{BLOOM_POINTS_PER_GIFT} captured moments grow a tree, shrub or flower (up to{' '}
              {MAX_BLOOM_GIFTS_PER_DAY} a day)
            </ThemedText>
          </View>
        </View>

        {signatures.map((signature) => {
          const source = worldAssetSource(signature.assetKey);
          return (
            <View key={signature.id} style={styles.earnRow}>
              {source ? (
                <Image contentFit="contain" source={source} style={styles.earnThumb} transition={120} />
              ) : (
                <ThemedText style={styles.earnEmoji}>✨</ThemedText>
              )}
              <View style={styles.earnBody}>
                <ThemedText style={styles.earnName} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                  {signature.name}
                </ThemedText>
                <ThemedText style={styles.earnSub} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                  {signature.label}
                </ThemedText>
              </View>
            </View>
          );
        })}

        <ThemedText style={styles.footer} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
          {day.state === 'hatched'
            ? 'Delivered with the hatch — plant them in your Kingdom.'
            : 'Everything earned is already on your Kingdom’s shelf — plant it any time.'}
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
  row: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  meter: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(168,201,154,0.35)',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  meterEmoji: { fontSize: 16 },
  meterBody: { flex: 1, gap: 5 },
  meterLine: { fontSize: 12, fontWeight: '700' },
  track: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 999, height: 5, overflow: 'hidden' },
  fill: { backgroundColor: '#A8C99A', borderRadius: 999, height: 5 },
  sigBadge: {
    alignItems: 'center',
    backgroundColor: Lantern.ember300,
    borderRadius: 999,
    height: 18,
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: 4,
  },
  sigBadgeLabel: { fontSize: 10, fontWeight: '900', lineHeight: 12 },
  chip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,195,107,0.12)',
    borderColor: 'rgba(255,195,107,0.5)',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  chipEmoji: { fontSize: 14 },
  chipLabel: { fontSize: 13, fontWeight: '800' },
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
  title: { fontSize: 18, fontWeight: '800', lineHeight: 23 },
  earnRow: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingVertical: 2 },
  earnEmoji: { fontSize: 22, textAlign: 'center', width: 40 },
  earnThumb: { height: 40, width: 40 },
  earnBody: { flex: 1, gap: 1 },
  earnName: { fontSize: 14, fontWeight: '800' },
  earnSub: { fontSize: 12, fontWeight: '600', lineHeight: 16 },
  footer: { fontSize: 12, fontWeight: '600', lineHeight: 16, marginTop: 4 },
  close: { alignSelf: 'center', paddingTop: 6 },
  closeLabel: { fontSize: 13, fontWeight: '800', lineHeight: 16 },
});
