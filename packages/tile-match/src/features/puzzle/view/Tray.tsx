/**
 * The piece tray and the drag interaction.
 *
 * Ported closely from the reference implementation, whose grab model is much
 * better than a naive one:
 *
 *  - The hitbox fills the whole tray *section*, not the piece's bounds, so you
 *    can start a drag anywhere near it rather than having to hit small blocks.
 *  - `grabOffset` records where inside that hitbox you grabbed, so the piece
 *    keeps its relative position under the finger instead of snapping its
 *    centre to the touch point.
 *  - The piece floats `fingerLift` above the finger so your thumb never covers
 *    the cells you are aiming at.
 *  - A `Pressable onPress` under the pan gives tap-to-select for free.
 *  - On a successful drop the piece is hidden instantly (`placedSuccessfully`)
 *    so it never visibly springs back over the cell it just filled.
 *
 * Three constants were re-derived for the slot field, which sits a third of a screen above the tray
 * rather than immediately on top of it: `GAIN_Y`, `trayCell` and `fingerLift`. See each below.
 */

import { memo, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { clamp } from '../../../core/math';
import { CONTROLLED_EASE } from '../../../ui/motion';
import { alpha } from '../../../ui/color';
import { elevation, line, palette, radius, surface, zLayer } from '../../../ui/tokens';
import { cellsExtent } from '../engine/board';
import {
  NO_CELL,
  dropFootprintFor,
  resolveDropCell,
  type DropFrame,
  type DropRelease,
} from '../engine/slot-drop';
import type { Piece } from '../engine/types';
import { PieceArt } from './PieceArt';
import type { BoardMetrics } from './metrics';

/**
 * What became of a piece when the finger lifted.
 *
 * A three-way answer, and it used to be a boolean. The third case arrived with armour: a drop that a mechanic
 * *ate* is neither consumed nor invalid. The piece really does come back — that is the mechanic — but it came back
 * because the player did the right thing, so the tray must not scold them for it.
 *
 * Under a boolean the only options were both wrong. `true` hid the piece forever, because `placed` latches and the
 * view never reappears — so a chipped footprint left an empty tray slot holding a piece the run still says is
 * there. `false` sprang it back correctly and then fired `onInvalid`, buzzing a rejection at a drop that had just
 * done damage.
 *
 *   `consumed`  spent. Hidden at once, so it never springs back over the cell it just filled.
 *   `returned`  back in the tray, no complaint. A chip, or a release the screen judged to be a cancel.
 *   `rejected`  back in the tray, and it was a mistake. Springs back *and* raises `onInvalid`.
 */
export type DropOutcome = 'consumed' | 'returned' | 'rejected';

/**
 * Finger-travel amplification.
 *
 * The reference used an isotropic 1.42 on an 8-row board. Horizontal keeps most of that (the thumb
 * arc is naturally wide sideways); vertical is the one that had to be re-derived for the slot field.
 *
 * It was 1.12, chosen when the target was a 5-row board sitting immediately above the tray: a row was
 * a big fraction of a short board, so amplification made a mis-row far more punishing. Both halves of
 * that changed. The slot field is now about 215pt above the tray's centre — `npm run layout` prints
 * the exact figure per device as `dragY` — so at 1.12 reaching its top row costs about 180pt of
 * finger travel, which is a stretch rather than a flick. But precision matters *more* than it did,
 * not less, because the drop is now graded on being exactly right.
 *
 * 1.25 is the compromise those two pull toward: the whole field sits within roughly 60–160pt of
 * travel, and one row still costs ~33pt — well clear of finger tremor. Raising `fingerLift` below is
 * what pays for most of the reach, and it costs no precision at all.
 */
const GAIN_X = 1.35;
const GAIN_Y = 1.25;

/** Delay before a *refilled* tray animates in, so the clear that emptied it lands first. */
const REFILL_SETTLE = 220;
/** Per-piece stagger, so the three arrive as a run rather than a block. */
const REFILL_STAGGER = 55;
const REFILL_DURATION = 220;

export type TrayProps = {
  style?: StyleProp<ViewStyle>;
  pieces: readonly Piece[];
  metrics: BoardMetrics;
  height: number;
  disabled?: boolean;
  selectedPieceId?: string | null;
  reduceMotion?: boolean;
  /**
   * Increments on every refill. Used as a `key` so the slots remount and their
   * entering animations re-fire — without it React reuses the views and the
   * new pieces would simply appear.
   */
  trayGeneration: number;
  /**
   * Where the drop field is on screen.
   *
   * The tray resolves drops itself, on the UI thread, and this is everything it needs to do that. The
   * split of responsibility is deliberate: the screen owns where the *field* is, the tray owns where
   * the *finger* is, and they meet on a cell index. Passing screen coordinates back and forth instead
   * is what forced the whole gesture onto the JS thread.
   *
   * Optional so the tray still renders — inert — before a layout has been solved.
   */
  dropFrame?: DropFrame;
  /**
   * How far the field has drifted from where the layout put it, in points.
   *
   * The field sways vertically on the upper rungs of the difficulty ladder, and this is the *live* offset
   * — read on the UI thread, every gesture frame, so the drop quantises against where the footprints
   * actually are. Without it the drag would still be graded against the field's resting position, and a
   * drifting beat would be unwinnable in a way the player could see but not act on.
   *
   * A shared value rather than a number for the reason the whole gesture is a worklet: a prop would
   * rebuild the pan sixty times a second, and rebuilding a gesture mid-drag drops its events.
   */
  driftY?: Readonly<SharedValue<number>>;
  onSelect?: (pieceId: string | null) => void;
  onPickUp?: (pieceId: string) => void;
  /**
   * The piece crossed into a different cell, or `NO_CELL` when it left the field or the drag ended.
   *
   * Called only on an actual change, from the UI thread via `runOnJS` — a few times a second rather
   * than sixty.
   */
  onCell?: (pieceId: string, cellIndex: number) => void;
  /**
   * The finger lifted. Say what became of the piece.
   *
   * Called for **every** release, including ones that resolved to no cell at all. That is deliberate and
   * it is a change from how this used to work: the tray no longer decides that a drop outside the field is
   * a non-event. Letting a piece go somewhere the field is not costs it — the screen fails it and collapses
   * it where it fell — and the only release that springs back is one the screen judges to be a cancel. The
   * tray cannot make that call, because it depends on where the tray *is*, which is layout.
   */
  onDropAt?: (pieceId: string, release: DropRelease) => DropOutcome;
  /** Fired when a drag ends somewhere the screen declined to consume it. */
  onInvalid?: () => void;
};

/**
 * Memoised. `DraggablePiece` already was, but the container was not — so the tray
 * subtree reconciled on every ghost move during a drag, which is the one moment it
 * must not compete for the JS thread. Every prop is either a stable value or a
 * `useCallback`, so this bails on essentially every hover-driven render.
 */
export const Tray = memo(function Tray({
  style,
  pieces,
  metrics,
  height,
  disabled,
  selectedPieceId,
  reduceMotion = false,
  trayGeneration,
  dropFrame,
  driftY,
  onSelect,
  onPickUp,
  onCell,
  onDropAt,
  onInvalid,
}: TrayProps) {
  // Only refills should wait for the settle delay; the very first tray of a run
  // should appear promptly.
  const isRefill = trayGeneration > 0;

  return (
    // Keyed on the generation so every slot remounts when the tray refills.
    <View key={trayGeneration} style={[styles.tray, { height }, style]}>
      <View pointerEvents="none" style={styles.traySheen} />

      {/* One slot per piece, rather than a hardcoded three.
          `slot` is `flex: 1` and centres its contents, so a single-piece tray centres that piece
          across the whole width for free — and its hitbox, which fills the slot, becomes the
          entire tray. That is the right target for a mode where there is nothing to choose
          between: you can start the drag anywhere along the bar. */}
      {pieces.map((_, slot) => {
        const piece = pieces[slot];
        const used = !piece || piece.used;
        const selected = !!piece && selectedPieceId === piece.id;

        return (
          <TraySlot
            key={slot}
            index={slot}
            isRefill={isRefill}
            reduceMotion={reduceMotion}
            used={used}
            selected={selected}
          >
            {piece && !piece.used ? (
              <DraggablePiece
                piece={piece}
                metrics={metrics}
                disabled={disabled}
                selected={selected}
                reduceMotion={reduceMotion}
                dropFrame={dropFrame}
                driftY={driftY}
                onSelect={onSelect}
                onPickUp={onPickUp}
                onCell={onCell}
                onDropAt={onDropAt}
                onInvalid={onInvalid}
              />
            ) : (
              <View style={styles.usedDot} />
            )}
          </TraySlot>
        );
      })}
    </View>
  );
});

/**
 * One tray section, with the refill intro.
 *
 * The animation is driven by an explicit shared value rather than Reanimated's
 * `entering={FadeInUp...}` layout animation. Layout animations depend on the
 * element genuinely remounting *and* on platform support, and when either is
 * missing they fail silently — the pieces simply pop in with no warning. An
 * explicit timeline behaves identically everywhere and is easy to verify.
 *
 * The parent keys this on `trayGeneration`, so a refill remounts the slot and
 * re-runs the effect.
 */
function TraySlot({
  index,
  isRefill,
  reduceMotion,
  used,
  selected,
  children,
}: {
  index: number;
  isRefill: boolean;
  reduceMotion: boolean;
  used: boolean;
  selected: boolean;
  children: ReactNode;
}) {
  const intro = useSharedValue(0);

  useEffect(() => {
    intro.value = 0;
    // Refills wait for the clear that emptied the tray to finish first.
    const delay = (isRefill ? REFILL_SETTLE : 0) + index * REFILL_STAGGER;
    intro.value = withDelay(
      reduceMotion ? Math.min(delay, 80) : delay,
      withTiming(1, {
        duration: reduceMotion ? 60 : REFILL_DURATION,
        easing: CONTROLLED_EASE,
      }),
    );
    return () => cancelAnimation(intro);
  }, [intro, index, isRefill, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: intro.value,
    transform: [
      // Rise into place — the "Up" in the reference's FadeInUp.
      { translateY: interpolate(intro.value, [0, 1], [reduceMotion ? 0 : 20, 0]) },
    ],
  }));

  return (
    <Animated.View
      style={[styles.slot, used && styles.slotUsed, selected && styles.slotActive, style]}
    >
      {children}
    </Animated.View>
  );
}

