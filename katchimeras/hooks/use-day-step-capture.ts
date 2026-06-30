import { useIsFocused } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import type { ActivityPermissionState } from '@/types/home';

type UseDayStepCaptureOptions = {
  enabled: boolean;
  requireFocus?: boolean;
  permissionState: ActivityPermissionState;
  onPermissionResolved: (permission: ActivityPermissionState) => void;
  onStepCount: (stepsCount: number) => void;
};

export function useDayStepCapture({
  enabled,
  requireFocus = true,
  permissionState,
  onPermissionResolved,
  onStepCount,
}: UseDayStepCaptureOptions) {
  const isFocused = useIsFocused();
  const [appActive, setAppActive] = useState(() => AppState.currentState === 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      setAppActive(nextState === 'active');
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (process.env.EXPO_OS === 'web' || !enabled || !appActive || (requireFocus && !isFocused)) {
      return;
    }

    let active = true;
    let watchSubscription: { remove: () => void } | null = null;
    let baselineSteps = 0;

    function getStartOfDay() {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return start;
    }

    async function startWatching() {
      const Sensors = await import('expo-sensors');
      const { Pedometer } = Sensors;
      const available = await Pedometer.isAvailableAsync();

      if (!active) {
        return;
      }

      if (!available) {
        onPermissionResolved('unavailable');
        return;
      }

      const existingPermission = await Pedometer.getPermissionsAsync();
      if (!active) {
        return;
      }

      if (!existingPermission.granted) {
        if (permissionState === 'denied' || existingPermission.canAskAgain === false) {
          onPermissionResolved('denied');
          return;
        }

        const requestedPermission = await Pedometer.requestPermissionsAsync();
        if (!active) {
          return;
        }

        if (!requestedPermission.granted) {
          onPermissionResolved('denied');
          return;
        }
      }

      onPermissionResolved('granted');

      try {
        const result = await Pedometer.getStepCountAsync(getStartOfDay(), new Date());
        if (active) {
          baselineSteps = Math.max(0, result.steps ?? 0);
          onStepCount(baselineSteps);
        }
      } catch {
        baselineSteps = 0;
      }

      if (!active) {
        return;
      }

      watchSubscription = Pedometer.watchStepCount((result) => {
        if (!active) {
          return;
        }

        onStepCount(Math.max(0, baselineSteps + (result.steps ?? 0)));
      });
    }

    void startWatching();

    return () => {
      active = false;
      watchSubscription?.remove();
    };
  }, [appActive, enabled, isFocused, onPermissionResolved, onStepCount, permissionState, requireFocus]);
}
