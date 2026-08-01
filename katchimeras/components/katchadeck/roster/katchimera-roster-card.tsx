import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { AppFontFamilies } from '@/constants/theme';
import { lifeAspectById } from '@/constants/life-aspects';
import { resolveCreatureArtSource } from '@/utils/creature-art';
import type {
  KatchimeraOwnedRosterItem,
  KatchimeraRosterItem,
} from '@/utils/katchimera-roster';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const CATEGORY_ICONS: Record<string, IconSymbolName> = {
  'daily-life': 'cup.and.saucer.fill',
  body: 'dumbbell.fill',
  relationships: 'heart.fill',
  purpose: 'sparkles',
  world: 'leaf.fill',
  'inner-life': 'moon.stars.fill',
};

const STATUS_ICONS: Record<NonNullable<KatchimeraOwnedRosterItem['status']>, IconSymbolName> = {
  offer: 'star.fill',
  active: 'bolt.fill',
  ready: 'checkmark',
};

function KatchimeraRosterCardComponent({
  featured,
  item,
  onPress,
  renderArtwork,
  width,
}: {
  featured: boolean;
  item: KatchimeraRosterItem;
  onPress: (creatureId: string) => void;
  renderArtwork: boolean;
  width: number;
}) {
  const pressScale = useSharedValue(1);
  const cardHeight = Math.min(214, Math.max(166, width * 1.46));
  const aspect = lifeAspectById.get(item.aspectId);
  const icon = CATEGORY_ICONS[aspect?.category ?? ''] ?? 'sparkles';
  const artwork = renderArtwork
    ? item.kind === 'owned'
      ? resolveCreatureArtSource(item.visualKey, { lod: 'thumb' })
      : resolveCreatureArtSource(item.silhouetteVisualKey, { lod: 'thumb' })
    : null;
  const artworkKey = item.kind === 'owned'
    ? `${item.creatureId}:${item.visualKey}`
    : `locked:${item.familyId}:${item.silhouetteVisualKey}`;
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <AnimatedPressable
      accessibilityLabel={item.kind === 'owned'
        ? `${item.name}. Bond level ${item.bond.level}. Open companion.`
        : 'Undiscovered Katchimera. Hatch more days to meet this companion.'}
      accessibilityRole="button"
      disabled={item.kind === 'locked'}
      onPress={() => {
        if (item.kind === 'owned') onPress(item.creatureId);
      }}
      onPressIn={() => {
        pressScale.value = withTiming(0.98, { duration: 90 });
      }}
      onPressOut={() => {
        pressScale.value = withSpring(1, { damping: 18, mass: 0.55, stiffness: 260 });
      }}
      style={[
        styles.card,
        {
          borderColor: featured ? '#EFCB67' : 'rgba(255,255,255,0.18)',
          height: cardHeight,
          width,
        },
        featured ? styles.featured : null,
        animatedStyle,
      ]}>
      <View style={[
        StyleSheet.absoluteFill,
        styles.cardTint,
        item.kind === 'owned'
          ? { backgroundColor: `${item.accentColor}24` }
          : styles.lockedTint,
      ]} />

      <View style={styles.topRow}>
        <View style={styles.aspectGlyph}>
          <IconSymbol name={icon} size={12} color="#FFF1C9" />
        </View>
        {item.kind === 'owned' && item.status ? (
          <View style={styles.statusGlyph}>
            <IconSymbol name={STATUS_ICONS[item.status]} size={11} color="#3B2A0E" />
          </View>
        ) : item.kind === 'locked' ? (
          <IconSymbol name="circle.fill" size={10} color="rgba(255,244,215,0.46)" />
        ) : featured ? (
          <IconSymbol name="star.fill" size={12} color="#F5D36F" />
        ) : null}
      </View>

      <View pointerEvents="none" style={styles.artStage}>
        {artwork ? (
          <Image
            accessibilityLabel=""
            cachePolicy="memory-disk"
            contentFit="contain"
            recyclingKey={artworkKey}
            source={artwork}
            style={styles.art}
            tintColor={item.kind === 'locked' ? '#191815' : undefined}
            transition={0}
          />
        ) : null}
        {item.kind === 'locked' ? (
          <View style={styles.questionBadge}>
            <ThemedText style={styles.question} lightColor="#EEDFB9" darkColor="#EEDFB9">?</ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.meta}>
        {item.kind === 'owned' ? (
          <>
            <View style={styles.nameRow}>
              <ThemedText numberOfLines={1} style={styles.name} lightColor="#FFF8E8" darkColor="#FFF8E8">
                {item.name}
              </ThemedText>
              <ThemedText style={styles.level} lightColor="#E9D8AE" darkColor="#E9D8AE">
                Lv. {item.bond.level}
              </ThemedText>
            </View>
            <View style={styles.progressRow}>
              <IconSymbol name="heart.fill" size={10} color="#F2CB69" />
              <ThemedText style={styles.points} lightColor="#E7D8B7" darkColor="#E7D8B7">
                {item.bond.isMax
                  ? item.bond.totalPoints
                  : `${item.bond.segmentPoints}/${item.bond.segmentTarget}`}
              </ThemedText>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.max(5, item.bond.ratio * 100)}%` }]} />
              </View>
            </View>
          </>
        ) : (
          <>
            <ThemedText numberOfLines={1} style={styles.lockedName} lightColor="#E4D8BB" darkColor="#E4D8BB">
              Undiscovered
            </ThemedText>
            <ThemedText numberOfLines={2} style={styles.lockedHint} lightColor="#AA9F85" darkColor="#AA9F85">
              Hatch more days to meet
            </ThemedText>
          </>
        )}
      </View>
    </AnimatedPressable>
  );
}

export const KatchimeraRosterCard = memo(KatchimeraRosterCardComponent);

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(24,23,20,0.82)',
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1,
    boxShadow: '0 10px 22px rgba(15,12,5,0.26), inset 0 1px 0 rgba(255,248,221,0.14)',
    overflow: 'hidden',
  },
  featured: {
    borderWidth: 1.5,
    boxShadow: '0 12px 25px rgba(23,17,5,0.32), inset 0 0 0 1px rgba(255,230,151,0.28)',
  },
  cardTint: { opacity: 0.88 },
  lockedTint: { backgroundColor: 'rgba(77,65,42,0.3)' },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 9,
    position: 'absolute',
    right: 9,
    top: 9,
    zIndex: 2,
  },
  aspectGlyph: {
    alignItems: 'center',
    backgroundColor: 'rgba(18,17,14,0.62)',
    borderColor: 'rgba(255,240,194,0.25)',
    borderRadius: 999,
    borderWidth: 1,
    height: 25,
    justifyContent: 'center',
    width: 25,
  },
  statusGlyph: {
    alignItems: 'center',
    backgroundColor: '#EFCB67',
    borderRadius: 999,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  artStage: {
    bottom: 49,
    left: 2,
    position: 'absolute',
    right: 2,
    top: 14,
  },
  art: { height: '100%', width: '100%' },
  questionBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(31,28,20,0.82)',
    borderColor: 'rgba(238,223,185,0.28)',
    borderRadius: 999,
    borderWidth: 1,
    height: 31,
    justifyContent: 'center',
    left: '50%',
    marginLeft: -15.5,
    marginTop: -15.5,
    position: 'absolute',
    top: '52%',
    width: 31,
  },
  question: {
    fontFamily: AppFontFamilies.fredokaBold,
    fontSize: 18,
  },
  meta: {
    backgroundColor: 'rgba(17,16,13,0.62)',
    bottom: 0,
    gap: 4,
    left: 0,
    minHeight: 53,
    paddingHorizontal: 9,
    paddingVertical: 7,
    position: 'absolute',
    right: 0,
  },
  nameRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'space-between',
  },
  name: {
    flex: 1,
    fontFamily: AppFontFamilies.fredokaBold,
    fontSize: 13,
    lineHeight: 16,
  },
  level: {
    fontFamily: AppFontFamilies.manrope,
    fontSize: 8.5,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  progressRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  points: {
    fontFamily: AppFontFamilies.manrope,
    fontSize: 8,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  track: {
    backgroundColor: 'rgba(243,229,190,0.18)',
    borderRadius: 999,
    flex: 1,
    height: 4,
    overflow: 'hidden',
  },
  fill: {
    backgroundColor: '#EFCB67',
    borderRadius: 999,
    height: '100%',
  },
  lockedName: {
    fontFamily: AppFontFamilies.fredokaBold,
    fontSize: 12,
    textAlign: 'center',
  },
  lockedHint: {
    fontFamily: AppFontFamilies.manrope,
    fontSize: 8.5,
    fontWeight: '700',
    lineHeight: 11,
    textAlign: 'center',
  },
});
