import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import type { HealthPermissionState } from '@/types/home';
import type { ImportedHealthRoutesPayload } from '@/utils/home-engine';

type NativeHealthRouteAvailability = {
  platformSupported?: boolean;
  permissionState?: string;
};

type NativeHealthRouteImportModule = {
  getHealthRouteAvailabilityAsync: () => Promise<NativeHealthRouteAvailability>;
  requestHealthRoutePermissionAsync: () => Promise<{ permissionState?: string }>;
  importRoutesForDayAsync: (isoDate: string) => Promise<ImportedHealthRoutesPayload>;
};

const nativeHealthRouteModule = requireOptionalNativeModule<NativeHealthRouteImportModule>('KatchimeraHealthRoutes');

export async function getHealthRouteAvailability() {
  if (Platform.OS !== 'ios' || !nativeHealthRouteModule) {
    return {
      platformSupported: false,
      permissionState: 'unavailable' as const,
    };
  }

  const result = await nativeHealthRouteModule.getHealthRouteAvailabilityAsync();
  return {
    platformSupported: result.platformSupported !== false,
    permissionState: normalizeHealthPermissionState(result.permissionState),
  };
}

export async function requestHealthRoutePermission(): Promise<HealthPermissionState> {
  if (Platform.OS !== 'ios' || !nativeHealthRouteModule) {
    return 'unavailable';
  }

  const result = await nativeHealthRouteModule.requestHealthRoutePermissionAsync();
  return normalizeHealthPermissionState(result.permissionState);
}

export async function importRoutesForDay(params: { isoDate: string }): Promise<ImportedHealthRoutesPayload> {
  if (Platform.OS !== 'ios' || !nativeHealthRouteModule) {
    return {
      status: 'unavailable',
      importedWorkoutCount: 0,
      sampledPointCount: 0,
      segmentCount: 0,
      workoutIds: [],
      message: 'Health route import is only available on iPhone builds with HealthKit enabled.',
    };
  }

  const result = await nativeHealthRouteModule.importRoutesForDayAsync(params.isoDate);
  return {
    ...result,
    status: normalizeImportStatus(result.status),
  };
}

function normalizeHealthPermissionState(value: string | undefined): HealthPermissionState {
  if (value === 'granted' || value === 'denied' || value === 'unavailable') {
    return value;
  }

  return 'unknown';
}

function normalizeImportStatus(value: ImportedHealthRoutesPayload['status'] | string | undefined) {
  if (
    value === 'success' ||
    value === 'no_data' ||
    value === 'denied' ||
    value === 'unavailable' ||
    value === 'error'
  ) {
    return value;
  }

  return 'error';
}
