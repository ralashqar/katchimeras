import { useIsFocused } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import type { ActivityPermissionState } from '@/types/home';
import { toLocalDateId } from '@/game/days/date';

export type DayStepCountReading = {
  stepsCount: number;
  dayId: string;
  observedAt: string;
};

type UseDayStepCaptureOptions = {
  enabled: boolean;
  requireFocus?: boolean;
  permissionState: ActivityPermissionState;
  onPermissionResolved: (permission: ActivityPermissionState) => void;
  onStepCount: (reading: DayStepCountReading) => void;
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
  const [localDayId, setLocalDayId] = useState(() => toLocalDateId(new Date()));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      setAppActive(nextState === 'active');
      if (nextState === 'active') {
        setLocalDayId(toLocalDateId(new Date()));
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setLocalDayId((current) => {
        const next = toLocalDateId(new Date());
        return next === current ? current : next;
      });
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (process.env.EXPO_OS === 'web' || !enabled || !appActive || (requireFocus && !isFocused)) {
      return;
    }

    let active = true;
    let watchSubscription: { remove: () => void } | null = null;
    let baselineSteps = 0;

    function getStartOfDay() {
      const start = new Date(`${localDayId}T00:00:00`);
      start.setHours(0, 0, 0, 0);
      return start;
    }

    function emitStepCount(stepsCount: number) {
      onStepCount({
        stepsCount: Math.max(0, stepsCount),
        dayId: localDayId,
        observedAt: new Date().toISOString(),
      });
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
          emitStepCount(baselineSteps);
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

        emitStepCount(baselineSteps + (result.steps ?? 0));
      });
    }

    void startWatching();

    return () => {
      active = false;
      watchSubscription?.remove();
    };
  }, [appActive, enabled, isFocused, localDayId, onPermissionResolved, onStepCount, permissionState, requireFocus]);
}
