import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { MotiView } from 'moti';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withTiming,
} from 'react-native-reanimated';

import { ARCHETYPE_THEME } from '@/constants/world';
import { Lantern } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { LanternEgg } from '@/components/katchadeck/home/lantern-egg';
import { HatchCountdown } from '@/components/katchadeck/home/hatch-countdown';
import type { EggVisualState } from '@/types/home';
import type { MemoryNode, WorldPatch } from '@/types/world';
import { layoutWorld, type SceneFence, type SceneSprite } from '@/utils/world-scene';
import { cellCenter, TILE_H, type IsoPoint } from '@/utils/world-iso';
import {
  DECAL_ATLAS,
  DECAL_ATLAS_COLS,
  DECAL_ATLAS_ROWS,
  worldAssetSource,
  worldDecalCell,
} from '@/utils/world-visuals';

type Props = {
  patches: WorldPatch[];
  onSelectPatch: (patchId: string) => void;
  onSelectMemory: (memory: MemoryNode, patchId: string) => void;
  // Tapping a cell object on today's patch opens that cell's detail view.
  onSelectCell?: (cellType: NonNullable<SceneSprite['category']>) => void;
  // Draw a glowing ring under this cell's object (the last one tapped).
  highlightedCell?: SceneSprite['category'] | null;
  // Today's live patch: the egg is composited over its centre cell and the view
  // auto-centres on it. Absent once the day has hatched.
  eggPatchId?: string | null;
  eggVisual?: EggVisualState | null;
  eggReady?: boolean;
  eggFeedKey?: number;
  onPressEgg?: () => void;
};

// The egg sits on the patch's CENTRE tile (cells live at the four corners). The
// slab centre returned by layoutWorld already corresponds to cell (1,1), so the
// egg lands exactly at the patch centre.
const EGG_CELL = { col: 1, row: 1 };
const SLAB_CENTRE_CELL = { col: 1, row: 1 };
const EGG_STAGE_WIDTH = 200;
const EGG_STAGE_HEIGHT = 258;
// The LanternEgg art is fixed-pixel, so shrink the whole stage with a transform
// (scales about its centre) to sit small and centred on a single tile. Tunable.
const EGG_SCALE = 0.5;
const EGG_RISE = 24;
// How far below the egg's tile the countdown pill sits (scene units) — tucked up
// close under the small egg.
const COUNTDOWN_DROP = 6;

// Feathered radial glow (the same soft texture the egg uses) — tinted + faded
// under the last-tapped object as a soft circular highlight.
const HIGHLIGHT_GLOW = require('../../../assets/images/katchimeras/soft-glow.png');

// What an empty cell hints it could hold (Diorama Time Capsule ghost spots).
const GHOST_HINT: Record<string, { emoji: string; label: string }> = {
  memory: { emoji: '📷', label: 'memory' },
  places: { emoji: '🧭', label: 'places' },
  journey: { emoji: '🚶', label: 'journey' },
  reflection: { emoji: '🌿', label: 'reflection' },
};

function polyPath(points: IsoPoint[]) {
  const path = Skia.Path.Make();
  if (!points.length) return path;
  path.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) path.lineTo(points[i].x, points[i].y);
  path.close();
  return path;
}

function segPath(a: IsoPoint, b: IsoPoint) {
  const path = Skia.Path.Make();
  path.moveTo(a.x, a.y);
  path.lineTo(b.x, b.y);
  return path;
}

