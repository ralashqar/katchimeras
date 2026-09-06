import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { MotionView as MotiView } from '@/components/katchadeck/ui/motion-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { popEnter } from '@/components/katchadeck/motion';
import { Meadow } from '@/constants/meadow-theme';
import type { TodayCategoryState } from '@/utils/today-categories';

export type TodayCategoryRingItem = Pick<
  TodayCategoryState,
  'label' | 'icon' | 'count' | 'countLabel' | 'hasContent' | 'needsAttention' | 'variant'
> & { id: string };

// The Today screen's life categories, arranged in a fixed ring around the egg.
// Each icon is a door into its category sheet: dim while the day has nothing
// there, lit once it holds content, and glowing gold when the category is
// asking a contextual question (a new photo to read, a place to name, a steps
// spike to interpret…). Taps pass through the empty space to the egg below.
type TodayCategoryRingProps = {
  categories: TodayCategoryRingItem[];
  onPress: (category: TodayCategoryRingItem) => void;
  radius?: number;
  // Vertical nudge so the ring centers on the (lifted) egg, not the stage box.
  centerOffsetY?: number;
  // Centre on the top `anchorHeight` px of the container instead of the whole
  // box — the hero stages (egg AND creature) are a fixed 258px art box with
  // variable text below, so anchoring keeps the ring identical on both.
  anchorHeight?: number;
  // Exploration-scene placement: move the lone action beside an object with
  // this rendered width instead of using the legacy bottom-right position.
  singleItemLeftOfAnchorWidth?: number;
};

// Icons sit in two tight vertical fans beside the egg — the first half of the
// list down its right, the rest down its left. The fans hug the horizontal
// axis (small vertical span, wide horizontal reach) so nothing crowds the UI
// directly above or below the egg (hatch countdown, stats strip).
const VERTICAL_SPAN = 76; // max |y| of a side's top/bottom chip (snug stack)
// Chips stack in straight vertical columns (no arc) — every chip on a side
// shares the same x, flanking the egg left and right.
const ARC_INSET = 0;
const STANDARD_MOTE_SIZE = 66;
const GOAL_CARD_WIDTH = 170;
const GOAL_CARD_HEIGHT = 84;
const COMPACT_GOAL_CARD_WIDTH = 112;
const COMPACT_GOAL_CARD_HEIGHT = 58;
const SINGLE_ITEM_SIDE_GAP = 12;

