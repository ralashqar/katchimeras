import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { MotiView } from 'moti';
import Animated from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { popEnter } from '@/components/katchadeck/motion';
import { Meadow } from '@/constants/meadow-theme';
import type { TodayCategoryState } from '@/utils/today-categories';

// The Today screen's life categories, arranged in a fixed ring around the egg.
// Each icon is a door into its category sheet: dim while the day has nothing
// there, lit once it holds content, and glowing gold when the category is
// asking a contextual question (a new photo to read, a place to name, a steps
// spike to interpret…). Taps pass through the empty space to the egg below.
type TodayCategoryRingProps = {
  categories: TodayCategoryState[];
  onPress: (category: TodayCategoryState) => void;
  radius?: number;
  // Vertical nudge so the ring centers on the (lifted) egg, not the stage box.
  centerOffsetY?: number;
  // Centre on the top `anchorHeight` px of the container instead of the whole
  // box — the hero stages (egg AND creature) are a fixed 258px art box with
  // variable text below, so anchoring keeps the ring identical on both.
  anchorHeight?: number;
};

// Icons sit in two tight vertical fans beside the egg — the first half of the
// list down its right, the rest down its left. The fans hug the horizontal
// axis (small vertical span, wide horizontal reach) so nothing crowds the UI
// directly above or below the egg (hatch countdown, stats strip).
const VERTICAL_SPAN = 76; // max |y| of a side's top/bottom chip (snug stack)
// Chips stack in straight vertical columns (no arc) — every chip on a side
// shares the same x, flanking the egg left and right.
const ARC_INSET = 0;

export function TodayCategoryRing({
  categories,
  onPress,
  radius = 134,
  centerOffsetY = -18,
  anchorHeight,
}: TodayCategoryRingProps) {
  if (categories.length === 0) return null;
  const rightCount = Math.ceil(categories.length / 2);
  const container = anchorHeight
    ? { position: 'absolute' as const, top: 0, left: 0, right: 0, height: anchorHeight }
    : StyleSheet.absoluteFill;
  return (
    <View pointerEvents="box-none" style={[container, styles.center, { marginTop: centerOffsetY }]}>
      {categories.map((category, index) => {
        const onRight = index < rightCount;
        const sideIndex = onRight ? index : index - rightCount;
        const sideCount = onRight ? rightCount : categories.length - rightCount;
        // Even spacing top→bottom within the side's fan. A LONE chip (the
        // quests compass, since the other categories moved into the numbers
        // panel) sits at the egg's bottom-right instead of mid-height.
        const t = sideCount === 1 ? (categories.length === 1 ? 1 : 0.5) : sideIndex / (sideCount - 1);
        const y = (t - 0.5) * 2 * VERTICAL_SPAN;
        // The middle icon reaches furthest out; top/bottom tuck slightly in.
        const x = (radius - (Math.abs(y) / VERTICAL_SPAN) * ARC_INSET) * (onRight ? 1 : -1);
        return (
          <CategoryMote
            key={category.id}
            category={category}
            onPress={() => onPress(category)}
            translateX={x}
            translateY={y}
            enterDelay={110 + index * 45}
          />
        );
      })}
    </View>
  );
}

const GLOW = Meadow.gold;

// Generated 3D icon art per category (FAL grid → sliced + matted). Categories
// without art fall back to their IconSymbol glyph. Exported: the Today-in-
// numbers panel renders the same art for its category row.
// Per-state art — the chip becomes the day's current mood / logged night.
export const VARIANT_ART: Partial<Record<string, Record<string, number>>> = {
  mood: {
    radiant: require('@/assets/images/katchimeras/today-icons/moods/radiant.webp'),
    light: require('@/assets/images/katchimeras/today-icons/moods/light.webp'),
    meh: require('@/assets/images/katchimeras/today-icons/moods/meh.webp'),
    heavy: require('@/assets/images/katchimeras/today-icons/moods/heavy.webp'),
    stormy: require('@/assets/images/katchimeras/today-icons/moods/stormy.webp'),
  },
  sleep: {
    good: require('@/assets/images/katchimeras/today-icons/sleep/good.webp'),
    normal: require('@/assets/images/katchimeras/today-icons/sleep/normal.webp'),
    low: require('@/assets/images/katchimeras/today-icons/sleep/low.webp'),
  },
};

