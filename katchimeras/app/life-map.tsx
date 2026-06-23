import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GlassPanel } from '@/components/katchadeck/ui/glass-panel';
import { ScreenCloseButton } from '@/components/katchadeck/ui/screen-close-button';
import { ThemedText } from '@/components/themed-text';
import { loadStoredHomeState } from '@/utils/home-storage';
import { getCreatureVisual } from '@/utils/home-engine';
import { buildLifeMap, type LifeMapPin } from '@/utils/life-map-engine';
import { requestSelectedDay } from '@/utils/selected-day-signal';

type NativeMapsModule = typeof import('react-native-maps');

export default function LifeMapRoute() {
  const router = useRouter();
  const [nativeMaps, setNativeMaps] = useState<NativeMapsModule | null>(null);

  const lifeMap = useMemo(() => {
    const stored = loadStoredHomeState();
    const days = stored ? [stored.today, ...stored.archivedDays] : [];
    return buildLifeMap(days);
  }, []);

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

  const hatchedCount = lifeMap.pins.filter((pin) => pin.hatched).length;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ animation: 'fade', headerShown: false, title: 'Life map' }} />

      {lifeMap.viewport && nativeMaps ? (
        <LifeMapCanvas
          nativeMaps={nativeMaps}
          pins={lifeMap.pins}
          viewport={lifeMap.viewport}
          onOpenDay={(dayId) => {
            requestSelectedDay(dayId);
            router.replace('/(tabs)');
          }}
        />
      ) : (
        <View style={styles.emptyWrap}>
          <GlassPanel contentStyle={styles.emptyPanel} fillColor="rgba(18, 27, 47, 0.9)">
            <ThemedText type="onboardingLabel" style={styles.emptyLabel} lightColor="#D7E4FF" darkColor="#D7E4FF">
              Life map
            </ThemedText>
            <ThemedText style={styles.emptyBody} lightColor="#DCE6FF" darkColor="#DCE6FF">
              {nativeMaps
                ? 'No places have landed on your map yet. As your days gather locations, they fill in here.'
                : 'The life map is available in the native app build.'}
            </ThemedText>
          </GlassPanel>
        </View>
      )}

      <ScreenCloseButton onPress={() => router.back()} />

      <View pointerEvents="none" style={styles.captionWrap}>
        <GlassPanel contentStyle={styles.captionPanel} fillColor="rgba(10, 15, 28, 0.82)">
          <ThemedText type="onboardingLabel" style={styles.captionLabel} lightColor="#D7E4FF" darkColor="#D7E4FF">
            Everywhere you’ve lived
          </ThemedText>
          <ThemedText style={styles.captionBody} lightColor="#DCE6FF" darkColor="#DCE6FF">
            {lifeMap.pins.length === 0
              ? 'Your map is waiting for its first days.'
              : `${lifeMap.pins.length} ${lifeMap.pins.length === 1 ? 'day' : 'days'} pinned · ${hatchedCount} hatched. Tap any to relive it.`}
          </ThemedText>
        </GlassPanel>
      </View>
    </View>
  );
}

function LifeMapCanvas({
  nativeMaps,
  pins,
  viewport,
  onOpenDay,
}: {
  nativeMaps: NativeMapsModule;
  pins: LifeMapPin[];
  viewport: NonNullable<ReturnType<typeof buildLifeMap>['viewport']>;
  onOpenDay: (dayId: string) => void;
}) {
  const MapView = nativeMaps.default;
  const { Marker } = nativeMaps;

  return (
    <MapView
      initialRegion={viewport}
      mapType="standard"
      pitchEnabled={false}
      rotateEnabled={false}
      showsCompass={false}
      showsPointsOfInterest={false}
      showsScale={false}
      showsUserLocation={false}
      style={StyleSheet.absoluteFill}
      toolbarEnabled={false}>
      {pins.map((pin) => (
        <Marker
          anchor={{ x: 0.5, y: 0.5 }}
          coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
          key={pin.dayId}
          tracksViewChanges={Boolean(pin.creatureVisualKey)}
          onPress={() => onOpenDay(pin.dayId)}>
          <LifeMapPinMarker pin={pin} />
        </Marker>
      ))}
    </MapView>
  );
}

function LifeMapPinMarker({ pin }: { pin: LifeMapPin }) {
  const visual = pin.creatureVisualKey ? getCreatureVisual(pin.creatureVisualKey) : null;
  const isRare = pin.rarity != null && pin.rarity !== 'common';

  if (!visual) {
    return (
      <View style={styles.markerWrap}>
        <View style={[styles.formingDot, { borderColor: `${pin.accentColor}AA`, backgroundColor: `${pin.accentColor}55` }]} />
      </View>
    );
  }

  return (
    <View style={styles.markerWrap}>
      <View style={[styles.markerHalo, { backgroundColor: `${pin.accentColor}2E` }]} />
      <View style={[styles.markerPlate, { borderColor: isRare ? '#FFF3E5' : `${pin.accentColor}80` }]}>
        <Image contentFit="contain" source={visual.source} style={styles.markerImage} transition={0} />
      </View>
      {isRare ? <View style={styles.rareBadge} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#090B12',
    flex: 1,
  },
  captionWrap: {
    bottom: 24,
    left: 18,
    position: 'absolute',
    right: 18,
  },
  captionPanel: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 22,
    paddingVertical: 16,
  },
  captionLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
  captionBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyPanel: {
    gap: 8,
    justifyContent: 'center',
    minHeight: 160,
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
    height: 60,
    position: 'absolute',
    width: 60,
  },
  markerPlate: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 248, 240, 0.92)',
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1.5,
    boxShadow: '0 6px 16px rgba(19, 22, 34, 0.24)',
    height: 48,
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 3,
    width: 48,
  },
  markerImage: {
    height: 40,
    width: 40,
  },
  formingDot: {
    borderRadius: 999,
    borderWidth: 2,
    height: 18,
    width: 18,
  },
  rareBadge: {
    backgroundColor: '#FFF3E5',
    borderRadius: 999,
    height: 9,
    position: 'absolute',
    right: 2,
    top: 2,
    width: 9,
  },
});
