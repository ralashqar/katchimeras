import { useMemo } from 'react';

import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { GUARDIAN_CONTINUE, GUARDIAN_LINES, GUARDIAN_TITLE } from '@/features/onboarding/last-clearing';
import type { ConversationTranscriptEntry } from '@/types/companion-conversation';
import { ConversationNarrativeOverlay } from './conversation-narrative-overlay';

/**
 * The guardian (`docs/cozy-4x-ftue-the-last-clearing.md`, beat 2): Mossprout, who has held the last lit clearing on
 * its own, meets the Wayfinder. The lines arrive one at a time (a tap hurries them); the last brings the button
 * that stands with Mossprout, into the first battle.
 */
export function LastClearingGuardian({ onContinue }: { onContinue: () => void }) {
  const entries = useMemo((): ConversationTranscriptEntry[] => GUARDIAN_LINES.map((text, index) => ({ id: `guardian:${index}`, speaker: 'mossprout', text })), []);
  return <ConversationNarrativeOverlay title={GUARDIAN_TITLE} entries={entries} checkpoint="guardian" required paced onClose={() => undefined}>
    {(perform) => <KatchaButton fullWidth glow pill label={GUARDIAN_CONTINUE} onPress={() => perform(onContinue, true)} />}
  </ConversationNarrativeOverlay>;
}
