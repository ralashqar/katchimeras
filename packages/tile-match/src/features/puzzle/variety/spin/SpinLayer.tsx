/**
 * How long until the footprint turns.
 *
 * A timing mechanic the player cannot see the clock of is a guessing game, so this is the half of `spin` that
 * makes it fair — the same thin bar `HuesLayer` draws under the colour clock, in the sabotage amber, under the one
 * footprint that turns. Full means you have time, empty means it is about to turn. While turned the bar reads
 * "how long until it faces you"; while aligned, "how long you have to land it".
 *
 * Views, not Skia, for the reason `HuesLayer` gives: one animated bar earns no canvas.
 *
 * The bar rides the footprint's live motion, so on a beat that both drifts and spins the countdown stays under
 * the target it belongs to.
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
import { MOTION_STRIDE } from '../../engine/slot-drop';
import { cellOrigin } from '../../view/metrics';
import { varietyData } from '../contract';
import type { VarietyLayerProps } from '../view-registry';
import { SPIN_VARIETY, type SpinData } from './spin';

const BAR_HEIGHT = 3;
const BAR_GAP = 4;

export const SpinLayer = memo(function SpinLayer({
  metrics,
  beat,
  reduceMotion,
  clock,
  beatStartedAt = 0,
  motion,
}: VarietyLayerProps) {
  const data = varietyData<SpinData>(beat, SPIN_VARIETY.id);
  const remaining = useSharedValue(1);
  const nextTurnMs = data?.nextTurnMs ?? 0;
  const windowMs = data?.windowMs ?? 0;
  const turned = data?.turned ?? false;
  const groupIndex = data?.groupId ? beat.groups.findIndex((group) => group.id === data.groupId) : -1;

  useEffect(() => {
    if (!data || reduceMotion || !Number.isFinite(nextTurnMs)) {
      remaining.value = 1;
      return;
    }
    remaining.value = 1;
    remaining.value = withTiming(0, { duration: windowMs, easing: Easing.linear });
    return () => cancelAnimation(remaining);
  }, [remaining, nextTurnMs, windowMs, reduceMotion, data]);

  const progress = useDerivedValue(() =>
    clock && windowMs > 0 && Number.isFinite(nextTurnMs)
      ? Math.max(0, Math.min(1, (nextTurnMs - (clock.value - beatStartedAt)) / windowMs))
      : remaining.value,
  );
  const fill = useAnimatedStyle(() => ({ flex: Math.max(0, progress.value) }));
  const empty = useAnimatedStyle(() => ({ flex: Math.max(0, 1 - progress.value) }));
  const ride = useAnimatedStyle(() => {
    const live = motion?.value;
    const dx = live && groupIndex >= 0 ? live[groupIndex * MOTION_STRIDE] ?? 0 : 0;
    const dy = live && groupIndex >= 0 ? live[groupIndex * MOTION_STRIDE + 1] ?? 0 : 0;
    return { transform: [{ translateX: dx }, { translateY: dy }] };
  });

  if (!data || groupIndex < 0) return null;
  const group = beat.groups[groupIndex];

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

  return (
    <Animated.View style={[StyleSheet.absoluteFill, ride]} pointerEvents="none">
      <View style={[styles.track, { left, top: bottom + BAR_GAP, width: right - left }]}>
        <Animated.View style={[styles.fill, { backgroundColor: turned ? palette.amberHot : palette.greenHot }, fill]} />
        <Animated.View style={empty} />
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  track: {
    position: 'absolute',
    height: BAR_HEIGHT,
    flexDirection: 'row',
    borderRadius: radius.xs,
    backgroundColor: alpha(palette.ink, 0.45),
    overflow: 'hidden',
  },
  fill: { borderRadius: radius.xs },
});
