/**
 * The frozen footprint: a plate over every armoured cell, with its hit points on it.
 *
 * Two jobs, and both are load-bearing rather than decorative. The plate says *this one is not ready* — without it
 * a player drops normally, watches nothing land, and concludes the game is broken. The number says *how many more
 * times*, which is the difference between a mechanic and an obstacle: a target that shows its remaining points is
 * one the player can plan around.
 *
 * ## Views, not Skia
 *
 * Two reasons, and the second is the deciding one.
 *
 * At most six cells, each drawing a border and one glyph, with a single shared animation between them — nowhere
 * near the many-cells-into-one-picture bar Skia has to clear here. `HuesLayer` made the same call for the same
 * reason.
 *
 * And the numbers are **text**. Skia text needs a font object loaded and threaded in, which is a real dependency
 * and a real failure mode for two characters that a `GameText` renders for free. Drawing the points as pips
 * instead would have avoided it, and was the first plan — but pips stop scaling the moment armour goes past three,
 * and the point of showing the number is that it is a number.
 *
 * ## The flash is per footprint, not per cell
 *
 * A hit lands on several cells at once — every cell of the piece that covered one — so the whole plate reacting is
 * both cheaper and more accurate than each cell reacting alone. It is also the only shape available: a shared
 * value per cell would mean a hook per cell, and the cell count changes with the deal.
 */

