import { requireOptionalNativeModule } from 'expo-modules-core';

import type { NativePlaceLookupResult } from './photo-place';

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
  resolveNearbyPlacesAsync: (
    latitude: number,
    longitude: number,
    radiusMeters: number
  ) => Promise<NativePlaceLookupResult>;
};

export default requireOptionalNativeModule<KatchimeraMapSearchModuleShape>('KatchimeraMapSearch');
