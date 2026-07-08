import { requireOptionalNativeModule } from 'expo-modules-core';

type KatchimeraVisionModuleShape = {
  analyzePhotoAsync: (uri: string) => Promise<{
    labels?: { name?: unknown; confidence?: unknown }[];
    text?: unknown[];
    faceCount?: unknown;
  }>;
};

export default requireOptionalNativeModule<KatchimeraVisionModuleShape>('KatchimeraVision');
