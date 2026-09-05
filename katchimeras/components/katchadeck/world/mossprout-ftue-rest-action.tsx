import { useEffect, useRef, useState } from 'react';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { MOSSPROUT_FTUE_COPY as COPY } from '@/features/onboarding/mossprout-ftue-copy';
import { useFtueDialoguePages } from '@/hooks/use-ftue-dialogue-pages';

export function MossproutFtueRestAction({ onNarration, onRest }: {
  onNarration?: (text: string | null) => void; onRest?: () => void | Promise<void>;
}) {
  const dialogue = useFtueDialoguePages(COPY.farewell);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef(false);
  useEffect(() => { onNarration?.(dialogue.text); return () => onNarration?.(null); }, [dialogue.text, onNarration]);
  return <KatchaButton label={error ? 'Try again' : dialogue.hasNext ? 'Continue' : COPY.restAction} disabled={busy} onPress={() => {
    if (pending.current) return;
    if (dialogue.hasNext) { dialogue.next(); return; }
    pending.current = true; setBusy(true); setError(false);
    void Promise.resolve().then(() => onRest?.()).catch(() => setError(true)).finally(() => { pending.current = false; setBusy(false); });
  }} />;
}
