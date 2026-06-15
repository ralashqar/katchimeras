import { requireOptionalNativeModule } from 'expo-modules-core';

import type { PhotoVisionResult } from '@/types/home';

// JS bridge to the on-device Apple Vision module (modules/katchimera-vision).
// `requireOptionalNativeModule` returns null when the native module isn't in
// the build (Expo Go, or before the dev client is rebuilt), so every caller
// degrades gracefully to "no vision signal" and the app keeps working — exactly
// how the media-library and health-route modules are accessed.

type VisionNativeModule = {
  analyzePhotoAsync: (uri: string) => Promise<{
    labels?: { name?: unknown; confidence?: unknown }[];
    text?: unknown[];
    faceCount?: unknown;
  }>;
};

const nativeVision = requireOptionalNativeModule<VisionNativeModule>('KatchimeraVision');

export function isVisionAvailable(): boolean {
  return nativeVision != null;
}

// Best-effort: returns the on-device read of one photo, or null if the module
// is absent or the frame can't be analysed. `uri` should be a decodable local
// file path (info.localUri), not a ph:// asset reference.
export async function analyzePhoto(uri: string): Promise<PhotoVisionResult | null> {
  if (!nativeVision) {
    return null;
  }

  try {
    const raw = await nativeVision.analyzePhotoAsync(uri);
    return {
      labels: (raw.labels ?? [])
        .map((label) => ({
          name: typeof label?.name === 'string' ? label.name : '',
          confidence: Number(label?.confidence) || 0,
        }))
        .filter((label) => label.name.length > 0),
      text: (raw.text ?? []).map((token) => String(token)).filter((token) => token.length > 0),
      faceCount: Number(raw.faceCount) || 0,
    };
  } catch {
    return null;
  }
}
