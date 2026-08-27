import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  Image as SkiaImage,
  ImageShader,
  Path,
  Skia,
  useImage,
} from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, runOnJS, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EggAvatarArtwork } from '@/components/katchadeck/egg-avatar/egg-avatar-artwork';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useScenePerformanceProbe } from '@/hooks/use-scene-performance-probe';
import { resolveCreatureArtSource } from '@/utils/creature-art';
import { safeGoBack } from '@/utils/safe-navigation';
import {
  boardCellAtWorldPoint,
  boardCellCenter,
  generateWorldBoardManifest,
  isoCellCenter,
  isoCellPolygon,
  projectBoardCell,
  regionAtWorldPoint,
  screenPointToWorldBoard,
  type IsoCell,
  type WorldIsoRegion,
  type WorldPoint,
} from '@/utils/world-board-lab';
import {
  GRASS_DETAIL_BERRIES,
  GRASS_DETAIL_FLOWER,
  GRASS_GROUND_TEXTURE,
  worldAssetSource,
} from '@/utils/world-visuals';

import { useWorldBoardLabCamera, WorldBoardAnimatedView } from './use-world-board-lab-camera';

const HOME_SOURCE = worldAssetSource('home');
const MOSSPROUT_SOURCE = resolveCreatureArtSource('mossprout', { lod: 'medium', stage: 'grown' });

type DebugSettings = { cellIds: boolean; details: boolean; regionLabels: boolean; seams: boolean };
const INITIAL_DEBUG: DebugSettings = { cellIds: false, details: true, regionLabels: true, seams: true };

function polygonPath(points: readonly WorldPoint[]) {
  const path = Skia.Path.Make();
  points.forEach((point, index) => {
    if (index === 0) path.moveTo(point.x, point.y);
    else path.lineTo(point.x, point.y);
  });
  path.close();
  return path;
}

function offsetPoint(point: WorldPoint, y: number): WorldPoint {
  return { x: point.x, y: point.y + y };
}

function keyOf(cell: IsoCell) {
  return `${cell.col}:${cell.row}`;
}

function regionCenter(region: WorldIsoRegion, sceneOrigin: WorldPoint) {
  const centers = region.cells.map((cell) => isoCellCenter(sceneOrigin, cell));
  return {
    x: centers.reduce((sum, point) => sum + point.x, 0) / centers.length,
    y: centers.reduce((sum, point) => sum + point.y, 0) / centers.length,
  };
}

