import { useEffect, useRef } from 'react';

import type { ActivityPermissionState } from '@/types/home';
import { toLocalDateId } from '@/game/days/date';

export type DayStepCountReading = {
  stepsCount: number;
  dayId: string;
  observedAt: string;
};

type UseDayStepCaptureOptions = {
  enabled: boolean;
  requestKey: number;
  permissionState: ActivityPermissionState;
  onPermissionResolved: (permission: ActivityPermissionState) => void;
  onStepCount: (reading: DayStepCountReading) => void;
};

export function useDayStepCapture({
  enabled,
  requestKey,
  permissionState,
  onPermissionResolved,
  onStepCount,
}: UseDayStepCaptureOptions) {
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
    const localDayId = toLocalDateId(new Date());

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
          emitStepCount(Math.max(0, result.steps ?? 0));
        }
      } catch {
        // The scheduler will retry after its step cooldown.
      }
    }

    void startWatching();

    return () => {
      active = false;
    };
  }, [enabled, onPermissionResolved, onStepCount, permissionState, requestKey]);
}
