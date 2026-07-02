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
  // Deep read (newer builds): adds the media branch — when the photo is OF a
  // work (book cover, poster, album) the model identifies it from the OCR'd
  // text + its own knowledge of the work.
  readSceneAsync?: (
    tags: string[],
    ocrLines: string[],
    faceCount: number
  ) => Promise<{ type?: unknown; subject?: unknown; mediaKind?: unknown; title?: unknown; creator?: unknown }>;
};

const nativeFoundation = requireOptionalNativeModule<FoundationSceneModule>('KatchimeraFoundation');

export function isFoundationSceneAvailable(): boolean {
  try {
    return !!nativeFoundation?.classifySceneAsync && (nativeFoundation.isAvailable?.() ?? false);
  } catch {
    return false;
  }
}

export type DeepSceneRead = {
  type: string;
  subject: string | null;
  mediaKind: string | null;
  title: string | null;
  creator: string | null;
};

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/^["'“”]+|["'“”]+$/g, '').trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

// The deep hierarchical read (media-aware). Null when the native method is
// missing (older build), the model is unavailable, or the call fails — the
// caller then tries the legacy classify, then the rule engine.
export async function readSceneOnDevice(
  tags: string[],
  ocrLines: string[],
  faceCount: number
): Promise<DeepSceneRead | null> {
  if (!nativeFoundation?.readSceneAsync || !(nativeFoundation.isAvailable?.() ?? false) || tags.length === 0) {
    return null;
  }
  try {
    const result = await nativeFoundation.readSceneAsync(
      tags.slice(0, 12),
      ocrLines.slice(0, 12),
      Math.max(0, Math.trunc(faceCount))
    );
    const type = typeof result?.type === 'string' ? result.type.trim().toLowerCase() : '';
    if (!type) return null;
    const mediaKind = typeof result?.mediaKind === 'string' ? result.mediaKind.trim().toLowerCase() : '';
    return {
      type,
      subject: cleanText(result?.subject, 60),
      mediaKind: mediaKind && mediaKind !== 'none' ? mediaKind : null,
      title: cleanText(result?.title, 60),
      creator: cleanText(result?.creator, 48),
    };
  } catch {
    return null;
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
