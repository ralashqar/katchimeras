import { WorldTileTransition } from './world-tile-transition';
import type { HavenUpgradePresentationPhase } from './upgrade-presentation';
import { useEffect, useMemo, type ReactNode } from 'react';
import { Pressable, Text, View, type ImageSourcePropType } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useKingdomHexCamera } from './hex-camera';
import { kingdomCameraSnapshotForTarget } from './hex-camera-math';
import { createHexTileRenderer } from './hex-tile';
import { createSeamlessWorldImage } from './seamless-image';

const SCENE = { width: 2400, height: 3600 };
const ORIGIN = { x: 1200, y: 1900 };
const SeamlessWorldImage = createSeamlessWorldImage({ imageCrossfadeMs: 600 });
const { KingdomTileArt } = createHexTileRenderer<{ frame: { left: number; top: number; width: number; height: number }; source: ImageSourcePropType }, 'map'>({ SeamlessWorldImage, sourceForLod: layer => layer.source, overlayForLod: () => null });
export type NeighborhoodTile = { id: string; x: number; y: number; source: ImageSourcePropType; label: string; enabled: boolean; completed?: boolean; faction?: 'rival' | 'player'; resident?: ReactNode; onPress(): void };

/** A retained map surface: focus changes never remount residents or tile art. */
export function Neighborhood({ width, height, tiles, focus, zoom, locked, onSettled, renderUpgradeEffects, paths = [] }: {
  paths?: readonly { from: string; to: string; open: boolean }[];
  renderUpgradeEffects?: (phase: HavenUpgradePresentationPhase, reduced: boolean) => ReactNode;
  width: number; height: number; tiles: readonly NeighborhoodTile[];
  focus: { x: number; y: number }; zoom: number; locked?: boolean; onSettled?: () => void;
}) {
  const reduced = useReducedMotion();
  const viewport = useMemo(() => ({ width, height }), [width, height]);
  const target = useMemo(() => kingdomCameraSnapshotForTarget(viewport, SCENE, { x: focus.x + ORIGIN.x, y: focus.y + ORIGIN.y }, zoom), [viewport, focus.x, focus.y, zoom]);
  const { ready, animateToSnapshot, gesture, worldStyle } = useKingdomHexCamera({
    center: { x: focus.x + ORIGIN.x, y: focus.y + ORIGIN.y }, initialSnapshot: target,
    scene: SCENE, viewport, interactionEnabled: !locked, minimumScale: .18, maximumScale: 1,
  });
  useEffect(() => {
    if (ready) animateToSnapshot(target, reduced ? 0 : 900, onSettled);
  }, [ready, target, reduced, animateToSnapshot, onSettled]);
  return <GestureDetector gesture={gesture}><View style={{ width, height, overflow: 'hidden' }}>
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: SCENE.width, height: SCENE.height, opacity: ready ? 1 : 0 }, worldStyle]}>
      {paths.map(path => {
        const from = tiles.find(tile => tile.id === path.from), to = tiles.find(tile => tile.id === path.to);
        if (!from || !to) return null;
        const distance = Math.hypot(to.x - from.x, to.y - from.y);
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        return <View key={`${path.from}:${path.to}`} pointerEvents="none" style={{ position: 'absolute', left: ORIGIN.x + (from.x + to.x) / 2 - distance / 2, top: ORIGIN.y + (from.y + to.y) / 2 - 9, width: distance, height: 18, borderRadius: 9, backgroundColor: path.open ? '#F1D892' : '#6F929C', opacity: path.open ? .9 : .35, transform: [{ rotate: `${angle}rad` }] }} />;
      })}
      {[...tiles].sort((a, b) => a.y - b.y).map(tile => <View key={tile.id} style={{ position: 'absolute', left: tile.x + ORIGIN.x - 200, top: tile.y + ORIGIN.y - 200, width: 400, height: 400 }}>
        <WorldTileTransition source={tile.source} effects={renderUpgradeEffects}>{source => <KingdomTileArt source={source} fallbackSource={null} overlaySource={null} frame={{ left: 0, top: 0, width: 400, height: 400 }} focusAnchorX={200} focusAnchorY={200} focusScale={1} priority="high" />}</WorldTileTransition>
        {tile.resident && <View pointerEvents="none" style={{ position: 'absolute', left: 120, top: 40 }}>{tile.resident}</View>}
        {tile.faction && <Text pointerEvents="none" style={{ position: 'absolute', right: 65, top: 80, fontSize: 75, color: tile.faction === 'player' ? '#ECDB95' : '#BC5253' }}>⚑</Text>}

      </View>)}
      {tiles.map(tile => (        <Pressable key={tile.id} disabled={!tile.enabled} accessibilityRole="button" accessibilityLabel={tile.label} accessibilityState={{ disabled: !tile.enabled }} onPress={tile.onPress} style={{ position: 'absolute', top: tile.y + ORIGIN.y + 80, left: tile.x + ORIGIN.x - 155, width: 310, minHeight: 84, alignItems: 'center', justifyContent: 'center', borderRadius: 35, backgroundColor: tile.completed ? '#597951F2' : '#183A30ED', borderWidth: 3, borderColor: tile.enabled ? '#EBD894' : '#6D857B' }}>
          <Text style={{ color: '#FFF2D2', fontSize: 26, fontWeight: '700', textAlign: 'center' }}>{tile.completed ? '⚑ ' : ''}{tile.label}</Text>
        </Pressable>))}
    </Animated.View>
  </View></GestureDetector>;
}