function LabChip({ active = false, label, onPress }: { active?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}>
      <Text selectable style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function WorldBoardLabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [seedIndex, setSeedIndex] = useState(1);
  const [debug, setDebug] = useState(INITIAL_DEBUG);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [mode, setMode] = useState<'overview' | 'board-focus'>('overview');
  const seed = `mossprout-iso-${String(seedIndex).padStart(3, '0')}`;
  const manifest = useMemo(() => generateWorldBoardManifest(seed), [seed]);
  const grassTexture = useImage(GRASS_GROUND_TEXTURE as number);
  const flowerTexture = useImage(GRASS_DETAIL_FLOWER as number);
  const berryTexture = useImage(GRASS_DETAIL_BERRIES as number);
  const camera = useWorldBoardLabCamera({ boardCellWorldSize: manifest.tileWidth, scene: manifest.bounds, viewport });
  const transitionActive = useSharedValue(0);
  useEffect(() => {
    transitionActive.value = camera.moving ? 1 : 0;
  }, [camera.moving, transitionActive]);
  useScenePerformanceProbe('world-board-lab-camera', transitionActive);

  const geometry = useMemo(() => {
    const occupied = new Set(manifest.regions.flatMap((region) => region.cells.map(keyOf)));
    const tiles = manifest.regions
      .flatMap((region) => region.cells.map((cell) => ({ cell, region })))
      .sort((left, right) => {
        const leftCenter = isoCellCenter(manifest.sceneOrigin, left.cell);
        const rightCenter = isoCellCenter(manifest.sceneOrigin, right.cell);
        return leftCenter.y - rightCenter.y || leftCenter.x - rightCenter.x;
      })
      .map(({ cell, region }) => {
        const corners = isoCellPolygon(manifest.sceneOrigin, cell);
        const [topLeft, , bottomRight, bottomLeft] = corners;
        return {
          cell,
          region,
          top: polygonPath(corners),
          frontFace: !occupied.has(`${cell.col}:${cell.row + 1}`)
            ? polygonPath([bottomLeft, bottomRight, offsetPoint(bottomRight, manifest.slabThickness), offsetPoint(bottomLeft, manifest.slabThickness)])
            : null,
          leftFace: !occupied.has(`${cell.col - 1}:${cell.row}`)
            ? polygonPath([topLeft, bottomLeft, offsetPoint(bottomLeft, manifest.slabThickness), offsetPoint(topLeft, manifest.slabThickness)])
            : null,
        };
      });
    const seams = Skia.Path.Make();
    tiles.forEach(({ cell }) => {
      const [, topRight, bottomRight, bottomLeft] = isoCellPolygon(manifest.sceneOrigin, cell);
      if (occupied.has(`${cell.col + 1}:${cell.row}`)) {
        seams.moveTo(topRight.x, topRight.y);
        seams.lineTo(bottomRight.x, bottomRight.y);
      }
      if (occupied.has(`${cell.col}:${cell.row + 1}`)) {
        seams.moveTo(bottomRight.x, bottomRight.y);
        seams.lineTo(bottomLeft.x, bottomLeft.y);
      }
    });
    return { seams, tiles };
  }, [manifest]);

  const boardRegion = manifest.regions.find((region) => region.role === 'board')!;
  const boardCenter = useMemo(() => regionCenter(boardRegion, manifest.sceneOrigin), [boardRegion, manifest.sceneOrigin]);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setViewport((current) => current.width === width && current.height === height ? current : { width, height });
  }, []);
  const focusBoard = useCallback(() => {
    setMode('board-focus');
    camera.focus(boardCenter, camera.boardScale);
  }, [boardCenter, camera]);
  const showOverview = useCallback(() => {
    setMode('overview');
    setSelectedCell(null);
    camera.overview();
  }, [camera]);
  const focusRegion = useCallback((region: WorldIsoRegion) => {
    if (region.role === 'board') return focusBoard();
    setMode('overview');
    camera.focus(regionCenter(region, manifest.sceneOrigin), Math.max(camera.overviewScale * 1.75, camera.boardScale * 0.72));
  }, [camera, focusBoard, manifest.sceneOrigin]);
  const handleStageTap = useCallback((screenX: number, screenY: number) => {
    if (camera.moving || !viewport.width || !viewport.height) return;
    const world = screenPointToWorldBoard({ x: screenX, y: screenY }, manifest.bounds, camera.snapshot);
    const cell = boardCellAtWorldPoint(manifest.board, world);
    if (cell != null && mode === 'board-focus') {
      setSelectedCell(cell);
      if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
      return;
    }
    const region = regionAtWorldPoint(manifest, world);
    if (region && region.role !== 'connector') focusRegion(region);
  }, [camera.moving, camera.snapshot, focusRegion, manifest, mode, viewport.height, viewport.width]);
  const tapGesture = useMemo(() => Gesture.Tap().maxDistance(10).onEnd((event, success) => {
    if (success) runOnJS(handleStageTap)(event.x, event.y);
  }), [handleStageTap]);
  const stageGesture = useMemo(() => Gesture.Simultaneous(camera.gesture, tapGesture), [camera.gesture, tapGesture]);
  const selectedCellPath = useMemo(() => selectedCell == null ? null : polygonPath(projectBoardCell(manifest.board, selectedCell)), [manifest.board, selectedCell]);
  const selectedCenter = selectedCell == null ? null : boardCellCenter(manifest.board, selectedCell);
  const toggleDebug = useCallback((key: keyof DebugSettings) => setDebug((current) => ({ ...current, [key]: !current[key] })), []);

  return (
    <View onLayout={onLayout} style={styles.screen}>
      <LinearGradient colors={['#4BACE0', '#81CCDA', '#E8F4DB']} end={{ x: 0.5, y: 1 }} start={{ x: 0.5, y: 0 }} style={StyleSheet.absoluteFill} />
      <GestureDetector gesture={stageGesture}>
        <View style={styles.viewport}>
          {viewport.width > 0 ? (
            <WorldBoardAnimatedView style={[styles.world, { height: manifest.bounds.height, width: manifest.bounds.width }, camera.worldStyle]}>
              <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
                {geometry.tiles.map(({ cell, frontFace, leftFace, region, top }) => {
                  const locked = region.role === 'locked';
                  const connector = region.role === 'connector';
                  return (
                    <Group key={`${region.id}:${keyOf(cell)}`}>
                      {leftFace ? <Path color={locked ? '#76919A' : '#7A6139'} path={leftFace} /> : null}
                      {frontFace ? <Path color={locked ? '#8AA7AD' : '#947646'} path={frontFace} /> : null}
                      <Path color={locked ? '#B9D4D5' : connector ? '#86AC49' : '#82B746'} path={top}>
                        {!locked && grassTexture ? <ImageShader fit="none" image={grassTexture} transform={[{ scale: 0.72 }]} tx="repeat" ty="repeat" /> : null}
                      </Path>
                    </Group>
                  );
                })}
                {debug.seams ? <Path color="rgba(57,78,36,0.28)" path={geometry.seams} strokeWidth={1.2} style="stroke" /> : null}
                {debug.details ? manifest.decorations.map((detail) => {
                  const image = detail.kind === 'flower' ? flowerTexture : berryTexture;
                  return image ? <SkiaImage fit="contain" height={detail.size} image={image} key={detail.id} width={detail.size} x={detail.position.x - detail.size / 2} y={detail.position.y - detail.size * 0.7} /> : null;
                }) : null}
                {selectedCellPath ? <Path color="#FFE56E" path={selectedCellPath} style="stroke" strokeWidth={9}><BlurMask blur={4} style="solid" /></Path> : null}
                {manifest.regions.filter((region) => region.role === 'locked').map((region) => {
                  const center = regionCenter(region, manifest.sceneOrigin);
                  return (
                    <Group key={`mist:${region.id}`} opacity={0.82}>
                      {Array.from({ length: 8 }, (_, index) => {
                        const angle = Math.PI * 2 * index / 8;
                        return <Circle color={index % 2 ? '#EDF8FF' : '#DCEEFF'} cx={center.x + Math.cos(angle) * 82} cy={center.y + Math.sin(angle) * 36} key={index} r={42 + index % 3 * 6} />;
                      })}
                    </Group>
                  );
                })}
              </Canvas>

              {manifest.subjects.map((subject) => {
                const frame = {
                  height: subject.size,
                  left: subject.position.x - subject.size / 2,
                  position: 'absolute' as const,
                  top: subject.position.y - subject.size * 0.72,
                  width: subject.size,
                  zIndex: Math.round(subject.position.y + subject.depthBias),
                };
                if (subject.id === 'egg') return <EggAvatarArtwork faceId="curious" hatId={null} heldAccessoryId={null} key={subject.id} resolution="thumbnail" skinId="classic" style={frame} />;
                return <ExpoImage accessibilityIgnoresInvertColors contentFit="contain" key={subject.id} source={subject.id === 'home' ? HOME_SOURCE : MOSSPROUT_SOURCE} style={[styles.subject, frame]} transition={0} />;
              })}
              {debug.regionLabels ? manifest.regions.filter((region) => region.role !== 'connector').map((region) => {
                const center = regionCenter(region, manifest.sceneOrigin);
                return <View key={`label:${region.id}`} pointerEvents="none" style={[styles.regionLabel, { left: center.x - 76, top: center.y - 92 }]}><Text selectable style={styles.regionLabelText}>{region.label}</Text></View>;
              }) : null}
              {debug.cellIds ? Array.from({ length: manifest.board.columns * manifest.board.rows }, (_, cell) => {
                const center = boardCellCenter(manifest.board, cell)!;
                return <Text key={`cell-id:${cell}`} pointerEvents="none" style={[styles.cellId, { left: center.x - 18, top: center.y - 12 }]}>{cell}</Text>;
              }) : null}
              {manifest.regions.filter((region) => region.role === 'locked').map((region) => {
                const center = regionCenter(region, manifest.sceneOrigin);
                return <View key={`lock:${region.id}`} pointerEvents="none" style={[styles.lock, { left: center.x - 23, top: center.y - 34 }]}><IconSymbol color="#725235" name="lock.fill" size={26} /></View>;
              })}
            </WorldBoardAnimatedView>
          ) : null}
        </View>
      </GestureDetector>

      <View pointerEvents="box-none" style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Pressable accessibilityLabel="Close World and Board Lab" accessibilityRole="button" hitSlop={10} onPress={() => safeGoBack(router)} style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}><IconSymbol color="#F7FBFF" name="chevron.left" size={22} /></Pressable>
        <View pointerEvents="none" style={styles.titleBlock}>
          <Text selectable style={styles.eyebrow}>OBLIQUE SKIA ISO LAB</Text>
          <Text selectable style={styles.title}>{seed}</Text>
          <Text selectable style={styles.meta}>{mode === 'board-focus' ? `Board focus${selectedCell == null ? '' : ` · cell ${selectedCell}`}` : 'World overview'} · top-down oblique / 46px slab</Text>
        </View>
        <Pressable accessibilityLabel="Regenerate ground details" accessibilityRole="button" hitSlop={10} onPress={() => { setSelectedCell(null); setSeedIndex((value) => value + 1); }} style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}><IconSymbol color="#F7FBFF" name="arrow.clockwise" size={20} /></Pressable>
      </View>

      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={[styles.controls, { bottom: insets.bottom + 12 }]}>
        <View style={styles.controlRow}>
          <LabChip active={mode === 'overview'} label="Overview" onPress={showOverview} />
          <LabChip active={mode === 'board-focus'} label="Board" onPress={focusBoard} />
          <LabChip active={debug.seams} label="Tile seams" onPress={() => toggleDebug('seams')} />
        </View>
        <View style={styles.controlRow}>
          <LabChip active={debug.details} label="Grass details" onPress={() => toggleDebug('details')} />
          <LabChip active={debug.regionLabels} label="Labels" onPress={() => toggleDebug('regionLabels')} />
          <LabChip active={debug.cellIds} label="Cell IDs" onPress={() => toggleDebug('cellIds')} />
        </View>
      </Animated.View>
      {selectedCenter ? <View pointerEvents="none" style={styles.selectionAnnouncement}><Text selectable style={styles.selectionText}>Logical cell {selectedCell} · iso centre {Math.round(selectedCenter.x)}, {Math.round(selectedCenter.y)}</Text></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#4EADE2', flex: 1, overflow: 'hidden' },
  viewport: { flex: 1, overflow: 'hidden' },
  world: { left: 0, position: 'absolute', top: 0 },
  subject: { position: 'absolute' },
  topBar: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between', left: 12, position: 'absolute', right: 12, top: 0 },
  roundButton: { alignItems: 'center', backgroundColor: 'rgba(18,43,52,0.78)', borderColor: 'rgba(255,255,255,0.22)', borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, height: 46, justifyContent: 'center', width: 46 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.97 }] },
  titleBlock: { alignItems: 'center', backgroundColor: 'rgba(18,43,52,0.72)', borderCurve: 'continuous', borderRadius: 17, flex: 1, maxWidth: 290, paddingHorizontal: 12, paddingVertical: 7 },
  eyebrow: { color: '#F7D66F', fontSize: 9, fontWeight: '900', letterSpacing: 1.15 },
  title: { color: '#F7FBFF', fontSize: 14, fontVariant: ['tabular-nums'], fontWeight: '900' },
  meta: { color: 'rgba(247,251,255,0.74)', fontSize: 9, fontWeight: '700' },
  controls: { alignSelf: 'center', backgroundColor: 'rgba(17,38,44,0.84)', borderColor: 'rgba(255,255,255,0.16)', borderCurve: 'continuous', borderRadius: 20, borderWidth: 1, gap: 7, left: 10, padding: 9, position: 'absolute', right: 10 },
  controlRow: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  chip: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.09)', borderColor: 'rgba(255,255,255,0.12)', borderRadius: 999, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 34, paddingHorizontal: 7 },
  chipActive: { backgroundColor: 'rgba(248,216,106,0.22)', borderColor: 'rgba(248,216,106,0.78)' },
  chipText: { color: '#DCE9EB', fontSize: 10, fontWeight: '800', textAlign: 'center' },
  chipTextActive: { color: '#FFF1A7' },
  regionLabel: { alignItems: 'center', backgroundColor: 'rgba(49,75,35,0.72)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, position: 'absolute', width: 152, zIndex: 4000 },
  regionLabelText: { color: '#FFFBE8', fontSize: 10, fontWeight: '900', textAlign: 'center' },
  cellId: { color: 'rgba(36,58,24,0.82)', fontSize: 14, fontVariant: ['tabular-nums'], fontWeight: '900', position: 'absolute', textAlign: 'center', width: 36, zIndex: 1200 },
  lock: { alignItems: 'center', backgroundColor: 'rgba(255,238,197,0.92)', borderColor: '#9B7447', borderRadius: 15, borderWidth: 2, height: 46, justifyContent: 'center', position: 'absolute', width: 46, zIndex: 4500 },
  selectionAnnouncement: { alignSelf: 'center', backgroundColor: 'rgba(18,43,52,0.84)', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 6, position: 'absolute', top: 108 },
  selectionText: { color: '#FFF3B2', fontSize: 11, fontVariant: ['tabular-nums'], fontWeight: '800' },
});
