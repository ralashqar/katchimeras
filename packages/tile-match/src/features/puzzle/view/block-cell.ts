import type { TileColors } from '../../../ui/theme';
/**
 * One block cell's look, defined once.
 *
 * Three Skia components draw a block cell — `SlotField` draws it as a footprint or a landed block,
 * `ClearBurstSkia` takes it over on the frame a beat resolves, and `SlotMissSkia` drops it when a piece
 * misses — and until this module existed each of them carried its own hand-written copy of the gradient,
 * the inset and the corner radius.
 *
 * That has cost real bugs twice, both recorded in `ClearBurstSkia`'s own comments: the burst's gradient
 * ran `0..cell` against the field's `inset..inset+span`, which tinted every cell very slightly
 * differently at the exact moment the two swapped; and the burst drew `0, 0, cell, cell` against the
 * field's `2, 2, cell-4, cell-5`, so every cell jumped four points larger on the same frame. Both were
 * invisible in a diff and obvious on a device, which is the worst combination.
 *
 * A fourth copy per variety mode was the thing that made this worth fixing rather than tolerating.
 *
 * ## There are two looks, not one, and that is deliberate
 *
 * **`field`** — inset two points, a point shorter at the bottom, gradient over the inset span. This is a
 * cell *in the grid*: the inset is what separates neighbouring cells of one footprint so they read as
 * cells rather than as a bar. `SlotField` and `ClearBurstSkia` share it, and they share a **seam** — the
 * field stops drawing a cell on the exact frame the burst starts — so any divergence between those two
 * is a visible flicker.
 *
 * **`piece`** — the full cell, gradient over its whole height. This is a cell *of a piece*, matching what
 * `PieceArt` draws in the tray with Views. `SlotMissSkia` uses it because what falls away is the piece
 * the player was holding, not a cell that was ever in the grid. There is no seam here, so the two are
 * free to differ — but they should differ *on purpose*, which is what naming them does.
 *
 * Kept out of the components for the reason `slot-metrics.ts` is: shared geometry belongs outside a
 * platform split, so a later `.web.tsx` cannot orphan it. This one does import Skia — it builds paints —
 * so it is a view module and not an engine one, and `node --test` must not reach it.
 */

import {
  BlurStyle,
  PaintStyle,
  Skia,
  TileMode,
  vec,
  type SkPaint,
} from '@shopify/react-native-skia';

import { alpha } from '../../../ui/color';
import { blocks } from '../../../ui/tokens';
import { BLOCK_COLOR_IDS } from '../engine/types';
import { cellRadius } from './metrics';

/**
 * How far a grid cell's face is inset from its cell box, in points.
 *
 * Two, and the gradient must span the same window — see the header. A face drawn at the box's full size
 * makes adjacent cells of one footprint touch, which reads as a single bar rather than as a shape.
 */
export const CELL_INSET = 2;

/** The face's corner radius. Tighter than the cell box's, so the face sits *inside* the well. */
export const faceRadius = (cell: number): number => Math.max(4, cell * 0.14);

/**
 * The face rect, as plain numbers.
 *
 * **Call it once in the component body, not per cell inside the picture.** It allocates, and a recording
 * worklet walks every cell every frame — the existing components already hoist these numbers out of the
 * loop for exactly that reason. It carries `'worklet'` so a variety *may* call it on the UI thread when
 * it genuinely has to, not as an invitation to do so per cell.
 *
 * A point shorter at the bottom than at the top (`cell - inset*2 - 1`). That asymmetry is not a typo and
 * not an accident of tuning: it leaves the deep end of the gradient a hair more room, which is what stops
 * the bottom edge reading as a hard line against the cell below it.
 */
export function blockFaceRect(cell: number): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  'worklet';
  return {
    x: CELL_INSET,
    y: CELL_INSET,
    width: cell - CELL_INSET * 2,
    height: cell - CELL_INSET * 2 - 1,
  };
}

/** The shine bar's rect and radius, as plain numbers. Shared so the highlight cannot drift either. */
export function blockShineRect(cell: number): {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
} {
  'worklet';
  return {
    x: cell * 0.14,
    y: cell * 0.12,
    width: cell * 0.72,
    height: cell * 0.3,
    radius: cell * 0.12,
  };
}

/** How opaque the shine is over a fully drawn face. */
export const SHINE_ALPHA = 0.17;

/**
 * The gradient window for each look. `field` matches `blockFaceRect`; `piece` spans the whole cell.
 *
 * Returned rather than inlined so `blockFacePaints` reads as one thing parameterised, instead of two
 * near-identical branches — which is how the divergence happened the first time.
 */
