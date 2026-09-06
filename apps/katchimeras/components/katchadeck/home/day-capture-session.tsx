import { useCallback, useEffect, useMemo, useRef } from 'react';
import { usePathname } from 'expo-router';

import { useDayLocationCapture } from '@/hooks/use-day-location-capture';
import { useDayStepCapture } from '@/hooks/use-day-step-capture';
import { useHomeScreenState } from '@/hooks/use-home-screen-state';
import { useRecentPhotoMapSeeding } from '@/hooks/use-recent-photo-map-seeding';
import { usePassiveCaptureGates } from '@/hooks/use-passive-capture-gates';
import { useAppActivity } from '@/features/performance/app-activity';

// App-session capture for today's passive evidence. This deliberately uses
// foreground/app-active capture only; no background location tracking.
export function DayCaptureSession() {
  const pathname = usePathname();
  const captureActive = pathname === '/today';
  const { criticalInteractionActive, gameActive } = useAppActivity();
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
  const criticalInteractionRef = useRef(criticalInteractionActive);
  const pendingLocationRef = useRef<Parameters<typeof addForegroundLocationSample>[0] | null>(null);
  const pendingStepRef = useRef<Parameters<typeof setTodayStepCount>[0] | null>(null);
  const pendingPhotosRef = useRef<Parameters<typeof seedRecentPhotoLocations>[0] | null>(null);
  criticalInteractionRef.current = criticalInteractionActive;

  const handleLocationSample = useCallback((sample: Parameters<typeof addForegroundLocationSample>[0]) => {
    if (criticalInteractionRef.current) {
      pendingLocationRef.current = sample;
      return;
    }
    addForegroundLocationSample(sample);
  }, [addForegroundLocationSample]);
  const handleStepCount = useCallback((reading: Parameters<typeof setTodayStepCount>[0]) => {
    if (criticalInteractionRef.current) {
      pendingStepRef.current = reading;
      return;
    }
    setTodayStepCount(reading);
  }, [setTodayStepCount]);
  const handlePhotoSeed = useCallback((photos: Parameters<typeof seedRecentPhotoLocations>[0]) => {
    if (criticalInteractionRef.current) {
      pendingPhotosRef.current = photos;
      return;
    }
    seedRecentPhotoLocations(photos);
  }, [seedRecentPhotoLocations]);

  useEffect(() => {
    if (!captureActive || criticalInteractionActive || gameActive) return;
    const timer = setTimeout(() => {
      const location = pendingLocationRef.current;
      const steps = pendingStepRef.current;
      const photos = pendingPhotosRef.current;
      pendingLocationRef.current = null;
      pendingStepRef.current = null;
      pendingPhotosRef.current = null;
      if (location) addForegroundLocationSample(location);
      if (steps) setTodayStepCount(steps);
      if (photos) seedRecentPhotoLocations(photos);
    }, 500);
    return () => clearTimeout(timer);
  }, [addForegroundLocationSample, captureActive, criticalInteractionActive, gameActive, seedRecentPhotoLocations, setTodayStepCount]);

  const today = useMemo(
    () => timelineDays.find((day) => day.kind === 'day' && day.isToday) ?? null,
    [timelineDays]
  );
  const todayId = today?.kind === 'day' ? today.id : null;
  const captureGates = usePassiveCaptureGates({
    active: captureActive,
    blocked: criticalInteractionActive || gameActive,
    dayId: todayId,
  });

  useDayLocationCapture({
    enabled: captureGates.captureEnabled,
    requestKey: captureGates.locationRequestKey,
    onPermissionResolved: setLocationPermission,
    onSample: handleLocationSample,
    permissionState: locationPermission,
  });

  useDayStepCapture({
    enabled: captureGates.captureEnabled,
    requestKey: captureGates.stepRequestKey,
    onPermissionResolved: setActivityPermission,
    onStepCount: handleStepCount,
    permissionState: activityPermission,
  });

  useRecentPhotoMapSeeding({
    dayId: todayId ? `seed-${new Date().toISOString().slice(0, 10)}` : null,
    enabled: captureGates.captureEnabled,
    onSeed: handlePhotoSeed,
    requestKey: captureGates.photoRequestKey,
  });

  return null;
}