export function WorldCanvas({
  patches,
  onSelectPatch,
  onSelectMemory,
  onSelectCell,
  eggPatchId,
  eggVisual,
  eggReady = false,
  eggFeedKey = 0,
  highlightedCell,
  onPressEgg,
}: Props) {
  const scene = useMemo(() => layoutWorld(patches), [patches]);

  // The slab the camera focuses on: today's egg patch when present, else the
  // newest patch. Its centre also anchors the composited egg.
  const focusSlab = useMemo(() => {
    if (eggPatchId) {
      const found = scene.slabs.find((s) => s.patchId === eggPatchId);
      if (found) return found;
    }
    return scene.slabs[scene.slabs.length - 1] ?? null;
  }, [scene, eggPatchId]);

  // Egg sits on the patch's reserved centre cell (1,2); recover its scene point
  // from the slab centre (cell 1,1) so it pans/zooms glued to the tile.
  const eggPoint = useMemo(() => {
    if (!focusSlab || !eggPatchId) return null;
    const slab = scene.slabs.find((s) => s.patchId === eggPatchId);
    if (!slab) return null;
    return {
      x: slab.centre.x + (cellCenter(EGG_CELL.col, EGG_CELL.row).x - cellCenter(SLAB_CENTRE_CELL.col, SLAB_CENTRE_CELL.row).x),
      y: slab.centre.y + (cellCenter(EGG_CELL.col, EGG_CELL.row).y - cellCenter(SLAB_CENTRE_CELL.col, SLAB_CENTRE_CELL.row).y),
    };
  }, [scene, focusSlab, eggPatchId]);

  // The object to draw a highlight ring under — the last cell the user tapped.
  const highlightSprite = useMemo(() => {
    if (!highlightedCell || !eggPatchId) return null;
    return scene.sprites.find((s) => s.category === highlightedCell && s.patchId === eggPatchId) ?? null;
  }, [scene, highlightedCell, eggPatchId]);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const centred = useRef(false);
  const tabBarHeight = useBottomTabBarHeight();

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  // True once a touch moves past the tap threshold, so a drag/pinch release is
  // not mistaken for a tap (which would open the inspector). Reset on each touch.
  const dragged = useSharedValue(false);

  // Pan bounds: the world (scene W×H, scaled about its centre) may be panned so
  // any part of it can reach the viewport centre, but never so far that it leaves
  // the centre entirely — so you can roam the whole map yet never lose it. Plain
  // numbers (not the scene object) so the worklets capture cheaply.
  const sceneW = scene.width;
  const sceneH = scene.height;
  const vw = viewport.width;
  const vh = viewport.height;

  // Centre the newest patch (drawn last / front-most) in the viewport once we
  // know both sizes.
  useEffect(() => {
    if (centred.current || !viewport.width || !focusSlab) return;
    const focus = focusSlab.centre;
    tx.value = viewport.width / 2 - focus.x;
    ty.value = viewport.height / 2 - focus.y;
    centred.current = true;
  }, [viewport, focusSlab, tx, ty]);

  // Re-centre on today's egg every time the World tab regains focus (exit + come
  // back). Reads the latest viewport/focus through a ref so the focus effect's
  // deps stay stable — it must NOT re-fire when the patch grows mid-session.
  const focusRef = useRef({ viewport, focusSlab });
  focusRef.current = { viewport, focusSlab };
  const recentreOnFocus = useCallback(() => {
    const { viewport: vp, focusSlab: fs } = focusRef.current;
    if (!vp.width || !fs) return; // first mount: layout not measured yet — the effect above handles it
    cancelAnimation(tx);
    cancelAnimation(ty);
    scale.value = 1;
    startScale.value = 1;
    tx.value = vp.width / 2 - fs.centre.x;
    ty.value = vp.height / 2 - fs.centre.y;
    centred.current = true;
  }, [tx, ty, scale, startScale]);
  useFocusEffect(recentreOnFocus);

  const pan = Gesture.Pan()
    .onBegin(() => {
      cancelAnimation(tx); // stop any momentum glide so a new grab takes over
      cancelAnimation(ty);
      dragged.value = false;
    })
    .onChange((e) => {
      const s = scale.value;
      const hw = (sceneW * s) / 2;
      const hh = (sceneH * s) / 2;
      tx.value = Math.min(Math.max(tx.value + e.changeX, vw / 2 - sceneW / 2 - hw), vw / 2 - sceneW / 2 + hw);
      ty.value = Math.min(Math.max(ty.value + e.changeY, vh / 2 - sceneH / 2 - hh), vh / 2 - sceneH / 2 + hh);
      if (Math.abs(e.translationX) + Math.abs(e.translationY) > 8) {
        dragged.value = true;
      }
    })
    .onEnd((e) => {
      // Momentum: let the map glide and decelerate, clamped to the same bounds.
      const s = scale.value;
      const hw = (sceneW * s) / 2;
      const hh = (sceneH * s) / 2;
      tx.value = withDecay({
        velocity: e.velocityX,
        deceleration: 0.996,
        clamp: [vw / 2 - sceneW / 2 - hw, vw / 2 - sceneW / 2 + hw],
      });
      ty.value = withDecay({
        velocity: e.velocityY,
        deceleration: 0.996,
        clamp: [vh / 2 - sceneH / 2 - hh, vh / 2 - sceneH / 2 + hh],
      });
    });
  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(0.55, Math.min(2.4, startScale.value * e.scale));
      dragged.value = true;
    })
    .onEnd(() => {
      startScale.value = scale.value;
      // Re-clamp translation into the bounds the new zoom level implies.
      const s = scale.value;
      const hw = (sceneW * s) / 2;
      const hh = (sceneH * s) / 2;
      tx.value = withTiming(Math.min(Math.max(tx.value, vw / 2 - sceneW / 2 - hw), vw / 2 - sceneW / 2 + hw), { duration: 160 });
      ty.value = withTiming(Math.min(Math.max(ty.value, vh / 2 - sceneH / 2 - hh), vh / 2 - sceneH / 2 + hh), { duration: 160 });
    });
  const gesture = Gesture.Simultaneous(pan, pinch);

  // Bounce in objects that appear AFTER the first paint (a grown seed/memory),
  // but never the whole map on open. `seen` is updated post-commit in an effect;
  // anything missing from it on a later render is freshly grown → animate.
  const seenSpriteIds = useRef<Set<string>>(new Set());
  const spritesInitialised = useRef(false);
  const animateInIds = useMemo(() => {
    if (!spritesInitialised.current) return new Set<string>();
    const fresh = new Set<string>();
    for (const sprite of scene.sprites) if (!seenSpriteIds.current.has(sprite.id)) fresh.add(sprite.id);
    return fresh;
  }, [scene]);
  useEffect(() => {
    scene.sprites.forEach((sprite) => seenSpriteIds.current.add(sprite.id));
    spritesInitialised.current = true;
  }, [scene]);

  // Recenter on the newest patch — the escape hatch if the user ever pans away.
  const recenter = () => {
    if (!focusSlab || !viewport.width) return;
    cancelAnimation(tx);
    cancelAnimation(ty);
    const focus = focusSlab.centre;
    const s = scale.value;
    tx.value = withTiming(viewport.width / 2 - sceneW / 2 - (focus.x - sceneW / 2) * s, { duration: 320 });
    ty.value = withTiming(viewport.height / 2 - sceneH / 2 - (focus.y - sceneH / 2) * s, { duration: 320 });
  };

  const worldStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const groundPaths = useMemo(
    () =>
      scene.slabs.map((slab) => {
        const theme = ARCHETYPE_THEME[slab.archetype];
        const [top, right, , left] = slab.topCorners;
        return {
          id: slab.patchId,
          theme,
          left: polyPath(slab.leftFace),
          right: polyPath(slab.rightFace),
          face: polyPath(slab.topCorners),
          rimLeft: segPath(top, left),
          rimRight: segPath(top, right),
        };
      }),
    [scene]
  );

  // Objects + fence segments rendered in one depth-sorted pass so fences occlude
  // correctly relative to the objects in front of / behind them.
  const renderables = useMemo(() => {
    const items: { depth: number; sprite?: SceneSprite; fence?: SceneFence }[] = [
      ...scene.sprites.map((s) => ({ depth: s.depth, sprite: s })),
      ...scene.fences.map((f) => ({ depth: f.depth, fence: f })),
    ];
    return items.sort((a, b) => a.depth - b.depth);
  }, [scene]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setViewport({ width, height });
  };

  return (
    <View style={styles.root} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.world, { width: scene.width, height: scene.height }, worldStyle]}>
          <Canvas style={{ width: scene.width, height: scene.height }}>
            {groundPaths.map((g) => (
              <Path key={`${g.id}-l`} path={g.left} color={g.theme.groundSide} />
            ))}
            {groundPaths.map((g) => (
              <Path key={`${g.id}-r`} path={g.right} color={shade(g.theme.groundSide)} />
            ))}
            {groundPaths.map((g) => (
              <Path key={`${g.id}-f`} path={g.face} color={g.theme.groundTop} />
            ))}
            {groundPaths.map((g) => (
              <Path key={`${g.id}-rim`} path={g.rimLeft} color={g.theme.rim} style="stroke" strokeWidth={2} />
            ))}
            {groundPaths.map((g) => (
              <Path key={`${g.id}-rim2`} path={g.rimRight} color={g.theme.rim} style="stroke" strokeWidth={2} />
            ))}
          </Canvas>

          {/* Flat ground decals — between the slab and the props. Each is a
              clipped sub-region of one shared atlas texture (single GPU upload). */}
          {scene.decals.map((d) => {
            const cell = worldDecalCell(d.decal);
            if (!cell) return null;
            const w = d.size;
            const h = d.size / 2;
            return (
              <View
                key={d.id}
                pointerEvents="none"
                style={[styles.decal, { left: d.x - w / 2, top: d.y - h / 2, width: w, height: h }]}>
                <Image
                  source={DECAL_ATLAS}
                  pointerEvents="none"
                  contentFit="fill"
                  style={{
                    position: 'absolute',
                    width: w * DECAL_ATLAS_COLS,
                    height: h * DECAL_ATLAS_ROWS,
                    left: -cell.col * w,
                    top: -cell.row * h,
                  }}
                />
              </View>
            );
          })}

          {/* Empty slot ghosts — faint, gently breathing placeholders that hint
              what could grow there, drawn under the objects. */}
          {scene.ghosts.map((ghost) => {
            const hint = GHOST_HINT[ghost.slotType];
            if (!hint) return null;
            const size = ghost.size * 0.6;
            return (
              <MotiView
                key={ghost.id}
                pointerEvents="none"
                from={{ opacity: 0.32, scale: 0.9 }}
                animate={{ opacity: 0.6, scale: 1 }}
                transition={{ loop: true, type: 'timing', duration: 1500 }}
                style={[styles.ghost, { left: ghost.x - size / 2, top: ghost.y - size / 2, width: size, height: size }]}>
                <Text style={styles.ghostEmoji}>{hint.emoji}</Text>
              </MotiView>
            );
          })}

          {/* Soft circular glow under the last-tapped object — a feathered radial
              wash that fades off at the edges (no hard ring). */}
          {highlightSprite ? (
            <MotiView
              pointerEvents="none"
              from={{ opacity: 0.3, scale: 0.92 }}
              animate={{ opacity: 0.6, scale: 1.06 }}
              transition={{ loop: true, type: 'timing', duration: 1300 }}
              style={[
                styles.highlight,
                {
                  left: highlightSprite.x - highlightSprite.size * 0.6,
                  top: highlightSprite.y - highlightSprite.size * 0.6,
                  width: highlightSprite.size * 1.2,
                  height: highlightSprite.size * 1.2,
                },
              ]}>
              <Image source={HIGHLIGHT_GLOW} tintColor="#7DE8CD" contentFit="contain" style={StyleSheet.absoluteFill} />
            </MotiView>
          ) : null}

          {/* Objects + perimeter-fence segments, depth-sorted together. */}
          {renderables.map((item) =>
            item.sprite ? (
              <SpriteView
                key={item.sprite.id}
                sprite={item.sprite}
                animateIn={animateInIds.has(item.sprite.id)}
                onPress={() => {
                  if (dragged.value) return; // released after a drag — not a tap
                  const s = item.sprite!;
                  if (s.kind === 'memory' && s.memory) onSelectMemory(s.memory, s.patchId);
                  else if (s.category && s.patchId === eggPatchId && onSelectCell) onSelectCell(s.category);
                  else onSelectPatch(s.patchId);
                }}
              />
            ) : (
              <FenceView key={item.fence!.id} fence={item.fence!} />
            )
          )}

          {/* Today's egg, seated on its patch — pans/zooms with the world. The
              real LanternEgg (never a lookalike); tapping it opens the prompts. */}
          {eggPoint && eggVisual ? (
            <View
              style={[
                styles.eggLayer,
                {
                  left: eggPoint.x - EGG_STAGE_WIDTH / 2,
                  top: eggPoint.y - EGG_STAGE_HEIGHT / 2 - EGG_RISE,
                  width: EGG_STAGE_WIDTH,
                  height: EGG_STAGE_HEIGHT,
                  transform: [{ scale: EGG_SCALE }],
                },
              ]}>
              <LanternEgg egg={eggVisual} onPress={onPressEgg} feedKey={eggFeedKey} />
            </View>
          ) : null}

          {/* Hatch countdown, glued just below the egg's tile (pans/zooms with
              the world). */}
          {eggPoint && eggVisual ? (
            <View
              pointerEvents="none"
              style={[styles.countdownLayer, { left: eggPoint.x - 110, top: eggPoint.y + COUNTDOWN_DROP, width: 220 }]}>
              <HatchCountdown isReady={eggReady} compact />
            </View>
          ) : null}
        </Animated.View>
      </GestureDetector>

      {/* Recenter button — fixed on screen, anchored above the tab bar. */}
      <Pressable onPress={recenter} hitSlop={10} style={[styles.recenter, { bottom: tabBarHeight + 16 }]}>
        <IconSymbol name="scope" size={24} color={Lantern.moon50} />
      </Pressable>
    </View>
  );
}

