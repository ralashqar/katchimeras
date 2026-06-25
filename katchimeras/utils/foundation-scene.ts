import { requireOptionalNativeModule } from 'expo-modules-core';

// On-device hierarchical scene classification via Apple Foundation Models (iOS 26+,
// Apple-Intelligence devices). Given the photo's on-device vision tags it returns
// the single best top-level scene type + a specific subject phrase. Everything runs
// locally — the tags never leave the device. On any older device / unsupported
// state (or older app build without this native method) it returns null and the JS
// side falls back to the rule-based classifier.
type FoundationSceneModule = {
  isAvailable?: () => boolean;
  classifySceneAsync?: (tags: string[], faceCount: number) => Promise<{ type?: unknown; subject?: unknown }>;
};

const nativeFoundation = requireOptionalNativeModule<FoundationSceneModule>('KatchimeraFoundation');

export function isFoundationSceneAvailable(): boolean {
  try {
    return !!nativeFoundation?.classifySceneAsync && (nativeFoundation.isAvailable?.() ?? false);
  } catch {
    return false;
  }
}

export async function classifySceneOnDevice(
  tags: string[],
  faceCount: number
): Promise<{ type: string; subject: string | null } | null> {
  if (!nativeFoundation?.classifySceneAsync || !isFoundationSceneAvailable() || tags.length === 0) {
    return null;
  }
  try {
    const result = await nativeFoundation.classifySceneAsync(tags.slice(0, 12), Math.max(0, Math.trunc(faceCount)));
    const type = typeof result?.type === 'string' ? result.type.trim().toLowerCase() : '';
    if (!type) return null;
    const subject = typeof result?.subject === 'string' && result.subject.trim() ? result.subject.trim() : null;
    return { type, subject };
  } catch {
    return null;
  }
}
