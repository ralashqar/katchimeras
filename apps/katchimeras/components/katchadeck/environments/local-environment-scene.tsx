import { Image } from 'expo-image';
import { Canvas, Group, Image as SkiaImage, Skia, useImage } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  localEnvironmentForegroundSource,
  localEnvironmentFullSceneSource,
  localEnvironmentGuideSource,
  localEnvironmentPlateSource,
  localEnvironmentPropSource,
  localEnvironmentRevealObjectSource,
} from '@/constants/local-environments';
import type { EnvironmentHitbox, LocalEnvironmentRuntime, LocalEnvironmentStationRuntime } from '@/types/local-environment';

const SHOW_ENVIRONMENT_DEV_OVERLAY = false;

type Props = {
  runtime: LocalEnvironmentRuntime;
  creatureSource: ImageSourcePropType | null;
  creatureName: string;
  onStationPress: (station: LocalEnvironmentStationRuntime) => void;
  onTalkPress: () => void;
};

export function LocalEnvironmentScene({ runtime, creatureSource, creatureName, onStationPress, onTalkPress }: Props) {
  const { width } = useWindowDimensions();
  const revealMode = runtime.definition.plate.revealMode === 'fullSceneMasks' ? 'fullSceneMasks' : 'propLayers';
  const plateSource = localEnvironmentPlateSource(
    revealMode === 'fullSceneMasks'
      ? runtime.definition.plate.revealBaseAssetKey ?? runtime.definition.plate.assetKey
      : runtime.definition.plate.assetKey
  );
  const fullSceneSource = localEnvironmentFullSceneSource(runtime.definition.plate.fullSceneAssetKey);
  const foregroundSource = revealMode === 'fullSceneMasks' ? null : localEnvironmentForegroundSource(runtime.definition.plate.foregroundAssetKey);
  const guideSource = SHOW_ENVIRONMENT_DEV_OVERLAY ? localEnvironmentGuideSource(runtime.definition.plate.guideAssetKey) : null;
  const depthSortedStations = useMemo(
    () => [...runtime.stations].sort((a, b) => {
      const aRect = maskRectForStation(a);
      const bRect = maskRectForStation(b);
      const bottomDelta = aRect.y + aRect.h - (bRect.y + bRect.h);
      return bottomDelta === 0 ? a.zIndex - b.zIndex : bottomDelta;
    }),
    [runtime.stations]
  );
  const sceneSize = Math.max(760, Math.min(1040, width * 1.72));
  const scale = sceneSize / runtime.definition.plate.width;
  const creatureFrame = runtime.definition.creature ?? {
    anchor: { x: 660, y: 770 },
    width: 150,
    height: 160,
  };

  return (
    <View style={styles.frame}>
      <ScrollView
        horizontal
        bounces
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scroller, { minWidth: sceneSize + 24 }]}>
        <Animated.View entering={FadeIn.duration(220)} style={[styles.scene, { height: sceneSize, width: sceneSize }]}>
          {plateSource ? <Image source={plateSource} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          <View pointerEvents="none" style={styles.vignette} />

          {revealMode === 'fullSceneMasks' && fullSceneSource
            ? depthSortedStations.map((station) => (
                <StationRevealLayer
                  key={`reveal-${station.id}`}
                  fullSceneSource={fullSceneSource}
                  plateSize={runtime.definition.plate.width}
                  scale={scale}
                  station={station}
                />
              ))
            : runtime.stations.map((station) => (
                <StationPropLayer key={`prop-${station.id}`} scale={scale} station={station} />
              ))}

          {runtime.stations.map((station) => (
            <StationHitbox
              key={`hitbox-${station.id}`}
              scale={scale}
              station={station}
              onPress={() => onStationPress(station)}
            />
          ))}

          {creatureSource ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Talk to ${creatureName}`}
              onPress={onTalkPress}
              style={[
                styles.creatureButton,
                {
                  left: (creatureFrame.anchor.x - creatureFrame.width / 2) * scale,
                  top: (creatureFrame.anchor.y - creatureFrame.height) * scale,
                  width: creatureFrame.width * scale,
                  height: creatureFrame.height * scale,
                },
              ]}>
              <Image source={creatureSource} style={styles.creature} contentFit="contain" />
              <View style={styles.talkBubble}>
                <IconSymbol name="bubble.left.and.bubble.right.fill" size={13} color="#2A1C10" />
                <ThemedText style={styles.talkText} lightColor="#2A1C10" darkColor="#2A1C10">
                  Talk
                </ThemedText>
              </View>
            </Pressable>
          ) : null}

          {foregroundSource ? <Image pointerEvents="none" source={foregroundSource} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          {guideSource ? <Image pointerEvents="none" source={guideSource} style={[StyleSheet.absoluteFill, styles.guide]} contentFit="cover" /> : null}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function maskRectForStation(station: LocalEnvironmentStationRuntime): EnvironmentHitbox {
  if (station.revealMask?.type === 'rect' && station.revealMask.rect) {
    return station.revealMask.rect;
  }
  if (station.revealMask?.type === 'polygon' && station.revealMask.bounds) {
    return station.revealMask.bounds;
  }
  const padding = station.revealMask?.type === 'rect' ? station.revealMask.padding ?? 0 : 0;
  return {
    x: station.hitbox.x - padding,
    y: station.hitbox.y - padding,
    w: station.hitbox.w + padding * 2,
    h: station.hitbox.h + padding * 2,
  };
}

function stationDepthZIndex(station: LocalEnvironmentStationRuntime, rect: EnvironmentHitbox): number {
  return Math.round((rect.y + rect.h) / 8) + station.zIndex;
}

function StationRevealLayer({
  station,
  scale,
  fullSceneSource,
  plateSize,
}: {
  station: LocalEnvironmentStationRuntime;
  scale: number;
  fullSceneSource: ImageSourcePropType;
  plateSize: number;
}) {
  const visibleFrom = station.art.visibleWhenLevel ?? 1;
  if (station.level < visibleFrom) return null;
  const rect = maskRectForStation(station);
  const revealObjectSource = localEnvironmentRevealObjectSource(station.revealObjectAssetKey);
  const zIndex = stationDepthZIndex(station, rect);
  if (station.revealRenderMode === 'object' && revealObjectSource) {
    return (
      <Animated.View
        entering={FadeIn.duration(220)}
        pointerEvents="none"
        style={[
          styles.stationRevealObject,
          {
            height: rect.h * scale,
            left: rect.x * scale,
            top: rect.y * scale,
            width: rect.w * scale,
            zIndex,
          },
        ]}>
        <Image source={revealObjectSource} style={StyleSheet.absoluteFill} contentFit="contain" />
      </Animated.View>
    );
  }

  if (station.revealMask?.type === 'polygon' && station.revealMask.points.length >= 3) {
    return (
      <StationPolygonRevealLayer
        fullSceneSource={fullSceneSource}
        plateSize={plateSize}
        rect={rect}
        scale={scale}
        station={station}
      />
    );
  }

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      pointerEvents="none"
      style={[
        styles.stationReveal,
        {
          height: rect.h * scale,
          left: rect.x * scale,
          top: rect.y * scale,
          width: rect.w * scale,
          zIndex,
        },
      ]}>
      <Image
        source={fullSceneSource}
        style={{
          height: plateSize * scale,
          left: -rect.x * scale,
          position: 'absolute',
          top: -rect.y * scale,
          width: plateSize * scale,
        }}
        contentFit="cover"
      />
    </Animated.View>
  );
}

function StationPolygonRevealLayer({
  station,
  scale,
  fullSceneSource,
  plateSize,
  rect,
}: {
  station: LocalEnvironmentStationRuntime;
  scale: number;
  fullSceneSource: ImageSourcePropType;
  plateSize: number;
  rect: EnvironmentHitbox;
}) {
  const image = useImage(fullSceneSource as number);
  const path = useMemo(() => {
    const nextPath = Skia.Path.Make();
    const points = station.revealMask?.type === 'polygon' ? station.revealMask.points : [];
    points.forEach((point, index) => {
      const x = (point.x - rect.x) * scale;
      const y = (point.y - rect.y) * scale;
      if (index === 0) nextPath.moveTo(x, y);
      else nextPath.lineTo(x, y);
    });
    nextPath.close();
    return nextPath;
  }, [rect.x, rect.y, scale, station.revealMask]);

  if (!image) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      pointerEvents="none"
      style={[
        styles.stationReveal,
        {
          height: rect.h * scale,
          left: rect.x * scale,
          top: rect.y * scale,
          width: rect.w * scale,
          zIndex: stationDepthZIndex(station, rect),
        },
      ]}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Group clip={path}>
          <SkiaImage
            fit="cover"
            height={plateSize * scale}
            image={image}
            width={plateSize * scale}
            x={-rect.x * scale}
            y={-rect.y * scale}
          />
        </Group>
      </Canvas>
    </Animated.View>
  );
}

function StationPropLayer({ station, scale }: { station: LocalEnvironmentStationRuntime; scale: number }) {
  const assetKey = station.level > 0 ? station.art.levels[station.level - 1] : undefined;
  const source = localEnvironmentPropSource(assetKey);
  const visibleFrom = station.art.visibleWhenLevel ?? 1;
  if (!source || station.level < visibleFrom) return null;
  const rect = station.hitbox;

  return (
    <Image
      pointerEvents="none"
      source={source}
      style={[
        styles.stationProp,
        {
          height: station.art.height * scale,
          left: (station.anchor.x - station.art.anchorOffset.x) * scale,
          top: (station.anchor.y - station.art.anchorOffset.y) * scale,
          width: station.art.width * scale,
          zIndex: stationDepthZIndex(station, rect),
        },
      ]}
      contentFit="contain"
    />
  );
}

function StationHitbox({
  station,
  scale,
  onPress,
}: {
  station: LocalEnvironmentStationRuntime;
  scale: number;
  onPress: () => void;
}) {
  const active = station.level > 0;
  const rect = maskRectForStation(station);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${station.label}, ${station.valueLabel}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.hitbox,
        SHOW_ENVIRONMENT_DEV_OVERLAY ? styles.hitboxDev : null,
        pressed ? styles.hitboxPressed : null,
        {
          height: rect.h * scale,
          left: rect.x * scale,
          top: rect.y * scale,
          width: rect.w * scale,
          zIndex: stationDepthZIndex(station, rect) + 1000,
        },
      ]}>
      {SHOW_ENVIRONMENT_DEV_OVERLAY ? (
        <View style={styles.devLabel}>
          <IconSymbol name={station.icon} size={12} color="#24160C" />
          <ThemedText style={styles.devLabelText} lightColor="#24160C" darkColor="#24160C">
            {station.id} z{station.zIndex} L{station.level}
          </ThemedText>
        </View>
      ) : null}
      {!SHOW_ENVIRONMENT_DEV_OVERLAY && active ? <View style={styles.tapGlint} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: 'rgba(16, 10, 6, 0.45)',
    borderColor: 'rgba(255, 230, 184, 0.18)',
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  scroller: { padding: 12 },
  scene: {
    backgroundColor: '#25180D',
    borderCurve: 'continuous',
    borderRadius: 18,
    boxShadow: '0 18px 42px rgba(0,0,0,0.28)',
    overflow: 'hidden',
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    boxShadow: 'inset 0 0 90px rgba(39, 21, 9, 0.38)',
  },
  guide: { opacity: 0.72, zIndex: 900 },
  stationProp: {
    position: 'absolute',
  },
  stationReveal: {
    overflow: 'hidden',
    position: 'absolute',
  },
  stationRevealObject: {
    position: 'absolute',
  },
  hitbox: {
    position: 'absolute',
  },
  hitboxDev: {
    backgroundColor: 'rgba(255, 217, 104, 0.14)',
    borderColor: 'rgba(255, 217, 104, 0.75)',
    borderWidth: 1,
  },
  hitboxPressed: { backgroundColor: 'rgba(255, 224, 163, 0.12)' },
  tapGlint: {
    backgroundColor: 'rgba(255, 238, 196, 0.92)',
    borderRadius: 999,
    height: 7,
    position: 'absolute',
    right: 8,
    top: 8,
    width: 7,
  },
  devLabel: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 224, 163, 0.88)',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    position: 'absolute',
    top: 4,
  },
  devLabelText: { fontSize: 9, fontWeight: '900' },
  creatureButton: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    zIndex: 60,
  },
  creature: { height: '100%', width: '100%' },
  talkBubble: {
    alignItems: 'center',
    backgroundColor: '#FFE0A3',
    borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: 999,
    borderWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: 'absolute',
  },
  talkText: { fontSize: 11, fontWeight: '900' },
});
