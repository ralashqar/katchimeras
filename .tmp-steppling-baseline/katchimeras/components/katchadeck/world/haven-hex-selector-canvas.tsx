import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ImageSourcePropType, type LayoutChangeEvent } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { buildKingdomHexScene, tileVisibleBounds } from '@/components/katchadeck/world/kingdom-hex-scene';
import { SeamlessWorldImage } from '@/components/katchadeck/world/seamless-world-image';
import { useKingdomHexCamera } from '@/components/katchadeck/world/use-kingdom-hex-camera';
import { KINGDOM_RENDERING } from '@/constants/kingdom-rendering';
import { Lantern } from '@/constants/theme';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import type { WorldIdentityState } from '@/types/world-identity';
import type { TodayAtmosphereBackground } from '@/utils/day-background-scene';
import { getDevKingdomHexVerticalAlignmentMode } from '@/utils/dev-asset-overrides';
import {
  compactKingdomCompanionHexSlots,
  type KingdomHexCompanionSlot,
} from '@/utils/katchimera-kingdom-slots';
import { kingdomHexTileOverlaySourceForLod, kingdomHexTileSourceForLod, playerHavenHexTileSet } from '@/utils/world-visuals';

export const IMPLEMENTED_KATCHIMERA_WORLDS = new Set<KatchimeraFamilyId>(['mossprout', 'steppling']);

export type HavenWorldMarker = {
  displayName: string;
  enterable: boolean;
  familyId: KatchimeraFamilyId;
  notification: 'active' | 'ready' | 'upgrade' | null;
  portraitSource: ImageSourcePropType;
  restorationMaximum: number;
  restorationStage: number;
};