import { memo, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Keyframe,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { GameText } from '../../../../ui/text';
import { alpha } from '../../../../ui/color';
import { palette, radius, semantic } from '../../../../ui/tokens';
import { cellOrigin } from '../../view/metrics';
import { varietyData } from '../contract';
import type { VarietyLayerProps } from '../view-registry';
import { ARMOUR_VARIETY, armourDropsLeft, armourProgress, type ArmourData } from './armour';

/** How far the plate is inset inside its cell, in points. Matches the block cell's own face inset. */
const INSET = 2;

/** The hit flash: up fast, down slower. */
const FLASH_RISE_MS = 70;
const FLASH_FALL_MS = 260;

/**
 * How far the plate rattles sideways on a hit, in points.
 *
 * Small, and the constraint is the same one the camera's lateral shake ran into: the plate sits **exactly over a
 * cell the player is aiming at**, so motion here costs more than motion anywhere else on screen. Three points is
 * enough to read as a jolt at a glance and small enough that the number on it stays legible while it happens.
 */
const RATTLE = 3;

/**
 * Rattle cycles over the flash's rise and fall.
 *
 * The oscillation is derived from the flash rather than driven by its own value: the flash runs 0 → 1 → 0, so a
 * sine of it at this multiple gives a burst of shakes that starts and ends at rest by construction. One shared
 * value, no second timeline to keep in step, and no chance of the rattle outliving the flash.
 */
const RATTLE_CYCLES = 3;

/**
 * How the plate leaves when its last point is gone.
 *
 * A **swell and fade**, deliberately the same gesture `ClearBurstSkia` uses for a cell being paid out rather than
 * `SlotMissSkia`'s collapse. Clearing armour is an achievement — it is the thing the player has been drumming away
 * at — so it should read as the plate being blown off, not as it dropping. Without any exit at all the plate
 * simply blinked out of existence, which made the moment the mechanic pays off the one moment it showed nothing.
 */
const CLEAR_MS = 260;

/**
 * The exit itself, built once at module scope.
 *
 * A `Keyframe` rather than Reanimated's stock `FadeOut` because the swell is the half that carries the meaning, and
 * built out here rather than per render because a new instance on every commit is a new animation object for every
 * plate on every frame the field repaints.
 */
const cleared = new Keyframe({
  0: { opacity: 1, transform: [{ scale: 1 }] },
  // Overshoots before it goes, so the plate reads as coming apart under pressure rather than shrinking away.
  40: { opacity: 0.85, transform: [{ scale: 1.35 }] },
  100: { opacity: 0, transform: [{ scale: 1.7 }] },
}).duration(CLEAR_MS);

export const ArmourLayer = memo(function ArmourLayer({
  metrics,
  beat,
  reduceMotion,
}: VarietyLayerProps) {
  const data = varietyData<ArmourData>(beat, ARMOUR_VARIETY.id);

  /**
   * One driver for the whole plate. See the header.
   *
   * Fired on a **change in points remaining**, which is the honest trigger: the only thing that reduces it is a
   * chip, and it cannot change for any other reason. Comparing a total rather than diffing the map keeps this to
   * one number and makes the mount case free — the ref is seeded from the first render, so a beat dealt with
   * armour already on it does not open by flashing.
   */
  const flash = useSharedValue(0);
  const left = data ? armourProgress(data).left : 0;
  const previousLeft = useRef(left);

  useEffect(() => {
    const took = previousLeft.current > left;
    previousLeft.current = left;
    if (!took || reduceMotion) return;
    flash.value = 0;
    flash.value = withSequence(
      withTiming(1, { duration: FLASH_RISE_MS, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: FLASH_FALL_MS, easing: Easing.in(Easing.quad) }),
    );
  }, [flash, left, reduceMotion]);

  /**
   * The plate pulses, brightens and rattles on a hit.
   *
   * Three things off one driver. The **swell** is the pulse; the **rattle** is a sine of the same value, so it
   * begins and ends at rest without a second timeline; and the **border** interpolates toward white rather than
   * cutting, so a fast hit does not read as the plate being replaced.
   *
   * `interpolateColor` rather than a threshold, which is what this was first: at a 70ms rise a hard switch spends
   * most of the animation at one end or the other, and the pulse looked like a flicker.
   */
  const hit = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      flash.value,
      [0, 1],
      [semantic.sabotageAxis, palette.text],
    ),
    transform: [
      { translateX: Math.sin(flash.value * Math.PI * 2 * RATTLE_CYCLES) * RATTLE },
      { scale: 1 + 0.16 * flash.value },
    ],
  }));

  if (!data?.groupId) return null;
  const group = beat.groups.find((candidate) => candidate.id === data.groupId);
  if (!group) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {group.cells.map((index) => {
        const points = data.hp[index] ?? 0;
        /**
         * A cleared cell stops being drawn — but it **leaves**, it does not vanish.
         *
         * Returning null unmounts the plate, and `exiting` is what turns that unmount into the blow-off above. It
         * is the one place a layout animation earns its keep here: the alternative is keeping spent plates mounted
         * with their own per-cell timers, which is state for something that is already over.
         *
         * Underneath, `SlotField` has been drawing the cell as an ordinary target the whole time — so once the
         * plate is gone the footprint is simply itself again, with nothing to switch over.
         */
        if (points <= 0) return null;

        const { x, y } = cellOrigin(metrics, Math.floor(index / metrics.cols), index % metrics.cols);
        const size = metrics.cell - INSET * 2;

        return (
          <Animated.View
            key={index}
            exiting={reduceMotion ? undefined : cleared}
            style={[
              styles.plate,
              { left: x + INSET, top: y + INSET, width: size, height: size },
              hit,
            ]}
          >
            {/* Drops remaining, not hit points — see `armourDropsLeft`. The two differ by the placement that
                actually fills the cell, and printing the raw points promised one drop where two were needed. */}
            <GameText style={[styles.points, { fontSize: Math.max(11, size * 0.44) }]}>
              {armourDropsLeft(points)}
            </GameText>
          </Animated.View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  plate: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xs,
    borderWidth: 2,
    /**
     * A dark wash rather than the group's own colour.
     *
     * The footprint underneath is already tinted with the colour that pairs it to its piece, and that pairing has
     * to survive being frozen — the player still needs to know *which* piece this wants. So the plate darkens what
     * is there instead of replacing it, which reads as the target being covered rather than as a different target.
     */
    backgroundColor: alpha(palette.ink, 0.62),
  },
  points: {
    // No `fontWeight` alongside a `fontFamily` from the tokens: custom faces carry weight in the family name, and
    // pairing the two synthesises a fake bold on Android or falls back to Roboto.
    color: palette.text,
    textAlign: 'center',
  },
});