// Tile-generated objects (world-tile-edit.py object-grid) are 1:2 frames whose
// object has been BOTTOM-SNAPPED: its true bottom pixel sits at OBJECT_BOTTOM_FRAC
// of the frame (matches OBJ_BOTTOM_FRAC in the py script). We plant that bottom on
// the tile, a touch forward of centre (OBJECT_SEAT, the adjustable padding), and
// the object rises up. Robust to any vertical offset the AI introduced. Creatures
// aren't tile-generated — square + centre-anchored.
const OBJECT_BOTTOM_FRAC = 0.96; // object's bottom pixel down the 1:2 frame (matches py)
const OBJECT_SEAT = TILE_H * 0.25; // how far below the tile centre the bottom sits (padding)

function SpriteView({
  sprite,
  animateIn,
  onPress,
}: {
  sprite: SceneSprite;
  animateIn: boolean;
  onPress: () => void;
}) {
  const source = worldAssetSource(sprite.assetKey);
  const theme = ARCHETYPE_THEME[sprite.archetype];
  const isCreature = sprite.kind === 'creature';
  const w = sprite.size;
  const h = isCreature ? w : w * 2;
  const left = sprite.x - w / 2;
  // Creatures are centre-anchored; lift them by 35% of a tile so they stand ON
  // the tile rather than sinking into it.
  const top = isCreature
    ? sprite.y - h / 2 - TILE_H * 0.35
    : sprite.y + OBJECT_SEAT - h * OBJECT_BOTTOM_FRAC;
  return (
    <MotiView
      // New objects spring up from their base with a little overshoot; existing
      // ones mount at rest (from = undefined → no entrance).
      from={animateIn ? { opacity: 0, scale: 0.2, translateY: 10 } : undefined}
      animate={{ opacity: 1, scale: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 8, stiffness: 175, mass: 0.85 }}
      style={[styles.sprite, styles.spriteOrigin, { left, top, width: w, height: h }]}>
      <Pressable onPress={onPress} hitSlop={6} style={StyleSheet.absoluteFill}>
        {source ? (
          <Image source={source} style={styles.spriteImage} contentFit="contain" />
        ) : (
          <View style={[styles.placeholder, { borderColor: theme.accent }]}>
            <Text style={styles.placeholderText}>{sprite.label.slice(0, 1)}</Text>
          </View>
        )}
      </Pressable>
    </MotiView>
  );
}