const GRADIENT_SPAN = {
  field: (cell: number) => [CELL_INSET, cell - CELL_INSET] as const,
  piece: (cell: number) => [0, cell] as const,
} as const;

export type BlockCellLook = keyof typeof GRADIENT_SPAN;

/**
 * One fill paint per block colour, indexed by `BLOCK_COLOR_IDS.indexOf(colorId)`.
 *
 * Built once per cell size by the caller's `useMemo`, never inside a worklet — worklets cannot allocate
 * a paint. Alpha is deliberately *not* set here: a recorded picture captures paint state at draw time,
 * so one paint serves every cell at a different opacity via `setAlphaf` immediately before the draw.
 */
export function blockFacePaints(cell: number, look: BlockCellLook, colors: TileColors = blocks): SkPaint[] {
  const [from, to] = GRADIENT_SPAN[look](cell);
  return BLOCK_COLOR_IDS.map((id) => {
    const swatch = colors[id];
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setStyle(PaintStyle.Fill);
    paint.setShader(
      Skia.Shader.MakeLinearGradient(
        vec(0, from),
        vec(0, to),
        [Skia.Color(swatch.bright), Skia.Color(swatch.mid), Skia.Color(swatch.deep)],
        [0, 0.5, 1],
        TileMode.Clamp,
      ),
    );
    return paint;
  });
}

/** The white highlight laid over a drawn face. One paint; alpha is set per draw. */
export function blockShinePaint(): SkPaint {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setStyle(PaintStyle.Fill);
  paint.setColor(Skia.Color(alpha('#FFFFFF', SHINE_ALPHA)));
  return paint;
}

/**
 * An empty target: the group's colour at low alpha, plus a brighter rim.
 *
 * Tinted rather than neutral because colour is what pairs a footprint with its piece in the tray. Only
 * `SlotField` draws these today, but they are the *other* half of the cell's vocabulary and a variety
 * that decorates an unfilled footprint will want them.
 */
export function blockWellPaints(colors: TileColors = blocks): SkPaint[] {
  return BLOCK_COLOR_IDS.map((id) => {
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setStyle(PaintStyle.Fill);
    paint.setColor(Skia.Color(alpha(colors[id].mid, 0.22)));
    return paint;
  });
}

/** Stroke width of a target's rim. Exported because the rim is inset by half of it. */
export const rimWidth = (cell: number): number => Math.max(1.5, cell * 0.055);

export function blockRimPaints(cell: number, colors: TileColors = blocks): SkPaint[] {
  return BLOCK_COLOR_IDS.map((id) => {
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setStyle(PaintStyle.Stroke);
    paint.setStrokeWidth(rimWidth(cell));
    paint.setColor(Skia.Color(alpha(colors[id].bright, 0.6)));
    return paint;
  });
}

/**
 * The blurred glow thrown just outside a cell as it lands or leaves.
 *
 * A genuine blur rather than concentric strokes faking one, because a hard-edged ring is already the
 * vocabulary for a *target* rim and the two would be confusable at a glance. `SlotField` uses it on
 * arrival and `ClearBurstSkia` on release, which is the point: a cell's first and last moments are
 * recognisably the same kind of event rather than two unrelated effects.
 */
export function blockGlowPaints(cell: number, colors: TileColors = blocks): SkPaint[] {
  return BLOCK_COLOR_IDS.map((id) => {
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setStyle(PaintStyle.Stroke);
    paint.setStrokeWidth(Math.max(2, cell * 0.1));
    paint.setColor(Skia.Color(colors[id].glow));
    paint.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, cell * 0.14, false));
    return paint;
  });
}

/**
 * Flat `bright` fills, one per block colour.
 *
 * The shards the clear burst throws outward. Flat rather than gradient because a shard is a fragment
 * seen for a tenth of a second — a gradient on it is cost with nothing to show for it — and `bright`
 * because it has to read against the cell it just came out of.
 *
 * Here rather than in the burst so that *every* paint keyed on `BLOCK_COLOR_IDS` lives in one file. That
 * matters more than it looks: the index basis is shared, so a sixth block colour has to reindex every one
 * of these arrays at once, and having them scattered across three files is how you find that out late.
 */
export function blockSparkPaints(colors: TileColors = blocks): SkPaint[] {
  return BLOCK_COLOR_IDS.map((id) => {
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setStyle(PaintStyle.Fill);
    paint.setColor(Skia.Color(colors[id].bright));
    return paint;
  });
}

/** The cell box's own radius — the well, and the glow thrown around it. */
export const wellRadius = cellRadius;
