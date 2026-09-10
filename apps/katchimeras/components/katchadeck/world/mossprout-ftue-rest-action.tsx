import { ConversationNarrativeOverlay } from './conversation-narrative-overlay';
import type { ConversationTranscriptEntry } from '@/types/companion-conversation';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { MOSSPROUT_FTUE_COPY as COPY } from '@/features/onboarding/mossprout-ftue-copy';
import { useFtueDialoguePages } from '@/hooks/use-ftue-dialogue-pages';
import {
  getCompanionNotificationAccess,
  requestCompanionNotificationAccess,
  type CompanionNotificationAccess,
} from '@/utils/companion-notification-permission';

const WAKE_ASK_ENTRY: ConversationTranscriptEntry = { id: 'first-rest:wake-ask', speaker: 'mossprout', text: COPY.wakeAsk };

/**
 * The farewell, then one question before the rest begins: may Mossprout wake
 * the player when he returns? The system prompt only appears after "Wake me",
 * so the reason for the notification is spoken in voice before it is asked.
 * Players who already decided (either way) go straight to rest; both answers
 * begin the same rest, and the reminder scheduler reads the OS decision.
 */
export function MossproutFtueRestAction({ onNarration, onRest, history = [] }: {
  history?: readonly ConversationTranscriptEntry[];
  onNarration?: (text: string | null) => void; onRest?: () => void | Promise<void>;
}) {
  const dialogue = useFtueDialoguePages(COPY.farewell);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef(false);
  const access = useRef<Promise<CompanionNotificationAccess> | null>(null);
  const resolveAccess = () => (access.current ??= getCompanionNotificationAccess().catch(() => 'unsupported' as const));
  // Warm the permission read so the Rest tap does not wait on it.
  useEffect(() => { void resolveAccess(); }, []);
  const narration = asking ? COPY.wakeAsk : dialogue.text;
  useEffect(() => { onNarration?.(history.length ? null : narration); return () => onNarration?.(null); }, [history.length, narration, onNarration]);

  /** Returns true when the wake question must be shown before resting. */
  const needsWakeAsk = async () => !asking && (await resolveAccess()) === 'should_request';
  const restAfterWakeAnswer = async (allow: boolean) => {
    if (allow) await requestCompanionNotificationAccess().catch(() => false);
    await onRest?.();
  };

  if (history.length) return <ConversationNarrativeOverlay title="Mossprout" required onClose={() => undefined}
    entries={[...history, { id: 'first-rest:farewell', speaker: 'mossprout', text: COPY.farewell }, ...(asking ? [WAKE_ASK_ENTRY] : [])]} checkpoint="first-rest"
    paced initiallyRevealedCount={history.length}>
    {(perform) => asking
      ? <View style={{ gap: 10 }}>
        <KatchaButton fullWidth label={COPY.wakeAllow} onPress={() => perform(() => restAfterWakeAnswer(true), true)} />
        <KatchaButton fullWidth label={COPY.wakeDecline} variant="secondary" onPress={() => perform(() => restAfterWakeAnswer(false), true)} />
      </View>
      : <KatchaButton fullWidth label={COPY.restAction} onPress={() => {
        void needsWakeAsk().then((ask) => { if (ask) setAsking(true); else perform(() => onRest?.(), true); });
      }} />}
  </ConversationNarrativeOverlay>;

  const run = (action: () => void | Promise<void>) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(false);
    void Promise.resolve().then(action).catch(() => setError(true)).finally(() => { pending.current = false; setBusy(false); });
  };
  if (asking) return <View style={{ gap: 10 }}>
    <KatchaButton label={error ? 'Try again' : COPY.wakeAllow} disabled={busy} onPress={() => run(() => restAfterWakeAnswer(true))} />
    <KatchaButton label={COPY.wakeDecline} variant="secondary" disabled={busy} onPress={() => run(() => restAfterWakeAnswer(false))} />
  </View>;
  return <KatchaButton label={error ? 'Try again' : dialogue.hasNext ? 'Continue' : COPY.restAction} disabled={busy} onPress={() => {
    if (pending.current) return;
    if (dialogue.hasNext) { dialogue.next(); return; }
    run(async () => {
      if (await needsWakeAsk()) { setAsking(true); return; }
      await onRest?.();
    });
  }} />;
}