export function TodayCategoryRing({
  categories,
  onPress,
  radius = 134,
  centerOffsetY = -18,
  anchorHeight,
  singleItemLeftOfAnchorWidth,
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
        // single action, since the other categories moved into the numbers
        // panel) sits at the egg's bottom-right instead of mid-height.
        const t = sideCount === 1 ? 1 : sideIndex / (sideCount - 1);
        const defaultY = (t - 0.5) * 2 * VERTICAL_SPAN;
        const placeSingleLeft = sideCount === 1 && singleItemLeftOfAnchorWidth != null;
        const compactGoal = placeSingleLeft && category.id === 'goals';
        const itemWidth = compactGoal ? COMPACT_GOAL_CARD_WIDTH : STANDARD_MOTE_SIZE;
        const y = placeSingleLeft ? 4 : defaultY;
        // The middle icon reaches furthest out; top/bottom tuck slightly in.
        const x = placeSingleLeft
          ? -(singleItemLeftOfAnchorWidth / 2 + itemWidth / 2 + SINGLE_ITEM_SIDE_GAP)
          : (radius - (Math.abs(y) / VERTICAL_SPAN) * ARC_INSET) * (onRight ? 1 : -1);
        return (
          <CategoryMote
            key={category.id}
            category={category}
            centeredOnAnchor={placeSingleLeft}
            compactGoal={compactGoal}
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
    radiant: require('@incubator/art-today-icons/moods/radiant.webp'),
    light: require('@incubator/art-today-icons/moods/light.webp'),
    meh: require('@incubator/art-today-icons/moods/meh.webp'),
    heavy: require('@incubator/art-today-icons/moods/heavy.webp'),
    stormy: require('@incubator/art-today-icons/moods/stormy.webp'),
  },
  sleep: {
    good: require('@incubator/art-today-icons/sleep/good.webp'),
    normal: require('@incubator/art-today-icons/sleep/normal.webp'),
    low: require('@incubator/art-today-icons/sleep/low.webp'),
  },
};

export const CATEGORY_ART: Partial<Record<string, number>> = {
  sleep: require('@incubator/art-today-icons/sleep.png'),
  mood: require('@incubator/art-today-icons/mood.png'),
  quests: require('@incubator/art-today-icons/quests.png'),
  reflection: require('@incubator/art-today-icons/reflection.png'),
  food: require('@incubator/art-today-icons/food.png'),
  studio: require('@incubator/art-today-icons/inspo.png'),
};

// Glassy squircle chips (the pedestal mockup): a frosted-glass rounded panel
// with the icon, category label AND count stacked inside, plus the solid gold
// count badge on the top-right corner. Attention = gold ring + slow pulse.
function CategoryMote({
  category,
  centeredOnAnchor,
  compactGoal,
  onPress,
  translateX,
  translateY,
  enterDelay = 0,
}: {
  category: TodayCategoryRingItem;
  centeredOnAnchor: boolean;
  compactGoal: boolean;
  onPress: () => void;
  translateX: number;
  translateY: number;
  enterDelay?: number;
}) {
  const active = category.hasContent || category.needsAttention;
  const badge = category.countLabel ?? (category.count > 0 ? `${category.count}` : null);

  if (category.id === 'goals') {
    const remaining = Number.parseInt(category.countLabel ?? '0', 10) || 0;
    const completed = Math.max(0, category.count - remaining);
    const completionPercent = category.count > 0
      ? Math.min(100, Math.round((completed / category.count) * 100))
      : 0;
    const status = category.count === 0
      ? 'Add your first'
      : remaining > 0
        ? `${remaining} to-do`
        : 'All done';

    if (compactGoal) {
      return (
        <View
          pointerEvents="box-none"
          style={[
            styles.slot,
            styles.compactGoalSlot,
            { transform: [{ translateX }, { translateY }] },
          ]}>
          <Animated.View entering={popEnter(enterDelay)} style={styles.compactGoalCardWrap}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Goals, ${status}`}
              hitSlop={8}
              onPress={onPress}
              style={({ pressed }) => [
                styles.compactGoalCard,
                pressed ? styles.goalCardPressed : null,
              ]}>
              <View style={styles.compactGoalClipboard} pointerEvents="none">
                <IconSymbol name="list.clipboard.fill" size={22} color="#59472F" />
                <View style={styles.compactGoalStar}>
                  <IconSymbol name="star.fill" size={8} color="#FFF5D4" />
                </View>
              </View>
              <View style={styles.compactGoalCopy} pointerEvents="none">
                <ThemedText
                  numberOfLines={1}
                  style={styles.compactGoalTitle}
                  lightColor="#FFF6DE"
                  darkColor="#FFF6DE">
                  Goals
                </ThemedText>
                <ThemedText
                  numberOfLines={1}
                  style={styles.compactGoalStatus}
                  lightColor="rgba(255, 246, 222, 0.78)"
                  darkColor="rgba(255, 246, 222, 0.78)">
                  {status}
                </ThemedText>
                <View style={styles.compactGoalProgressTrack}>
                  <View style={[styles.goalProgressFill, { width: `${completionPercent}%` }]} />
                </View>
              </View>
            </Pressable>
          </Animated.View>
        </View>
      );
    }

    return (
      <View
        pointerEvents="box-none"
        style={[
          styles.slot,
          centeredOnAnchor ? styles.centeredGoalSlot : styles.goalSlot,
          centeredOnAnchor ? { transform: [{ translateX }, { translateY }] } : null,
        ]}>
        <Animated.View entering={popEnter(enterDelay)} style={styles.goalCardWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Goals, ${status}`}
            hitSlop={8}
            onPress={onPress}
            style={({ pressed }) => [styles.goalCard, pressed ? styles.goalCardPressed : null]}>
            <View style={styles.goalClipboard} pointerEvents="none">
              <IconSymbol name="list.clipboard.fill" size={32} color="#59472F" />
              <View style={styles.goalStar}>
                <IconSymbol name="star.fill" size={12} color="#FFF5D4" />
              </View>
            </View>

            <View style={styles.goalCopy} pointerEvents="none">
              <ThemedText
                numberOfLines={1}
                style={styles.goalTitle}
                lightColor="#FFF6DE"
                darkColor="#FFF6DE">
                Goals
              </ThemedText>
              <ThemedText
                numberOfLines={1}
                style={styles.goalStatus}
                lightColor="rgba(255, 246, 222, 0.78)"
                darkColor="rgba(255, 246, 222, 0.78)">
                {status}
              </ThemedText>
              <View style={styles.goalProgressTrack}>
                <View style={[styles.goalProgressFill, { width: `${completionPercent}%` }]} />
              </View>
            </View>

            <IconSymbol name="chevron.right" size={23} color="rgba(255, 246, 222, 0.82)" />
          </Pressable>
        </Animated.View>
      </View>
    );
  }

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
    zIndex: 30,
  },
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  chipWrap: {
    height: STANDARD_MOTE_SIZE,
    width: STANDARD_MOTE_SIZE,
  },
  pulse: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
  },
  mote: {
    alignItems: 'center',
    backgroundColor: 'rgba(31, 27, 22, 0.78)',
    borderColor: 'rgba(255, 245, 220, 0.48)',
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1.2,
    // Inner top-light — the glassy bevel the target panels have.
    boxShadow: '0 4px 14px rgba(13, 12, 15, 0.28), inset 0 1px 0 rgba(255, 248, 230, 0.38)',
    height: STANDARD_MOTE_SIZE,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 5,
    width: STANDARD_MOTE_SIZE,
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
  goalCardWrap: {
    height: GOAL_CARD_HEIGHT,
    width: GOAL_CARD_WIDTH,
  },
  compactGoalCardWrap: {
    height: COMPACT_GOAL_CARD_HEIGHT,
    width: COMPACT_GOAL_CARD_WIDTH,
  },
  compactGoalSlot: {
    height: COMPACT_GOAL_CARD_HEIGHT,
    left: '50%',
    marginLeft: -COMPACT_GOAL_CARD_WIDTH / 2,
    marginTop: -COMPACT_GOAL_CARD_HEIGHT / 2,
    top: '50%',
    width: COMPACT_GOAL_CARD_WIDTH,
  },
  compactGoalCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(29, 25, 32, 0.91)',
    borderColor: 'rgba(247, 190, 69, 0.82)',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1.2,
    boxShadow: '0 4px 12px rgba(8, 7, 12, 0.34), 0 0 8px rgba(247, 190, 69, 0.18), inset 0 1px 0 rgba(255, 248, 225, 0.16)',
    flexDirection: 'row',
    gap: 7,
    height: COMPACT_GOAL_CARD_HEIGHT,
    paddingHorizontal: 9,
    width: COMPACT_GOAL_CARD_WIDTH,
  },
  compactGoalClipboard: {
    alignItems: 'center',
    backgroundColor: '#F2DFC0',
    borderColor: 'rgba(255, 249, 226, 0.7)',
    borderCurve: 'continuous',
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 28,
  },
  compactGoalStar: {
    alignItems: 'center',
    backgroundColor: Meadow.gold,
    borderRadius: 999,
    height: 14,
    justifyContent: 'center',
    position: 'absolute',
    right: -5,
    top: -5,
    width: 14,
  },
  compactGoalCopy: {
    flex: 1,
    gap: 0,
    minWidth: 0,
  },
  compactGoalTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.1,
    lineHeight: 17,
  },
  compactGoalStatus: {
    fontSize: 9.5,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    lineHeight: 12,
  },
  compactGoalProgressTrack: {
    backgroundColor: 'rgba(255, 246, 222, 0.19)',
    borderRadius: 999,
    height: 4,
    marginTop: 3,
    overflow: 'hidden',
    width: '100%',
  },
  centeredGoalSlot: {
    height: GOAL_CARD_HEIGHT,
    left: '50%',
    marginLeft: -GOAL_CARD_WIDTH / 2,
    marginTop: -GOAL_CARD_HEIGHT / 2,
    top: '50%',
    width: GOAL_CARD_WIDTH,
  },
  goalSlot: {
    right: 0,
    top: 0,
  },
  goalCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(29, 25, 32, 0.91)',
    borderColor: 'rgba(247, 190, 69, 0.86)',
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1.5,
    boxShadow: '0 5px 18px rgba(8, 7, 12, 0.38), 0 0 12px rgba(247, 190, 69, 0.22), inset 0 1px 0 rgba(255, 248, 225, 0.18)',
    flexDirection: 'row',
    gap: 9,
    height: GOAL_CARD_HEIGHT,
    paddingHorizontal: 12,
    width: GOAL_CARD_WIDTH,
  },
  goalCardPressed: {
    opacity: 0.82,
  },
  goalClipboard: {
    alignItems: 'center',
    backgroundColor: '#F2DFC0',
    borderColor: 'rgba(255, 249, 226, 0.72)',
    borderCurve: 'continuous',
    borderRadius: 10,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 38,
  },
  goalStar: {
    alignItems: 'center',
    backgroundColor: Meadow.gold,
    borderRadius: 999,
    boxShadow: '0 2px 5px rgba(61, 38, 8, 0.35)',
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    right: -7,
    top: -7,
    width: 20,
  },
  goalCopy: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.15,
    lineHeight: 21,
  },
  goalStatus: {
    fontSize: 12.5,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    lineHeight: 16,
  },
  goalProgressTrack: {
    backgroundColor: 'rgba(255, 246, 222, 0.19)',
    borderRadius: 999,
    height: 6,
    marginTop: 4,
    overflow: 'hidden',
    width: '100%',
  },
  goalProgressFill: {
    backgroundColor: Meadow.gold,
    borderRadius: 999,
    height: '100%',
    minWidth: 2,
  },
});
