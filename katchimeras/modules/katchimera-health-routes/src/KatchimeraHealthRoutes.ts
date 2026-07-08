import { requireOptionalNativeModule } from 'expo-modules-core';

type KatchimeraHealthRoutesModuleShape = {
  getHealthRouteAvailabilityAsync: () => Promise<unknown>;
  requestHealthRoutePermissionAsync: () => Promise<unknown>;
  importRoutesForDayAsync: (isoDate: string) => Promise<unknown>;
  // Total asleep minutes for the night that began the day (Sleep Atmosphere).
  getSleepForDayAsync: (isoDate: string) => Promise<{ available?: boolean; totalSleepMinutes?: number }>;
};

export default requireOptionalNativeModule<KatchimeraHealthRoutesModuleShape>('KatchimeraHealthRoutes');
