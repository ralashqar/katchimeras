import { requireOptionalNativeModule } from 'expo-modules-core';

const PERSONAS: Record<string, { persona: string; moods?: Record<string, string> }> = require('../data/katchimeras/creature-personas.json');

type FoundationVoiceModule = {
  isAvailable: () => boolean;
  companionLineAsync?: (
    persona: string,
    thread: string,
    dataSummary: string,
    baseLine: string
  ) => Promise<{ line?: unknown }>;
};

const nativeFoundation = requireOptionalNativeModule<FoundationVoiceModule>('KatchimeraFoundation');
const TIMEOUT_MS = 2500;

export type CompanionThreadKind = 'opening' | 'quest' | 'insight' | 'reflection';

export function personaFor(creatureId: string): string | null {
  return PERSONAS[creatureId]?.persona ?? null;
}

export function isCompanionVoiceAvailable(): boolean {
  try {
    return nativeFoundation?.isAvailable() === true
      && typeof nativeFoundation.companionLineAsync === 'function';
  } catch {
    return false;
  }
}

/**
 * Rephrase rule-owned copy in the creature's persona when the optional local
 * Foundation module is available. Content and decisions remain rule-owned.
 */
export async function voiceLine(
  creatureId: string,
  thread: CompanionThreadKind,
  baseLine: string,
  dataSummary = ''
): Promise<string> {
  const persona = personaFor(creatureId);
  if (!persona || !isCompanionVoiceAvailable() || !nativeFoundation?.companionLineAsync) {
    return baseLine;
  }
  try {
    const result = await Promise.race([
      nativeFoundation.companionLineAsync(persona, thread, dataSummary, baseLine),
      new Promise<{ line?: unknown }>((resolve) =>
        setTimeout(() => resolve({}), TIMEOUT_MS)
      ),
    ]);
    const line = typeof result.line === 'string' ? result.line.trim() : '';
    return line.length > 0 ? line : baseLine;
  } catch {
    return baseLine;
  }
}
