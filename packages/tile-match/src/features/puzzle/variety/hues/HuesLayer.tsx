import { useTileColors } from '../../../../ui/theme';
/**
 * How long until the footprints change colour.
 *
 * A timing mechanic the player cannot see the clock of is a guessing game, so this is not decoration — it is the
 * half of the mechanic that makes it fair. A thin bar under each footprint depletes toward the next swap: full
 * means you have time, empty means it is about to turn.
 *
 * ## Views, not Skia
 *
 * Two or three bars, each one animated width. `AGENTS.md` is explicit that Skia earns its place by collapsing
 * *many* cells into one recorded picture, and that decoration should be Reanimated and Views — a canvas for
 * three rectangles would be cost with nothing to show for it. `SlotField`'s own drop ghost makes the same call
 * for the same reason.
 *
 * ## Why it runs its own clock, and why that is safe
 *
 * The reducer deliberately has none, and `beatElapsedMs` is not on the beat — it is handed to the reducer by the
 * caller and not kept. So this cannot read the schedule's absolute position.
 *
 * It does not need to. `data.nextSwapMs` changes on **every** swap, so restarting a `withTiming` whenever it
 * changes re-syncs the bar to the schedule at every window boundary. The worst drift is one frame, and it is
 * self-correcting rather than accumulating — which is the property that matters. Deriving it from a clock
 * threaded through the state would be more precise and would put a per-frame write into the run.
 */

import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { alpha } from '../../../../ui/color';
import { palette, radius } from '../../../../ui/tokens';
import { cellOrigin } from '../../view/metrics';
import { varietyData } from '../contract';
import type { VarietyLayerProps } from '../view-registry';
import { HUES_VARIETY, type HuesData } from './hues';

/** How thick the bar is, and how far under the footprint it sits. Points. */
const BAR_HEIGHT = 3;
const BAR_GAP = 4;

export const HuesLayer = memo(function HuesLayer({
  metrics,
  beat,
  reduceMotion,
  clock,
  beatStartedAt = 0,
}: VarietyLayerProps) {
  const blocks = useTileColors();
  const data = varietyData<HuesData>(beat, HUES_VARIETY.id);

  /**
   * One driver for every bar.
   *
   * They all swap together — see `hues.ts` on why the footprints are in sync — so one shared value is the honest
   * model as well as the cheap one. Two drivers could disagree about when the window ends.
   */
  const remaining = useSharedValue(1);

  const nextSwapMs = data?.nextSwapMs ?? 0;
  const windowMs = data?.windowMs ?? 0;

  useEffect(() => {
    if (!data || reduceMotion) {
      // Held full under reduced motion: the bar then reads as "there is a timer" without animating, which is
      // better than an empty bar implying the swap is imminent.
      remaining.value = 1;
      return;
    }
    remaining.value = 1;
    remaining.value = withTiming(0, { duration: windowMs, easing: Easing.linear });
    return () => cancelAnimation(remaining);
    // Keyed on `nextSwapMs`, which changes on every swap — that is what re-syncs the bar to the schedule.
  }, [remaining, nextSwapMs, windowMs, reduceMotion, data]);

  const progress = useDerivedValue(() => clock && windowMs > 0 ? Math.max(0, Math.min(1, (nextSwapMs - (clock.value - beatStartedAt)) / windowMs)) : remaining.value);
  const fill = useAnimatedStyle(() => ({ flex: Math.max(0, progress.value) }));
  const empty = useAnimatedStyle(() => ({ flex: Math.max(0, 1 - progress.value) }));

  if (!data) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/*
        Only the footprint that actually changes gets a bar.

        The layer used to draw one under every group, which was right when every group swapped. Now exactly one
        does — see `HuesData.swatches` — and a countdown under a footprint that is never going to change would be
        telling the player to wait for something that already matches.
      */}
      {beat.groups.filter((group) => data.swatches[group.id]).map((group) => {
        /**
         * The bar spans the footprint's own width, under its lowest row.
         *
         * Derived from the group's cells rather than from its origin and shape, because a variety that reshaped
         * the beat could have left the two disagreeing — the cells are what is actually drawn.
         */
        let left = Infinity;
        let right = -Infinity;
        let bottom = -Infinity;
        for (const index of group.cells) {
          const { x, y } = cellOrigin(metrics, Math.floor(index / metrics.cols), index % metrics.cols);
          left = Math.min(left, x);
          right = Math.max(right, x + metrics.cell);
          bottom = Math.max(bottom, y + metrics.cell);
        }
        if (!Number.isFinite(left)) return null;

        const swatch = blocks[group.colorId];

        return (
          <View
            key={group.id}
            style={[
              styles.track,
              { left, top: bottom + BAR_GAP, width: right - left },
            ]}
          >
            {/* Two flex children rather than a width animation: `flex` interpolates on the UI thread without
                needing the track's measured width, so this needs no layout pass and no second source of
                truth about how wide the footprint is. */}
            <Animated.View
              style={[styles.fill, { backgroundColor: swatch.bright }, fill]}
            />
            <Animated.View style={empty} />
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  track: {
    position: 'absolute',
    height: BAR_HEIGHT,
    flexDirection: 'row',
    borderRadius: radius.xs,
    // A visible trough, so an almost-empty bar still reads as a bar rather than as a stray mark.
    backgroundColor: alpha(palette.ink, 0.45),
    overflow: 'hidden',
  },
  fill: { borderRadius: radius.xs },
});
