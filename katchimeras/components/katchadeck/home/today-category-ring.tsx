import { Pressable, StyleSheet, View } from 'react-native';
import { MotiView } from 'moti';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
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
};

// Icons sit in two tight vertical fans beside the egg — the first half of the
// list down its right, the rest down its left. The fans hug the horizontal
// axis (small vertical span, wide horizontal reach) so nothing crowds the UI
// directly above or below the egg (hatch countdown, stats strip).
const VERTICAL_SPAN = 72; // max |y| of a side's top/bottom icon
const ARC_INSET = 12; // how much the top/bottom icons curve in toward the egg

export function TodayCategoryRing({ categories, onPress, radius = 136, centerOffsetY = -18 }: TodayCategoryRingProps) {
  if (categories.length === 0) return null;
  const rightCount = Math.ceil(categories.length / 2);
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.center, { marginTop: centerOffsetY }]}>
      {categories.map((category, index) => {
        const onRight = index < rightCount;
        const sideIndex = onRight ? index : index - rightCount;
        const sideCount = onRight ? rightCount : categories.length - rightCount;
        // Even spacing top→bottom within the side's fan.
        const t = sideCount === 1 ? 0.5 : sideIndex / (sideCount - 1);
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
          />
        );
      })}
    </View>
  );
}

const GLOW = '#FFC36B';

function CategoryMote({
  category,
  onPress,
  translateX,
  translateY,
}: {
  category: TodayCategoryState;
  onPress: () => void;
  translateX: number;
  translateY: number;
}) {
  const active = category.hasContent || category.needsAttention;
  const tint = category.needsAttention ? GLOW : active ? category.accent : 'rgba(201,194,232,0.45)';
  const badge = category.countLabel ?? (category.count > 0 ? `${category.count}` : null);

  return (
    <View pointerEvents="box-none" style={[styles.slot, { transform: [{ translateX }, { translateY }] }]}>
      {category.needsAttention ? (
        <MotiView
          from={{ opacity: 0.35, scale: 1 }}
          animate={{ opacity: 0.0, scale: 1.7 }}
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
          {
            borderColor: `${tint}AA`,
            boxShadow: category.needsAttention ? `0 0 16px ${GLOW}99` : active ? `0 0 12px ${category.accent}66` : 'none',
            opacity: active ? 1 : 0.55,
          },
        ]}>
        <IconSymbol name={category.icon} size={16} color={tint} />
      </Pressable>
      {badge ? (
        <View style={[styles.badge, { borderColor: `${tint}66` }]} pointerEvents="none">
          <ThemedText style={styles.badgeLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            {badge}
          </ThemedText>
        </View>
      ) : null}
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
  pulse: {
    borderRadius: 999,
    height: 36,
    position: 'absolute',
    width: 36,
  },
  mote: {
    alignItems: 'center',
    backgroundColor: 'rgba(12,10,20,0.86)',
    borderRadius: 999,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  badge: {
    backgroundColor: 'rgba(12,10,20,0.92)',
    borderRadius: 999,
    borderWidth: 1,
    bottom: -7,
    minWidth: 18,
    paddingHorizontal: 4,
    paddingVertical: 1,
    position: 'absolute',
  },
  badgeLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    lineHeight: 12,
    textAlign: 'center',
  },
});
