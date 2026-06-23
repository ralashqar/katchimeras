import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { ARCHETYPE_THEME } from '@/constants/world';
import { Lantern } from '@/constants/theme';
import type { MemoryNode, WorldPatch } from '@/types/world';
import { layoutWorld, type SceneSprite } from '@/utils/world-scene';
import type { IsoPoint } from '@/utils/world-iso';
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

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);

  // Centre the newest patch (drawn last / front-most) in the viewport once we
  // know both sizes.
  useEffect(() => {
    if (centred.current || !viewport.width || !scene.slabs.length) return;
    const focus = scene.slabs[scene.slabs.length - 1].centre;
    tx.value = viewport.width / 2 - focus.x;
    ty.value = viewport.height / 2 - focus.y;
    startX.value = tx.value;
    startY.value = ty.value;
    centred.current = true;
  }, [viewport, scene, tx, ty, startX, startY]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      tx.value = startX.value + e.translationX;
      ty.value = startY.value + e.translationY;
    })
    .onEnd(() => {
      startX.value = tx.value;
      startY.value = ty.value;
    });
  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(0.55, Math.min(2.4, startScale.value * e.scale));
    })
    .onEnd(() => {
      startScale.value = scale.value;
    });
  const gesture = Gesture.Simultaneous(pan, pinch);

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

          {/* Object / memory / creature sprites. */}
          {scene.sprites.map((s) => (
            <SpriteView
              key={s.id}
              sprite={s}
              onPress={() => {
                if (s.kind === 'memory' && s.memory) onSelectMemory(s.memory, s.patchId);
                else onSelectPatch(s.patchId);
              }}
            />
          ))}

          {/* Patch name chips — the patch-inspection entry point. */}
          {scene.slabs.map((slab) => (
            <Pressable
              key={`${slab.patchId}-name`}
              onPress={() => onSelectPatch(slab.patchId)}
              style={[styles.nameChip, { left: slab.centre.x - 54, top: slab.topCorners[0].y - 26 }]}>
              <Text style={styles.nameChipText} numberOfLines={1}>
                {patchName(patches, slab.patchId)}
              </Text>
            </Pressable>
          ))}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function SpriteView({ sprite, onPress }: { sprite: SceneSprite; onPress: () => void }) {
  const source = worldAssetSource(sprite.assetKey);
  const theme = ARCHETYPE_THEME[sprite.archetype];
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={[
        styles.sprite,
        { left: sprite.x - sprite.size / 2, top: sprite.y - sprite.size / 2, width: sprite.size, height: sprite.size },
      ]}>
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
});
