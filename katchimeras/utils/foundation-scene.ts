import { requireOptionalNativeModule } from 'expo-modules-core';

// On-device hierarchical scene classification via Apple Foundation Models (iOS 26+,
// Apple-Intelligence devices). Given the photo's on-device vision tags it returns
// the single best top-level scene type + a specific subject phrase. Everything runs
// locally — the tags never leave the device. On any older device / unsupported
// state (or older app build without this native method) it returns null and the JS
// side falls back to the rule-based classifier.
type FoundationSceneModule = {
  isAvailable?: () => boolean;
  availabilityInfo?: () => {
    status?: unknown;
    reason?: unknown;
    locale?: unknown;
    localeSupported?: unknown;
  };
  classifySceneAsync?: (tags: string[], faceCount: number) => Promise<{ type?: unknown; subject?: unknown }>;
  // Deep read (newer builds): adds the media branch — when the photo is OF a
  // work (book cover, poster, album) the model identifies it from the OCR'd
  // text + its own knowledge of the work.
  readSceneAsync?: (
    tags: string[],
    ocrLines: string[],
    faceCount: number
  ) => Promise<{ type?: unknown; subject?: unknown; mediaKind?: unknown; title?: unknown; creator?: unknown }>;
  readMemoryAsync?: (
    tags: string[],
    ocrLines: string[],
    faceCount: number
  ) => Promise<{
    domain?: unknown;
    subject?: unknown;
    animalKind?: unknown;
    mediaKind?: unknown;
    title?: unknown;
    creator?: unknown;
    food?: unknown;
    activity?: unknown;
    representation?: unknown;
    supportingSubjects?: unknown;
    promptVersion?: unknown;
  }>;
};

export const FOUNDATION_MEMORY_PROMPT_VERSION = 1;

export type FoundationUnavailableReason =
  | 'native_module_missing'
  | 'scene_reader_missing'
  | 'apple_intelligence_not_enabled'
  | 'device_not_eligible'
  | 'model_not_ready'
  | 'ios_version_unsupported'
  | 'framework_not_linked'
  | 'unknown_unavailable_reason'
  | 'model_unavailable';

const nativeFoundation = requireOptionalNativeModule<FoundationSceneModule>('KatchimeraFoundation');

export function isFoundationSceneAvailable(): boolean {
  try {
    const hasSceneReader = !!(
      nativeFoundation?.readMemoryAsync ||
      nativeFoundation?.readSceneAsync ||
      nativeFoundation?.classifySceneAsync
    );
    return hasSceneReader && (nativeFoundation?.isAvailable?.() ?? false);
  } catch {
    return false;
  }
}

export function foundationSceneAvailability(): {
  available: boolean;
  reason: 'available' | FoundationUnavailableReason;
  locale?: string;
  localeSupported?: boolean;
} {
  if (!nativeFoundation) return { available: false, reason: 'native_module_missing' };
  if (!nativeFoundation.readMemoryAsync && !nativeFoundation.readSceneAsync && !nativeFoundation.classifySceneAsync) {
    return { available: false, reason: 'scene_reader_missing' };
  }
  try {
    const info = nativeFoundation.availabilityInfo?.();
    const locale = typeof info?.locale === 'string' ? info.locale : undefined;
    const localeSupported = info?.localeSupported === 'true'
      ? true
      : info?.localeSupported === 'false'
        ? false
        : undefined;
    if (info?.status === 'available') return { available: true, reason: 'available', locale, localeSupported };
    const knownReasons: FoundationUnavailableReason[] = [
      'apple_intelligence_not_enabled',
      'device_not_eligible',
      'model_not_ready',
      'ios_version_unsupported',
      'framework_not_linked',
      'unknown_unavailable_reason',
    ];
    if (typeof info?.reason === 'string' && knownReasons.includes(info.reason as FoundationUnavailableReason)) {
      return { available: false, reason: info.reason as FoundationUnavailableReason, locale, localeSupported };
    }
    return nativeFoundation.isAvailable?.()
      ? { available: true, reason: 'available' }
      : { available: false, reason: 'model_unavailable' };
  } catch {
    return { available: false, reason: 'model_unavailable' };
  }
}

