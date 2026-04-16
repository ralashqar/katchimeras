import { requireOptionalNativeModule } from 'expo-modules-core';

type KatchimeraHealthRoutesModuleShape = {
  getHealthRouteAvailabilityAsync: () => Promise<unknown>;
  requestHealthRoutePermissionAsync: () => Promise<unknown>;
  importRoutesForDayAsync: (isoDate: string) => Promise<unknown>;
};

export default requireOptionalNativeModule<KatchimeraHealthRoutesModuleShape>('KatchimeraHealthRoutes');
