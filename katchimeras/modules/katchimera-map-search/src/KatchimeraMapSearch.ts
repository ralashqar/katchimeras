import { requireOptionalNativeModule } from 'expo-modules-core';

export type NativeApplePlace = {
  id: string;
  name: string;
  address?: string | null;
  category?: string | null;
  latitude: number;
  longitude: number;
  distanceMeters?: number | null;
  rank?: number;
};

type KatchimeraMapSearchModuleShape = {
  isAvailable: () => boolean;
  searchAsync: (
    query: string,
    latitude: number | null,
    longitude: number | null,
    radiusMeters: number
  ) => Promise<NativeApplePlace[]>;
};

export default requireOptionalNativeModule<KatchimeraMapSearchModuleShape>('KatchimeraMapSearch');
