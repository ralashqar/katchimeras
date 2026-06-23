import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
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
import type { MemoryNode, WorldPatch } from '@/types/world';
import { layoutWorld, type SceneFence, type SceneSprite } from '@/utils/world-scene';
import { TILE_H, type IsoPoint } from '@/utils/world-iso';
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

export function WorldCanvas({ patches, onSelectPatch, onSelectMemory }: Props) {
  const scene = useMemo(() => layoutWorld(patches), [patches]);
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
    if (centred.current || !viewport.width || !scene.slabs.length) return;
    const focus = scene.slabs[scene.slabs.length - 1].centre;
    tx.value = viewport.width / 2 - focus.x;
    ty.value = viewport.height / 2 - focus.y;
    centred.current = true;
  }, [viewport, scene, tx, ty]);

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

  // Recenter on the newest patch — the escape hatch if the user ever pans away.
  const recenter = () => {
    if (!scene.slabs.length || !viewport.width) return;
    cancelAnimation(tx);
    cancelAnimation(ty);
    const focus = scene.slabs[scene.slabs.length - 1].centre;
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

          {/* Objects + perimeter-fence segments, depth-sorted together. */}
          {renderables.map((item) =>
            item.sprite ? (
              <SpriteView
                key={item.sprite.id}
                sprite={item.sprite}
                onPress={() => {
                  if (dragged.value) return; // released after a drag — not a tap
                  const s = item.sprite!;
                  if (s.kind === 'memory' && s.memory) onSelectMemory(s.memory, s.patchId);
                  else onSelectPatch(s.patchId);
                }}
              />
            ) : (
              <FenceView key={item.fence!.id} fence={item.fence!} />
            )
          )}

          {/* Patch name chips — the patch-inspection entry point. */}
          {scene.slabs.map((slab) => (
            <Pressable
              key={`${slab.patchId}-name`}
              onPress={() => {
                if (dragged.value) return;
                onSelectPatch(slab.patchId);
              }}
              style={[styles.nameChip, { left: slab.centre.x - 54, top: slab.topCorners[0].y - 26 }]}>
              <Text style={styles.nameChipText} numberOfLines={1}>
                {patchName(patches, slab.patchId)}
              </Text>
            </Pressable>
          ))}
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

function SpriteView({ sprite, onPress }: { sprite: SceneSprite; onPress: () => void }) {
  const source = worldAssetSource(sprite.assetKey);
  const theme = ARCHETYPE_THEME[sprite.archetype];
  const isCreature = sprite.kind === 'creature';
  const w = sprite.size;
  const h = isCreature ? w : w * 2;
  const left = sprite.x - w / 2;
  const top = isCreature ? sprite.y - h / 2 : sprite.y + OBJECT_SEAT - h * OBJECT_BOTTOM_FRAC;
  return (
    <Pressable onPress={onPress} hitSlop={6} style={[styles.sprite, { left, top, width: w, height: h }]}>
      {source ? (
        <Image source={source} style={styles.spriteImage} contentFit="contain" />
      ) : (
        <View style={[styles.placeholder, { borderColor: theme.accent }]}>
          <Text style={styles.placeholderText}>{sprite.label.slice(0, 1)}</Text>
        </View>
      )}
    </Pressable>
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

function patchName(patches: WorldPatch[], patchId: string): string {
  return patches.find((p) => p.id === patchId)?.name ?? '';
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
  nameChip: {
    position: 'absolute',
    width: 108,
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(20,17,31,0.82)',
  },
  nameChipText: { color: Lantern.moon50, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
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
