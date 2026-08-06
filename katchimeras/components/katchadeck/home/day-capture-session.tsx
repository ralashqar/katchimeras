import { useMemo } from 'react';

import { useDayLocationCapture } from '@/hooks/use-day-location-capture';
import { useDayStepCapture } from '@/hooks/use-day-step-capture';
import { useHomeScreenState } from '@/hooks/use-home-screen-state';
import { useRecentPhotoMapSeeding } from '@/hooks/use-recent-photo-map-seeding';
import { useAppActivity } from '@/features/performance/app-activity';

// App-session capture for today's passive evidence. This deliberately uses
// foreground/app-active capture only; no background location tracking.
export function DayCaptureSession() {
  const { gameActive } = useAppActivity();
  const {
    activityPermission,
    addForegroundLocationSample,
    locationPermission,
    seedRecentPhotoLocations,
    setActivityPermission,
    setLocationPermission,
    setTodayStepCount,
    timelineDays,
  } = useHomeScreenState({ enableInteractiveServices: false });

  const today = useMemo(
    () => timelineDays.find((day) => day.kind === 'day' && day.isToday) ?? null,
    [timelineDays]
  );
  const todayId = today?.kind === 'day' ? today.id : null;

  useDayLocationCapture({
    enabled: !!todayId && !gameActive,
    requireFocus: false,
    onPermissionResolved: setLocationPermission,
    onSample: addForegroundLocationSample,
    permissionState: locationPermission,
  });

  useDayStepCapture({
    enabled: !!todayId && !gameActive,
    requireFocus: false,
    onPermissionResolved: setActivityPermission,
    onStepCount: setTodayStepCount,
    permissionState: activityPermission,
  });

  useRecentPhotoMapSeeding({
    dayId: todayId ? `seed-${new Date().toISOString().slice(0, 10)}` : null,
    enabled: !!todayId && !gameActive,
    onSeed: seedRecentPhotoLocations,
  });

  return null;
}
