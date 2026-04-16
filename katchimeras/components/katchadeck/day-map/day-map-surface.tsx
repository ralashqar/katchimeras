import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { GlassPanel } from '@/components/katchadeck/ui/glass-panel';
import { ThemedText } from '@/components/themed-text';
import { KatchaDeckUI } from '@/constants/theme';
import type { DayMapNode, HomeDayRecord, HomeLocationType, HomeMoment } from '@/types/home';
import { getCreatureVisual } from '@/utils/home-engine';

type DayMapSurfaceProps = {
  day: HomeDayRecord;
  accentColor: string;
  interactive?: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
  detailMode?: 'compact' | 'bottom';
  detailBottomInset?: number;
};

type NativeMapsModule = typeof import('react-native-maps');

export function DayMapSurface({
  day,
  accentColor,
  interactive = false,
  height = interactive ? 360 : 220,
  style,
  detailMode = 'compact',
  detailBottomInset = 0,
}: DayMapSurfaceProps) {
  const [nativeMaps, setNativeMaps] = useState<NativeMapsModule | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(day.dayMap?.primaryLocationId ?? null);
  const [expandedPhotoUri, setExpandedPhotoUri] = useState<string | null>(null);
  const momentIndex = useMemo(() => new Map(day.moments.map((moment) => [moment.id, moment])), [day.moments]);

  useEffect(() => {
    setSelectedNodeId(day.dayMap?.primaryLocationId ?? null);
    setExpandedPhotoUri(null);
  }, [day.dayMap?.primaryLocationId, day.id]);

  useEffect(() => {
    if (process.env.EXPO_OS === 'web') {
      return;
    }

    let active = true;

    import('react-native-maps').then((module) => {
      if (active) {
        setNativeMaps(module);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  if (!day.dayMap || day.dayMap.nodes.length === 0 || !day.dayMap.viewport) {
    return (
      <GlassPanel contentStyle={styles.emptyPanel} fillColor="rgba(18, 27, 47, 0.9)">
        <ThemedText type="onboardingLabel" style={styles.emptyLabel} lightColor="#D7E4FF" darkColor="#D7E4FF">
          Day map
        </ThemedText>
        <ThemedText style={styles.emptyBody} lightColor="#DCE6FF" darkColor="#DCE6FF">
          No places captured for this day.
        </ThemedText>
      </GlassPanel>
    );
  }

  if (!nativeMaps) {
    return (
      <GlassPanel contentStyle={styles.emptyPanel} fillColor="rgba(18, 27, 47, 0.9)">
        <ThemedText type="onboardingLabel" style={styles.emptyLabel} lightColor="#D7E4FF" darkColor="#D7E4FF">
          Day map
        </ThemedText>
        <ThemedText style={styles.emptyBody} lightColor="#DCE6FF" darkColor="#DCE6FF">
          Day maps are available in the native app build.
        </ThemedText>
      </GlassPanel>
    );
  }

  const MapView = nativeMaps.default;
  const { Marker, Polyline } = nativeMaps;
  const mapTheme = resolveMapTheme(accentColor);
  const selectedNode =
    day.dayMap.nodes.find((node) => node.id === selectedNodeId) ??
    day.dayMap.nodes.find((node) => node.id === day.dayMap?.primaryLocationId) ??
    day.dayMap.nodes[0] ??
    null;
  const selectedMoment = selectedNode?.linkedMomentId ? momentIndex.get(selectedNode.linkedMomentId) ?? null : null;
  const selectedThumbnailUri = selectedMoment?.metadata?.thumbnailUri ?? selectedNode?.photoThumbnailUri ?? null;
  const primaryNode = day.dayMap.nodes.find((node) => node.id === day.dayMap?.primaryLocationId) ?? null;
  const creatureVisual = day.creature ? getCreatureVisual(day.creature.visualKey) : null;
  const creatureMarkerCoordinate =
    day.creature && primaryNode && day.dayMap.viewport
      ? {
          latitude: primaryNode.latitude + day.dayMap.viewport.latitudeDelta * 0.08,
          longitude: primaryNode.longitude + day.dayMap.viewport.longitudeDelta * 0.02,
        }
      : null;

  return (
    <View style={[styles.shell, { minHeight: height }, style]}>
      <MapView
        region={day.dayMap.viewport}
        mapType="standard"
        onPress={() => {
          if (interactive) {
            setSelectedNodeId(null);
          }
        }}
        pitchEnabled={false}
        rotateEnabled={false}
        scrollEnabled={interactive}
        showsCompass={false}
        showsIndoors={false}
        showsPointsOfInterest={false}
        showsScale={false}
        showsTraffic={false}
        showsUserLocation={false}
        style={StyleSheet.absoluteFill}
        toolbarEnabled={false}
        zoomControlEnabled={false}
        zoomEnabled={interactive}>
        {day.dayMap.path.length > 1 ? (
          <Polyline
            coordinates={day.dayMap.path}
            lineCap="round"
            lineJoin="round"
            strokeColor={mapTheme.path}
            strokeWidth={interactive ? 5 : 4}
          />
        ) : null}
        {day.dayMap.nodes.map((node) => (
          <Marker
            anchor={{ x: 0.5, y: 0.5 }}
            coordinate={{ latitude: node.latitude, longitude: node.longitude }}
            key={node.id}
            tracksViewChanges={Boolean(node.photoThumbnailUri)}
            onPress={() => {
              if (interactive) {
                setSelectedNodeId(node.id);
              }
            }}>
            <MapNodeMarker
              accentColor={accentColor}
              isPrimary={node.id === day.dayMap?.primaryLocationId}
              isSelected={interactive && selectedNode?.id === node.id}
              node={node}
            />
          </Marker>
        ))}
        {creatureVisual && creatureMarkerCoordinate ? (
          <Marker
            anchor={{ x: 0.5, y: 1 }}
            coordinate={creatureMarkerCoordinate}
            key={`creature-catch-${day.id}`}
            tracksViewChanges
            onPress={() => {
              if (interactive && primaryNode) {
                setSelectedNodeId(primaryNode.id);
              }
            }}>
            <View style={styles.creatureMarkerWrap}>
              <View style={[styles.creatureMarkerHalo, { backgroundColor: `${creatureVisual.accentColor}2A` }]} />
              <View style={[styles.creatureMarkerPlate, { borderColor: `${creatureVisual.accentColor}72` }]}>
                <View style={styles.creatureMarkerInner}>
                  <Image contentFit="contain" source={creatureVisual.source} style={styles.creatureMarkerImage} transition={0} />
                </View>
              </View>
            </View>
          </Marker>
        ) : null}
      </MapView>
      <View pointerEvents="none" style={styles.chrome} />
      {interactive && selectedNode ? (
        <View
          style={[
            styles.detailWrap,
            detailMode === 'bottom' ? styles.detailWrapBottom : null,
            detailMode === 'bottom' ? { bottom: 18 + detailBottomInset } : null,
          ]}>
          <GlassPanel contentStyle={styles.detailPanel} fillColor="rgba(10, 15, 28, 0.88)">
            {detailMode === 'bottom' ? (
              <View style={styles.memoryCaptionStack}>
                {selectedThumbnailUri ? (
                  <Pressable onPress={() => setExpandedPhotoUri(selectedThumbnailUri)} style={styles.thumbnailPressable}>
                    <Image contentFit="cover" source={selectedThumbnailUri} style={styles.captionThumbnail} />
                  </Pressable>
                ) : null}
                <ThemedText style={styles.memoryCaptionText} lightColor="#F8FBFF" darkColor="#F8FBFF">
                  {resolveNodeCaption(selectedNode, selectedMoment, day)}
                </ThemedText>
                <ThemedText style={styles.memoryCaptionMeta} lightColor="#DCE6FF" darkColor="#DCE6FF">
                  {formatNodeTimeRange(selectedNode)}
                </ThemedText>
              </View>
            ) : (
              <>
                <View style={styles.detailHeader}>
                  <View style={styles.detailCopy}>
                    <ThemedText type="onboardingLabel" style={styles.detailLabel} lightColor="#FFDCC0" darkColor="#FFDCC0">
                      {selectedMoment ? selectedMoment.label : resolveNodeLabel(selectedNode)}
                    </ThemedText>
                    <ThemedText type="subtitle" style={styles.detailTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
                      {selectedMoment?.metadata?.text ?? resolveNodeTitle(selectedNode, selectedMoment)}
                    </ThemedText>
                    <ThemedText style={styles.detailMeta} lightColor="#DCE6FF" darkColor="#DCE6FF">
                      {formatNodeTimeRange(selectedNode)}
                    </ThemedText>
                  </View>
                  {selectedThumbnailUri ? (
                    <Pressable onPress={() => setExpandedPhotoUri(selectedThumbnailUri)} style={styles.thumbnailPressable}>
                      <Image contentFit="cover" source={selectedThumbnailUri} style={styles.thumbnail} />
                    </Pressable>
                  ) : null}
                </View>
                <ThemedText style={styles.detailBody} lightColor="#E8EEFF" darkColor="#E8EEFF">
                  {resolveNodeCaption(selectedNode, selectedMoment, day)}
                </ThemedText>
              </>
            )}
          </GlassPanel>
        </View>
      ) : null}
      {expandedPhotoUri ? (
        <Pressable onPress={() => setExpandedPhotoUri(null)} style={styles.expandedPhotoOverlay}>
          <View style={styles.expandedPhotoFrame}>
            <Image contentFit="contain" source={expandedPhotoUri} style={styles.expandedPhoto} transition={120} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

function MapNodeMarker({
  node,
  accentColor,
  isSelected,
  isPrimary,
}: {
  node: DayMapNode;
  accentColor: string;
  isSelected: boolean;
  isPrimary: boolean;
}) {
  const markerTheme = resolveNodeTheme(node.type, accentColor);
  const size = 16 + node.importance * 20 + (isSelected ? 2 : 0);
  const haloSize = size + (isSelected ? 24 : 18);

  return (
    <View style={styles.markerWrap}>
      <View
        style={[
          styles.markerHalo,
          {
            backgroundColor: isSelected
              ? markerTheme.primaryHalo
              : isPrimary
                ? markerTheme.primaryHalo
                : markerTheme.halo,
            height: haloSize,
            opacity: isSelected ? 0.82 : 0.54,
            width: haloSize,
          },
        ]}
      />
      {node.photoThumbnailUri ? (
        <View
          style={[
            styles.photoMarkerFrame,
            {
              backgroundColor: markerTheme.photoCore,
              borderColor: isSelected || isPrimary ? '#FFF7EA' : markerTheme.border,
              height: size + 10,
              width: size + 10,
            },
          ]}>
          <Image contentFit="cover" source={node.photoThumbnailUri} style={styles.photoMarkerThumb} transition={120} />
        </View>
      ) : (
        <View
          style={[
            styles.markerCore,
            {
              backgroundColor: node.hasPhoto ? markerTheme.photoCore : markerTheme.core,
              borderColor: isSelected || isPrimary ? '#FFF7EA' : markerTheme.border,
              height: size,
              width: size,
            },
          ]}
        />
      )}
      <View style={[styles.markerSpark, { backgroundColor: markerTheme.spark }]} />
      {isPrimary ? <View style={styles.primaryBadge} /> : null}
    </View>
  );
}

function resolveNodeTheme(type: HomeLocationType, accentColor: string) {
  if (type === 'cafe') {
    return {
      halo: 'rgba(255, 190, 151, 0.42)',
      primaryHalo: 'rgba(255, 190, 151, 0.62)',
      core: '#F6B38F',
      photoCore: '#FFCCA8',
      border: '#FBD7BC',
      spark: '#FFF2E4',
    };
  }

  if (type === 'park') {
    return {
      halo: 'rgba(154, 225, 188, 0.42)',
      primaryHalo: 'rgba(154, 225, 188, 0.62)',
      core: '#8FD8BE',
      photoCore: '#B8F0D5',
      border: '#DDF7EB',
      spark: '#F5FFF9',
    };
  }

  if (type === 'home') {
    return {
      halo: 'rgba(243, 179, 221, 0.4)',
      primaryHalo: 'rgba(243, 179, 221, 0.62)',
      core: '#EAB1D3',
      photoCore: '#F7CDE4',
      border: '#FFE7F4',
      spark: '#FFF6FB',
    };
  }

  return {
    halo: `${accentColor}32`,
    primaryHalo: `${accentColor}58`,
    core: `${accentColor}D8`,
    photoCore: `${accentColor}F2`,
    border: `${accentColor}AA`,
    spark: '#FFF8EF',
  };
}

function resolveMapTheme(accentColor: string) {
  return {
    path: `${accentColor}B8`,
  };
}

function resolveNodeLabel(node: DayMapNode) {
  if (node.hasPhoto) {
    return 'Photo memory';
  }

  if (node.type === 'cafe') {
    return 'Warm stop';
  }

  if (node.type === 'park') {
    return 'Open air';
  }

  if (node.type === 'home') {
    return 'Home rhythm';
  }

  return 'Day trace';
}

function resolveNodeTitle(node: DayMapNode, moment: HomeMoment | null) {
  if (moment?.type === 'photo') {
    return 'A moment the day kept';
  }

  if (moment?.type === 'new_place') {
    return 'Somewhere that bent the day';
  }

  if (node.type === 'cafe') {
    return 'A softer pocket in the day';
  }

  if (node.type === 'park') {
    return 'A little movement stayed visible';
  }

  if (node.type === 'home') {
    return 'The day settled here';
  }

  return 'A place the creature remembered';
}

function resolveNodeCaption(node: DayMapNode, moment: HomeMoment | null, day: HomeDayRecord) {
  if (moment?.type === 'photo') {
    return 'A saved frame made this stop feel worth keeping.';
  }

  if (moment?.type === 'new_place') {
    return 'Something about this stop felt new enough to tilt the day.';
  }

  if (moment?.type === 'coffee') {
    return 'A warm pause here gave the day a softer middle.';
  }

  if (moment?.type === 'social') {
    return 'This was one of the places where the day opened outward a little.';
  }

  if (day.creature && node.id === day.dayMap?.primaryLocationId) {
    return `${day.creature.name} seems to have been caught here first, then carried through the rest of the day.`;
  }

  if (node.type === 'park') {
    return 'A little open space here kept the day from feeling too closed in.';
  }

  if (node.type === 'cafe') {
    return 'This stop reads like a quiet treat the day decided to remember.';
  }

  if (node.type === 'home') {
    return 'The day seems to have settled here long enough to leave a trace.';
  }

  return 'This point stayed in the map as one of the day’s small anchors.';
}

function formatNodeTimeRange(node: DayMapNode) {
  const start = formatShortTime(node.startedAt);
  const end = formatShortTime(node.endedAt);

  if (start === end) {
    return start;
  }

  return `${start} to ${end}`;
}

function formatShortTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: '#F6F2ED',
    borderCurve: 'continuous',
    borderRadius: KatchaDeckUI.radii.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  chrome: {
    borderColor: 'rgba(255, 251, 247, 0.82)',
    borderRadius: KatchaDeckUI.radii.lg,
    borderWidth: 1,
    bottom: 0,
    left: 0,
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  emptyPanel: {
    gap: 8,
    minHeight: 160,
    justifyContent: 'center',
  },
  emptyLabel: {
    fontSize: 11,
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  markerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerHalo: {
    borderRadius: 999,
    position: 'absolute',
  },
  markerCore: {
    borderRadius: 999,
    borderWidth: 1.5,
    boxShadow: '0 6px 18px rgba(20, 20, 34, 0.12)',
  },
  photoMarkerFrame: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1.5,
    boxShadow: '0 6px 18px rgba(20, 20, 34, 0.14)',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoMarkerThumb: {
    borderRadius: 999,
    height: '100%',
    width: '100%',
  },
  markerSpark: {
    borderRadius: 999,
    height: 5,
    position: 'absolute',
    right: 2,
    top: 2,
    width: 5,
  },
  primaryBadge: {
    backgroundColor: '#FFF3E5',
    borderRadius: 999,
    height: 8,
    position: 'absolute',
    right: -3,
    top: -3,
    width: 8,
  },
  detailWrap: {
    bottom: 12,
    left: 12,
    position: 'absolute',
    right: 12,
  },
  detailWrapBottom: {
    bottom: 18,
    left: 18,
    right: 18,
  },
  detailPanel: {
    gap: 8,
  },
  thumbnailPressable: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  memoryCaptionStack: {
    alignItems: 'center',
    gap: 8,
  },
  memoryCaptionText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  memoryCaptionMeta: {
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.84,
    textAlign: 'center',
  },
  detailHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  detailCopy: {
    flex: 1,
    gap: 3,
  },
  detailLabel: {
    fontSize: 11,
  },
  detailTitle: {
    fontSize: 16,
    lineHeight: 20,
  },
  detailMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  detailBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  thumbnail: {
    borderRadius: 16,
    height: 58,
    width: 58,
  },
  captionThumbnail: {
    borderRadius: 18,
    height: 52,
    width: 52,
  },
  creatureMarkerWrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  creatureMarkerHalo: {
    borderRadius: 24,
    height: 74,
    opacity: 0.84,
    position: 'absolute',
    transform: [{ translateY: 3 }],
    width: 74,
  },
  creatureMarkerPlate: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 248, 240, 0.92)',
    borderCurve: 'continuous',
    borderRadius: 29,
    borderWidth: 1.5,
    boxShadow: '0 8px 22px rgba(19, 22, 34, 0.22)',
    height: 58,
    justifyContent: 'center',
    padding: 4,
    width: 58,
  },
  creatureMarkerInner: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderCurve: 'continuous',
    borderRadius: 25,
    height: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  creatureMarkerImage: {
    height: 44,
    width: 44,
  },
  expandedPhotoOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(6, 9, 17, 0.82)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    paddingHorizontal: 20,
    paddingVertical: 32,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  expandedPhotoFrame: {
    backgroundColor: 'rgba(255, 250, 246, 0.96)',
    borderColor: 'rgba(255,255,255,0.38)',
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    boxShadow: '0 12px 36px rgba(5, 10, 20, 0.32)',
    maxHeight: '78%',
    maxWidth: '92%',
    overflow: 'hidden',
    padding: 10,
    width: '100%',
  },
  expandedPhoto: {
    borderRadius: 20,
    height: 420,
    maxHeight: '100%',
    width: '100%',
  },
});
