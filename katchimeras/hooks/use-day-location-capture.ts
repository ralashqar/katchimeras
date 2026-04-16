import { useIsFocused } from '@react-navigation/native';
import { useEffect } from 'react';

import type { LocationPermissionState } from '@/types/home';

type UseDayLocationCaptureOptions = {
  enabled: boolean;
  permissionState: LocationPermissionState;
  onPermissionResolved: (permission: LocationPermissionState) => void;
  onSample: (sample: {
    lat: number;
    lng: number;
    capturedAt: string;
    accuracyMeters?: number;
  }) => void;
};

export function useDayLocationCapture({
  enabled,
  permissionState,
  onPermissionResolved,
  onSample,
}: UseDayLocationCaptureOptions) {
  const isFocused = useIsFocused();

  useEffect(() => {
    if (process.env.EXPO_OS === 'web' || !enabled || !isFocused) {
      return;
    }

    let active = true;
    let subscription: { remove: () => void } | null = null;

    async function startWatching() {
      const Location = await import('expo-location');
      const existingPermission = await Location.getForegroundPermissionsAsync();

      if (!active) {
        return;
      }

      if (existingPermission.granted) {
        onPermissionResolved('granted');
        await captureAndWatch(Location);
        return;
      }

      if (permissionState === 'denied' || existingPermission.canAskAgain === false) {
        onPermissionResolved('denied');
        return;
      }

      const requestedPermission = await Location.requestForegroundPermissionsAsync();
      if (!active) {
        return;
      }

      if (!requestedPermission.granted) {
        onPermissionResolved('denied');
        return;
      }

      onPermissionResolved('granted');
      await captureAndWatch(Location);
    }

    async function captureAndWatch(Location: typeof import('expo-location')) {
      try {
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (active) {
          onSample({
            lat: current.coords.latitude,
            lng: current.coords.longitude,
            capturedAt: new Date(current.timestamp).toISOString(),
            accuracyMeters: current.coords.accuracy ?? undefined,
          });
        }
      } catch {
        // Ignore single-shot failures and still try the foreground watcher.
      }

      if (!active) {
        return;
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 120,
          timeInterval: 180000,
          mayShowUserSettingsDialog: true,
        },
        (position) => {
          if (!active) {
            return;
          }

          onSample({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            capturedAt: new Date(position.timestamp).toISOString(),
            accuracyMeters: position.coords.accuracy ?? undefined,
          });
        }
      );
    }

    startWatching();

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [enabled, isFocused, onPermissionResolved, onSample, permissionState]);
}
