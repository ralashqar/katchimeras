import { requireOptionalNativeModule } from 'expo-modules-core';
import type { PhotoVisionResult } from '@/types/home';

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
    noteSchemaVersion?: unknown;
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
    container?: unknown;
    confidence?: unknown;
    alternatives?: unknown;
    supportingSubjects?: unknown;
    promptVersion?: unknown;
  }>;
  readMemoryV2Async?: (
    tags: string[],
    ocrLines: string[],
    faceCount: number,
    spatialCandidates: string[]
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
    container?: unknown;
    confidence?: unknown;
    alternatives?: unknown;
    supportingSubjects?: unknown;
    promptVersion?: unknown;
  }>;
};

export const FOUNDATION_MEMORY_PROMPT_VERSION = 1;
export const FOUNDATION_NOTE_SCHEMA_VERSION = 4;

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
      nativeFoundation?.readMemoryV2Async ||
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
  noteSchemaVersion?: number;
} {
  if (!nativeFoundation) return { available: false, reason: 'native_module_missing' };
  if (!nativeFoundation.readMemoryV2Async && !nativeFoundation.readMemoryAsync && !nativeFoundation.readSceneAsync && !nativeFoundation.classifySceneAsync) {
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
    const noteSchemaVersion = typeof info?.noteSchemaVersion === 'string' && /^\d+$/.test(info.noteSchemaVersion)
      ? Number(info.noteSchemaVersion)
      : undefined;
    if (info?.status === 'available') return { available: true, reason: 'available', locale, localeSupported, noteSchemaVersion };
    const knownReasons: FoundationUnavailableReason[] = [
      'apple_intelligence_not_enabled',
      'device_not_eligible',
      'model_not_ready',
      'ios_version_unsupported',
      'framework_not_linked',
      'unknown_unavailable_reason',
    ];
    if (typeof info?.reason === 'string' && knownReasons.includes(info.reason as FoundationUnavailableReason)) {
      return { available: false, reason: info.reason as FoundationUnavailableReason, locale, localeSupported, noteSchemaVersion };
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
  representationV2: string | null;
  container: string | null;
  confidence: number | null;
  alternatives: string[];
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
  _imageUri?: string | null,
  _rawVision?: PhotoVisionResult | null
): Promise<DeepSceneRead | null> {
  if (
    (!nativeFoundation?.readMemoryV2Async && !nativeFoundation?.readMemoryAsync && !nativeFoundation?.readSceneAsync) ||
    !(nativeFoundation.isAvailable?.() ?? false) ||
    (tags.length === 0 && ocrLines.length === 0)
  ) {
    return null;
  }
  try {
    if (nativeFoundation.readMemoryV2Async) {
      const memory = await nativeFoundation.readMemoryV2Async(
        tags.slice(0, 12),
        ocrLines.slice(0, 12),
        Math.max(0, Math.trunc(faceCount)),
        spatialCandidateDescriptions(_rawVision)
      );
      const structured = sceneFromMemoryResult(memory);
      if (structured) return structured;
    }
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
      representationV2: null,
      container: null,
      confidence: null,
      alternatives: [],
      supportingSubjects: [],
      promptVersion: null,
    };
  } catch {
    return null;
  }
}

function spatialCandidateDescriptions(raw: PhotoVisionResult | null | undefined): string[] {
  const candidates = (raw?.regionClassifications ?? []).map((item, index) => {
    const area = Math.max(0, item.region.width * item.region.height);
    const labels = [...item.labels]
      .sort((left, right) => right.confidence - left.confidence)
      .slice(0, 3)
      .map((label) => `${label.name} ${label.confidence.toFixed(2)}`)
      .join(', ');
    const centreX = item.region.x + item.region.width / 2;
    const centreY = item.region.y + item.region.height / 2;
    return `region ${index + 1}: ${labels}; coverage ${area.toFixed(2)}; centre ${centreX.toFixed(2)},${centreY.toFixed(2)}; saliency ${item.region.confidence.toFixed(2)}`;
  });
  return candidates.slice(0, 3);
}

function sceneFromMemoryResult(memory: {
  domain?: unknown;
  subject?: unknown;
  mediaKind?: unknown;
  title?: unknown;
  creator?: unknown;
  representation?: unknown;
  container?: unknown;
  confidence?: unknown;
  alternatives?: unknown;
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
    representation: legacyRepresentation(memory.representation),
    representationV2: cleanEnum(memory.representation, ['physical_scene', 'physical_artwork', 'physical_document', 'device_showing_content', 'native_digital_image', 'screenshot', 'unknown']),
    container: cleanEnum(memory.container, ['none', 'book', 'screen', 'frame_or_canvas', 'poster_or_print', 'document', 'packaging', 'unknown']),
    confidence: Number.isFinite(Number(memory.confidence)) ? Math.min(1, Math.max(0, Number(memory.confidence))) : null,
    alternatives: typeof memory.alternatives === 'string' ? memory.alternatives.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 3) : [],
    supportingSubjects: typeof memory.supportingSubjects === 'string'
      ? memory.supportingSubjects.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 4)
      : [],
    promptVersion: cleanText(memory.promptVersion, 48),
  };
}

function cleanEnum(value: unknown, allowed: string[]): string | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return allowed.includes(normalized) ? normalized : null;
}

function legacyRepresentation(value: unknown): DeepSceneRead['representation'] {
  const normalized = String(value);
  if (normalized === 'physical_scene' || normalized === 'physical_artwork' || normalized === 'physical_document') return 'real_world';
  if (normalized === 'device_showing_content' || normalized === 'native_digital_image' || normalized === 'screenshot') return 'screen_content';
  return normalized === 'real_world' || normalized === 'screen_content' || normalized === 'unknown'
    ? normalized as DeepSceneRead['representation']
    : null;
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
