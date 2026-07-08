import { useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import { Meadow } from '@/constants/meadow-theme';
import type { HomeDayRecord } from '@/types/home';
import { bloomYieldForDay, signatureEarnsForDay } from '@/utils/kingdom-decor';
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
  // Yield ladder (world-economy.json): 1 bloom is guaranteed every day; living
  // adds one at each points threshold.
  const { points, count: earned, prevThreshold, nextThreshold } = bloomYieldForDay(day);
  const maxed = nextThreshold === null;
  const toNext = maxed ? 0 : nextThreshold - points;
  const progress = maxed ? 1 : (points - prevThreshold) / Math.max(1, nextThreshold - prevThreshold);
  const signatures = signatureEarnsForDay(day);

  const line = maxed
    ? `${earned} blooms earned today`
    : earned > 1
      ? `${earned} earned · ${toNext} more ${toNext === 1 ? 'moment' : 'moments'} to the next bloom`
      : `Today’s bloom is growing · ${toNext} ${toNext === 1 ? 'moment' : 'moments'} to a second`;

  return (
    <>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" onPress={() => setSheetOpen(true)} style={styles.meter}>
          <ThemedText style={styles.meterEmoji}>🌱</ThemedText>
          <View style={styles.meterBody}>
            <ThemedText style={styles.meterLine} lightColor={Meadow.ink} darkColor={Meadow.ink}>
              {line}
            </ThemedText>
            <ThemedText style={styles.meterSub} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
              {maxed ? 'A full day of growing' : 'Keep going, you’re growing'}
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
            <ThemedText style={styles.chipLabel} lightColor={Meadow.ink} darkColor={Meadow.ink}>
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
              One bloom grows every day on its own — captured moments grow more (up to 3 a day)
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
    backgroundColor: Meadow.card,
    borderColor: Meadow.cardBorder,
    borderCurve: 'continuous',
    borderRadius: Meadow.radius.card,
    borderWidth: 1,
    boxShadow: Meadow.cardShadow,
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: Meadow.space.cardPad,
    paddingVertical: 12,
  },
  meterEmoji: { fontSize: 18 },
  meterBody: { flex: 1, gap: 6 },
  meterLine: { fontSize: 13.5, fontWeight: '800' },
  track: { backgroundColor: Meadow.trackOnCard, borderRadius: 999, height: 6, overflow: 'hidden' },
  meterSub: { fontSize: 11.5, fontWeight: '600' },
  fill: { backgroundColor: Meadow.leaf, borderRadius: 999, height: 6 },
  sigBadge: {
    alignItems: 'center',
    backgroundColor: Meadow.gold,
    borderColor: Meadow.goldDeep,
    borderRadius: 999,
    borderWidth: 1,
    height: 20,
    justifyContent: 'center',
    minWidth: 20,
    paddingHorizontal: 5,
  },
  sigBadgeLabel: { fontSize: 10, fontWeight: '900', lineHeight: 12 },
  chip: {
    alignItems: 'center',
    backgroundColor: Meadow.card,
    borderColor: Meadow.cardBorder,
    borderCurve: 'continuous',
    borderRadius: Meadow.radius.card,
    borderWidth: 1,
    boxShadow: Meadow.cardShadow,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  chipEmoji: { fontSize: 14 },
  chipLabel: { fontSize: 13, fontWeight: '800' },
  overlay: { ...StyleSheet.absoluteFillObject, elevation: 24, zIndex: 50 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4, 7, 15, 0.42)' },
  sheet: {
    backgroundColor: Meadow.overlay.sheetBg,
    borderColor: Meadow.overlay.sheetBorder,
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
