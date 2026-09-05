import { useEffect, useRef } from 'react';

import type { LocationPermissionState } from '@/types/home';

type UseDayLocationCaptureOptions = {
  enabled: boolean;
  requestKey: number;
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
  requestKey,
  permissionState,
  onPermissionResolved,
  onSample,
}: UseDayLocationCaptureOptions) {
  const lastStartedRequestKeyRef = useRef(0);

  useEffect(() => {
    if (
      process.env.EXPO_OS === 'web' ||
      !enabled ||
      requestKey <= 0 ||
      lastStartedRequestKeyRef.current >= requestKey
    ) {
      return;
    }
    lastStartedRequestKeyRef.current = requestKey;

    let active = true;

    async function startWatching() {
      const Location = await import('expo-location');
      const existingPermission = await Location.getForegroundPermissionsAsync();

      if (!active) {
        return;
      }

      if (existingPermission.granted) {
        onPermissionResolved('granted');
        await captureOnce(Location);
        return;
      }

      if (permissionState === 'denied' || existingPermission.canAskAgain === false) {
        onPermissionResolved('denied');
        return;
      }
      // Permission is requested from onboarding or an explicit Places action.
      // Mounting the Today tab must never trigger a system prompt by itself.
    }

    async function captureOnce(Location: typeof import('expo-location')) {
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
        // The scheduler will retry after its location cooldown.
      }
    }

    startWatching();

    return () => {
      active = false;
    };
  }, [enabled, onPermissionResolved, onSample, permissionState, requestKey]);
}