function FenceView({ fence }: { fence: SceneFence }) {
  const source = worldAssetSource('fence_strip');
  if (!source) return null;
  // Clip this segment's slice of the strip, then skew the whole slice onto the edge.
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: fence.x,
        top: fence.y,
        width: fence.w,
        height: fence.h,
        overflow: 'hidden',
        transform: [{ skewY: `${fence.angle}deg` }],
      }}>
      <Image
        source={source}
        pointerEvents="none"
        contentFit="fill"
        style={{
          position: 'absolute',
          width: fence.w * fence.sliceCount,
          height: fence.h,
          left: -fence.sliceIndex * fence.w,
        }}
      />
    </View>
  );
}

// Slightly darken a hex colour for the second (shadowed) slab face.
function shade(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.max(0, ((n >> 16) & 255) - 22);
  const g = Math.max(0, ((n >> 8) & 255) - 22);
  const b = Math.max(0, (n & 255) - 22);
  return `rgb(${r},${g},${b})`;
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  world: { position: 'relative' },
  decal: { position: 'absolute', opacity: 0.95, overflow: 'hidden' },
  sprite: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  // Grow/bounce from the planted base, not the centre.
  spriteOrigin: { transformOrigin: 'bottom' },
  highlight: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  ghost: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(214,236,182,0.4)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  ghostEmoji: { fontSize: 17, opacity: 0.85 },
  eggLayer: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  countdownLayer: { position: 'absolute', alignItems: 'center' },
  spriteImage: { width: '100%', height: '100%' },
  placeholder: {
    width: '78%',
    height: '78%',
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { color: Lantern.moon50, fontSize: 18, fontWeight: '700' },
  recenter: {
    position: 'absolute',
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,17,31,0.82)',
  },
});