export function HavenHexSelectorCanvas({
  background,
  companionSlots,
  highlightedFamilyId,
  identity,
  onContentReady,
  onSelectFamily,
  onSelectHome,
  recenterBottom = 84,
  worldMarkers,
}: {
  background: TodayAtmosphereBackground;
  companionSlots: KingdomHexCompanionSlot[];
  highlightedFamilyId?: KatchimeraFamilyId | null;
  identity?: WorldIdentityState | null;
  onContentReady?: () => void;
  onSelectFamily: (familyId: KatchimeraFamilyId) => void;
  onSelectHome?: () => void;
  recenterBottom?: number;
  worldMarkers: readonly HavenWorldMarker[];
}) {
  const [viewport, setViewport] = useState({ height: 0, width: 0 });
  const [assetRevision, setAssetRevision] = useState(0);
  useFocusEffect(useCallback(() => setAssetRevision((revision) => revision + 1), []));
  const selectorCompanionSlots = useMemo(
    () => compactKingdomCompanionHexSlots(companionSlots),
    [companionSlots],
  );
  const tileSelection = useMemo(() => ({
    revision: assetRevision,
    value: {
      ...playerHavenHexTileSet(),
      layoutProfile: 'haven-selector-v1' as const,
    },
  }), [assetRevision]);
  const verticalAlignment = useMemo(
    () => ({ revision: assetRevision, value: getDevKingdomHexVerticalAlignmentMode() }),
    [assetRevision],
  );
  const scene = useMemo(() => buildKingdomHexScene(
    selectorCompanionSlots,
    tileSelection.value,
    identity,
    verticalAlignment.value,
    { includeMossproutGarden: false, useWorldSelectorTiles: true },
  ), [identity, selectorCompanionSlots, tileSelection, verticalAlignment]);
  const markerByFamily = useMemo(
    () => new Map(worldMarkers.map((marker) => [marker.familyId, marker])),
    [worldMarkers],
  );
  const camera = useKingdomHexCamera({
    center: { x: scene.centerTile.cx, y: scene.centerTile.cy },
    centerId: scene.centerTile.id,
    initialFitWorld: true,
    interactionEnabled: true,
    minimumScale: 0.28,
    scene,
    viewport,
  });
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    setViewport((current) => current.height === height && current.width === width ? current : { height, width });
    onContentReady?.();
  }, [onContentReady]);

  return (
    <View collapsable={false} onLayout={onLayout} style={styles.root}>
      <Image cachePolicy="disk" contentFit="cover" pointerEvents="none" recyclingKey={background.id} source={background.havenSource} style={StyleSheet.absoluteFill} />
      <GestureDetector key={`haven-selector-${assetRevision}`} gesture={camera.gesture}>
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.scene, { height: scene.height, width: scene.width }, camera.worldStyle]}>
            {scene.tileArtLayers.map((layer) => {
              const source = kingdomHexTileSourceForLod(layer, KINGDOM_RENDERING.havenImageLod);
              const overlaySource = kingdomHexTileOverlaySourceForLod(layer, KINGDOM_RENDERING.havenImageLod);
              const fallbackSource = layer.fallbackSource
                ? kingdomHexTileSourceForLod({ source: layer.fallbackSource, sources: layer.fallbackSources }, KINGDOM_RENDERING.havenImageLod)
                : null;
              return (
                <View key={layer.id} pointerEvents="none" style={[styles.tile, layer.frame]}>
                  <SeamlessWorldImage allowDownscaling fallbackSource={fallbackSource} priority={layer.id === scene.centerTile.id ? 'high' : 'normal'} source={source} />
                  {overlaySource ? <SeamlessWorldImage allowDownscaling priority="normal" source={overlaySource} /> : null}
                </View>
              );
            })}
            {scene.tiles.map((tile) => {
              if (tile.kind !== 'companion' || !tile.companion) return null;
              const marker = markerByFamily.get(tile.companion.familyId);
              return marker ? <HavenSelectorWorldMarker key={`marker-${marker.familyId}`} marker={marker} x={tile.cx} y={tile.cy} /> : null;
            })}
            {scene.tiles.map((tile) => {
              const bounds = tileVisibleBounds(tile.cx, tile.cy);
              if (tile.kind === 'home') {
                return <Pressable accessibilityLabel="Your Haven home" accessibilityRole="button" key="haven-selector-home" onPress={onSelectHome} style={[styles.hitTarget, {
                  height: bounds.bottom - bounds.top,
                  left: bounds.left,
                  top: bounds.top,
                  width: bounds.right - bounds.left,
                }]} />;
              }
              if (!tile.companion || tile.companion.kind === 'locked' || !IMPLEMENTED_KATCHIMERA_WORLDS.has(tile.companion.familyId)) return null;
              const highlighted = highlightedFamilyId === tile.companion.familyId;
              return <Pressable
                accessibilityHint="Opens this Katchimera world"
                accessibilityLabel={`Open ${tile.companion.familyId} world`}
                accessibilityRole="button"
                key={`haven-selector-${tile.companion.familyId}`}
                onPress={() => onSelectFamily(tile.companion!.familyId)}
                style={({ pressed }) => [styles.hitTarget, {
                  height: bounds.bottom - bounds.top,
                  left: bounds.left,
                  top: bounds.top,
                  width: bounds.right - bounds.left,
                }, highlighted && styles.highlighted, pressed && styles.pressed]}
              />;
            })}
          </Animated.View>
        </View>
      </GestureDetector>
      <Pressable accessibilityLabel="Recenter Haven map" accessibilityRole="button" onPress={camera.recenter} style={[styles.recenter, { bottom: recenterBottom }]}>
        <IconSymbol color={Lantern.moon50} name="scope" size={22} />
      </Pressable>
    </View>
  );
}