export const CATEGORY_ART: Partial<Record<string, number>> = {
  sleep: require('@/assets/images/katchimeras/today-icons/sleep.png'),
  mood: require('@/assets/images/katchimeras/today-icons/mood.png'),
  quests: require('@/assets/images/katchimeras/today-icons/quests.png'),
  reflection: require('@/assets/images/katchimeras/today-icons/reflection.png'),
  food: require('@/assets/images/katchimeras/today-icons/food.png'),
  studio: require('@/assets/images/katchimeras/today-icons/inspo.png'),
};

// Glassy squircle chips (the pedestal mockup): a frosted-glass rounded panel
// with the icon, category label AND count stacked inside, plus the solid gold
// count badge on the top-right corner. Attention = gold ring + slow pulse.
function CategoryMote({
  category,
  onPress,
  translateX,
  translateY,
  enterDelay = 0,
}: {
  category: TodayCategoryState;
  onPress: () => void;
  translateX: number;
  translateY: number;
  enterDelay?: number;
}) {
  const active = category.hasContent || category.needsAttention;
  const badge = category.countLabel ?? (category.count > 0 ? `${category.count}` : null);

  return (
    <View pointerEvents="box-none" style={[styles.slot, { transform: [{ translateX }, { translateY }] }]}>
      <Animated.View entering={popEnter(enterDelay)} style={styles.chipWrap} pointerEvents="box-none">
        {category.needsAttention ? (
          <MotiView
            from={{ opacity: 0.35, scale: 1 }}
            animate={{ opacity: 0.0, scale: 1.35 }}
            transition={{ loop: true, type: 'timing', duration: 1600 }}
            pointerEvents="none"
            style={[styles.pulse, { backgroundColor: GLOW }]}
          />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${category.label}${badge ? ` (${badge})` : ''}${category.needsAttention ? ' — needs a look' : ''}`}
          hitSlop={6}
          onPress={onPress}
          style={[
            styles.mote,
            category.needsAttention ? styles.moteAttention : null,
            { opacity: active ? 1 : 0.62 },
          ]}>
          <View style={styles.chipArtWrap} pointerEvents="none">
            {(() => {
              const art =
                (category.variant ? VARIANT_ART[category.id]?.[category.variant] : undefined) ??
                CATEGORY_ART[category.id];
              return art ? (
                <Image source={art} style={styles.chipArt} contentFit="contain" />
              ) : (
                <IconSymbol name={category.icon} size={24} color={Meadow.chipLabel} />
              );
            })()}
          </View>
          <ThemedText numberOfLines={1} style={styles.chipName} lightColor={Meadow.chipLabel} darkColor={Meadow.chipLabel}>
            {category.label}
          </ThemedText>
        </Pressable>
        {badge ? (
          <View style={styles.badge} pointerEvents="none">
            <ThemedText style={styles.badgeLabel} lightColor={Meadow.ink} darkColor={Meadow.ink}>
              {badge}
            </ThemedText>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  chipWrap: {
    height: 66,
    width: 66,
  },
  pulse: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
  },
  mote: {
    alignItems: 'center',
    backgroundColor: 'rgba(43, 34, 22, 0.52)',
    borderColor: 'rgba(255, 245, 220, 0.38)',
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1.2,
    // Inner top-light — the glassy bevel the target panels have.
    boxShadow: 'inset 0 1px 0 rgba(255, 248, 230, 0.35)',
    height: 66,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 5,
    width: 66,
  },
  moteAttention: {
    borderColor: GLOW,
    boxShadow: `0 0 14px ${GLOW}88`,
  },
  chipArtWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    // Optically centre the icon in the space above the caption.
    paddingBottom: 13,
  },
  chipArt: {
    height: 30,
    width: 30,
  },
  chipName: {
    bottom: 5,
    fontSize: 9.5,
    fontWeight: '600',
    left: 0,
    letterSpacing: 0.1,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
  },

  badge: {
    alignItems: 'center',
    backgroundColor: Meadow.gold,
    borderColor: Meadow.goldDeep,
    borderRadius: 999,
    borderWidth: 1.5,
    boxShadow: '0 2px 6px rgba(40, 26, 8, 0.35)',
    justifyContent: 'center',
    minWidth: 21,
    height: 21,
    paddingHorizontal: 5,
    position: 'absolute',
    right: -6,
    top: -6,
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 13.5,
    textAlign: 'center',
  },
});
