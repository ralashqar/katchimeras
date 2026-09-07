import { useTileAppearance } from '@incubator/tile-match/theme';
import { memo, useLayoutEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Picture, Canvas, Skia, PaintStyle, TileMode, BlendMode, createPicture, type SkImage } from '@shopify/react-native-skia';
import { makeMutable, runOnJS, useAnimatedReaction, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { TILE_COLORS } from '../data/tile-theme';
import { CELL_FLIGHT_MS, CELL_IMPACT_MS, CELL_LAUNCH_MS } from '../game/volley-presentation';
import { SLOT_BLAST_SHAKE_MS, SLOT_BLAST_POP_MS, SLOT_BLAST_STEP_MS } from '@incubator/tile-match/timing';
import { effectCommands, effectCapacity, effectDeadlines, type CombatVolleyData, type CombatBurstData } from '../game/effect-commands';
export type { CombatVolleyData, CombatBurstData } from '../game/effect-commands';

const TILE = 64;
const ids = Object.keys(TILE_COLORS) as (keyof typeof TILE_COLORS)[];
let texture: SkImage | null = null;
/** Three pre-rendered sprites per colour. Blurs/shadows are never evaluated in flight. */
function atlasTexture() {
  if (texture) return texture;
  const surface = Skia.Surface.MakeOffscreen(TILE * 3, TILE * ids.length);
  if (!surface) throw new Error('Unable to allocate combat sprite atlas');
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('transparent'));
  const paint = Skia.Paint(); paint.setAntiAlias(true);
  ids.forEach((id, row) => {
    const c = TILE_COLORS[id], y = row * TILE;
    paint.setColor(Skia.Color(c.deep));
    canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(1, y + 1, 62, 62), 9, 9), paint);
    paint.setShader(Skia.Shader.MakeLinearGradient({x:0,y:y+2},{x:0,y:y+60},
      [Skia.Color(c.bright),Skia.Color(c.mid),Skia.Color(c.deep)],[0,.5,1],TileMode.Clamp));
    canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(2, y + 2, 60, 56), 8, 8), paint);
    paint.setShader(null);
    paint.setColor(Skia.Color(c.bright)); paint.setAlphaf(.7);
    canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(5, y + 4, 54, 5), 2, 2), paint);
    paint.setAlphaf(1); paint.setStyle(PaintStyle.Stroke); paint.setStrokeWidth(3);
    canvas.drawCircle(TILE + 32, y + 32, 27, paint);
    paint.setStyle(PaintStyle.Fill);
    canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(TILE * 2 + 2, y + 2, 60, 60), 12, 12), paint);
  });
  surface.flush();
  // The offscreen producer and onscreen canvas can use different GPU contexts.
  // Keep a raster-backed image that Skia uploads once to each consuming context.
  texture = surface.makeImageSnapshot().makeNonTextureImage();
  surface.dispose();
  return texture;
}

