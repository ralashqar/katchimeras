import { requireOptionalNativeModule } from 'expo-modules-core';

type KatchimeraVisionModuleShape = {
  analyzePhotoAsync: (uri: string) => Promise<{
    labels?: { name?: unknown; confidence?: unknown }[];
    text?: unknown[];
    faceCount?: unknown;
    regionClassifications?: {
      region?: { x?: unknown; y?: unknown; width?: unknown; height?: unknown; confidence?: unknown };
      labels?: { name?: unknown; confidence?: unknown }[];
    }[];
  }>;
};

export default requireOptionalNativeModule<KatchimeraVisionModuleShape>('KatchimeraVision');
