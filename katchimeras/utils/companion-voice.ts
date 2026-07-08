import { requireOptionalNativeModule } from 'expo-modules-core';

// Companion voice layer (docs/katchimera-engagement-v1.md Slice 2). Turns a
// plain engagement line into the creature's OWN voice. Two tiers:
//   1. Apple Foundation Models (on-device iOS 26) rephrases the line in the
//      creature's persona — Slice 2, lands with the next native rebuild.
//   2. Fallback: the rule text unchanged (works today).
// The FM path NEVER decides content — it only rephrases a line whose facts are
// already rule-owned, so a hallucination can't corrupt quest/insight state.

// Persona bible: creatureId → { persona, moods, bond }. Same ids as the
// encounter registry (data/katchimeras/creature-personas.json).
const PERSONAS: Record<string, { persona: string; moods?: Record<string, string> }> = require('../data/katchimeras/creature-personas.json');

// The native method is added to the module with the next rebuild; until then
// `companionLineAsync` is undefined and we fall straight through to the rule
// text. `isAvailable` already exists (gates the whole module).
type FoundationVoiceModule = {
  isAvailable: () => boolean;
  companionLineAsync?: (persona: string, thread: string, dataSummary: string, baseLine: string) => Promise<{ line?: unknown }>;
};

const nativeFoundation = requireOptionalNativeModule<FoundationVoiceModule>('KatchimeraFoundation');
const TIMEOUT_MS = 2500;

export type CompanionThreadKind = 'opening' | 'quest' | 'insight' | 'reflection';

export function personaFor(creatureId: string): string | null {
  return PERSONAS[creatureId]?.persona ?? null;
}

export function isCompanionVoiceAvailable(): boolean {
  try {
    return nativeFoundation?.isAvailable() === true && typeof nativeFoundation.companionLineAsync === 'function';
  } catch {
    return false;
  }
}

/**
 * Voice a base line in the creature's persona. Resolves to the FM-rephrased
 * line when available, else the base line verbatim. Always resolves (never
 * throws) so callers can `const line = await voiceLine(...) ?? baseLine`.
 */
export async function voiceLine(
  creatureId: string,
  thread: CompanionThreadKind,
  baseLine: string,
  dataSummary = ''
): Promise<string> {
  const persona = personaFor(creatureId);
  if (!persona || !isCompanionVoiceAvailable() || !nativeFoundation?.companionLineAsync) return baseLine;
  try {
    const result = await Promise.race([
      nativeFoundation.companionLineAsync(persona, thread, dataSummary, baseLine),
      new Promise<{ line?: unknown }>((resolve) => setTimeout(() => resolve({}), TIMEOUT_MS)),
    ]);
    const line = typeof result.line === 'string' ? result.line.trim() : '';
    return line.length > 0 ? line : baseLine;
  } catch {
    return baseLine;
  }
}
