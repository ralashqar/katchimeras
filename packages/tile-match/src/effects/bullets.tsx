import { useTileColors } from '../ui/theme';
/**
 * Cleared blocks flying into the player's car.
 *
 * This is the piece that connects the two halves of the screen. Everything the
 * player does happens at the bottom, and everything it affects happens at the
 * top, so a clear reads as two unrelated events: blocks vanish, and separately a
 * number goes up. Firing the blocks *into* the car makes the causation literal.
 *
 * Why it lives at the root rather than inside the board:
 *
 *   - It has to cross container boundaries. The cells belong to the play stack
 *     at the bottom; the car belongs to the road layer at the top, which is also
 *     scaled by the camera. Nothing can span both except a sibling of both.
 *   - So every coordinate here is **window space**. The board's origin comes from
 *     `measureInWindow`, and the car's from `roadGeometry` — the road starts at
 *     y=0 and spans the full width, so its local coordinates *are* window
 *     coordinates.
 *
 * Cost control: one shared `progress` per volley drives every bullet in it. Each
 * bullet still needs its own animated style — they travel different distances —
 * but they share one timing source, and a volley is capped so a huge clear
 * cannot spawn 40 of them.
 */

import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { type BlockPaletteId } from '../ui/tokens';

/**
 * Hard cap per volley. A perfect clear could otherwise fire 40 bullets, which
 * costs 40 animated styles at the exact moment the screen is busiest.
 */
const MAX_BULLETS = 14;

const FLIGHT_MS = 420;

export type Bullet = {
  /** Window-space origin. */
  x: number;
  y: number;
  colorId: BlockPaletteId;
  size: number;
  /** Staggers departure so the volley streams rather than teleports. */
  delay: number;
};

export type BulletVolley = {
  id: number;
  bullets: Bullet[];
  /** Window-space destination — the car. */
  target: { x: number; y: number };
};

export const Bullets = memo(function Bullets({
  volley,
  onDone,
}: {
  volley: BulletVolley;
  onDone: (id: number) => void;
}) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.layer]}>
      {volley.bullets.map((bullet, index) => (
        <Tracer
          key={index}
          bullet={bullet}
          target={volley.target}
          // Only the last bullet reports back, so the volley is retired once.
          onDone={index === volley.bullets.length - 1 ? () => onDone(volley.id) : undefined}
        />
      ))}
    </View>
  );
});

function Tracer({
  bullet,
  target,
  onDone,
}: {
  bullet: Bullet;
  target: { x: number; y: number };
  onDone?: () => void;
}) {
  const progress = useSharedValue(0);
  const swatch = useTileColors()[bullet.colorId];

  const dx = target.x - bullet.x;
  const dy = target.y - bullet.y;

  // Bow the path sideways so a volley fans out instead of collapsing onto one
  // straight line. Sign alternates with the horizontal direction of travel.
  const arc = Math.min(70, Math.abs(dy) * 0.28) * (dx >= 0 ? 1 : -1);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: FLIGHT_MS + bullet.delay,
      // Slow out of the board, then accelerate hard into the car — the shape of
      // something being fired rather than drifting.
      easing: Easing.bezier(0.55, 0, 0.85, 0.35),
    });
    return () => cancelAnimation(progress);
  }, [bullet.delay, progress]);

  useEffect(() => {
    if (!onDone) return;
    const timer = setTimeout(onDone, FLIGHT_MS + bullet.delay + 60);
    return () => clearTimeout(timer);
  }, [bullet.delay, onDone]);

  const style = useAnimatedStyle(() => {
    // Hold at the origin through the stagger, then fly.
    const t = interpolate(
      progress.value,
      [0, bullet.delay / (FLIGHT_MS + bullet.delay), 1],
      [0, 0, 1],
      'clamp',
    );

    return {
      opacity: interpolate(t, [0, 0.12, 0.75, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: dx * t + arc * Math.sin(t * Math.PI) },
        { translateY: dy * t },
        // Shrink into the car and stretch along the direction of travel.
        { scale: interpolate(t, [0, 0.3, 1], [1, 0.82, 0.28]) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: bullet.x - bullet.size / 2,
          top: bullet.y - bullet.size / 2,
          width: bullet.size,
          height: bullet.size,
          borderRadius: bullet.size * 0.3,
          backgroundColor: swatch.mid,
          boxShadow: `0 0 10px ${swatch.glow}`,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  /**
   * Above the board and the tray. Bullets are the one effect that has to cross
   * the whole screen, so nothing may occlude them.
   */
  layer: { zIndex: 300 },
});

/**
 * Turn cleared cells into a volley.
 *
 * `cells` are field-local pixel positions; `boardOrigin` shifts them into window
 * space. Sampled down to `MAX_BULLETS` by taking an even stride through the
 * list, which keeps the spread across the whole payout rather than
 * bunching at one end.
 *
 * A cell may carry its **own** `delayMs`, and when it does that is used verbatim instead of an even
 * stagger. That is what keeps a tracer welded to the cell it came from: the outro takes each cell out one
 * at a time, so an evenly-staggered volley launched every bullet in the first fraction of a second while
 * most of the cells it was supposedly carrying had not so much as twitched. Passing the cell's own outro
 * delay means the tracer leaves exactly as its cell does.
 */
export function buildVolley(options: {
  id: number;
  cells: { x: number; y: number; colorId: BlockPaletteId; delayMs?: number }[];
  boardOrigin: { x: number; y: number };
  cellSize: number;
  target: { x: number; y: number };
}): BulletVolley {
  const { id, cells, boardOrigin, cellSize, target } = options;

  const stride = Math.max(1, Math.ceil(cells.length / MAX_BULLETS));
  const sampled = cells.filter((_, index) => index % stride === 0).slice(0, MAX_BULLETS);

  return {
    id,
    target,
    bullets: sampled.map((cell, index) => ({
      x: boardOrigin.x + cell.x + cellSize / 2,
      y: boardOrigin.y + cell.y + cellSize / 2,
      colorId: cell.colorId,
      size: Math.max(10, cellSize * 0.46),
      // The even stride is the fallback for callers with no per-cell timing to offer.
      delay: cell.delayMs ?? index * 26,
    })),
  };
}