export type DeepSceneRead = {
  memoryDomain: string | null;
  type: string;
  subject: string | null;
  mediaKind: string | null;
  title: string | null;
  creator: string | null;
  representation: 'real_world' | 'screen_content' | 'unknown' | null;
  supportingSubjects: string[];
  promptVersion: string | null;
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
  faceCount: number,
  _imageUri?: string | null
): Promise<DeepSceneRead | null> {
  if (
    (!nativeFoundation?.readMemoryAsync && !nativeFoundation?.readSceneAsync) ||
    !(nativeFoundation.isAvailable?.() ?? false) ||
    (tags.length === 0 && ocrLines.length === 0)
  ) {
    return null;
  }
  try {
    if (nativeFoundation.readMemoryAsync) {
      const memory = await nativeFoundation.readMemoryAsync(
        tags.slice(0, 12),
        ocrLines.slice(0, 12),
        Math.max(0, Math.trunc(faceCount))
      );
      const structured = sceneFromMemoryResult(memory);
      if (structured) return structured;
    }
    if (!nativeFoundation.readSceneAsync) return null;
    const result = await nativeFoundation.readSceneAsync(
      tags.slice(0, 12),
      ocrLines.slice(0, 12),
      Math.max(0, Math.trunc(faceCount))
    );
    const type = typeof result?.type === 'string' ? result.type.trim().toLowerCase() : '';
    if (!type) return null;
    const mediaKind = typeof result?.mediaKind === 'string' ? result.mediaKind.trim().toLowerCase() : '';
    return {
      memoryDomain: null,
      type,
      subject: cleanText(result?.subject, 60),
      mediaKind: mediaKind && mediaKind !== 'none' ? mediaKind : null,
      title: cleanText(result?.title, 60),
      creator: cleanText(result?.creator, 48),
      representation: null,
      supportingSubjects: [],
      promptVersion: null,
    };
  } catch {
    return null;
  }
}

function sceneFromMemoryResult(memory: {
  domain?: unknown;
  subject?: unknown;
  mediaKind?: unknown;
  title?: unknown;
  creator?: unknown;
  representation?: unknown;
  supportingSubjects?: unknown;
  promptVersion?: unknown;
} | null | undefined): DeepSceneRead | null {
  const domain = typeof memory?.domain === 'string' ? memory.domain.trim().toLowerCase() : '';
  const type = mapMemoryDomainToScene(domain);
  if (!type || !memory) return null;
  const mediaKind = typeof memory.mediaKind === 'string' ? memory.mediaKind.trim().toLowerCase() : '';
  return {
    memoryDomain: domain,
    type,
    subject: cleanText(memory.subject, 60),
    mediaKind: mediaKind && mediaKind !== 'none' ? mediaKind : null,
    title: cleanText(memory.title, 60),
    creator: cleanText(memory.creator, 48),
    representation: ['real_world', 'screen_content', 'unknown'].includes(String(memory.representation))
      ? String(memory.representation) as DeepSceneRead['representation']
      : null,
    supportingSubjects: typeof memory.supportingSubjects === 'string'
      ? memory.supportingSubjects.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 4)
      : [],
    promptVersion: cleanText(memory.promptVersion, 48),
  };
}

function mapMemoryDomainToScene(domain: string): string | null {
  switch (domain) {
    case 'animal': return 'pet';
    case 'people': return 'social';
    case 'movement':
    case 'work': return 'activity';
    case 'life_event': return 'social';
    case 'food':
    case 'media':
    case 'place':
    case 'nature':
    case 'other': return domain;
    default: return null;
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