const DraggablePiece = memo(function DraggablePiece({
  piece,
  metrics,
  disabled,
  selected,
  reduceMotion,
  dropFrame,
  driftY,
  onSelect,
  onPickUp,
  onCell,
  onDropAt,
  onInvalid,
}: {
  piece: Piece;
  metrics: BoardMetrics;
  disabled?: boolean;
  selected: boolean;
  reduceMotion: boolean;
  dropFrame?: DropFrame;
  driftY?: Readonly<SharedValue<number>>;
  onSelect?: (pieceId: string | null) => void;
  onPickUp?: (pieceId: string) => void;
  onCell?: (pieceId: string, cellIndex: number) => void;
  onDropAt?: (pieceId: string, release: DropRelease) => DropOutcome;
  onInvalid?: () => void;
}) {
  /**
   * Tray scale, and the gap scaled to match so the piece keeps its proportions as it grows to field
   * size.
   *
   * Was `clamp(cell * 0.5, 11, 19)`, which drew thumbnails — correct when a full-size board sat
   * directly above and the tray was only telling you *which* piece was next. The tray is the only
   * piece surface now, its zone grew from 84 to 132pt, and the shape is what the player has to match
   * against a footprint a third of a screen away. So it is drawn nearer to half size than a third.
   */
  const trayCell = clamp(metrics.cell * 0.62, 14, 26);
  const trayGap = (trayCell * metrics.gap) / metrics.cell;

  const extent = cellsExtent(piece.cells);
  const pieceHeight = extent.height * metrics.pitch - metrics.gap;

  /**
   * How far above the fingertip the piece floats.
   *
   * The floor was 56, because the tray used to sit immediately below the board and a bigger lift
   * dropped a one-row piece past the bottom row before the finger had moved at all. There is a
   * ~215pt gap to the slot field now, so that failure mode is gone and the lift is pure benefit: it
   * buys reach for free, and unlike raising `GAIN_Y` it costs no precision — the piece and the finger
   * still move one-for-one, just offset.
   *
   * It is also what keeps the thumb off the cells being aimed at, which matters far more here than it
   * did on a board: the drop is graded on being exact, so covering the target with your own hand is
   * the difference between a perfect and a miss.
   */
  const fingerLift = clamp(pieceHeight / 2 + 30, 76, 104);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const grabOffsetX = useSharedValue(0);
  const grabOffsetY = useSharedValue(0);
  const homeCenterX = useSharedValue(0);
  const homeCenterY = useSharedValue(0);
  const hitboxWidth = useSharedValue(0);
  const hitboxHeight = useSharedValue(0);
  const placed = useSharedValue(false);
  const returning = useSharedValue(false);

  useEffect(() => {
    if (!selected) {
      scale.value = withTiming(1, { duration: reduceMotion ? 30 : 95, easing: CONTROLLED_EASE });
    }
  }, [reduceMotion, scale, selected]);

  /** The last cell this piece resolved to, so the gesture can spot a genuine change. */
  const lastCell = useSharedValue(NO_CELL);
  /**
   * True between `onEnd` handing the drop to JS and JS answering.
   *
   * `onFinalize` fires immediately after `onEnd` and used to spring the piece home whenever it had not
   * been placed. That was safe while the drop resolved synchronously on the JS thread; it is not now
   * that the answer comes back a frame later, because the spring would start before anyone knew whether
   * the piece was consumed, and a successful drop would visibly lurch homeward and then vanish.
   */
  const awaitingDrop = useSharedValue(false);

  /**
   * The piece's own geometry, in cells. Recomputed only when the piece or the field changes.
   *
   * Hoisted out of the gesture deliberately: `dropFootprintFor` walks the cell list and allocates, and
   * the answer cannot change while one piece is in the air.
   */
  const footprint = useMemo(
    () => (dropFrame ? dropFootprintFor({ rows: dropFrame.rows, cols: dropFrame.cols }, piece.cells) : null),
    [dropFrame, piece.cells],
  );

  /**
   * Spring the piece back to its slot.
   *
   * A worklet, because `onFinalize` is one now and calls it directly. It is also called from
   * `finishDrag` on the JS thread — a worklet is an ordinary function there, and starting a `withTiming`
   * from JS is the normal way to do it, so one definition serves both.
   */
  const returnToTray = useCallback(() => {
    'worklet';
    if (placed.value || returning.value) return;
    returning.value = true;
    const settle = reduceMotion ? 30 : 110;
    translateX.value = withTiming(0, { duration: settle, easing: CONTROLLED_EASE });
    translateY.value = withTiming(0, { duration: settle, easing: CONTROLLED_EASE });
    scale.value = withTiming(1, { duration: reduceMotion ? 30 : 90, easing: CONTROLLED_EASE });
    opacity.value = withTiming(1, { duration: reduceMotion ? 30 : 70, easing: CONTROLLED_EASE });
  }, [placed, returning, reduceMotion, translateX, translateY, scale, opacity]);

  /**
   * Resolve the drop on the JS thread, then commit the piece one way or the other.
   *
   * Reached via `runOnJS`, so it lands a frame after the finger lifted. Nothing has moved the piece in
   * that frame — `onFinalize` is held off by `awaitingDrop` — so the piece simply sits where it was
   * dropped until this decides, which is imperceptible either way.
   */
  const finishDrag = useCallback(
    (cellIndex: number, centerX: number, centerY: number, fingerX: number, fingerY: number) => {
      awaitingDrop.value = false;
      if (placed.value) return;
      /**
       * Offered to the screen **whatever** it resolved to, including `NO_CELL`.
       *
       * The guard that used to be here — `cellIndex !== NO_CELL &&` — is what made a drop outside the
       * field a free retry, and it was making the wrong decision in the wrong place. A piece released
       * somewhere the field is not should be lost, not returned; but whether a particular release counts
       * as "somewhere the field is not" or as the player changing their mind depends on where the tray is,
       * and the tray's own bounds are the screen's business. So the tray reports and the screen decides.
       */
      const outcome =
        onDropAt?.(piece.id, { cellIndex, centerX, centerY, fingerX, fingerY }) ?? 'rejected';

      if (outcome === 'consumed') {
        // Hide immediately so the piece never springs back over the cell it just filled.
        placed.value = true;
        returning.value = true;
        cancelAnimation(translateX);
        cancelAnimation(translateY);
        cancelAnimation(scale);
        cancelAnimation(opacity);
        opacity.value = 0;
      } else {
        /**
         * Back to the tray, animated all the way from wherever it was let go.
         *
         * That long travel is the point for a `returned` drop rather than a cost: a piece that bounced off a frozen
         * footprint and visibly flew home says *that did something, try again* far better than a fade-in would.
         * The two return cases differ only in whether the screen is also told to complain.
         */
        returnToTray();
        if (outcome === 'rejected') onInvalid?.();
      }
      onCell?.(piece.id, NO_CELL);
    },
    [
      awaitingDrop,
      placed,
      returning,
      onDropAt,
      onInvalid,
      onCell,
      piece.id,
      returnToTray,
      translateX,
      translateY,
      scale,
      opacity,
    ],
  );

  const beginDrag = useCallback(() => {
    placed.value = false;
    returning.value = false;
    opacity.value = 1;
    onSelect?.(null);
    onPickUp?.(piece.id);
  }, [placed, returning, opacity, onSelect, onPickUp, piece.id]);

  const reportCell = useCallback(
    (cellIndex: number) => {
      onCell?.(piece.id, cellIndex);
    },
    [onCell, piece.id],
  );

  const dragScale = (metrics.cell + metrics.gap) / (trayCell + trayGap);

  /**
   * Move the piece and, if it crossed into a different cell, say so. One gesture frame's worth of work.
   *
   * Shared by `onStart` and `onUpdate` so the very first frame of a drag resolves a cell like every
   * other one — otherwise the ghost stayed blank until the second frame.
   */
  const applyDrag = useCallback(
    (translationX: number, translationY: number) => {
      'worklet';
      const x = translationX * GAIN_X + grabOffsetX.value;
      const y = translationY * GAIN_Y + grabOffsetY.value - fingerLift;
      translateX.value = x;
      translateY.value = y;

      if (!dropFrame || !footprint) return;
      /**
       * Scalars in, a scalar out — no allocation, and no reason to wake the JS thread unless this differs
       * from the cell the ghost is already drawn for.
       *
       * The drift is applied to the **piece**, not to the frame, and that is not a shortcut: `DropFrame` is
       * a plain-number object captured by this worklet, so a per-frame `anchorY` would mean rebuilding it —
       * and rebuilding the object rebuilds the gesture. Subtracting the offset from the piece's centre is
       * the same arithmetic (the frame's anchor and the piece's position only ever appear as a difference),
       * costs one subtraction, and leaves `resolveDropCell` pure and unaware that the field can move.
       */
      const cellIndex = resolveDropCell(
        dropFrame,
        footprint,
        homeCenterX.value + x,
        homeCenterY.value + y - (driftY ? driftY.value : 0),
      );
      if (cellIndex === lastCell.value) return;
      lastCell.value = cellIndex;
      runOnJS(reportCell)(cellIndex);
    },
    [
      dropFrame,
      driftY,
      footprint,
      fingerLift,
      reportCell,
      grabOffsetX,
      grabOffsetY,
      homeCenterX,
      homeCenterY,
      lastCell,
      translateX,
      translateY,
    ],
  );

  /**
   * The pan, entirely on the UI thread.
   *
   * **This used to be `.runOnJS(true)`**, and that was the single biggest performance problem in the
   * game. `RaceScene` renders the car, the road and the sky from a `useFrame` on the **JS thread** — so
   * every gesture frame of every drag was competing directly with the 3D render for that thread, and it
   * cost three separate things per frame per finger: a native-to-JS crossing to deliver the event, two
   * cross-thread shared-value writes to move the piece, and a resolve that allocated. Two fingers
   * doubled all of it, which is exactly why two-handed play stalled.
   *
   * Now every frame is UI-thread scalar arithmetic. The transform writes are local, `resolveDropCell`
   * allocates nothing, and JS is woken **only when the resolved cell actually changes** — a few times a
   * second rather than sixty. The drag is no longer on the render thread's budget at all.
   *
   * The `runOnJS` calls that remain are all once-per-drag or once-per-cell-crossing, which is what the
   * JS thread is for.
   */
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled)
        .minDistance(6)
        .maxPointers(1)
        .onBegin((event) => {
          // Where inside the hitbox the finger landed, and where that hitbox
          // sits on screen — together these keep the piece under the finger.
          grabOffsetX.value = event.x - hitboxWidth.value / 2;
          grabOffsetY.value = event.y - hitboxHeight.value / 2;
          homeCenterX.value = event.absoluteX - event.x + hitboxWidth.value / 2;
          homeCenterY.value = event.absoluteY - event.y + hitboxHeight.value / 2;
          lastCell.value = NO_CELL;
          awaitingDrop.value = false;
        })
        .onStart((event) => {
          scale.value = dragScale;
          applyDrag(event.translationX, event.translationY);
          runOnJS(beginDrag)();
        })
        .onUpdate((event) => {
          if (placed.value) return;
          applyDrag(event.translationX, event.translationY);
        })
        .onEnd((event, success) => {
          // `success` is false when the gesture was cancelled rather than released — a system gesture
          // taking over, or the view unmounting mid-drag. Committing then would place a piece the player
          // never let go of, so this bows out and leaves `onFinalize` to spring it home.
          if (!success) return;
          awaitingDrop.value = true;
          /**
           * Two positions, because they answer two different questions.
           *
           * The **piece centre** is where a failed piece has to come apart — it is the thing the player was
           * looking at, and collapsing it anywhere else would read as a second object appearing. The
           * **finger** is what decides whether this was a cancel: the tray is the cancel zone, and the
           * piece is lifted `fingerLift` points clear of the finger precisely so it is not under it, so
           * testing the piece against the tray would make the cancel unreachable.
           */
          runOnJS(finishDrag)(
            lastCell.value,
            homeCenterX.value + translateX.value,
            homeCenterY.value + translateY.value,
            event.absoluteX,
            event.absoluteY,
          );
        })
        .onFinalize(() => {
          // Held off while a drop is in flight, or a successful placement would start springing home
          // before JS had confirmed it. A cancelled gesture never set the flag, so it still returns.
          if (!placed.value && !awaitingDrop.value) {
            returnToTray();
            runOnJS(reportCell)(NO_CELL);
          }
        }),
    [
      disabled,
      applyDrag,
      dragScale,
      beginDrag,
      finishDrag,
      returnToTray,
      reportCell,
      awaitingDrop,
      lastCell,
      grabOffsetX,
      grabOffsetY,
      homeCenterX,
      homeCenterY,
      hitboxWidth,
      hitboxHeight,
      placed,
      scale,
      translateX,
      translateY,
    ],
  );

  const translated = useAnimatedStyle(() => ({
    opacity: placed.value ? 0 : opacity.value,
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));
  const scaled = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <GestureDetector gesture={gesture}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${piece.cells.length} block piece`}
        accessibilityHint="Drag anywhere in this tray section onto its slot around the car"
        accessibilityState={{ selected, disabled: !!disabled }}
        disabled={disabled}
        onLayout={(event) => {
          hitboxWidth.value = event.nativeEvent.layout.width;
          hitboxHeight.value = event.nativeEvent.layout.height;
        }}
        onPress={() => onSelect?.(selected ? null : piece.id)}
        style={({ pressed }) => [
          styles.hitbox,
          pressed && styles.hitboxPressed,
          disabled && styles.hitboxDisabled,
        ]}
      >
        {/* Lifted above its tray neighbours while held. That is all this can do — clearing the slot
            field is the play stack's `zIndex` in `race.tsx`, because the field is a sibling of the
            tray and no child of the tray can be ordered against it. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.floating,
            { zIndex: selected ? zLayer.trayLifted : zLayer.trayPiece },
            translated,
          ]}
        >
          <Animated.View style={scaled}>
            <PieceArt cells={piece.cells} colorId={piece.colorId} cell={trayCell} gap={trayGap} />
          </Animated.View>
          {selected ? <View style={styles.selectedRing} /> : null}
        </Animated.View>
      </Pressable>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  // Panel treatment ported from the reference: a slightly lifted well with a
  // hairline sheen along the top edge.
  tray: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: line.edgeSoft,
    backgroundColor: surface.plate,
    boxShadow: elevation.lifted,
    overflow: 'visible',
    position: 'relative',
  },
  traySheen: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 1,
    height: 1,
    borderRadius: 99,
    backgroundColor: line.rimSoft,
  },
  slot: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  slotUsed: { opacity: 0.48 },
  /** The held slot, above its neighbours so a piece dragged over them is not clipped by one. */
  slotActive: { zIndex: zLayer.trayLifted },
  usedDot: {
    width: 5,
    height: 5,
    borderRadius: 99,
    backgroundColor: alpha(palette.chromeHi, 0.18),
  },
  hitbox: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  hitboxPressed: { opacity: 0.9 },
  hitboxDisabled: { opacity: 0.35 },
  floating: { alignItems: 'center', justifyContent: 'center', padding: 5 },
  selectedRing: {
    position: 'absolute',
    left: -6,
    right: -6,
    top: -6,
    bottom: -6,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: palette.amberHot,
  },
});