/** One persistent canvas for both fighters; reusable host buffers, no per-cell React/native views. */
export const CombatVolleys = memo(function CombatVolleys({ volleys, bursts, clock, endedAt, reduced, onDone }: {
  volleys: readonly CombatVolleyData[]; bursts: readonly CombatBurstData[]; clock: SharedValue<number>; endedAt?: number; reduced: boolean;
  onDone: (id: number) => void;
}) {
  const appearance = useTileAppearance();
  const fallback = useMemo(() => appearance ? null : atlasTexture(), [appearance]);
  const image = appearance?.atlas ?? fallback!;
  const tileSize = appearance?.spriteSize ?? TILE;
  const emptyPicture = useMemo(() => createPicture(() => {}), []);
  const picture = useSharedValue(emptyPicture);
  // Atlas tint multiplication and canvas compositing need different blend modes.
  // An explicit source-over paint prevents the atlas tint mode from also clearing
  // the transparent destination on Skia 2.3 (native and CanvasKit).
  const paint = useMemo(() => Skia.Paint(), []);
  const commands = useMemo(() => effectCommands(volleys, bursts, endedAt), [volleys, bursts, endedAt]);
  const capacity = effectCapacity(commands.length);
  const buffers = useMemo(() => ({
    transforms: makeMutable(Array.from({length: capacity}, () => Skia.RSXform(0, 0, 0, 0))),
    sprites: makeMutable(Array.from({length: capacity}, () => Skia.XYWHRect(0, 0, tileSize, tileSize))),
    colors: makeMutable(Array.from({length: capacity}, () => Skia.Color('white'))),
  }), [capacity, tileSize]);
  const data = useSharedValue(commands);
  const deadlines = useSharedValue<{id: number; at: number}[]>([]);
  const drawn = useSharedValue(0);
  useLayoutEffect(() => {
    data.value = commands;
    deadlines.value = effectDeadlines(volleys, bursts, endedAt);
  }, [commands, data, deadlines, volleys, bursts, endedAt]);
  useAnimatedReaction(() => {
    // Once retired, this mapper does not subscribe to the combat clock.
    if (!data.value.length && !deadlines.value.length) return -1;
    return {now: clock.value, commands: data.value};
  }, frame => {
    const now = frame === -1 ? -1 : frame.now;
    let n = 0, decoration = 0;
    const transforms = buffers.transforms.value, sprites = buffers.sprites.value, colors = buffers.colors.value;
    const draw = (x: number, y: number, size: number, sprite: number, colour: number, alpha: number, rotation = 0) => {
      const scale = size / tileSize, c = Math.cos(rotation) * scale, s = Math.sin(rotation) * scale;
      transforms[n].set(c, s, x - tileSize/2*c + tileSize/2*s, y - tileSize/2*s - tileSize/2*c);
      sprites[n].setXYWH(sprite * tileSize, colour * tileSize, tileSize, tileSize);
      colors[n][3] = alpha;
      n++;
    };
    if (now >= 0) for (const b of data.value) {
      const age = now - b.start;
      if (b.kind === 'miss') {
        if (age >= 340) continue;
        const t = Math.max(0, age / 340), fall = t*t;
        draw(b.x, b.y + (reduced ? 0 : fall*b.size*2.4), b.size*(1-fall*.38), 0, b.colour, 1-t,
          reduced ? 0 : (b.ordinal%2 ? -1 : 1)*fall*.45);
        continue;
      }
      if (b.kind === 'blast') {
        const detonation = SLOT_BLAST_SHAKE_MS + b.ordinal*SLOT_BLAST_STEP_MS;
        if (age < detonation) {
          const shake = reduced ? 0 : Math.sin(age*.12)*3;
          draw(b.x+shake, b.y, b.size, 0, b.colour, 1);
          draw(b.x, b.y, b.size*1.1, 1, 0, .8);
        } else if (age < detonation + SLOT_BLAST_POP_MS) {
          const t = (age-detonation)/SLOT_BLAST_POP_MS;
          draw(b.x, b.y, b.size*(1+t*.6), 1, 0, 1-t);
          for (let j=0; j<b.shards && decoration<b.cap; j++, decoration++) {
            const d = b.directions[j];
            draw(b.x+d.x*t*b.size, b.y+d.y*t*b.size,
              8*(1-t*.7), 2, b.colour, 1-t, d.angle);
          }
        }
        continue;
      }
      if (age < CELL_FLIGHT_MS) {
        const t = 1-Math.pow(1-Math.max(0,age/CELL_FLIGHT_MS),1.5);
        const shake = !reduced && b.shakeMs > 0 && now < b.shakeStart + b.shakeMs ? Math.sin((now-b.shakeStart)*.12)*3 : 0;
        draw(b.x + shake + (reduced ? 0 : 2*(1-t)*t*b.outward+t*t*b.dx), b.y + (reduced ? 0 : b.dy*t),
          b.size*(reduced ? 1 : 1-t*.55), 0, b.colour, 1);
        if (age >= 0 && age < CELL_LAUNCH_MS) {
          const t = age / CELL_LAUNCH_MS;
          draw(b.x, b.y, b.size * (reduced ? 1 : .75 + t * .95), 1, b.colour, (1-t)*.8);
        }
      } else if (age < CELL_FLIGHT_MS + CELL_IMPACT_MS) {
        const t = (age - CELL_FLIGHT_MS) / CELL_IMPACT_MS;
        // The small collision pulse is essential feedback, including when the shard budget is full.
        draw(b.target.x, b.target.y, 12 + t*20, 1, b.colour, (1-t)*.6);
        for (let j = 0; j < b.shards && decoration < b.cap; j++, decoration++) {
          const d = b.directions[j], distance = reduced ? 7 : 8 + t*36;
          draw(b.target.x + d.x*distance, b.target.y + d.y*distance + (reduced ? 0 : t*t*12),
            8*(1-t*.8), 2, b.colour, (1-t)*(reduced ? .55 : 1), reduced ? 0 : d.angle*.5+t*1.745);
        }
      }
    }
    for (let i = n; i < Math.min(drawn.value, capacity); i++) transforms[i].set(0, 0, 0, 0);
    if (n || drawn.value) {
      // Draw the mutated host buffers directly. The native declarative Atlas
      // recorder copies its arrays; mutating shared arrays in place can leave
      // that recorder drawing the original zero-scale transforms. A Picture
      // publishes the complete frame atomically on native and CanvasKit.
      picture.value = n ? createPicture(canvas => {
        canvas.drawAtlas(image, sprites, transforms, paint, BlendMode.Modulate, colors);
      }) : emptyPicture;
    }
    drawn.value = n;
    const pending = deadlines.value;
    if (pending.some(d => now >= d.at)) {
      deadlines.value = pending.filter(d => {
        if (now < d.at) return true;
        runOnJS(onDone)(d.id); return false;
      });
    }
  });
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, {zIndex: 300}]}>
    <Canvas style={StyleSheet.absoluteFill}>
      <Picture picture={picture} />
    </Canvas>
  </View>;
});
