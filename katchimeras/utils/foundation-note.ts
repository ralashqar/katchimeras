import { requireOptionalNativeModule } from 'expo-modules-core';

import { type NoteArchetype } from '@/utils/note-meaning';

// On-device interpretation of a voice-note transcript via Apple Foundation Models
// (modules/katchimera-foundation). Present only on iOS 26+ Apple-Intelligence
// devices; null everywhere else, so callers fall back to the cloud / rules. The
// transcript text never leaves the device.
type FoundationNoteModule = {
  isAvailable: () => boolean;
  interpretNoteAsync: (transcript: string) => Promise<{ label?: unknown; archetype?: unknown }>;
};

const nativeFoundation = requireOptionalNativeModule<FoundationNoteModule>('KatchimeraFoundation');

const VALID_ARCHETYPES: NoteArchetype[] = ['calm', 'energy', 'together', 'meaningful'];
const TIMEOUT_MS = 2500;

export function isFoundationNoteAvailable(): boolean {
  try {
    return nativeFoundation?.isAvailable() === true;
  } catch {
    return false;
  }
}

// Ask the on-device model for a title + feeling. Returns null (fast) when
// unavailable, on timeout, or on any malformed result — the caller then falls
// back to the cloud interpreter / rules.
export async function interpretNoteOnDevice(
  transcript: string
): Promise<{ archetype: NoteArchetype; label: string } | null> {
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
    return { archetype: archetype as NoteArchetype, label };
  } catch {
    return null;
  }
}
