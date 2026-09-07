import { BlurStyle, ClipOp, PaintStyle, Skia } from '@shopify/react-native-skia';
import { footprintContours } from './footprint-contour';
import type { BoardMetrics } from './metrics';

/** Bake the soft light once per geometry/colour change, never during a drag or animation frame. */
export function footprintGlow(groups: {cells: number[]; color: string}[], metrics: BoardMetrics, clear: boolean, miniature: boolean) {
  const surface = Skia.Surface.MakeOffscreen(Math.ceil(metrics.width), Math.ceil(metrics.height));
  if (!surface) return null;
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('transparent'));
  const paint = Skia.Paint(); paint.setAntiAlias(true);
  for (const group of groups) {
    const path = Skia.Path.Make();
    const r = metrics.cell * .22;
    for (const loop of footprintContours(group.cells, metrics.cols)) {
      if (loop.length < 3) continue;
      const points = loop.map(p => ({x: metrics.outer - metrics.gap/2 + p.x*metrics.pitch, y: metrics.outer - metrics.gap/2 + p.y*metrics.pitch}));
      for (let i=0; i<points.length; i++) {
        const p=points[i], before=points[(i+points.length-1)%points.length], after=points[(i+1)%points.length];
        const entry={x:p.x+Math.sign(before.x-p.x)*r,y:p.y+Math.sign(before.y-p.y)*r};
        const exit={x:p.x+Math.sign(after.x-p.x)*r,y:p.y+Math.sign(after.y-p.y)*r};
        if (i === 0) path.moveTo(entry.x,entry.y); else path.lineTo(entry.x,entry.y);
        path.quadTo(p.x,p.y,exit.x,exit.y);
      }
      path.close();
    }
    paint.setStyle(PaintStyle.Fill); paint.setColor(Skia.Color('#102B2848')); canvas.drawPath(path,paint);
    canvas.save(); canvas.clipPath(path, ClipOp.Intersect, true);
    paint.setStyle(PaintStyle.Stroke); paint.setStrokeWidth(clear ? 1 : .65); paint.setColor(Skia.Color('#D8F4F02A'));
    const members = new Set(group.cells);
    for (const index of group.cells) {
      const col=index%metrics.cols, row=Math.floor(index/metrics.cols);
      const x=metrics.outer-metrics.gap/2+col*metrics.pitch, y=metrics.outer-metrics.gap/2+row*metrics.pitch;
      if (col < metrics.cols-1 && members.has(index+1)) canvas.drawLine(x+metrics.pitch,y,x+metrics.pitch,y+metrics.pitch,paint);
      if (members.has(index+metrics.cols)) canvas.drawLine(x,y+metrics.pitch,x+metrics.pitch,y+metrics.pitch,paint);
    }
    canvas.restore();
    const strength = miniature ? .55 : 1;
    paint.setColor(Skia.Color(group.color)); paint.setAlphaf(.55*strength);
    paint.setStrokeWidth(4); paint.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, miniature ? 2 : 3.5, false)); canvas.drawPath(path,paint);
    paint.setMaskFilter(null); paint.setAlphaf(.9*strength); paint.setStrokeWidth(clear ? 2.2 : 1.5); canvas.drawPath(path,paint);
    paint.setColor(Skia.Color('#F1FFFF')); paint.setAlphaf(.65*strength); paint.setStrokeWidth(.65); canvas.drawPath(path,paint);
    paint.setAlphaf(1);
  }
  surface.flush();
  const image = surface.makeImageSnapshot().makeNonTextureImage();
  surface.dispose();
  return image;
}
