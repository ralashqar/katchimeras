import { ConversationNarrativeOverlay } from './conversation-narrative-overlay';
import type { ConversationTranscriptEntry } from '@/types/companion-conversation';
import { useEffect, useRef, useState } from 'react';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { MOSSPROUT_FTUE_COPY as COPY } from '@/features/onboarding/mossprout-ftue-copy';
import { useFtueDialoguePages } from '@/hooks/use-ftue-dialogue-pages';

export function MossproutFtueRestAction({ onNarration, onRest, history = [] }: {
  history?: readonly ConversationTranscriptEntry[];
  onNarration?: (text: string | null) => void; onRest?: () => void | Promise<void>;
}) {
  const dialogue = useFtueDialoguePages(COPY.farewell);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef(false);
  useEffect(() => { onNarration?.(history.length ? null : dialogue.text); return () => onNarration?.(null); }, [dialogue.text, history.length, onNarration]);
  if (history.length) return <ConversationNarrativeOverlay title="Mossprout" required onClose={() => undefined}
    entries={[...history, { id: 'first-rest:farewell', speaker: 'mossprout', text: COPY.farewell }]} checkpoint="first-rest"
    paced initiallyRevealedCount={history.length}>
    {(perform) => <KatchaButton fullWidth label={COPY.restAction} onPress={() => perform(() => onRest?.(), true)} />}
  </ConversationNarrativeOverlay>;
  return <KatchaButton label={error ? 'Try again' : dialogue.hasNext ? 'Continue' : COPY.restAction} disabled={busy} onPress={() => {
    if (pending.current) return;
    if (dialogue.hasNext) { dialogue.next(); return; }
    pending.current = true; setBusy(true); setError(false);
    void Promise.resolve().then(() => onRest?.()).catch(() => setError(true)).finally(() => { pending.current = false; setBusy(false); });
  }} />;
}
