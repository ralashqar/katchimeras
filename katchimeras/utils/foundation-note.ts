import { requireOptionalNativeModule } from 'expo-modules-core';

import { type NoteArchetype } from '@/utils/note-meaning';
import type { StudioMediaType } from '@/types/home';

// On-device interpretation of a note (typed or voice transcript) via Apple
// Foundation Models (modules/katchimera-foundation). Present only on iOS 26+
// Apple-Intelligence devices; null everywhere else, so callers fall back to
// the cloud / rules. The text never leaves the device.
//
// One call returns the note's title + feeling AND its classification: whether
// it mentions a work of media (with the real, correctly-capitalized title from
// the model's world knowledge) and whether it's about food. `llmClassified`
// is true only when the classification fields were present — an OLD native
// build returns just {label, archetype}, and the caller then falls back to
// the deterministic regex classifier.
type FoundationNoteModule = {
  isAvailable: () => boolean;
  interpretNoteAsync: (transcript: string) => Promise<{
    label?: unknown;
    archetype?: unknown;
    mediaKind?: unknown;
    mediaTitle?: unknown;
    mediaCreator?: unknown;
    food?: unknown;
  }>;
};

const nativeFoundation = requireOptionalNativeModule<FoundationNoteModule>('KatchimeraFoundation');

const VALID_ARCHETYPES: NoteArchetype[] = ['calm', 'energy', 'together', 'meaningful'];
const VALID_MEDIA_KINDS: StudioMediaType[] = ['book', 'film', 'show', 'game', 'music', 'art', 'other'];
const TIMEOUT_MS = 2500;

export type OnDeviceNoteRead = {
  archetype: NoteArchetype;
  label: string;
  // Present (possibly null) ONLY when llmClassified — null means "the model
  // says this note is not about a media work".
  media: { mediaType: StudioMediaType; title: string | null; creator: string | null } | null;
  // The dish/drink phrase when the note is about food, else null.
  food: string | null;
  // The model actually classified this note (new native build responded with
  // the classification fields). When false, callers use the rule fallback.
  llmClassified: boolean;
};

export function isFoundationNoteAvailable(): boolean {
  try {
    return nativeFoundation?.isAvailable() === true;
  } catch {
    return false;
  }
}

function cleanShort(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length > 0 && text.length <= max ? text : null;
}

// Ask the on-device model for a title + feeling + classification. Returns null
// (fast) when unavailable, on timeout, or on any malformed result — the caller
// then falls back to the cloud interpreter / rules.
export async function interpretNoteOnDevice(transcript: string): Promise<OnDeviceNoteRead | null> {
  const text = transcript.trim();
  if (!nativeFoundation?.interpretNoteAsync || !isFoundationNoteAvailable() || !text) {
    return null;
  }
  try {
    const raw = await Promise.race([
      nativeFoundation.interpretNoteAsync(text),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);
    if (!raw) return null;
    const label = typeof raw.label === 'string' ? raw.label.trim() : '';
    const archetype = typeof raw.archetype === 'string' ? raw.archetype.trim().toLowerCase() : '';
    if (!label || label.length > 40 || !VALID_ARCHETYPES.includes(archetype as NoteArchetype)) {
      return null;
    }

    // Classification: only trust it when the new-build fields are present AND
    // mediaKind is a value we know ('none' = classified as not-media).
    const mediaKind = typeof raw.mediaKind === 'string' ? raw.mediaKind.trim().toLowerCase() : null;
    const llmClassified = mediaKind === 'none' || VALID_MEDIA_KINDS.includes(mediaKind as StudioMediaType);
    const media =
      llmClassified && mediaKind !== 'none'
        ? {
            mediaType: mediaKind as StudioMediaType,
            title: cleanShort(raw.mediaTitle, 80),
            creator: cleanShort(raw.mediaCreator, 60),
          }
        : null;
    const food = llmClassified ? cleanShort(raw.food, 60) : null;

    return { archetype: archetype as NoteArchetype, label, media, food, llmClassified };
  } catch {
    return null;
  }
}
