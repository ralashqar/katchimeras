import { useMemo } from 'react';

import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { GLOW } from '@/constants/glow';
import { HEART_TREE_LINES, HEART_TREE_RESTORE, HEART_TREE_TITLE } from '@/features/onboarding/last-clearing';
import type { ConversationTranscriptEntry } from '@/types/companion-conversation';
import { ConversationNarrativeOverlay } from './conversation-narrative-overlay';

/**
 * The Heart Tree (`docs/cozy-4x-ftue-the-last-clearing.md`, beat 8): with the camera on the grey Tree, Mossprout says
 * what it is and what the light could do; the last line brings the one button, which spends the first light on it.
 * The overlay steps aside as it is pressed, so the restoration plays over the open world.
 */
export function LastClearingHeartTree({ cost = GLOW.firstRestorationCost, onRestore }: { cost?: number; onRestore: () => void }) {
  const entries = useMemo((): ConversationTranscriptEntry[] => HEART_TREE_LINES.map((text, index) => ({ id: `heart-tree:${index}`, speaker: 'mossprout', text })), []);
  return <ConversationNarrativeOverlay title={HEART_TREE_TITLE} entries={entries} checkpoint="heart-tree" required paced onClose={() => undefined}>
    {(perform) => <KatchaButton fullWidth glow pill icon="sparkles" label={`${HEART_TREE_RESTORE} · ${cost} ${GLOW.name}`} onPress={() => perform(onRestore, true)} />}
  </ConversationNarrativeOverlay>;
}