const HavenSelectorWorldMarker = memo(function HavenSelectorWorldMarker({
  marker,
  x,
  y,
}: {
  marker: HavenWorldMarker;
  x: number;
  y: number;
}) {
  const notificationLabel = marker.notification === 'ready'
    ? '✓'
    : marker.notification === 'upgrade'
      ? '↑'
      : '!';
  return (
    <View
      pointerEvents="none"
      style={[
        styles.marker,
        {
          left: x - 116,
          top: y - 25,
        },
        !marker.enterable && styles.markerUnavailable,
      ]}>
      <View style={styles.portraitStage}>
        <View pointerEvents="none" style={styles.portraitBackdrop} />
        <Image
          accessibilityIgnoresInvertColors
          allowDownscaling
          cachePolicy="memory-disk"
          contentFit="contain"
          source={marker.portraitSource}
          style={styles.portraitArt}
          transition={0}
        />
        {marker.notification ? (
          <View style={[styles.notification, marker.notification === 'ready' && styles.notificationReady]}>
            <Text style={styles.notificationText}>{notificationLabel}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.markerPlaque}>
        <Text numberOfLines={1} style={styles.markerName}>{marker.displayName}</Text>
        <View style={styles.progressRow}>
          <Text style={styles.progressStar}>★</Text>
          <Text style={styles.progressText}>{marker.restorationStage}/{marker.restorationMaximum}</Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  scene: { position: 'relative' },
  tile: { position: 'absolute' },
  hitTarget: { borderCurve: 'continuous', borderRadius: 28, position: 'absolute' },
  highlighted: { backgroundColor: 'rgba(150,239,113,0.16)', borderColor: 'rgba(214,255,190,0.94)', borderWidth: 2, boxShadow: '0 0 22px rgba(150,239,113,0.82)' },
  marker: { alignItems: 'center', height: 180, position: 'absolute', width: 232, zIndex: 8 },
  markerUnavailable: { opacity: 0.72 },
  portraitStage: {
    height: 112,
    position: 'relative',
    width: 156,
    zIndex: 2,
  },
  portraitBackdrop: {
    backgroundColor: '#EAF6D2',
    borderColor: '#FFF6D8',
    borderCurve: 'continuous',
    borderRadius: 56,
    borderWidth: 7,
    boxShadow: '0 7px 16px rgba(35,44,25,0.34)',
    height: 112,
    left: 22,
    position: 'absolute',
    top: 20,
    width: 112,
    zIndex: 1,
  },
  portraitArt: { height: 156, left: 0, position: 'absolute', top: 0, width: 156, zIndex: 2 },
  notification: {
    alignItems: 'center',
    backgroundColor: '#E95045',
    borderColor: '#FFF8DE',
    borderRadius: 20,
    borderWidth: 4,
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    right: -14,
    top: -14,
    width: 40,
    zIndex: 5,
  },
  notificationReady: { backgroundColor: '#64A941' },
  notificationText: { color: '#FFFDF3', fontSize: 24, fontWeight: '900', lineHeight: 27 },
  markerPlaque: {
    alignItems: 'center',
    backgroundColor: '#2A3022',
    borderColor: 'rgba(255,244,210,0.88)',
    borderRadius: 22,
    borderWidth: 3,
    boxShadow: '0 6px 14px rgba(26,30,24,0.32)',
    marginTop: -10,
    minHeight: 68,
    paddingHorizontal: 21,
    paddingVertical: 8,
    width: 220,
    zIndex: 4,
  },
  markerName: { color: '#FFF9E8', fontSize: 23, fontWeight: '900', lineHeight: 27 },
  progressRow: { alignItems: 'center', flexDirection: 'row', gap: 9, justifyContent: 'center' },
  progressStar: { color: '#F4C84C', fontSize: 19, fontWeight: '900', lineHeight: 22 },
  progressText: { color: '#FFF8E5', fontSize: 19, fontWeight: '800', lineHeight: 22 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.98 }] },
  recenter: { alignItems: 'center', backgroundColor: 'rgba(20,17,31,0.82)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 23, borderWidth: 1, height: 46, justifyContent: 'center', position: 'absolute', right: 16, width: 46 },
});
