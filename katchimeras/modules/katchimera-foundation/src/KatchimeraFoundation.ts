import { requireOptionalNativeModule } from 'expo-modules-core';

type KatchimeraFoundationModuleShape = {
  // True only on Apple-Intelligence devices running iOS 26+ with the on-device
  // model ready. False everywhere else, so JS falls back to the rule-based set.
  isAvailable: () => boolean;
  // tags = on-device vision labels; faceCount = detected faces. Returns up to
  // four { label, archetype } suggestions, or [] on any failure / unavailability.
  suggestMeaningsAsync: (
    tags: string[],
    faceCount: number
  ) => Promise<{ label?: unknown; archetype?: unknown }[]>;
};

export default requireOptionalNativeModule<KatchimeraFoundationModuleShape>('KatchimeraFoundation');
