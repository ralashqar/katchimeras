import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';
import {
  photoPlaceRepository,
  type PhotoPlaceSettings,
} from '@/storage/repositories/photo-place-repository';
import {
  runPhotoPlaceBackfill,
  type PhotoPlaceBackfillProgress,
} from '@/utils/photo-place-backfill';

export default function LocationPrivacyScreen() {
  const [settings, setSettings] = useState<PhotoPlaceSettings>({
    enabled: true,
    historicalBackfillEnabled: false,
  });
  const [counts, setCounts] = useState({ resolutions: 0, personalPlaces: 0 });
  const [progress, setProgress] = useState<PhotoPlaceBackfillProgress | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const refresh = async () => {
    const [nextSettings, resolutions, clusters] = await Promise.all([
      photoPlaceRepository.settings(),
      photoPlaceRepository.resolutions(),
      photoPlaceRepository.clusters(),
    ]);
    setSettings(nextSettings);
    setCounts({ resolutions: resolutions.length, personalPlaces: clusters.length });
  };

  useEffect(() => {
    void refresh();
    return () => controllerRef.current?.abort();
  }, []);

  const toggleEnabled = (enabled: boolean) => {
    setSettings((current) => ({ ...current, enabled }));
    void photoPlaceRepository.updateSettings({ enabled });
  };

  const startBackfill = () => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setProgress({ scanned: 0, located: 0, resolved: 0, complete: false });
    void runPhotoPlaceBackfill({
      signal: controller.signal,
      onProgress: setProgress,
    }).finally(() => {
      controllerRef.current = null;
      void refresh();
    });
  };

  const clearData = () => {
    Alert.alert(
      'Delete saved photo places?',
      'This removes photo-place suggestions, corrections, Home and Work clusters from this device. Your photos are not deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void photoPlaceRepository.clearPrivateData().then(refresh);
          },
        },
      ]
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Photo places', headerLargeTitle: true }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ gap: 18, padding: 18, paddingBottom: 44 }}>
        <View style={{ gap: 6 }}>
          <ThemedText type="subtitle">Location from photos</ThemedText>
          <ThemedText style={{ lineHeight: 21, opacity: 0.72 }}>
            Katchimeras can use a photo&apos;s own location, nearby Apple Maps places, and its on-device
            visual read to suggest where it was taken. Precise coordinates stay on this device.
          </ThemedText>
        </View>

        <View style={{ backgroundColor: 'rgba(245,142,60,0.08)', borderCurve: 'continuous', borderRadius: 18, gap: 12, padding: 14 }}>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: 12 }}>
            <View style={{ alignItems: 'center', backgroundColor: 'rgba(245,142,60,0.14)', borderRadius: 12, height: 40, justifyContent: 'center', width: 40 }}>
              <IconSymbol name="mappin.and.ellipse" color={Lantern.ember500} size={19} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <ThemedText style={{ fontSize: 15, fontWeight: '900' }}>Use photo places</ThemedText>
              <ThemedText style={{ fontSize: 12, lineHeight: 17, opacity: 0.65 }}>
                Shapes memories, eligible quests, and hatch possibilities.
              </ThemedText>
            </View>
            <Switch value={settings.enabled} onValueChange={toggleEnabled} />
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <ThemedText type="subtitle">Older photos</ThemedText>
          <ThemedText style={{ lineHeight: 20, opacity: 0.7 }}>
            Scan up to 500 recent library photos in small, cancellable batches. Photos without a geotag
            are skipped, and a suggestion is never treated as confirmed.
          </ThemedText>
          {progress ? (
            <ThemedText selectable style={{ fontVariant: ['tabular-nums'], fontWeight: '800' }}>
              {progress.scanned} scanned · {progress.located} geotagged · {progress.resolved} resolved
            </ThemedText>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={!settings.enabled}
            onPress={controllerRef.current ? () => controllerRef.current?.abort() : startBackfill}
            style={({ pressed }) => ({
              alignItems: 'center',
              backgroundColor: Lantern.ember500,
              borderRadius: 16,
              justifyContent: 'center',
              minHeight: 52,
              opacity: !settings.enabled ? 0.4 : pressed ? 0.72 : 1,
            })}>
            <ThemedText style={{ color: '#21152B', fontWeight: '900' }}>
              {controllerRef.current ? 'Stop scan' : 'Find places in older photos'}
            </ThemedText>
          </Pressable>
        </View>

        <View style={{ gap: 8 }}>
          <ThemedText selectable style={{ opacity: 0.65 }}>
            {counts.resolutions} photo resolutions · {counts.personalPlaces} personal places stored locally
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={clearData}
            style={{ alignItems: 'center', borderColor: 'rgba(220,70,70,0.28)', borderRadius: 15, borderWidth: 1, justifyContent: 'center', minHeight: 50 }}>
            <ThemedText style={{ color: '#C94F4F', fontWeight: '900' }}>Delete saved photo places</ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}
